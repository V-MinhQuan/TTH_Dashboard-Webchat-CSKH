import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.repositories.analytics_repository import AnalyticsRepository
from app.routers.analytics import negative_conversations
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
