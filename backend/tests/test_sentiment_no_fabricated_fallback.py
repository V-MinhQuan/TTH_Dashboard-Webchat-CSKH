from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.auth import SessionClaims
from app.core.exceptions import register_exception_handlers
from app.routers.sentiment import enforce_predict_rate_limit, get_sentiment_service, router


class UnavailableSentimentService:
    def predict(self, text):
        return {
            "source": "huggingface",
            "sentiment": {"label": None, "confidence": None},
            "sentimentScore": None,
            "analysisStatus": "pending",
            "analysisSource": "huggingface",
            "analysisError": "timeout",
        }


class ReadySentimentService:
    def predict(self, text):
        return {"source": "huggingface", "sentiment": {"label": "positive", "confidence": 0.9}}


def make_client(service):
    app = FastAPI()
    register_exception_handlers(app)
    app.include_router(router)
    app.dependency_overrides[get_sentiment_service] = lambda: service
    app.dependency_overrides[enforce_predict_rate_limit] = lambda: SessionClaims(
        username="tester",
        role="staff",
        issued_at=1,
        expires_at=2,
    )
    return TestClient(app)


def test_predict_requires_existing_hmac_session():
    app = FastAPI()
    register_exception_handlers(app)
    app.include_router(router)
    app.dependency_overrides[get_sentiment_service] = lambda: ReadySentimentService()

    response = TestClient(app).post(
        "/api/sentiment/predict",
        json={"text": "Dịch vụ tốt"},
    )

    assert response.status_code == 401


def test_predict_returns_503_instead_of_fabricating_rule_based_result():
    response = make_client(UnavailableSentimentService()).post(
        "/api/sentiment/predict",
        json={"text": "Tôi chưa nhận được email"},
    )

    assert response.status_code == 503
    assert response.json()["success"] is False
    assert "không tự tạo kết quả" in response.json()["message"]
    assert response.json()["data"]["analysisStatus"] == "pending"
    assert response.json()["data"]["sentiment"]["label"] is None


def test_predict_returns_real_ml_result_when_available():
    response = make_client(ReadySentimentService()).post(
        "/api/sentiment/predict",
        json={"text": "Dịch vụ tốt"},
    )

    assert response.status_code == 200
    assert response.json()["source"] == "huggingface"
