from __future__ import annotations

import inspect

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse

from app.core.auth import SessionClaims, require_roles
from app.core.config import get_settings
from app.core.exceptions import AppError
from app.core.rate_limit import AsyncSlidingWindowRateLimiter
from app.schemas.sentiment import SentimentPredictRequest
from app.services.sentiment_service import SentimentService


router = APIRouter(prefix="/api/sentiment", tags=["sentiment"])
require_sentiment_user = require_roles("manager", "staff", "admin")
_predict_limiter = AsyncSlidingWindowRateLimiter(
    limit=get_settings().hf_predict_rate_limit_per_minute,
)


def get_sentiment_service(request: Request) -> SentimentService:
    service = getattr(request.app.state, "sentiment_service", None)
    if service is None:
        raise AppError(
            "Dịch vụ phân tích cảm xúc chưa được khởi tạo.",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    return service


async def enforce_predict_rate_limit(
    session: SessionClaims = Depends(require_sentiment_user),
) -> SessionClaims:
    if not await _predict_limiter.allow(session.username.lower()):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Đã vượt giới hạn yêu cầu phân tích cảm xúc; vui lòng thử lại sau.",
        )
    return session


@router.post("/predict")
async def predict_sentiment(
    request: SentimentPredictRequest,
    _session: SessionClaims = Depends(enforce_predict_rate_limit),
    service: SentimentService = Depends(get_sentiment_service),
):
    result = service.predict(request.text)
    if inspect.isawaitable(result):
        result = await result
    sentiment = result.get("sentiment") if isinstance(result, dict) else None
    label = sentiment.get("label") if isinstance(sentiment, dict) else None
    if label not in {"positive", "neutral", "negative"}:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "success": False,
                "message": "Dịch vụ phân tích cảm xúc chưa sẵn sàng; hệ thống không tự tạo kết quả trung tính.",
                "data": result,
            },
        )
    return result
