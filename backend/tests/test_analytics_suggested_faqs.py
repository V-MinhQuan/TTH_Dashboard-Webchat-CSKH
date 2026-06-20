import sys
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.repositories.analytics_repository import AnalyticsRepository
from app.services.analytics_service import AnalyticsService


class FakeSuggestedFaqRepository:
    def __init__(self, rows):
        self.rows = rows

    def get_suggested_faqs(self, filters):
        return self.rows


class FakeKeywordRepository:
    def __init__(self, rows):
        self.rows = rows

    def get_keyword_raw_data(self, filters):
        return {
            "rows": self.rows,
            "optionalColumns": {
                "issueFlag": True,
                "issueType": True,
                "issueReason": True,
                "issueConfidence": True,
            },
        }


def test_suggested_faqs_skip_blank_questions_without_fake_fallback():
    service = AnalyticsService(
        repository=FakeSuggestedFaqRepository([
            {
                "question": "",
                "suggestedAnswer": "Answer from DB",
                "detectedTopics": '["TOEIC"]',
                "freq": 12,
            },
            {
                "question": "Khi nao co lich thi sat hach CNTT?",
                "suggestedAnswer": "Answer from DB",
                "detectedTopics": '["Lich thi"]',
                "freq": 12,
            },
        ])
    )

    data = service.get_suggested_faqs({})

    assert len(data) == 1
    assert data[0]["question"] == "Khi nao co lich thi sat hach CNTT?"
    assert data[0]["suggestedAnswer"] == "Answer from DB"
    assert data[0]["topic"] == "Tin học / MOS / IC3"
    assert data[0]["detectedTopic"] == "Lich thi"


def test_negative_keywords_include_dominant_topic_from_database_context():
    service = AnalyticsService(
        repository=FakeKeywordRepository([
            {
                "matchedNegativeKeywords": '["chua nhan duoc mail"]',
                "detectedTopics": '["Lệ phí / Học phí"]',
                "keywordContext": "Chưa nhận được mail có mã QR để thanh toán lệ phí",
                "msgCount": 3,
            },
            {
                "matchedNegativeKeywords": '["chua nhan duoc mail"]',
                "detectedTopics": '["Khác"]',
                "keywordContext": "Chưa nhận được mail có mã QR",
                "msgCount": 1,
            },
            {
                "matchedNegativeKeywords": '["rot"]',
                "detectedTopics": '["Khac"]',
                "keywordContext": "Em thi đợt 4/4 tin cơ bản và bị rớt",
                "msgCount": 2,
            },
        ])
    )

    data = service.get_keywords({"mode": "negative"})

    by_keyword = {item["keyword"]: item for item in data}
    assert by_keyword["chua nhan duoc mail"]["count"] == 4
    assert by_keyword["chua nhan duoc mail"]["topicLabel"] == "Lệ phí / Học phí"
    assert by_keyword["rot"]["topicLabel"] == "Tin học / MOS / IC3"


def test_suggested_faqs_sql_uses_real_question_filters_and_status_filters():
    captured = {}

    @contextmanager
    def fake_connection():
        yield object()

    def fake_execute_all(conn, query, params):
        captured["query"] = query
        captured["params"] = params
        return []

    repository = AnalyticsRepository(connection_factory=fake_connection)

    with patch(
        "app.repositories.analytics_repository.inspect_message_analytics_columns",
        return_value={
            "issueFlag": True,
            "issueType": True,
            "issueReason": True,
            "issueConfidence": True,
            "standardizedQuestion": True,
        },
    ), patch("app.repositories.analytics_repository.execute_all", side_effect=fake_execute_all):
        repository.get_suggested_faqs({
            "conversationStatus": "Chờ xử lý",
            "aiStatus": "Không tìm thấy dữ liệu",
        })

    query = captured["query"]
    assert "NULLIF(LTRIM(RTRIM(a.standardizedQuestion)), '') AS StandardizedQuestion" in query
    assert "a.StandardizedQuestion IS NOT NULL" in query
    assert "a.RawQuestion LIKE N'%?%'" in query
    assert "LOWER(a.RawQuestion) LIKE N'%phải không%'" in query
    assert "LOWER(a.RawQuestion) LIKE N'%đúng không%'" in query
    assert "LOWER(a.RawQuestion) LIKE N'%làm sao%'" in query
    assert "LOWER(a.RawQuestion) LIKE N'%khi nào%'" in query
    assert "LOWER(a.RawQuestion) LIKE N'%bao nhiêu%'" in query
    assert "LOWER(a.RawQuestion) LIKE N'%được không%'" in query
    assert "LOWER(a.RawQuestion) LIKE N'%là gì%'" in query
    assert "dbo.WebChat_ConversationStatus" in query
    assert "a.issueType = N'Không tìm thấy dữ liệu'" in query
    assert captured["params"] == []
