import httpx
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import app
from app.routers import sentiment as sentiment_router
from app.services import sentiment_service as service_module
from app.services.sentiment_service import SentimentService


class FakeSentimentService:
    def __init__(self, payload):
        self.payload = payload

    def predict(self, text):
        return self.payload


def test_sentiment_predict_endpoint_issue_true():
    app.dependency_overrides[sentiment_router.get_sentiment_service] = lambda: FakeSentimentService(
        {
            "sentiment": {"label": "neutral", "confidence": 0.76},
            "issue": {"issueFlag": True, "issueType": "missing_email_or_notification"},
            "needStaffReview": True,
            "analyzerVersion": "ensemble-phobert-rule-v1",
            "source": "ml-service",
        }
    )
    try:
        response = TestClient(app).post("/api/sentiment/predict", json={"text": "em chua nhan email"})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["issue"]["issueFlag"] is True
    assert response.json()["needStaffReview"] is True


def test_sentiment_service_normalizes_issue_false(monkeypatch):
    payload = {
        "success": True,
        "mode": "phobert_rule",
        "model": "ensemble-phobert-rule-v1",
        "engine": "ensemble",
        "count": 1,
        "results": [
            {
                "text": "lich thi thang 6 co chua a",
                "mode": "phobert_rule",
                "final": {"label": "neutral", "confidence": 0.9, "needStaffReview": False},
                "issue": {"issueFlag": False, "issueType": "none", "issueReason": "no issue", "issueConfidence": 0},
                "analyzerVersion": "ensemble-phobert-rule-v1",
            }
        ],
    }
    _mock_httpx_client(monkeypatch, httpx.Response(200, json=payload))

    result = SentimentService(_settings()).predict("lich thi thang 6 co chua a")
    assert result["source"] == "ml-service"
    assert result["issue"]["issueFlag"] is False
    assert result["needStaffReview"] is False


def test_sentiment_service_offline_uses_explicit_fallback(monkeypatch):
    class BrokenClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            raise httpx.ConnectError("offline")

        def __exit__(self, *args):
            return False

    monkeypatch.setattr(service_module.httpx, "Client", BrokenClient)
    result = SentimentService(_settings()).predict("em chua nhan duoc email xac nhan")
    assert result["source"] == "fallback"
    assert result["fallbackSource"] == "fastapi-rule-based"
    assert result["issue"]["issueFlag"] is True


def test_ml_health_visobert_unavailable(monkeypatch):
    _mock_httpx_client(
        monkeypatch,
        httpx.Response(
            200,
            json={
                "success": True,
                "status": "ok",
                "modelLoaded": True,
                "phobertAvailable": True,
                "visobertAvailable": False,
                "visobertError": "ENABLE_VISOBERT=false",
                "actualAnalyzerVersion": "ensemble-phobert-rule-v1",
            },
        ),
    )
    result = SentimentService(_settings()).get_ml_health()
    assert result["mlServiceReachable"] is True
    assert result["visobertAvailable"] is False
    assert result["visobertStatus"] == "experimental_not_active"


def test_ml_health_model_not_loaded(monkeypatch):
    _mock_httpx_client(
        monkeypatch,
        httpx.Response(
            503,
            json={
                "success": False,
                "status": "model_not_loaded",
                "modelLoaded": False,
                "phobertAvailable": False,
                "visobertAvailable": False,
                "message": "No module named 'transformers'",
            },
        ),
    )
    result = SentimentService(_settings()).get_ml_health()
    assert result["mlServiceReachable"] is True
    assert result["status"] == "model_not_loaded"
    assert result["phobertAvailable"] is False


def _settings():
    return Settings(
        DB_SERVER="localhost",
        DB_NAME="test",
        DB_USER="sa",
        DB_PASSWORD="pw",
        ML_SERVICE_URL="http://ml.test",
    )


def _mock_httpx_client(monkeypatch, response):
    real_client = httpx.Client

    class MockClient:
        def __init__(self, *args, **kwargs):
            self.client = real_client(transport=httpx.MockTransport(lambda request: response))

        def __enter__(self):
            return self.client

        def __exit__(self, *args):
            self.client.close()
            return False

    monkeypatch.setattr(service_module.httpx, "Client", MockClient)
