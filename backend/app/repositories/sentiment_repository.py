from __future__ import annotations

import math
import re
from typing import Any, Callable, Dict, Mapping

from app.db.session import get_connection, rows_to_dicts
from app.repositories.display_filters import valid_message_condition


STALE_RECOVERY_BATCH_SIZE = 100
VALID_SENTIMENT_LABELS = frozenset({"positive", "neutral", "negative"})


DISCOVER_PENDING_SQL = f"""
INSERT INTO dbo.WebChat_MessageAnalytics
(
    messageId,
    conversationId,
    customerId,
    source,
    sentimentLabel,
    sentimentScore,
    messageAt,
    analyzedAt,
    sentimentSource,
    analysisStatus,
    analysisRetryCount,
    analysisStartedAt,
    analysisUpdatedAt,
    issueFlag
)
OUTPUT INSERTED.messageId
SELECT TOP (?)
    m.id_webchat_messageLogs,
    conversation.Id,
    m.SenderId,
    m.Source,
    NULL,
    NULL,
    m.SentAt,
    NULL,
    'huggingface',
    'pending',
    0,
    NULL,
    SYSUTCDATETIME(),
    NULL
FROM dbo.WebChat_MessageLogs m WITH (READPAST)
LEFT JOIN dbo.WebChat_Conversations conversation
  ON conversation.Source = m.Source
 AND conversation.CustomerId = m.SenderId
WHERE m.FromHost = 0
  AND m.TextContent IS NOT NULL
  AND NULLIF(LTRIM(RTRIM(m.TextContent)), '') IS NOT NULL
  AND {valid_message_condition("m")}
  AND m.id_webchat_messageLogs > ?
  AND NOT EXISTS (
      SELECT 1
      FROM dbo.WebChat_MessageAnalytics existing WITH (UPDLOCK, HOLDLOCK)
      WHERE existing.messageId = m.id_webchat_messageLogs
  )
ORDER BY m.id_webchat_messageLogs;
"""


CLAIM_PENDING_SQL = f"""
;WITH candidates AS (
    SELECT TOP (?) a.id
    FROM dbo.WebChat_MessageAnalytics a WITH (UPDLOCK, READPAST, ROWLOCK)
    INNER JOIN dbo.WebChat_MessageLogs customer_message
      ON customer_message.id_webchat_messageLogs = a.messageId
    WHERE a.analysisStatus = 'pending'
      AND a.messageId > ?
      AND a.sentimentSource = 'huggingface'
      AND customer_message.FromHost = 0
      AND customer_message.TextContent IS NOT NULL
      AND NULLIF(LTRIM(RTRIM(customer_message.TextContent)), '') IS NOT NULL
      AND {valid_message_condition("customer_message")}
    ORDER BY
        CASE WHEN a.analysisUpdatedAt IS NULL THEN 0 ELSE 1 END,
        a.analysisUpdatedAt,
        a.id
)
UPDATE analytics
SET analysisStatus = 'processing',
    analysisStartedAt = SYSUTCDATETIME(),
    analysisUpdatedAt = SYSUTCDATETIME(),
    analysisError = NULL
OUTPUT
    INSERTED.messageId,
    INSERTED.id AS analyticsId,
    INSERTED.analysisRetryCount,
    INSERTED.analysisStartedAt
FROM dbo.WebChat_MessageAnalytics analytics
INNER JOIN candidates candidate ON candidate.id = analytics.id;
"""


RECOVER_STALE_SQL = """
;WITH stale AS (
    SELECT TOP (?) a.id
    FROM dbo.WebChat_MessageAnalytics a WITH (UPDLOCK, READPAST, ROWLOCK)
    WHERE a.analysisStatus = 'processing'
      AND a.messageId > ?
      AND a.sentimentSource = 'huggingface'
      AND a.analysisStartedAt < DATEADD(minute, -?, SYSUTCDATETIME())
    ORDER BY a.analysisStartedAt, a.id
)
UPDATE analytics
SET analysisRetryCount = ISNULL(analysisRetryCount, 0) + 1,
    analysisStatus = CASE
        WHEN ISNULL(analysisRetryCount, 0) + 1 >= ? THEN 'failed'
        ELSE 'pending'
    END,
    analysisError = 'stale_processing_recovered',
    analysisStartedAt = NULL,
    analysisUpdatedAt = SYSUTCDATETIME()
OUTPUT INSERTED.messageId
FROM dbo.WebChat_MessageAnalytics analytics
INNER JOIN stale ON stale.id = analytics.id;
"""


STATUS_COUNTS_SQL = """
SELECT
    SUM(CASE WHEN analysisStatus = 'pending' THEN 1 ELSE 0 END) AS pending,
    SUM(CASE WHEN analysisStatus = 'processing' THEN 1 ELSE 0 END) AS processing,
    SUM(CASE WHEN analysisStatus = 'completed' THEN 1 ELSE 0 END) AS completed,
    SUM(CASE WHEN analysisStatus = 'failed' THEN 1 ELSE 0 END) AS failed,
    SUM(CASE WHEN analysisStatus = 'quarantined' THEN 1 ELSE 0 END) AS quarantined,
    COUNT_BIG(*) AS total
FROM dbo.WebChat_MessageAnalytics;
"""


class SentimentRepository:
    """Synchronous SQL Server persistence used through ``asyncio.to_thread``."""

    def __init__(self, connection_factory: Callable = get_connection):
        self._connection_factory = connection_factory

    def recover_stale_jobs(
        self,
        stale_minutes: int,
        max_retries: int,
        cutover_message_id: int,
    ) -> int:
        stale_minutes = max(1, int(stale_minutes))
        max_retries = max(1, int(max_retries))
        cutover_message_id = _required_cutover_message_id(cutover_message_id)
        with self._connection_factory() as conn:
            try:
                cursor = conn.cursor()
                cursor.execute(
                    RECOVER_STALE_SQL,
                    (
                        STALE_RECOVERY_BATCH_SIZE,
                        cutover_message_id,
                        stale_minutes,
                        max_retries,
                    ),
                )
                recovered = rows_to_dicts(cursor)
                conn.commit()
                return len(recovered)
            except Exception:
                conn.rollback()
                raise

    def discover_pending_jobs(self, batch_size: int, cutover_message_id: int) -> int:
        batch_size = max(1, int(batch_size))
        cutover_message_id = _required_cutover_message_id(cutover_message_id)
        with self._connection_factory() as conn:
            try:
                cursor = conn.cursor()
                cursor.execute(DISCOVER_PENDING_SQL, (batch_size, cutover_message_id))
                discovered = rows_to_dicts(cursor)
                conn.commit()
                return len(discovered)
            except Exception:
                conn.rollback()
                raise

    def claim_pending_batch(
        self,
        batch_size: int,
        cutover_message_id: int,
    ) -> list[Dict[str, Any]]:
        batch_size = max(1, int(batch_size))
        cutover_message_id = _required_cutover_message_id(cutover_message_id)
        with self._connection_factory() as conn:
            try:
                cursor = conn.cursor()
                cursor.execute(CLAIM_PENDING_SQL, (batch_size, cutover_message_id))
                claimed = rows_to_dicts(cursor)
                if not claimed:
                    conn.commit()
                    return []

                analytics_ids = [int(row["analyticsId"]) for row in claimed]
                placeholders = ", ".join("?" for _ in analytics_ids)
                cursor.execute(
                    f"""
                    SELECT
                        a.messageId,
                        a.id AS analyticsId,
                        a.analysisRetryCount,
                        a.analysisStartedAt,
                        a.conversationId,
                        customer_message.TextContent AS TextContent,
                        customer_message.TextContent AS CustomerText,
                        customer_message.FromHost,
                        customer_message.Source AS channel,
                        a.primaryTopicId,
                        a.detectedTopics,
                        a.detectedKeywords,
                        customer_message.SentAt AS createdAt
                    FROM dbo.WebChat_MessageAnalytics a
                    INNER JOIN dbo.WebChat_MessageLogs customer_message
                      ON customer_message.id_webchat_messageLogs = a.messageId
                    WHERE a.id IN ({placeholders})
                      AND a.analysisStatus = 'processing'
                      AND customer_message.FromHost = 0
                      AND customer_message.TextContent IS NOT NULL
                      AND NULLIF(LTRIM(RTRIM(customer_message.TextContent)), '') IS NOT NULL
                      AND {valid_message_condition("customer_message")}
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

    def complete_job(self, job: Mapping[str, Any], prediction: Any) -> int:
        label = str(_value(prediction, "label") or "").strip().lower()
        if label not in VALID_SENTIMENT_LABELS:
            raise ValueError(f"Unsupported sentiment label: {label or '<empty>'}")

        confidence = _probability(_value(prediction, "confidence"))
        raw_score = _value(prediction, "score")
        magnitude = _probability(confidence if raw_score is None else abs(float(raw_score)))
        score = -magnitude if label == "negative" else magnitude if label == "positive" else 0.0
        raw_label = str(_value(prediction, "raw_label") or label)[:50]
        analyzer_version = str(
            _value(prediction, "model")
            or job.get("analysisModel")
            or "huggingface-api"
        )[:50]
        reason = f"Hugging Face label={raw_label}, confidence={confidence:.4f}."[:500]
        message_id = int(job["messageId"])

        issue_flag = _optional_bit(job.get("issueFlag"))
        issue_type = _optional_text(job.get("issueType"), 100)
        issue_reason = _optional_text(job.get("issueReason"), 1000)
        issue_confidence = _optional_probability(job.get("issueConfidence"))
        detected_topics = _optional_text(job.get("detectedTopics"), None)
        detected_keywords = _optional_text(job.get("detectedKeywords"), None)

        with self._connection_factory() as conn:
            try:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    UPDATE dbo.WebChat_MessageAnalytics
                    SET sentimentLabel = ?,
                        sentimentScore = ?,
                        sentimentReason = ?,
                        analyzerVersion = ?,
                        sentimentSource = 'huggingface',
                        issueFlag = COALESCE(?, issueFlag),
                        issueType = CASE WHEN ? IS NULL THEN issueType ELSE ? END,
                        issueReason = CASE WHEN ? IS NULL THEN issueReason ELSE ? END,
                        issueConfidence = CASE WHEN ? IS NULL THEN issueConfidence ELSE ? END,
                        detectedTopics = COALESCE(detectedTopics, ?),
                        detectedKeywords = COALESCE(detectedKeywords, ?),
                        needStaffReview = CASE
                            WHEN ISNULL(needStaffReview, 0) = 1
                              OR ISNULL(?, ISNULL(issueFlag, 0)) = 1
                              OR ? = 'negative'
                            THEN 1 ELSE 0
                        END,
                        analyzedAt = SYSUTCDATETIME(),
                        analysisStatus = 'completed',
                        analysisError = NULL,
                        analysisStartedAt = NULL,
                        analysisUpdatedAt = SYSUTCDATETIME()
                    WHERE messageId = ?
                      AND analysisStatus = 'processing';
                    """,
                    (
                        label,
                        score,
                        reason,
                        analyzer_version,
                        issue_flag,
                        issue_flag,
                        issue_type,
                        issue_flag,
                        issue_reason,
                        issue_flag,
                        issue_confidence,
                        detected_topics,
                        detected_keywords,
                        issue_flag,
                        label,
                        message_id,
                    ),
                )
                changed = max(int(cursor.rowcount), 0)
                conn.commit()
                return changed
            except Exception:
                conn.rollback()
                raise

    def record_failure(
        self,
        message_id: int,
        code: str,
        retryable: bool,
        max_retries: int,
    ) -> int:
        max_retries = max(1, int(max_retries))
        error_code = _safe_error_code(code)
        with self._connection_factory() as conn:
            try:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    UPDATE dbo.WebChat_MessageAnalytics
                    SET analysisRetryCount = ISNULL(analysisRetryCount, 0) + 1,
                        analysisStatus = CASE
                            WHEN ? = 1
                             AND ISNULL(analysisRetryCount, 0) + 1 < ?
                            THEN 'pending'
                            ELSE 'failed'
                        END,
                        analysisError = ?,
                        analysisStartedAt = NULL,
                        analysisUpdatedAt = SYSUTCDATETIME()
                    WHERE messageId = ?
                      AND analysisStatus = 'processing';
                    """,
                    (1 if retryable else 0, max_retries, error_code, int(message_id)),
                )
                changed = max(int(cursor.rowcount), 0)
                conn.commit()
                return changed
            except Exception:
                conn.rollback()
                raise

    def get_status_counts(self) -> Dict[str, int]:
        with self._connection_factory() as conn:
            cursor = conn.cursor()
            cursor.execute(STATUS_COUNTS_SQL)
            rows = rows_to_dicts(cursor)
        row = rows[0] if rows else {}
        counts = {
            status: int(row.get(status) or 0)
            for status in ("pending", "processing", "completed", "failed", "quarantined")
        }
        counts["total"] = int(row.get("total") or 0)
        counts["unanalyzed"] = (
            counts["pending"]
            + counts["processing"]
            + counts["failed"]
            + counts["quarantined"]
        )
        return counts


SentimentAnalysisRepository = SentimentRepository


def _value(value: Any, name: str) -> Any:
    return value.get(name) if isinstance(value, Mapping) else getattr(value, name, None)


def _probability(value: Any) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise ValueError("Sentiment confidence must be numeric") from None
    if not math.isfinite(number):
        raise ValueError("Sentiment confidence must be finite")
    return round(max(0.0, min(1.0, number)), 6)


def _optional_probability(value: Any) -> float | None:
    return None if value is None else _probability(value)


def _optional_bit(value: Any) -> int | None:
    return None if value is None else int(bool(value))


def _optional_text(value: Any, limit: int | None) -> str | None:
    if value is None:
        return None
    text = str(value)
    return text[:limit] if limit is not None else text


def _safe_error_code(value: Any) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9_.:-]+", "_", str(value or "analysis_failed"))
    return normalized.strip("_")[:200] or "analysis_failed"


def _required_cutover_message_id(value: Any) -> int:
    if value is None:
        raise ValueError("HF_ANALYSIS_CUTOVER_MESSAGE_ID is required")
    cutover = int(value)
    if cutover < 0:
        raise ValueError("HF_ANALYSIS_CUTOVER_MESSAGE_ID must be non-negative")
    return cutover
