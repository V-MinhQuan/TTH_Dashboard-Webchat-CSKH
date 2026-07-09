from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.exceptions import AppError
from app.schemas.sentiment import SentimentPredictRequest
from app.services.sentiment_service import SentimentService

router = APIRouter(prefix="/api/sentiment", tags=["sentiment"])


def get_sentiment_service() -> SentimentService:
    return SentimentService()



