from fastapi.testclient import TestClient

from app.main import app
from app.routers import health as health_router


class FakeSentimentHealth:
    def __init__(self, payload):
        self.payload = payload

    def get_ml_health(self):
        return self.payload


def test_health_endpoint(monkeypatch):
    monkeypatch.setattr(health_router, "check_database_health", lambda: {"status": "connected"})
    app.dependency_overrides[health_router.get_sentiment_service] = lambda: FakeSentimentHealth(
        {"mlServiceReachable": True, "visobertAvailable": False}
    )
    try:
        response = TestClient(app).get("/api/health")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["database"] == "connected"
    assert body["mlService"] == "connected"


def test_ml_health_endpoint_visobert_unavailable():
    app.dependency_overrides[health_router.get_sentiment_service] = lambda: FakeSentimentHealth(
        {
            "status": "ok",
            "mlServiceReachable": True,
            "phobertAvailable": True,
            "visobertAvailable": False,
            "visobertNote": "ViSoBERT is experimental and not active in production runtime.",
        }
    )
    try:
        response = TestClient(app).get("/api/health/ml")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["visobertAvailable"] is False
    assert "experimental" in response.json()["visobertNote"]

