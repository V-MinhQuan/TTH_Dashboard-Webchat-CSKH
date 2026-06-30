from __future__ import annotations

import csv
import logging
from datetime import date, datetime
from io import StringIO
from typing import Iterable, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse, StreamingResponse

from app.core.auth import SessionClaims, require_roles
from app.core.exceptions import AppError
from app.schemas.analytics import CustomChartRequest
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/api/analytics", tags=["analytics"])
logger = logging.getLogger(__name__)
AI_FAILED_EXPORT_PAGE_SIZE = 100
AI_FAILED_EXPORT_MAX_ROWS = 50000
AI_FAILED_EXPORT_COLUMNS = [
    ("STT", "row_number", True),
    ("Message ID", "messageId", True),
    ("Conversation ID", "conversationId", True),
    ("Customer ID", "customerId", True),
    ("Số điện thoại", "phoneNumber", True),
    ("Tên khách hàng", "customerDisplayName", False),
    ("Câu hỏi khách hàng", "textContent", False),
    ("Câu trả lời AI", "aiAnswer", False),
    ("Chủ đề", "detectedTopics", False),
    ("Kênh", "source", False),
    ("Lý do lỗi AI", "issueType", False),
    ("Mức độ tin cậy", "issueConfidence", False),
    ("Gợi ý tri thức", "issueReason", False),
    ("Thời gian", "messageAt", False),
]


def get_analytics_service() -> AnalyticsService:
    return AnalyticsService()


def _analytics_filters(
    dateRange: Optional[str] = Query(default=None),
    fromDate: Optional[date] = Query(default=None),
    toDate: Optional[date] = Query(default=None),
    startDate: Optional[date] = Query(default=None),
    endDate: Optional[date] = Query(default=None),
    channel: Optional[str] = Query(default=None),
    source: Optional[str] = Query(default=None),
    topic: Optional[str] = Query(default=None),
    sentiment: Optional[str] = Query(default=None),
    sentimentLabel: Optional[str] = Query(default=None),
    issueType: Optional[str] = Query(default=None),
    conversationStatus: Optional[str] = Query(default=None),
    aiStatus: Optional[str] = Query(default=None),
):
    if fromDate and toDate and fromDate > toDate:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="fromDate must be before or equal to toDate.")
    if startDate and endDate and startDate > endDate:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="startDate must be before or equal to endDate.")

    return {
        "dateRange": dateRange,
        "fromDate": fromDate.isoformat() if fromDate else None,
        "toDate": toDate.isoformat() if toDate else None,
        "startDate": startDate.isoformat() if startDate else None,
        "endDate": endDate.isoformat() if endDate else None,
        "channel": channel,
        "source": source,
        "topic": topic,
        "sentiment": sentiment,
        "sentimentLabel": sentimentLabel,
        "issueType": issueType,
        "conversationStatus": conversationStatus,
        "aiStatus": aiStatus,
    }


def _review_filters(
    base: dict = Depends(_analytics_filters),
    page: int = Query(default=1),
    pageSize: int = Query(default=20),
    search: Optional[str] = Query(default=None),
    uniqueConversations: bool = Query(default=False),
):
    return {
        **base,
        "page": page,
        "pageSize": pageSize,
        "search": search,
        "uniqueConversations": uniqueConversations,
    }


def _csv_line(values: Iterable[object]) -> str:
    buffer = StringIO(newline="")
    writer = csv.writer(buffer, lineterminator="\r\n")
    writer.writerow(list(values))
    return buffer.getvalue()


def _csv_value(value: object, preserve_identifier: bool = False) -> str:
    if value is None:
        return ""
    if isinstance(value, list):
        text = "; ".join(str(item) for item in value if item is not None)
    else:
        text = str(value)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    if preserve_identifier:
        digits_only = text.isdigit()
        if digits_only and (text.startswith("0") or len(text) >= 12):
            text = f"\t{text}"
    if text.lstrip().startswith(("=", "+", "-", "@")):
        text = f"'{text}"
    return text


def _failed_conversation_export_rows(records: list[dict], start_index: int) -> Iterable[str]:
    for offset, record in enumerate(records):
        row_number = start_index + offset
        values = []
        for _, key, preserve_identifier in AI_FAILED_EXPORT_COLUMNS:
            value = row_number if key == "row_number" else record.get(key)
            values.append(_csv_value(value, preserve_identifier=preserve_identifier))
        yield _csv_line(values)


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
    data = service.get_negative_review_conversations(filters)
    data["metadata"] = {
        **data.get("metadata", {}),
        "canonicalEndpoint": "/api/analytics/negative-conversations",
    }
    return {
        "success": True,
        "message": "Lay danh sach hoi thoai tieu cuc can xu ly thanh cong.",
        "meta": data["metadata"],
        "data": data,
    }


@router.get("/positive-conversations")
def positive_conversations(
    filters: dict = Depends(_review_filters),
    service: AnalyticsService = Depends(get_analytics_service),
):
    data = service.get_positive_conversations(filters)
    return {
        "success": True,
        "message": "Lấy danh sách hội thoại tích cực thành công.",
        "meta": data["metadata"],
        "data": data,
    }


@router.get("/ai/quality-metrics")
def ai_quality_metrics(
    filters: dict = Depends(_analytics_filters),
    service: AnalyticsService = Depends(get_analytics_service),
):
    data = service.get_ai_quality_metrics(filters)
    return {"success": True, "message": "Lấy số liệu chất lượng AI thành công.", "data": data}


@router.get("/ai/staff-activity")
def ai_staff_activity(
    filters: dict = Depends(_analytics_filters),
    service: AnalyticsService = Depends(get_analytics_service),
):
    data = service.get_staff_activity_metrics(filters)
    return {"success": True, "message": "Lấy số liệu hoạt động nhân viên thành công.", "data": data}


@router.get("/ai/failure-trend")
def ai_failure_trend(
    filters: dict = Depends(_analytics_filters),
    service: AnalyticsService = Depends(get_analytics_service),
):
    data = service.get_ai_failure_trend(filters)
    return {"success": True, "message": "Lấy xu hướng lỗi AI thành công.", "data": data}


@router.get("/ai/failure-by-topic")
def ai_failure_by_topic(
    filters: dict = Depends(_analytics_filters),
    service: AnalyticsService = Depends(get_analytics_service),
):
    data = service.get_ai_failure_by_topic(filters)
    return {"success": True, "message": "Lấy phân bổ lỗi AI theo chủ đề thành công.", "data": data}


@router.get("/ai/failed-conversations")
def ai_failed_conversations(
    filters: dict = Depends(_review_filters),
    service: AnalyticsService = Depends(get_analytics_service),
):
    data = service.get_failed_conversations(filters)
    return {"success": True, "message": "Lấy danh sách lỗi AI thành công.", "data": data}


@router.get("/ai/failed-conversations/export")
def ai_failed_conversations_export(
    filters: dict = Depends(_review_filters),
    maxExportRows: int = Query(default=AI_FAILED_EXPORT_MAX_ROWS, ge=1, le=100000),
    _: SessionClaims = Depends(require_roles("manager")),
    service: AnalyticsService = Depends(get_analytics_service),
):
    page_filters = {
        **filters,
        "page": 1,
        "pageSize": AI_FAILED_EXPORT_PAGE_SIZE,
    }
    first_page = service.get_failed_conversations(page_filters)
    first_records = list(first_page.get("records") or [])
    pagination = first_page.get("pagination") or {}
    total = int(pagination.get("total") or len(first_records))
    if total > maxExportRows:
        raise AppError(
            f"Export có {total} bản ghi, vượt giới hạn an toàn {maxExportRows}. Vui lòng thu hẹp bộ lọc.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    filename = f"cau-hoi-ai-chua-xu-ly-{datetime.now().strftime('%Y%m%d-%H%M%S')}.csv"
    headers = {
        "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}",
        "X-Total-Records": str(total),
    }

    def iter_csv():
        yield "\ufeff"
        yield _csv_line(column[0] for column in AI_FAILED_EXPORT_COLUMNS)
        emitted = 0
        if first_records:
            yield from _failed_conversation_export_rows(first_records, 1)
            emitted += len(first_records)

        page = 2
        while emitted < total:
            next_page = service.get_failed_conversations({
                **page_filters,
                "page": page,
            })
            records = list(next_page.get("records") or [])
            if not records:
                break
            yield from _failed_conversation_export_rows(records, emitted + 1)
            emitted += len(records)
            page += 1

    return StreamingResponse(
        iter_csv(),
        media_type="text/csv; charset=utf-8",
        headers=headers,
    )


@router.get("/ai/staff-reported-errors")
def ai_staff_reported_errors(
    filters: dict = Depends(_review_filters),
    service: AnalyticsService = Depends(get_analytics_service),
):
    data = service.get_staff_reported_errors(filters)
    return {"success": True, "message": "Lấy danh sách lỗi nhân viên báo cáo thành công.", "data": data}


@router.get("/ai/suggested-faqs")
def ai_suggested_faqs(
    filters: dict = Depends(_analytics_filters),
    keywords: Optional[list[str]] = Query(default=None),
    scopeKeywords: Optional[list[str]] = Query(default=None),
    excludeKeywords: Optional[list[str]] = Query(default=None),
    topicLabel: Optional[str] = Query(default=None),
    limit: int = Query(default=5, ge=1, le=20),
    candidateLimit: int = Query(default=120, ge=1, le=300),
    service: AnalyticsService = Depends(get_analytics_service),
):
    try:
        data = service.get_suggested_faqs({
            **filters,
            "keywords": keywords or [],
            "scopeKeywords": scopeKeywords or [],
            "excludeKeywords": excludeKeywords or [],
            "topicLabel": topicLabel,
            "limit": limit,
            "candidateLimit": candidateLimit,
        })
    except Exception:
        logger.exception("Failed to load suggested FAQ analytics")
        data = []
    return {"success": True, "message": "Lấy danh sách đề xuất FAQ thành công.", "data": data}


@router.post("/custom-chart")
def custom_chart(
    request: CustomChartRequest,
    service: AnalyticsService = Depends(get_analytics_service),
):
    data = service.get_custom_chart_data(request.model_dump(by_alias=True, mode="json"))
    return {"success": True, "message": "Lay du lieu bieu do tuy chinh thanh cong.", "data": data}
