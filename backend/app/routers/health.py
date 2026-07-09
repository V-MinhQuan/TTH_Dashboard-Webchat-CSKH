from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status

from app.core.config import Settings, get_settings
from app.db.health import check_database_health
from app.services.sentiment_service import SentimentService

router = APIRouter(prefix="/api", tags=["health"])


def get_sentiment_service() -> SentimentService:
    return SentimentService()


@router.get("/health")
def health(
    response: Response,
    settings: Settings = Depends(get_settings),
    sentiment_service: SentimentService = Depends(get_sentiment_service),
):
    db = check_database_health()
    ml = sentiment_service.get_ml_health()
    
    is_ready = (db.get("status") == "ok") and bool(ml.get("modelLoaded"))
    
    if db.get("status") != "ok":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "success": is_ready,
        "message": "Backend is running successfully." if is_ready else "Service is not ready.",
        "status": "ok" if is_ready else "error",
        "service": "flic-fastapi-backend",
        "database": db.get("status", "error"),
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

