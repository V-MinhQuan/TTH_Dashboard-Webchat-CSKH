import asyncio
import logging
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.huggingface_sentiment_client import (  # noqa: E402
    HuggingFaceClientError,
    SentimentPrediction,
)
from app.core.config import Settings  # noqa: E402
from app.worker.ai_analytics_worker import SentimentAnalysisWorker  # noqa: E402
from app.worker.ai_issue_sync_worker import AiIssueKeywordSyncWorker  # noqa: E402
from app.worker import ai_issue_sync_worker as ai_issue_sync_worker_module  # noqa: E402
from app.worker.dashboard_worker import DashboardPrecomputeWorker  # noqa: E402
from app.worker import dashboard_worker as dashboard_worker_module  # noqa: E402
from app.worker.manager import BackgroundWorkerManager  # noqa: E402
from app.worker.standalone import single_instance_lock  # noqa: E402


def run(coro):
    return asyncio.run(coro)


def settings(**overrides):
    values = {
        "hf_batch_size": 2,
        "hf_background_interval_seconds": 10,
        "hf_processing_stale_minutes": 10,
        "hf_max_retries": 2,
        "hf_analysis_cutover_message_id": 100,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


class FakeRepository:
    def __init__(self, jobs=None):
        self.jobs = list(jobs or [])
        self.calls = []
        self.completed = []
        self.failures = []

    def recover_stale_jobs(self, stale_minutes, max_retries, cutover_message_id=None):
        self.calls.append(("recover", stale_minutes, max_retries, cutover_message_id))
        return 0

    def discover_pending_jobs(self, batch_size, cutover_message_id=None):
        self.calls.append(("discover", batch_size, cutover_message_id))
        return 0

    def claim_pending_batch(self, batch_size, cutover_message_id=None):
        self.calls.append(("claim", batch_size, cutover_message_id))
        claimed = self.jobs[:batch_size]
        self.jobs = self.jobs[batch_size:]
        return claimed

    def complete_job(self, job, prediction):
        self.completed.append((job, prediction))

    def record_failure(self, message_id, code, retryable, max_retries):
        self.failures.append((message_id, code, retryable, max_retries))


class FakeClient:
    configured = True

    def __init__(self):
        self.predict_calls = 0
        self.predicted_texts = []

    async def predict(self, text):
        self.predict_calls += 1
        self.predicted_texts.append(text)
        return SentimentPrediction(label="positive", confidence=0.9, score=0.9, raw_label="POS")


def job(message_id):
    text = f"message {message_id}"
    return {
        "messageId": message_id,
        "TextContent": text,
        "CustomerText": text,
        "FromHost": 0,
        "conversationId": message_id,
        "channel": "facebook",
        "createdAt": "2026-07-16T00:00:00",
    }


def test_worker_sends_customer_text_when_assistant_reply_has_opposite_sentiment():
    customer_text = "Hệ thống bị lỗi và tôi không thể đăng nhập được."
    assistant_text = "Cảm ơn bạn, vấn đề đã được giải quyết rất nhanh."
    customer_message_id = 101
    repository = FakeRepository(
        [
            {
                "messageId": customer_message_id,
                "TextContent": assistant_text,
                "CustomerText": customer_text,
                "AssistantText": assistant_text,
                "FromHost": 0,
                "conversationId": 77,
                "channel": "facebook",
                "createdAt": "2026-07-16T00:00:00",
            }
        ]
    )
    client = FakeClient()
    worker = SentimentAnalysisWorker(repository, client, settings(hf_batch_size=1))

    processed = run(worker.run_once())

    assert processed == 1
    assert client.predicted_texts == [customer_text]
    assert [entry[0]["messageId"] for entry in repository.completed] == [
        customer_message_id
    ]
    completed_job = repository.completed[0][0]
    assert completed_job["issueFlag"] is False
    assert completed_job["AssistantText"] == assistant_text


def test_worker_fails_closed_for_assistant_system_and_empty_customer_jobs():
    invalid_jobs = [
        {**job(201), "FromHost": 1},
        {**job(202), "FromHost": None},
        {**job(203), "CustomerText": "   "},
    ]
    repository = FakeRepository(invalid_jobs)
    client = FakeClient()
    worker = SentimentAnalysisWorker(repository, client, settings(hf_batch_size=3))

    processed = run(worker.run_once())

    assert processed == 0
    assert client.predicted_texts == []
    assert repository.completed == []
    assert repository.failures == [
        (201, "not_customer_message", False, 2),
        (202, "not_customer_message", False, 2),
        (203, "empty_customer_message", False, 2),
    ]


def test_run_once_uses_bounded_batch_and_thread_for_all_blocking_sql(monkeypatch):
    repository = FakeRepository([job(1), job(2), job(3)])
    worker = SentimentAnalysisWorker(repository, FakeClient(), settings(hf_batch_size=2))
    thread_calls = []

    async def fake_to_thread(function, *args, **kwargs):
        thread_calls.append(function.__name__)
        return function(*args, **kwargs)

    monkeypatch.setattr(asyncio, "to_thread", fake_to_thread)

    processed = run(worker.run_once())

    assert processed == 2
    assert [entry[0]["messageId"] for entry in repository.completed] == [1, 2]
    assert [entry[0]["issueFlag"] for entry in repository.completed] == [None, None]
    assert repository.jobs == [job(3)]
    assert thread_calls == [
        "recover_stale_jobs",
        "discover_pending_jobs",
        "claim_pending_batch",
        "complete_job",
        "complete_job",
    ]
    assert repository.calls[:3] == [
        ("recover", 10, 2, 100),
        ("discover", 2, 100),
        ("claim", 2, 100),
    ]


def test_missing_cutover_fails_closed_without_repository_or_client_calls():
    repository = FakeRepository([job(101)])
    client = FakeClient()
    worker = SentimentAnalysisWorker(
        repository,
        client,
        settings(hf_analysis_cutover_message_id=None),
    )

    processed = run(worker.run_once())

    assert processed == 0
    assert repository.calls == []
    assert repository.completed == []
    assert repository.failures == []
    assert client.predict_calls == 0
    assert worker.snapshot.last_error == "missing_cutover_message_id"


def test_missing_token_discovers_pending_but_does_not_claim():
    repository = FakeRepository([job(1)])
    client = FakeClient()
    client.configured = False
    worker = SentimentAnalysisWorker(repository, client, settings())

    processed = run(worker.run_once())

    assert processed == 0
    assert ("discover", 2, 100) in repository.calls
    assert not any(call[0] == "claim" for call in repository.calls)


def test_temporary_failure_is_persisted_without_neutral_fallback():
    class TimeoutClient(FakeClient):
        async def predict(self, _text):
            raise HuggingFaceClientError("timeout", retryable=True)

    repository = FakeRepository([job(7)])
    worker = SentimentAnalysisWorker(repository, TimeoutClient(), settings())

    processed = run(worker.run_once())

    assert processed == 0
    assert repository.completed == []
    assert repository.failures == [(7, "timeout", True, 2)]


def test_non_retryable_failure_is_marked_for_terminal_failure():
    class AuthClient(FakeClient):
        async def predict(self, _text):
            raise HuggingFaceClientError("authentication_failed", retryable=False, status_code=401)

    repository = FakeRepository([job(8)])
    worker = SentimentAnalysisWorker(repository, AuthClient(), settings())

    run(worker.run_once())

    assert repository.failures == [(8, "authentication_failed", False, 2)]


def test_loop_survives_iteration_exception_and_sleeps_configured_interval():
    calls = 0
    sleeps = []

    async def flaky_run_once():
        nonlocal calls
        calls += 1
        if calls == 1:
            raise RuntimeError("database temporarily unavailable")
        raise asyncio.CancelledError()

    async def fake_sleep(delay):
        sleeps.append(delay)

    worker = SentimentAnalysisWorker(FakeRepository(), FakeClient(), settings(), sleep=fake_sleep)
    worker.run_once = flaky_run_once

    try:
        run(worker.run_forever())
    except asyncio.CancelledError:
        pass

    assert calls == 2
    assert sleeps == [10]


def test_worker_iteration_log_redacts_database_error_details(caplog):
    secret = "password=do-not-log"
    calls = 0

    async def failing_run_once():
        nonlocal calls
        calls += 1
        if calls == 1:
            raise RuntimeError(secret)
        raise asyncio.CancelledError()

    async def no_sleep(_delay):
        return None

    worker = SentimentAnalysisWorker(FakeRepository(), FakeClient(), settings(), sleep=no_sleep)
    worker.run_once = failing_run_once

    with caplog.at_level(logging.ERROR):
        try:
            run(worker.run_forever())
        except asyncio.CancelledError:
            pass

    assert secret not in caplog.text


def test_manager_starts_worker_once_and_cancels_cleanly():
    sentiment_started = asyncio.Event()
    dashboard_started = asyncio.Event()

    class ManagedSentimentWorker:
        async def run_forever(self):
            sentiment_started.set()
            await asyncio.Event().wait()

    class ManagedDashboardWorker:
        async def run_forever(self):
            dashboard_started.set()
            await asyncio.Event().wait()

        def stop(self):
            pass

    async def scenario():
        manager = BackgroundWorkerManager(ManagedSentimentWorker(), ManagedDashboardWorker())
        manager.start()
        first_tasks = (manager._sentiment_task, manager._dashboard_task)
        manager.start()
        await asyncio.gather(sentiment_started.wait(), dashboard_started.wait())
        assert (manager._sentiment_task, manager._dashboard_task) == first_tasks
        assert manager.is_running is True
        assert manager.worker is manager.sentiment_worker
        await manager.stop()
        assert manager.is_running is False

    run(scenario())


def test_standalone_worker_rejects_second_instance(tmp_path):
    lock_path = tmp_path / "background-worker.lock"

    with single_instance_lock(lock_path):
        with pytest.raises(RuntimeError, match="already running"):
            with single_instance_lock(lock_path):
                pass


def test_dashboard_prewarm_prioritizes_all_page_ones_before_background_pages(monkeypatch):
    calls = []

    def fake_get_details(question, *_args, page, page_size, **_kwargs):
        calls.append((question, page, page_size))
        total_pages = 3 if question == "Câu A" else 2
        return {
            "records": [{"question": question, "count": 1}],
            "pagination": {"page": page, "pageSize": page_size, "total": 20, "totalPages": total_pages},
        }

    async def no_sleep(_seconds):
        return None

    monkeypatch.setattr(dashboard_worker_module.legacy_ds, "get_top_question_details", fake_get_details)
    monkeypatch.setattr(dashboard_worker_module.asyncio, "sleep", no_sleep)
    worker = DashboardPrecomputeWorker()
    worker._running = True

    run(worker._precompute_top_question_details(
        "2026-07-01",
        "2026-07-18",
        None,
        [{"question": "Câu A"}, {"question": "Câu B"}],
    ))

    assert calls == [
        ("Câu A", 1, 10),
        ("Câu B", 1, 10),
        ("Câu A", 2, 10),
        ("Câu B", 2, 10),
        ("Câu A", 3, 10),
    ]


def test_ai_issue_keyword_sync_applies_48_hour_incremental_window(monkeypatch):
    calls = []
    expected = SimpleNamespace(
        total_ai_messages=12,
        updated_rows=3,
        flagged_rows=2,
    )

    def fake_sync(*, apply, since):
        calls.append((apply, since))
        return expected

    monkeypatch.setattr(ai_issue_sync_worker_module, "sync_ai_issue_flags", fake_sync)
    worker = AiIssueKeywordSyncWorker(settings(
        ai_analytics_sync_interval_seconds=1800,
        ai_analytics_sync_lookback_hours=48,
        ai_analytics_sync_startup_delay_seconds=120,
    ))

    result = run(worker.run_once())

    assert result is expected
    assert calls[0][0] is True
    assert calls[0][1]


def test_ai_issue_keyword_sync_defaults_to_30_minutes(monkeypatch):
    monkeypatch.delenv("AI_ANALYTICS_SYNC_INTERVAL_SECONDS", raising=False)
    configured = Settings(_env_file=None)

    assert configured.ai_analytics_sync_interval_seconds == 1800
    assert configured.ai_analytics_sync_lookback_hours == 48
    assert configured.ai_analytics_sync_startup_delay_seconds == 120


def test_lifespan_does_not_start_worker_when_background_is_disabled(monkeypatch):
    from app import main

    starts = []

    monkeypatch.setattr(main.settings_obj, "hf_background_enabled", False)
    monkeypatch.setattr(main.BackgroundWorkerManager, "start", lambda self: starts.append(self))

    async def scenario():
        async with main.lifespan(main.app):
            assert main.app.state.hf_background_enabled is False
            assert main.app.state.background_worker_manager.is_running is False

    run(scenario())

    assert starts == []


def test_background_is_disabled_by_default_and_accepts_explicit_enable(monkeypatch):
    monkeypatch.delenv("HF_BACKGROUND_ENABLED", raising=False)
    assert Settings(_env_file=None).hf_background_enabled is False

    monkeypatch.setenv("HF_BACKGROUND_ENABLED", "true")
    assert Settings(_env_file=None).hf_background_enabled is True


def test_analysis_cutover_has_no_implicit_default_and_accepts_positive_id(monkeypatch):
    monkeypatch.delenv("HF_ANALYSIS_CUTOVER_MESSAGE_ID", raising=False)
    assert Settings(_env_file=None).hf_analysis_cutover_message_id is None

    monkeypatch.setenv("HF_ANALYSIS_CUTOVER_MESSAGE_ID", "11641")
    assert Settings(_env_file=None).hf_analysis_cutover_message_id == 11641


def test_compose_backend_loads_root_db_env_before_backend_secret_env():
    compose = (
        Path(__file__).resolve().parents[2] / "docker-compose.yml"
    ).read_text(encoding="utf-8")

    root_env = compose.index("path: ./.env")
    backend_env = compose.index("path: ./backend/.env")
    assert root_env < backend_env


def test_claim_sql_uses_short_sql_server_locking_hints():
    from app.repositories.sentiment_repository import CLAIM_PENDING_SQL

    normalized = " ".join(CLAIM_PENDING_SQL.upper().split())
    assert "UPDLOCK" in normalized
    assert "READPAST" in normalized
    assert "ROWLOCK" in normalized
    assert "OUTPUT INSERTED.MESSAGEID" in normalized
