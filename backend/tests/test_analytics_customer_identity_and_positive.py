import csv
from datetime import date
from io import StringIO
import sys
from pathlib import Path

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.auth import HMACBearerSessions, get_session_manager
from app.repositories.analytics_repository import AnalyticsRepository
from app.core.exceptions import AppError
from app.core.exceptions import register_exception_handlers
from app.routers import analytics
from app.routers.analytics import _analytics_filters, ai_failed_conversations_export, negative_conversations
from app.services.analytics_service import AnalyticsService, _normalize_review_record


def test_review_record_exposes_consistent_customer_identity_fields():
    named = _normalize_review_record({
        "customerName": " Nguyễn An ",
        "customerId": "C001",
        "phoneNumber": None,
    })
    identified = _normalize_review_record({"customerId": "C002"})
    phone_only = _normalize_review_record({"phoneNumber": "0901000000"})
    unknown = _normalize_review_record({})

    assert named["customerDisplayName"] == "Nguyễn An"
    assert identified["customerDisplayName"] == "C002"
    assert phone_only["customerDisplayName"] == "0901000000"
    assert unknown["customerDisplayName"] == "Không xác định"


class PositiveConversationRepository:
    def __init__(self):
        self.filters = None

    def get_positive_conversations(self, filters):
        self.filters = dict(filters)
        return {
            "records": [{
                "conversationId": 7,
                "customerName": None,
                "customerId": "C007",
                "sentimentLabel": "positive",
                "messageAt": "2026-06-20 09:30:00",
            }],
            "pagination": {"page": 1, "pageSize": 20, "total": 1},
            "optionalColumns": {},
        }


def test_positive_conversations_use_latest_conversation_sentiment_rule():
    repository = PositiveConversationRepository()
    service = AnalyticsService(repository=repository)

    result = service.get_positive_conversations({"topic": "TOEIC", "page": 1})

    assert repository.filters == {"topic": "TOEIC", "page": 1}
    assert result["metadata"]["aggregationRule"] == "latest_analyzed_message_per_conversation"
    assert result["records"][0]["customerDisplayName"] == "C007"
    assert result["records"][0]["sentimentLabel"] == "positive"


class NegativeConversationService:
    def get_negative_review_conversations(self, filters):
        return {
            "records": [],
            "pagination": {"page": 1, "pageSize": 10, "total": 0},
            "metadata": {"criteria": "sentimentLabel=negative AND needStaffReview=1"},
        }


def test_negative_conversation_endpoint_returns_a_response_envelope():
    response = negative_conversations(
        filters={"page": 1, "pageSize": 10},
        service=NegativeConversationService(),
    )

    assert response is not None
    assert response["success"] is True
    assert response["data"]["pagination"]["total"] == 0
    assert response["meta"]["canonicalEndpoint"] == "/api/analytics/negative-conversations"


def test_topic_filter_uses_parameterized_exact_json_member_without_new_sql_json_functions():
    repository = AnalyticsRepository()

    where, params = repository._build_read_where({"topic": "TOEIC_100%[A]"}, {})

    assert "ISJSON" not in where
    assert "OPENJSON" not in where
    assert "LIKE ?" in where
    assert params == ["TOEIC_100%[A]", '%"TOEIC~_100~%~[A]"%']


def test_analytics_filters_return_iso_dates_and_reject_inverted_range():
    filters = _analytics_filters(
        startDate=date(2024, 1, 23),
        endDate=date(2024, 1, 24),
        fromDate=date(2024, 1, 1),
        toDate=date(2024, 1, 31),
    )

    assert filters["startDate"] == "2024-01-23"
    assert filters["endDate"] == "2024-01-24"
    assert filters["fromDate"] == "2024-01-01"
    assert filters["toDate"] == "2024-01-31"

    with pytest.raises(HTTPException) as exc:
        _analytics_filters(fromDate=None, toDate=None, startDate=date(2024, 1, 24), endDate=date(2024, 1, 23))

    assert exc.value.status_code == 422


def test_ai_status_filter_maps_public_success_failed_values_to_issue_flag():
    repository = AnalyticsRepository()

    success_where, success_params = repository._build_read_where({"aiStatus": "success"}, {"issueFlag": True})
    failed_where, failed_params = repository._build_read_where({"aiStatus": "failed"}, {"issueFlag": True})
    all_where, all_params = repository._build_read_where({"aiStatus": "Tất cả"}, {"issueFlag": True})

    assert "ISNULL(a.issueFlag, 0) = 0" in success_where
    assert success_params == []
    assert "a.issueFlag = 1" in failed_where
    assert failed_params == []
    assert "issueFlag" not in all_where
    assert all_params == []


class FailedConversationExportService:
    def __init__(self):
        self.calls = []

    def get_failed_conversations(self, filters):
        self.calls.append(dict(filters))
        page = int(filters.get("page") or 1)
        records_by_page = {
            1: [
                {
                    "id": 1,
                    "messageId": "000000000001",
                    "conversationId": "9001",
                    "customerId": "000123456789",
                    "phoneNumber": "0901000000",
                    "customerDisplayName": "Nguyễn An",
                    "textContent": "Khi nào có lịch thi?",
                    "aiAnswer": "Không tìm thấy dữ liệu",
                    "detectedTopics": ["Lịch thi"],
                    "source": "Facebook",
                    "issueType": "Không tìm thấy dữ liệu",
                    "issueConfidence": 0.92,
                    "issueReason": "Thiếu FAQ",
                    "messageAt": "2026-06-23 09:00:00",
                },
                {
                    "id": 2,
                    "messageId": "2",
                    "conversationId": "9002",
                    "customerId": "C002",
                    "phoneNumber": None,
                    "customerDisplayName": "C002",
                    "textContent": "Câu có, dấu phẩy",
                    "aiAnswer": "Dòng 1\nDòng 2",
                    "detectedTopics": ["TOEIC", "VSTEP"],
                    "source": "ZaloOA",
                    "issueType": "Khác",
                    "issueConfidence": 0.2,
                    "issueReason": "=not a formula",
                    "messageAt": "2026-06-23 10:00:00",
                },
            ],
            2: [
                {
                    "id": 3,
                    "messageId": "3",
                    "conversationId": "9003",
                    "customerId": "C003",
                    "phoneNumber": "0911000000",
                    "customerDisplayName": "C003",
                    "textContent": "Trang hai",
                    "aiAnswer": "AI lỗi",
                    "detectedTopics": ["Khác"],
                    "source": "ChatWidget",
                    "issueType": "Lỗi hệ thống",
                    "issueConfidence": 0.5,
                    "issueReason": "timeout",
                    "messageAt": "2026-06-23 11:00:00",
                },
            ],
        }
        return {
            "records": records_by_page.get(page, []),
            "pagination": {"page": page, "pageSize": 100, "total": 3},
        }


class FailingFailedConversationExportService:
    def get_ai_failed_conversations(self, **_):
        raise RuntimeError("database unavailable")


async def _collect_streaming_response_text(response):
    chunks = []
    async for chunk in response.body_iterator:
        chunks.append(chunk.decode("utf-8") if isinstance(chunk, bytes) else chunk)
    return "".join(chunks)


def test_failed_conversation_export_streams_all_filtered_records_with_csv_headers():
    service = FailedConversationExportService()

    response = ai_failed_conversations_export(
        filters={"topic": "TOEIC", "page": 1, "pageSize": 10},
        maxExportRows=10,
        service=service,
    )
    content = pytest.importorskip("anyio").run(_collect_streaming_response_text, response)

    assert response.status_code == 200
    assert response.headers["X-Total-Records"] == "3"
    assert response.headers["Content-Disposition"].startswith("attachment; filename*=UTF-8''cau-hoi-ai-chua-xu-ly-")
    assert content.startswith("\ufeffSTT,Message ID,Conversation ID,Customer ID")
    parsed_rows = list(csv.reader(StringIO(content.lstrip("\ufeff"))))
    assert len(parsed_rows) == 4
    assert parsed_rows[0][:4] == ["STT", "Message ID", "Conversation ID", "Customer ID"]
    assert "\t000000000001" in content
    assert "\t000123456789" in content
    assert '"Câu có, dấu phẩy"' in content
    assert "'=not a formula" in content
    assert service.calls[0]["topic"] == "TOEIC"
    assert service.calls[0]["page"] == 1
    assert service.calls[0]["pageSize"] == 100
    assert service.calls[1]["page"] == 2


def test_failed_conversation_export_rejects_over_cap_before_streaming():
    service = FailedConversationExportService()

    with pytest.raises(AppError) as exc:
        ai_failed_conversations_export(filters={}, maxExportRows=2, service=service)

    assert exc.value.status_code == 400
    assert "vượt giới hạn" in exc.value.message


def test_failed_conversation_export_requires_manager_role():
    sessions = HMACBearerSessions(secret="s" * 32, ttl_seconds=900, clock=lambda: 1_000)
    app = FastAPI()
    register_exception_handlers(app)
    app.include_router(analytics.router)
    app.dependency_overrides[get_session_manager] = lambda: sessions
    app.dependency_overrides[analytics.get_analytics_service] = lambda: FailedConversationExportService()
    client = TestClient(app)

    no_token = client.get("/api/analytics/ai/failed-conversations/export")
    assert no_token.status_code == 401

    staff_token = sessions.issue(username="staff01", role="staff")
    forbidden = client.get(
        "/api/analytics/ai/failed-conversations/export",
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert forbidden.status_code == 403

    manager_token = sessions.issue(username="manager01", role="manager")
    allowed = client.get(
        "/api/analytics/ai/failed-conversations/export",
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert allowed.status_code == 200
    assert allowed.headers["X-Total-Records"] == "3"


def test_failed_conversation_export_returns_500_when_query_fails():
    sessions = HMACBearerSessions(secret="s" * 32, ttl_seconds=900, clock=lambda: 1_000)
    app = FastAPI()
    register_exception_handlers(app)
    app.include_router(analytics.router)
    app.dependency_overrides[get_session_manager] = lambda: sessions
    app.dependency_overrides[analytics.get_analytics_service] = lambda: FailingFailedConversationExportService()
    client = TestClient(app, raise_server_exceptions=False)

    manager_token = sessions.issue(username="manager01", role="manager")
    response = client.get(
        "/api/analytics/ai/failed-conversations/export",
        headers={"Authorization": f"Bearer {manager_token}"},
    )

    assert response.status_code == 500
    assert "text/csv" not in response.headers.get("content-type", "")
