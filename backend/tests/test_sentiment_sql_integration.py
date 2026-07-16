from __future__ import annotations

import os
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import pytest

from app.core.config import get_settings
from app.db.session import get_connection
from app.repositories.sentiment_repository import SentimentRepository
from scripts.pilot_hf_db_flow import (
    _assert_schema_ready,
    validate_pilot_safety,
)


SQL_INTEGRATION_ENABLED = os.getenv("RUN_HF_SQL_INTEGRATION", "").strip().lower() == "true"
pytestmark = pytest.mark.skipif(
    not SQL_INTEGRATION_ENABLED,
    reason="requires an explicitly approved migrated staging/safe-clone database",
)


@pytest.fixture(scope="module", autouse=True)
def require_safe_database():
    settings = get_settings()
    validate_pilot_safety(settings)
    _assert_schema_ready()
    return settings


def _insert_sandbox(status_specs):
    marker = uuid.uuid4().hex
    customer_id = f"codex-hf-it-{marker}"
    source = f"hf-it-{marker[:12]}"
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    message_ids = []
    analytics_ids = []

    with get_connection() as conn:
        try:
            cursor = conn.cursor()
            for index, _spec in enumerate(status_specs):
                if index == 0:
                    cursor.execute(
                        """
                        INSERT INTO dbo.WebChat_Messagelogs_User_Info
                            (SenderId, Source, DisplayName)
                        VALUES (?, ?, ?);
                        """,
                        (customer_id, source, "HF IT Test User"),
                    )

                cursor.execute(
                    """
                    INSERT INTO dbo.WebChat_MessageLogs
                        (messageId, SenderId, SentAt, TextContent, Source,
                         ReceiverId, FromHost, HostDisplayName)
                    OUTPUT INSERTED.id_webchat_messageLogs
                    VALUES (?, ?, ?, ?, ?, ?, 0, NULL);
                    """,
                    (
                        f"hf-it-message-{marker}-{index}",
                        customer_id,
                        now + timedelta(seconds=index),
                        f"Synthetic customer sentiment integration message {index}",
                        source,
                        "hf-it-host",
                    ),
                )
                message_ids.append(int(cursor.fetchone()[0]))

            cursor.execute(
                """
                INSERT INTO dbo.WebChat_Conversations
                    (CustomerId, Source, LastMessageId, LastMessageAt,
                     LastCustomerMessageAt, LastHostMessageAt)
                OUTPUT INSERTED.Id
                VALUES (?, ?, ?, ?, ?, NULL);
                """,
                (customer_id, source, message_ids[-1], now, now),
            )
            conversation_id = int(cursor.fetchone()[0])

            for message_id, spec in zip(message_ids, status_specs):
                cursor.execute(
                    """
                    INSERT INTO dbo.WebChat_MessageAnalytics
                        (messageId, conversationId, customerId, source,
                         sentimentLabel, sentimentScore, messageAt, analyzedAt,
                         sentimentSource, analysisStatus, analysisRetryCount,
                         analysisError, analysisStartedAt, analysisUpdatedAt)
                    OUTPUT INSERTED.id
                    VALUES (?, ?, ?, ?, NULL, NULL, ?, NULL, 'huggingface',
                            ?, ?, NULL, ?, SYSUTCDATETIME());
                    """,
                    (
                        message_id,
                        conversation_id,
                        customer_id,
                        source,
                        now,
                        spec["status"],
                        spec.get("retry_count", 0),
                        spec.get("started_at"),
                    ),
                )
                analytics_ids.append(int(cursor.fetchone()[0]))
            conn.commit()
        except Exception:
            conn.rollback()
            raise

    return {
        "message_ids": message_ids,
        "analytics_ids": analytics_ids,
        "conversation_id": conversation_id,
        "customer_id": customer_id,
        "source": source,
    }


def _cleanup_sandbox(sandbox):
    placeholders = ", ".join("?" for _ in sandbox["message_ids"])
    with get_connection() as conn:
        try:
            cursor = conn.cursor()
            cursor.execute(
                f"DELETE FROM dbo.WebChat_MessageAnalytics WHERE messageId IN ({placeholders})",
                tuple(sandbox["message_ids"]),
            )
            cursor.execute(
                "DELETE FROM dbo.WebChat_Conversations WHERE Id = ? AND CustomerId = ? AND Source = ?",
                (sandbox["conversation_id"], sandbox["customer_id"], sandbox["source"]),
            )
            cursor.execute(
                f"DELETE FROM dbo.WebChat_MessageLogs WHERE id_webchat_messageLogs IN ({placeholders})",
                tuple(sandbox["message_ids"]),
            )
            cursor.execute(
                "DELETE FROM dbo.WebChat_Messagelogs_User_Info WHERE SenderId = ? AND Source = ?",
                (sandbox["customer_id"], sandbox["source"]),
            )
            conn.commit()
        except Exception:
            conn.rollback()
            raise


def test_two_real_sql_connections_never_claim_the_same_message():
    sandbox = _insert_sandbox([{"status": "pending"}, {"status": "pending"}])
    cutover = min(sandbox["message_ids"]) - 1
    barrier = threading.Barrier(2)

    def claim_one():
        barrier.wait(timeout=10)
        return SentimentRepository().claim_pending_batch(1, cutover)

    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            batches = list(executor.map(lambda _index: claim_one(), range(2)))
        claimed_ids = [int(batch[0]["messageId"]) for batch in batches if batch]
        assert len(claimed_ids) == 2
        assert len(set(claimed_ids)) == 2
        assert set(claimed_ids) == set(sandbox["message_ids"])
    finally:
        _cleanup_sandbox(sandbox)


def test_real_sql_stale_recovery_only_changes_expired_processing_rows():
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    sandbox = _insert_sandbox(
        [
            {"status": "processing", "retry_count": 0, "started_at": now - timedelta(minutes=30)},
            {"status": "processing", "retry_count": 0, "started_at": now},
            {"status": "processing", "retry_count": 1, "started_at": now - timedelta(minutes=30)},
        ]
    )
    cutover = min(sandbox["message_ids"]) - 1
    try:
        recovered = SentimentRepository().recover_stale_jobs(10, 2, cutover)
        assert recovered == 2

        placeholders = ", ".join("?" for _ in sandbox["message_ids"])
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT messageId, analysisStatus, analysisRetryCount
                FROM dbo.WebChat_MessageAnalytics
                WHERE messageId IN ({placeholders});
                """,
                tuple(sandbox["message_ids"]),
            )
            state = {int(row[0]): (str(row[1]), int(row[2])) for row in cursor.fetchall()}

        old_retryable, fresh, old_exhausted = sandbox["message_ids"]
        assert state[old_retryable] == ("pending", 1)
        assert state[fresh] == ("processing", 0)
        assert state[old_exhausted] == ("failed", 2)
    finally:
        _cleanup_sandbox(sandbox)
