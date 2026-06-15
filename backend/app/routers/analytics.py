from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse

from app.schemas.analytics import CustomChartRequest
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def get_analytics_service() -> AnalyticsService:
    return AnalyticsService()


def _analytics_filters(
    dateRange: Optional[str] = Query(default=None),
    fromDate: Optional[str] = Query(default=None),
    toDate: Optional[str] = Query(default=None),
    startDate: Optional[str] = Query(default=None),
    endDate: Optional[str] = Query(default=None),
    channel: Optional[str] = Query(default=None),
    source: Optional[str] = Query(default=None),
    topic: Optional[str] = Query(default=None),
    sentiment: Optional[str] = Query(default=None),
    sentimentLabel: Optional[str] = Query(default=None),
    issueType: Optional[str] = Query(default=None),
):
    return {
        "dateRange": dateRange,
        "fromDate": fromDate,
        "toDate": toDate,
        "startDate": startDate,
        "endDate": endDate,
        "channel": channel,
        "source": source,
        "topic": topic,
        "sentiment": sentiment,
        "sentimentLabel": sentimentLabel,
        "issueType": issueType,
    }


def _review_filters(
    base: dict = Depends(_analytics_filters),
    page: int = Query(default=1),
    pageSize: int = Query(default=20),
    search: Optional[str] = Query(default=None),
):
    return {**base, "page": page, "pageSize": pageSize, "search": search}


def _keyword_mode(mode: str) -> str:
    return mode if mode in {"negative", "needReview", "issue"} else "negative"


@router.post("/run")
def run_analytics_disabled():
    return JSONResponse(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        content={
            "success": False,
            "message": "FastAPI migration stage does not run analytics reprocess. This write/reprocess flow requires separate approval.",
            "data": None,
        },
    )


@router.get("/sentiment-summary")
def sentiment_summary(
    filters: dict = Depends(_analytics_filters),
    service: AnalyticsService = Depends(get_analytics_service),
):
    data = service.get_sentiment_summary(filters)
    return {"success": True, "message": "Lay tong hop cam xuc thanh cong.", "data": data}


@router.get("/sentiment-trend")
def sentiment_trend(
    filters: dict = Depends(_analytics_filters),
    service: AnalyticsService = Depends(get_analytics_service),
):
    data = service.get_sentiment_trend(filters)
    return {"success": True, "message": "Lay xu huong cam xuc thanh cong.", "data": data}


@router.get("/satisfaction-summary")
def satisfaction_summary(
    filters: dict = Depends(_analytics_filters),
    service: AnalyticsService = Depends(get_analytics_service),
):
    data = service.get_satisfaction_summary(filters)
    return {"success": True, "message": "Lay tong hop hai long thanh cong.", "data": data}


@router.get("/satisfaction-trend")
def satisfaction_trend(
    filters: dict = Depends(_analytics_filters),
    service: AnalyticsService = Depends(get_analytics_service),
):
    data = service.get_satisfaction_trend(filters)
    return {"success": True, "message": "Lay xu huong hai long thanh cong.", "data": data}


@router.get("/topics")
def topic_summary(
    filters: dict = Depends(_analytics_filters),
    service: AnalyticsService = Depends(get_analytics_service),
):
    data = service.get_topic_summary(filters)
    return {"success": True, "message": "Lay tong hop chu de thanh cong.", "data": data}


@router.get("/negative-keywords")
def negative_keywords(
    filters: dict = Depends(_analytics_filters),
    mode: str = Query(default="negative"),
    service: AnalyticsService = Depends(get_analytics_service),
):
    filters = {**filters, "mode": _keyword_mode(mode)}
    data = service.get_keywords(filters)
    return {"success": True, "message": "Lay danh sach tu khoa thanh cong.", "data": data}


@router.get("/need-review-keywords")
def need_review_keywords(
    filters: dict = Depends(_analytics_filters),
    mode: str = Query(default="needReview"),
    service: AnalyticsService = Depends(get_analytics_service),
):
    filters = {**filters, "mode": _keyword_mode(mode)}
    data = service.get_keywords(filters)
    return {"success": True, "message": "Lay danh sach tu khoa can xem xet thanh cong.", "data": data}


@router.get("/need-review-conversations")
def need_review_conversations(
    filters: dict = Depends(_review_filters),
    service: AnalyticsService = Depends(get_analytics_service),
):
    data = service.get_need_review_conversations(filters)
    return {
        "success": True,
        "message": "Lay danh sach hoi thoai can nhan vien xem xet thanh cong.",
        "data": data,
    }


@router.get("/negative-conversations")
def negative_conversations(
    filters: dict = Depends(_review_filters),
    service: AnalyticsService = Depends(get_analytics_service),
):
    data = service.get_need_review_conversations(filters)
    data["metadata"] = {
        **data.get("metadata", {}),
        "legacy": True,
        "canonicalEndpoint": "/api/analytics/need-review-conversations",
    }
    return {
        "success": True,
        "message": "Lay danh sach hoi thoai can nhan vien xem xet thanh cong.",
        "meta": {
            "legacy": True,
            "canonicalEndpoint": "/api/analytics/need-review-conversations",
        },
        "data": data,
    }


@router.post("/custom-chart")
def custom_chart(
    request: CustomChartRequest,
    service: AnalyticsService = Depends(get_analytics_service),
):
    data = service.get_custom_chart_data(request.model_dump(by_alias=True, mode="json"))
    return {"success": True, "message": "Lay du lieu bieu do tuy chinh thanh cong.", "data": data}

