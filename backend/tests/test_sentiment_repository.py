from pathlib import Path
import re
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.repositories.sentiment_repository import (
    CLAIM_PENDING_SQL,
    DISCOVER_PENDING_SQL,
    RECOVER_STALE_SQL,
    SentimentRepository,
)


BACKEND_ROOT = Path(__file__).resolve().parents[1]


class Cursor:
    def __init__(self, result_sets=None, rowcounts=None):
        self._result_sets = list(result_sets or [])
        self._rowcounts = list(rowcounts or [])
        self.description = []
        self.rowcount = 0
        self.executions = []
        self._rows = []

    def execute(self, query, params=()):
        self.executions.append((query, tuple(params)))
        if self._result_sets:
            columns, rows = self._result_sets.pop(0)
            self.description = [(column,) for column in columns]
            self._rows = list(rows)
        else:
            self.description = []
            self._rows = []
        if self._rowcounts:
            self.rowcount = self._rowcounts.pop(0)
        return self

    def fetchall(self):
        return list(self._rows)


class Connection:
    def __init__(self, cursor):
        self._cursor = cursor
        self.commit = MagicMock()
        self.rollback = MagicMock()

    def cursor(self):
        return self._cursor


class ConnectionContext:
    def __init__(self, connection):
        self.connection = connection

    def __enter__(self):
        return self.connection

    def __exit__(self, *_args):
        return False


def repository_with(cursor):
    connection = Connection(cursor)
    repository = SentimentRepository(
        connection_factory=lambda: ConnectionContext(connection)
    )
    return repository, connection


def normalized_sql(query):
    return " ".join(query.upper().split())


def discover_anchor_alias():
    sql = normalized_sql(DISCOVER_PENDING_SQL)
    match = re.search(
        r"FROM DBO\.WEBCHAT_MESSAGELOGS (?P<alias>[A-Z_][A-Z0-9_]*) WITH \(READPAST\)",
        sql,
    )
    assert match is not None
    return sql, match.group("alias")


def test_claim_sql_is_atomic_and_uses_sql_server_skip_locked_hints():
    sql = normalized_sql(CLAIM_PENDING_SQL)

    assert "TOP (?)" in sql
    assert "UPDLOCK" in sql
    assert "READPAST" in sql
    assert "ROWLOCK" in sql
    assert "ANALYSISSTATUS = 'PENDING'" in sql
    assert "A.MESSAGEID > ?" in sql
    assert "A.SENTIMENTSOURCE = 'HUGGINGFACE'" in sql
    assert "OUTPUT INSERTED.MESSAGEID" in sql


def test_discover_sql_creates_jobs_from_customer_messages_without_requiring_assistant_reply():
    sql, customer_alias = discover_anchor_alias()

    assert f"{customer_alias}.FROMHOST = 0" in sql
    assert "HOSTDISPLAYNAME = 'AI ASSISTANT'" not in sql
    assert f"{customer_alias}.ID_WEBCHAT_MESSAGELOGS > ?" in sql
    assert "'HUGGINGFACE'" in sql


def test_discover_sql_excludes_assistant_system_and_empty_customer_rows():
    sql, customer_alias = discover_anchor_alias()

    assert f"{customer_alias}.FROMHOST = 0" in sql
    assert f"{customer_alias}.TEXTCONTENT IS NOT NULL" in sql
    assert (
        f"NULLIF(LTRIM(RTRIM({customer_alias}.TEXTCONTENT)), '') IS NOT NULL"
        in sql
    )
    assert f"{customer_alias}.SOURCE IS NOT NULL" in sql
    assert f"{customer_alias}.SENDERID" in sql


def test_repeated_discovery_is_idempotent_by_customer_message_id():
    sql, customer_alias = discover_anchor_alias()

    assert "NOT EXISTS" in sql
    assert "WITH (UPDLOCK, HOLDLOCK)" in sql
    assert (
        f"EXISTING.MESSAGEID = {customer_alias}.ID_WEBCHAT_MESSAGELOGS"
        in sql
    )


def test_recover_sql_only_requeues_post_cutover_huggingface_jobs():
    sql = normalized_sql(RECOVER_STALE_SQL)

    assert "A.MESSAGEID > ?" in sql
    assert "A.SENTIMENTSOURCE = 'HUGGINGFACE'" in sql


def test_claim_returns_customer_message_id_and_customer_text_before_committing():
    cursor = Cursor(
        result_sets=[
            (
                ["messageId", "analyticsId", "analysisRetryCount", "analysisStartedAt"],
                [(41, 7, 0, "2026-07-15T00:00:00")],
            ),
            (
                [
                    "messageId",
                    "analyticsId",
                    "analysisRetryCount",
                    "analysisStartedAt",
                    "TextContent",
                    "CustomerText",
                ],
                [(41, 7, 0, "2026-07-15T00:00:00", "Customer question", "Customer question")],
            ),
        ]
    )
    repository, connection = repository_with(cursor)

    jobs = repository.claim_pending_batch(10, cutover_message_id=5000)

    assert jobs == [
        {
            "messageId": 41,
            "analyticsId": 7,
            "analysisRetryCount": 0,
            "analysisStartedAt": "2026-07-15T00:00:00",
            "TextContent": "Customer question",
            "CustomerText": "Customer question",
        }
    ]
    connection.commit.assert_called_once_with()
    connection.rollback.assert_not_called()
    claim_query, claim_params = cursor.executions[0]
    assert claim_params == (10, 5000)
    assert "a.messageId > ?" in claim_query
    assert "a.sentimentSource = 'huggingface'" in claim_query

    detail_sql = normalized_sql(cursor.executions[1][0])
    customer_join = re.search(
        r"INNER JOIN DBO\.WEBCHAT_MESSAGELOGS (?P<alias>[A-Z_][A-Z0-9_]*) "
        r"ON (?P=alias)\.ID_WEBCHAT_MESSAGELOGS = A\.MESSAGEID",
        detail_sql,
    )
    assert customer_join is not None
    customer_alias = customer_join.group("alias")
    assert f"{customer_alias}.FROMHOST = 0" in detail_sql
    assert re.search(
        rf"{customer_alias}\.TEXTCONTENT\s+AS\s+CUSTOMERTEXT",
        detail_sql,
    )
    assert "A.PRIMARYTOPICID" in detail_sql
    assert "A.DETECTEDTOPICS" in detail_sql
    assert "A.DETECTEDKEYWORDS" in detail_sql
    assert f"{customer_alias}.PRIMARYTOPICID" not in detail_sql
    assert f"{customer_alias}.DETECTEDTOPICS" not in detail_sql


def test_discover_passes_cutover_as_sql_parameter():
    cursor = Cursor(result_sets=[(["messageId"], [])])
    repository, connection = repository_with(cursor)

    discovered = repository.discover_pending_jobs(10, cutover_message_id=5000)

    assert discovered == 0
    query, params = cursor.executions[0]
    assert params == (10, 5000)
    normalized_query = normalized_sql(query)
    assert "ID_WEBCHAT_MESSAGELOGS > ?" in normalized_query
    connection.commit.assert_called_once_with()


def test_recover_passes_cutover_as_sql_parameter():
    cursor = Cursor(result_sets=[(["messageId"], [])])
    repository, connection = repository_with(cursor)

    recovered = repository.recover_stale_jobs(
        stale_minutes=10,
        max_retries=2,
        cutover_message_id=5000,
    )

    assert recovered == 0
    query, params = cursor.executions[0]
    assert params == (100, 5000, 10, 2)
    assert "a.messageId > ?" in query
    assert "a.sentimentSource = 'huggingface'" in query
    connection.commit.assert_called_once_with()


def test_complete_job_keeps_signed_score_contract_and_marks_completed():
    cursor = Cursor(rowcounts=[1])
    repository, connection = repository_with(cursor)
    prediction = SimpleNamespace(
        label="negative",
        confidence=0.91,
        score=0.91,
        raw_label="NEG",
    )

    changed = repository.complete_job(
        {"messageId": 8, "analysisStartedAt": "2026-07-15T00:00:00"},
        prediction,
    )

    query, params = cursor.executions[0]
    assert changed == 1
    assert "analysisStatus = 'completed'" in query
    assert params[0] == "negative"
    assert params[1] == pytest.approx(-0.91)
    assert params[-1] == 8
    connection.commit.assert_called_once_with()


def test_complete_job_rejects_unknown_label_instead_of_using_neutral():
    repository, connection = repository_with(Cursor())

    with pytest.raises(ValueError, match="Unsupported sentiment label"):
        repository.complete_job(
            {"messageId": 8},
            SimpleNamespace(label="LABEL_9", confidence=0.8, score=0.8),
        )

    connection.commit.assert_not_called()


def test_retryable_failure_requeues_until_limit_and_never_writes_sentiment():
    cursor = Cursor(rowcounts=[1])
    repository, connection = repository_with(cursor)

    changed = repository.record_failure(
        message_id=9,
        code="timeout",
        retryable=True,
        max_retries=2,
    )

    query, params = cursor.executions[0]
    assert changed == 1
    assert "analysisRetryCount = ISNULL(analysisRetryCount, 0) + 1" in query
    assert "sentimentLabel" not in query
    assert params == (1, 2, "timeout", 9)
    connection.commit.assert_called_once_with()


def test_status_counts_are_normalized_for_health_and_dashboard():
    cursor = Cursor(
        result_sets=[
            (
                ["pending", "processing", "completed", "failed", "quarantined", "total"],
                [(3, 1, 12, 2, 4, 22)],
            )
        ]
    )
    repository, _connection = repository_with(cursor)

    assert repository.get_status_counts() == {
        "pending": 3,
        "processing": 1,
        "completed": 12,
        "failed": 2,
        "quarantined": 4,
        "total": 22,
        "unanalyzed": 10,
    }


def test_migration_is_idempotent_batched_and_has_guarded_rollback():
    migration_dir = BACKEND_ROOT / "database" / "migrations"
    wrapper_sql = (migration_dir / "20260715_huggingface_analysis_state.sql").read_text(encoding="utf-8")
    schema_sql = (migration_dir / "01_add_hf_analysis_schema.sql").read_text(encoding="utf-8")
    verified_sql = (migration_dir / "02_backfill_verified_legacy.sql").read_text(encoding="utf-8")
    quarantine_sql = (migration_dir / "03_quarantine_unverified_legacy.sql").read_text(encoding="utf-8")
    requeue_sql = (migration_dir / "04_requeue_quarantined_batch.sql").read_text(encoding="utf-8")
    rollback_sql = (migration_dir / "rollback_hf_analysis_schema.sql").read_text(encoding="utf-8")
    apply_bundle = "\n".join((schema_sql, verified_sql, quarantine_sql))

    assert ":r backend/database/migrations/01_add_hf_analysis_schema.sql" in wrapper_sql
    assert ":r backend/database/migrations/02_backfill_verified_legacy.sql" in wrapper_sql
    assert ":r backend/database/migrations/03_quarantine_unverified_legacy.sql" in wrapper_sql
    assert "04_requeue_quarantined_batch.sql" not in "\n".join(
        line for line in wrapper_sql.splitlines() if line.lstrip().startswith(":r")
    )
    assert "COL_LENGTH" in schema_sql
    assert "analysisStatus" in schema_sql
    assert "ADD sentimentSource NVARCHAR(50) NULL" in schema_sql
    assert "ADD analyzerVersion NVARCHAR(200) NULL" in schema_sql
    assert "TOP (@BatchSize)" in verified_sql
    assert "TOP (@BatchSize)" in quarantine_sql
    assert "sentimentScore IS NOT NULL" in verified_sql
    assert "analyzedAt IS NOT NULL" in verified_sql
    assert "sentimentSource" in verified_sql and "analyzerVersion" in verified_sql
    assert "analysisStatus = 'quarantined'" in quarantine_sql
    assert "legacy_unverified_provenance" in quarantine_sql
    assert "SET sentimentLabel = NULL" not in apply_bundle
    assert "sentimentScore = NULL" not in apply_bundle
    assert "SET analyzedAt = NULL" not in apply_bundle
    assert "IX_WebChat_MessageAnalytics_AnalysisQueue" in quarantine_sql
    assert "'quarantined'" in quarantine_sql
    assert "DECLARE @Apply BIT = 0" in requeue_sql
    assert "DECLARE @BatchSize INT = 50" in requeue_sql
    assert "DECLARE @CutoverMessageId INT = NULL" in requeue_sql
    assert "customer_message.FromHost = 0" in requeue_sql
    assert "analytics.messageId > @CutoverMessageId" in requeue_sql
    assert "sentimentSource = 'huggingface'" in requeue_sql
    assert "previousSentimentSource" in requeue_sql
    assert "customer_message.SenderId NOT IN" in requeue_sql
    assert "analysisStatus = 'quarantined'" in requeue_sql
    assert "SET analysisStatus = 'pending'" in requeue_sql
    assert "@MinAnalyticsId" in requeue_sql and "@Source" in requeue_sql
    assert "DROP DATABASE" not in (apply_bundle + rollback_sql).upper()
    assert "@ConfirmRollback BIT = 0" in rollback_sql
    assert "Unsafe rollback refused" in rollback_sql
    assert "analysisStatus IN ('pending', 'processing', 'failed')" in rollback_sql
    assert rollback_sql.index("IF @ConfirmRollback = 0") < rollback_sql.index(
        "DROP CONSTRAINT CK_WebChat_MessageAnalytics_AnalysisStatus"
    )
    assert "DROP TABLE" not in rollback_sql.upper()
