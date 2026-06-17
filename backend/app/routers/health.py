from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings
from app.db.health import check_database_health
from app.services.sentiment_service import SentimentService

router = APIRouter(prefix="/api", tags=["health"])


def get_sentiment_service() -> SentimentService:
    return SentimentService()


@router.get("/health")
def health(
    settings: Settings = Depends(get_settings),
    sentiment_service: SentimentService = Depends(get_sentiment_service),
):
    db = check_database_health()
    ml = sentiment_service.get_ml_health()
    return {
        "success": True,
        "message": "Backend is running successfully.",
        "status": "ok",
        "service": "flic-fastapi-backend",
        "database": db["status"],
        "mlService": "connected" if ml.get("mlServiceReachable") else "disconnected",
        "version": settings.app_version,
        "details": {
            "database": db,
            "ml": ml,
        },
    }


@router.get("/health/ml")
def ml_health(sentiment_service: SentimentService = Depends(get_sentiment_service)):
    return sentiment_service.get_ml_health()

