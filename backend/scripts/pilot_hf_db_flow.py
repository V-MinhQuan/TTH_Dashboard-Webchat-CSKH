from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import re
import sys
import time
from pathlib import Path
from typing import Any, Iterable

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import Settings, get_settings  # noqa: E402
from app.db.session import get_connection, rows_to_dicts  # noqa: E402
from app.repositories.display_filters import valid_message_condition  # noqa: E402
from app.repositories.sentiment_repository import SentimentRepository  # noqa: E402
from app.services.customer_message_resolver import (  # noqa: E402
    resolve_customer_message_for_analysis,
)
from app.services.huggingface_sentiment_client import (  # noqa: E402
    HuggingFaceClientError,
    HuggingFaceSentimentClient,
)


ALLOWED_PILOT_ENVIRONMENTS = frozenset({"development", "test", "staging", "safe_clone"})
REQUIRED_QUEUE_COLUMNS = frozenset(
    {
        "analysisStatus",
        "analysisRetryCount",
        "analysisError",
        "analysisStartedAt",
        "analysisUpdatedAt",
        "sentimentSource",
        "analyzerVersion",
        "analyzedAt",
    }
)


class PilotSafetyError(RuntimeError):
    pass


def parse_message_ids(values: Iterable[str], *, max_records: int) -> list[int]:
    if max_records < 1 or max_records > 3:
        raise PilotSafetyError("max_records_must_be_between_1_and_3")

    result: list[int] = []
    for raw in values:
        for token in re.split(r"[\s,]+", str(raw or "").strip()):
            if not token:
                continue
            try:
                message_id = int(token)
            except ValueError:
                raise PilotSafetyError("invalid_message_id") from None
            if message_id <= 0:
                raise PilotSafetyError("message_id_must_be_positive")
            if message_id not in result:
                result.append(message_id)

    if not result:
        raise PilotSafetyError("explicit_message_ids_required")
    if len(result) > max_records or len(result) > 3:
        raise PilotSafetyError("at_most_3_message_ids_allowed")
    return result


def validate_pilot_safety(settings: Any) -> None:
    if bool(settings.hf_background_enabled):
        raise PilotSafetyError("background_must_be_disabled")

    app_env = str(settings.app_env or "").strip().lower()
    pilot_env = str(settings.hf_pilot_environment or "").strip().lower()
    if app_env not in ALLOWED_PILOT_ENVIRONMENTS or pilot_env not in ALLOWED_PILOT_ENVIRONMENTS:
        raise PilotSafetyError("unsafe_environment")
    if not bool(settings.hf_pilot_backup_verified):
        raise PilotSafetyError("backup_not_verified")
    if settings.hf_analysis_cutover_message_id is None:
        raise PilotSafetyError("cutover_not_configured")

    database_name = str(settings.db_name or "").strip().lower()
    if re.search(r"(^|[_-])(prod|production|live)([_-]|$)", database_name):
        raise PilotSafetyError("production_database_name")


def mask_message_id(message_id: int) -> str:
    digest = hashlib.sha256(str(int(message_id)).encode("ascii")).hexdigest()[:10]
    return f"msg_{digest}"


def _assert_schema_ready() -> None:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT c.name
            FROM sys.columns c
            WHERE c.object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics');
            """
        )
        columns = {str(row[0]) for row in cursor.fetchall()}
        cursor.execute(
            """
            SELECT COUNT_BIG(*)
            FROM sys.indexes i
            INNER JOIN sys.index_columns ic
              ON ic.object_id = i.object_id AND ic.index_id = i.index_id
            INNER JOIN sys.columns c
              ON c.object_id = ic.object_id AND c.column_id = ic.column_id
            WHERE i.object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics')
              AND i.is_unique = 1
              AND ic.key_ordinal = 1
              AND c.name = N'messageId'
              AND NOT EXISTS (
                  SELECT 1
                  FROM sys.index_columns extra
                  WHERE extra.object_id = i.object_id
                    AND extra.index_id = i.index_id
                    AND extra.key_ordinal > 1
              );
            """
        )
        has_unique_message_index = int(cursor.fetchone()[0] or 0) > 0
    missing = sorted(REQUIRED_QUEUE_COLUMNS - columns)
    if missing:
        raise PilotSafetyError("migration_not_applied")
    if not has_unique_message_index:
        raise PilotSafetyError("message_id_unique_index_missing")


def _load_candidates(message_ids: list[int], cutover_message_id: int) -> list[dict[str, Any]]:
    placeholders = ", ".join("?" for _ in message_ids)
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            f"""
            SELECT
                customer_message.id_webchat_messageLogs AS messageId,
                customer_message.TextContent AS CustomerText,
                customer_message.FromHost,
                conversation.Id AS conversationId,
                customer_message.Source AS channel,
                analytics.primaryTopicId,
                analytics.detectedTopics,
                customer_message.SentAt AS createdAt
            FROM dbo.WebChat_MessageLogs customer_message
            LEFT JOIN dbo.WebChat_MessageAnalytics analytics
              ON analytics.messageId = customer_message.id_webchat_messageLogs
            LEFT JOIN dbo.WebChat_Conversations conversation
              ON conversation.Source = customer_message.Source
             AND conversation.CustomerId = customer_message.SenderId
            WHERE customer_message.id_webchat_messageLogs IN ({placeholders})
              AND customer_message.id_webchat_messageLogs > ?
              AND customer_message.FromHost = 0
              AND customer_message.TextContent IS NOT NULL
              AND NULLIF(LTRIM(RTRIM(customer_message.TextContent)), '') IS NOT NULL
              AND {valid_message_condition("customer_message")}
            ORDER BY customer_message.id_webchat_messageLogs;
            """,
            (*message_ids, int(cutover_message_id)),
        )
        rows = rows_to_dicts(cursor)
        cursor.execute(
            f"""
            SELECT messageId
            FROM dbo.WebChat_MessageAnalytics
            WHERE messageId IN ({placeholders});
            """,
            tuple(message_ids),
        )
        existing = rows_to_dicts(cursor)

    if existing:
        raise PilotSafetyError("analysis_row_already_exists")
    if {int(row["messageId"]) for row in rows} != set(message_ids):
        raise PilotSafetyError("message_not_eligible_customer_input")
    if any(row.get("conversationId") is None for row in rows):
        raise PilotSafetyError("conversation_not_resolved")
    return rows


def _create_pending_jobs(message_ids: list[int], cutover_message_id: int) -> int:
    placeholders = ", ".join("?" for _ in message_ids)
    with get_connection() as conn:
        try:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                INSERT INTO dbo.WebChat_MessageAnalytics
                (
                    messageId, conversationId, customerId, source,
                    sentimentLabel, sentimentScore, messageAt, analyzedAt,
                    sentimentSource, analysisStatus, analysisRetryCount,
                    analysisStartedAt, analysisUpdatedAt, issueFlag
                )
                OUTPUT INSERTED.messageId
                SELECT
                    customer_message.id_webchat_messageLogs,
                    conversation.Id,
                    customer_message.SenderId,
                    customer_message.Source,
                    NULL, NULL, customer_message.SentAt, NULL,
                    'huggingface', 'pending', 0, NULL, SYSUTCDATETIME(), NULL
                FROM dbo.WebChat_MessageLogs customer_message
                INNER JOIN dbo.WebChat_Conversations conversation
                  ON conversation.Source = customer_message.Source
                 AND conversation.CustomerId = customer_message.SenderId
                WHERE customer_message.id_webchat_messageLogs IN ({placeholders})
                  AND customer_message.id_webchat_messageLogs > ?
                  AND customer_message.FromHost = 0
                  AND customer_message.TextContent IS NOT NULL
                  AND NULLIF(LTRIM(RTRIM(customer_message.TextContent)), '') IS NOT NULL
                  AND {valid_message_condition("customer_message")}
                  AND NOT EXISTS (
                      SELECT 1
                      FROM dbo.WebChat_MessageAnalytics existing WITH (UPDLOCK, HOLDLOCK)
                      WHERE existing.messageId = customer_message.id_webchat_messageLogs
                  );
                """,
                (*message_ids, int(cutover_message_id)),
            )
            inserted = rows_to_dicts(cursor)
            if len(inserted) != len(message_ids):
                raise PilotSafetyError("pending_insert_count_mismatch")
            conn.commit()
            return len(inserted)
        except Exception:
            conn.rollback()
            raise


def _claim_selected_jobs(message_ids: list[int]) -> list[dict[str, Any]]:
    placeholders = ", ".join("?" for _ in message_ids)
    with get_connection() as conn:
        try:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                ;WITH candidates AS (
                    SELECT TOP (?) a.id
                    FROM dbo.WebChat_MessageAnalytics a WITH (UPDLOCK, READPAST, ROWLOCK)
                    INNER JOIN dbo.WebChat_MessageLogs customer_message
                      ON customer_message.id_webchat_messageLogs = a.messageId
                    WHERE a.messageId IN ({placeholders})
                      AND a.analysisStatus = 'pending'
                      AND a.sentimentSource = 'huggingface'
                      AND customer_message.FromHost = 0
                    ORDER BY a.id
                )
                UPDATE analytics
                SET analysisStatus = 'processing',
                    analysisStartedAt = SYSUTCDATETIME(),
                    analysisUpdatedAt = SYSUTCDATETIME(),
                    analysisError = NULL
                OUTPUT INSERTED.id AS analyticsId
                FROM dbo.WebChat_MessageAnalytics analytics
                INNER JOIN candidates candidate ON candidate.id = analytics.id;
                """,
                (len(message_ids), *message_ids),
            )
            claimed = rows_to_dicts(cursor)
            if len(claimed) != len(message_ids):
                raise PilotSafetyError("claim_count_mismatch")
            analytics_ids = [int(row["analyticsId"]) for row in claimed]
            analytics_placeholders = ", ".join("?" for _ in analytics_ids)
            cursor.execute(
                f"""
                SELECT
                    a.messageId, a.id AS analyticsId, a.analysisRetryCount,
                    a.analysisStartedAt, a.conversationId,
                    customer_message.TextContent AS CustomerText,
                    customer_message.FromHost,
                    customer_message.Source AS channel,
                    a.primaryTopicId,
                    a.detectedTopics,
                    customer_message.SentAt AS createdAt
                FROM dbo.WebChat_MessageAnalytics a
                INNER JOIN dbo.WebChat_MessageLogs customer_message
                  ON customer_message.id_webchat_messageLogs = a.messageId
                WHERE a.id IN ({analytics_placeholders})
                  AND a.analysisStatus = 'processing'
                  AND customer_message.FromHost = 0
                ORDER BY a.id;
                """,
                tuple(analytics_ids),
            )
            jobs = rows_to_dicts(cursor)
            conn.commit()
            return jobs
        except Exception:
            conn.rollback()
            raise


async def run_pilot(
    settings: Settings,
    message_ids: list[int],
    *,
    dry_run: bool,
) -> dict[str, Any]:
    max_records = min(3, int(getattr(settings, "hf_pilot_max_records", 3)))
    message_ids = parse_message_ids(
        [str(message_id) for message_id in message_ids],
        max_records=max_records,
    )
    validate_pilot_safety(settings)
    await asyncio.to_thread(_assert_schema_ready)
    candidates = await asyncio.to_thread(
        _load_candidates,
        message_ids,
        int(settings.hf_analysis_cutover_message_id),
    )
    if dry_run:
        return {
            "mode": "dry_run",
            "records": [mask_message_id(row["messageId"]) for row in candidates],
            "eligible": len(candidates),
            "hfLiveCalls": 0,
            "databaseWrites": 0,
        }

    pilot_settings = settings.model_copy(update={"hf_max_concurrency": 1})
    client = HuggingFaceSentimentClient(pilot_settings)
    if not client.configured:
        await client.close()
        raise PilotSafetyError("hf_token_not_configured")

    repository = SentimentRepository()
    results: list[dict[str, Any]] = []
    calls_before = client.request_attempt_count
    try:
        await asyncio.to_thread(
            _create_pending_jobs,
            message_ids,
            int(settings.hf_analysis_cutover_message_id),
        )
        for message_id in message_ids:
            jobs = await asyncio.to_thread(_claim_selected_jobs, [message_id])
            if len(jobs) != 1:
                results.append(
                    {
                        "message": mask_message_id(message_id),
                        "status": "not_claimed",
                        "assistantTextSent": False,
                    }
                )
                continue
            job = jobs[0]
            started = time.perf_counter()
            try:
                resolved = resolve_customer_message_for_analysis(job)
                prediction = await client.predict(resolved.customer_text)
                changed = await asyncio.to_thread(
                    repository.complete_job,
                    {**job, "analysisModel": client.model},
                    prediction,
                )
                results.append(
                    {
                        "message": mask_message_id(resolved.customer_message_id),
                        "status": "completed" if changed == 1 else "write_conflict",
                        "label": prediction.label,
                        "confidence": prediction.confidence,
                        "latencyMs": round((time.perf_counter() - started) * 1000, 1),
                        "assistantTextSent": False,
                    }
                )
            except HuggingFaceClientError as exc:
                await asyncio.to_thread(
                    repository.record_failure,
                    resolved.customer_message_id,
                    exc.code,
                    exc.retryable,
                    int(settings.hf_max_retries),
                )
                results.append(
                    {
                        "message": mask_message_id(resolved.customer_message_id),
                        "status": "pending" if exc.retryable else "failed",
                        "error": exc.code,
                        "latencyMs": round((time.perf_counter() - started) * 1000, 1),
                        "assistantTextSent": False,
                    }
                )
            except Exception:
                await asyncio.to_thread(
                    repository.record_failure,
                    int(job["messageId"]),
                    "pilot_unexpected_error",
                    False,
                    int(settings.hf_max_retries),
                )
                results.append(
                    {
                        "message": mask_message_id(int(job["messageId"])),
                        "status": "failed",
                        "error": "pilot_unexpected_error",
                        "latencyMs": round((time.perf_counter() - started) * 1000, 1),
                        "assistantTextSent": False,
                    }
                )
    finally:
        await client.close()

    return {
        "mode": "live",
        "records": results,
        "hfLiveCalls": client.request_attempt_count - calls_before,
        "failureConvertedToNeutral": any(
            row.get("status") != "completed" and row.get("label") == "NEU"
            for row in results
        ),
    }


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run a guarded one-shot HF sentiment DB pilot.")
    parser.add_argument("--message-ids", nargs="+", required=True)
    parser.add_argument("--max-records", type=int, default=None)
    parser.add_argument("--dry-run", action="store_true")
    return parser


def main() -> int:
    args = _parser().parse_args()
    settings = get_settings()
    max_records = args.max_records or int(settings.hf_pilot_max_records)
    try:
        message_ids = parse_message_ids(args.message_ids, max_records=max_records)
        result = asyncio.run(run_pilot(settings, message_ids, dry_run=bool(args.dry_run)))
    except PilotSafetyError as exc:
        print(json.dumps({"status": "blocked", "reason": str(exc)}, ensure_ascii=False))
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
