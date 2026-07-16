from types import SimpleNamespace
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers import health


class Repository:
    def get_status_counts(self):
        return {"pending": 3, "processing": 1, "completed": 10, "failed": 2}


class Manager:
    def __init__(self):
        self.is_running = True
        self.worker = SimpleNamespace(
            snapshot=SimpleNamespace(
                heartbeat_at=datetime.now(timezone.utc).isoformat(),
                last_error=None,
                last_batch_size=2,
                total_completed=10,
            )
        )


class Service:
    def __init__(self, *, token=True, last_status="ok", last_error=None):
        self.token = token
        self.last_status = last_status
        self.last_error = last_error
        self.health_calls = 0

    def get_ml_health(self):
        self.health_calls += 1
        return {
            "status": "ok" if self.last_status == "ok" else "degraded",
            "provider": "hf-inference",
            "modelName": "wonrax/phobert-base-vietnamese-sentiment",
            "tokenConfigured": self.token,
            "lastCallAt": None,
            "lastSuccessAt": None,
            "lastStatus": self.last_status,
            "lastError": self.last_error,
            "lastLatencyMs": None,
        }


def make_client(service=None, *, background_enabled=True, cutover_message_id=100):
    app = FastAPI()
    app.include_router(health.router)
    app.state.sentiment_service = service or Service()
    app.state.sentiment_repository = Repository()
    app.state.background_worker_manager = Manager()
    app.state.hf_background_enabled = background_enabled
    app.state.hf_analysis_cutover_message_id = cutover_message_id
    return TestClient(app), app


def test_live_does_not_call_database_or_huggingface(monkeypatch):
    service = Service()
    client, _ = make_client(service)
    monkeypatch.setattr(
        health,
        "check_database_health",
        lambda: (_ for _ in ()).throw(AssertionError("live must not query DB")),
    )

    response = client.get("/api/health/live")

    assert response.status_code == 200
    assert response.json()["status"] == "live"
    assert service.health_calls == 0


def test_ready_reports_queue_worker_and_cached_hf_state(monkeypatch):
    service = Service()
    client, _ = make_client(service)
    monkeypatch.setattr(health, "check_database_health", lambda: {"status": "connected"})

    response = client.get("/api/health/ready")

    assert response.status_code == 200
    assert response.json()["status"] == "ready"
    assert response.json()["analysisQueue"]["pending"] == 3
    assert response.json()["components"]["backgroundWorker"]["status"] == "running"
    assert service.health_calls == 1


def test_database_failure_is_not_ready_and_never_success(monkeypatch):
    client, _ = make_client()
    monkeypatch.setattr(
        health,
        "check_database_health",
        lambda: {"status": "disconnected", "error": "database_unavailable"},
    )

    response = client.get("/api/health/ready")

    assert response.status_code == 503
    assert response.json()["status"] == "not_ready"
    assert response.json()["success"] is False


def test_missing_token_is_degraded_not_crashed(monkeypatch):
    client, _ = make_client(Service(token=False, last_status="not_called"))
    monkeypatch.setattr(health, "check_database_health", lambda: {"status": "connected"})

    response = client.get("/api/health/ready")

    assert response.status_code == 200
    assert response.json()["status"] == "degraded"
    assert response.json()["components"]["huggingface"]["tokenConfigured"] is False


def test_provider_not_called_and_stale_heartbeat_are_degraded(monkeypatch):
    client, app = make_client(Service(token=True, last_status="not_called"))
    app.state.background_worker_manager.worker.snapshot.heartbeat_at = (
        datetime.now(timezone.utc) - timedelta(hours=1)
    ).isoformat()
    monkeypatch.setattr(health, "check_database_health", lambda: {"status": "connected"})

    response = client.get("/api/health/ready")

    assert response.status_code == 200
    assert response.json()["status"] == "degraded"
    assert response.json()["components"]["huggingface"]["lastStatus"] == "not_called"
    assert response.json()["components"]["backgroundWorker"]["status"] == "stalled"
    assert response.json()["components"]["backgroundWorker"]["heartbeatFresh"] is False


def test_disabled_background_worker_is_reported_without_crash_or_stall(monkeypatch):
    client, _ = make_client(background_enabled=False)
    monkeypatch.setattr(health, "check_database_health", lambda: {"status": "connected"})

    response = client.get("/api/health/ready")
    worker = response.json()["components"]["backgroundWorker"]

    assert response.status_code == 200
    assert response.json()["status"] == "ready"
    assert worker["enabled"] is False
    assert worker["status"] == "disabled"
    assert worker["heartbeatFresh"] is None
    assert worker["lastError"] is None


def test_disabled_worker_does_not_require_unmigrated_queue_schema(monkeypatch):
    client, app = make_client(background_enabled=False)
    app.state.sentiment_repository = SimpleNamespace(
        get_status_counts=lambda: (_ for _ in ()).throw(
            RuntimeError("analysis queue schema not migrated")
        )
    )
    monkeypatch.setattr(health, "check_database_health", lambda: {"status": "connected"})

    response = client.get("/api/health/ready")

    assert response.status_code == 200
    assert response.json()["status"] == "ready"
    assert response.json()["analysisQueue"]["available"] is False


def test_enabled_worker_without_cutover_is_degraded_and_misconfigured(monkeypatch):
    client, _ = make_client(cutover_message_id=None)
    monkeypatch.setattr(health, "check_database_health", lambda: {"status": "connected"})

    response = client.get("/api/health/ready")
    worker = response.json()["components"]["backgroundWorker"]

    assert response.status_code == 200
    assert response.json()["status"] == "degraded"
    assert worker["status"] == "misconfigured"
    assert worker["cutoverConfigured"] is False
    assert worker["cutoverMessageId"] is None
    assert worker["lastError"] == "missing_cutover_message_id"


def test_old_health_contract_is_preserved_without_false_healthy(monkeypatch):
    client, _ = make_client(Service(last_status="error", last_error="authentication_failed"))
    monkeypatch.setattr(health, "check_database_health", lambda: {"status": "connected"})

    response = client.get("/api/health")
    body = response.json()

    assert response.status_code == 200
    assert body["success"] is False
    assert body["readiness"] == "degraded"
    assert body["details"]["ml"]["modelLoaded"] is False
