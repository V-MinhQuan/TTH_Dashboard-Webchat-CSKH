from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.exceptions import AppError
from app.schemas.sentiment import SentimentPredictRequest
from app.services.sentiment_service import SentimentService

router = APIRouter(prefix="/api/sentiment", tags=["sentiment"])


def get_sentiment_service() -> SentimentService:
    return SentimentService()


@router.post("/predict")
def predict_sentiment(
    request: SentimentPredictRequest,
    service: SentimentService = Depends(get_sentiment_service),
):
    text = request.text.strip()
    if not text:
        raise AppError("text is required.", status_code=400)
    prediction = service.predict(text)
    if prediction.get("source") == "fallback":
        raise AppError(
            "Dịch vụ phân tích cảm xúc chưa sẵn sàng; hệ thống không tự tạo kết quả thay thế.",
            status_code=503,
        )
    return prediction

