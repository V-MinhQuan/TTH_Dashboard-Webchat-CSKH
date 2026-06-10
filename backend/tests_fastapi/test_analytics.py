from fastapi.testclient import TestClient

from app.main import app
from app.routers import analytics as analytics_router
from app.services.analytics_service import AnalyticsService


class FakeAnalyticsService:
    def get_sentiment_summary(self, filters):
        return {
            "total": 10,
            "positive": 1,
            "neutral": 8,
            "negative": 1,
            "issueFlag": 2,
            "needStaffReview": 3,
            "metadata": {"issueMetadataAvailable": True},
        }

    def get_sentiment_trend(self, filters):
        return [{"date": "2026-06-01", "positive": 1, "neutral": 2, "negative": 1, "issueFlag": 1}]

    def get_satisfaction_summary(self, filters):
        return {"avgSatisfactionScore": 0, "totalMessages": 10, "needReviewCount": 3, "levelDistribution": {}}

    def get_satisfaction_trend(self, filters):
        return [{"date": "2026-06-01", "avgScore": 50, "count": 10, "needReviewCount": 3}]

    def get_topic_summary(self, filters):
        return [{"topicKey": "document", "topicLabel": "Ho so", "count": 4}]

    def get_keywords(self, filters):
        return [{"keyword": "issue:missing_email_or_notification", "count": 2}]

    def get_need_review_conversations(self, filters):
        return {
            "records": [{"messageId": 1, "sentimentLabel": "neutral", "issueFlag": True, "needStaffReview": True}],
            "pagination": {"page": filters["page"], "pageSize": filters["pageSize"], "total": 1},
            "metadata": {"issueMetadataAvailable": True},
        }


def test_analytics_endpoints_with_mocked_service():
    app.dependency_overrides[analytics_router.get_analytics_service] = lambda: FakeAnalyticsService()
    client = TestClient(app)
    try:
        assert client.get("/api/analytics/sentiment-summary").json()["data"]["issueFlag"] == 2
        assert client.get("/api/analytics/sentiment-trend").json()["data"][0]["issueFlag"] == 1
        assert client.get("/api/analytics/need-review-keywords?mode=needReview").json()["data"][0]["count"] == 2
        legacy = client.get("/api/analytics/negative-conversations?page=2&pageSize=5").json()
        assert legacy["meta"]["legacy"] is True
        assert legacy["data"]["metadata"]["canonicalEndpoint"] == "/api/analytics/need-review-conversations"
    finally:
        app.dependency_overrides.clear()


def test_optional_columns_missing_summary_metadata():
    class Repo:
        def get_sentiment_summary(self, filters):
            return {
                "row": {"total": 1, "neutral": 1},
                "analyzerVersionDistribution": [],
                "optionalColumns": {"issueFlag": False, "issueType": False, "issueReason": False, "issueConfidence": False},
            }

    result = AnalyticsService(Repo()).get_sentiment_summary({})
    assert result["metadata"]["issueMetadataAvailable"] is False
    assert result["issueFlag"] == 0


def test_optional_columns_present_summary_metadata():
    class Repo:
        def get_sentiment_summary(self, filters):
            return {
                "row": {"total": 1, "neutral": 1, "issueFlag": 1},
                "analyzerVersionDistribution": [],
                "optionalColumns": {"issueFlag": True, "issueType": True, "issueReason": True, "issueConfidence": True},
            }

    result = AnalyticsService(Repo()).get_sentiment_summary({})
    assert result["metadata"]["issueMetadataAvailable"] is True
    assert result["issueFlag"] == 1

