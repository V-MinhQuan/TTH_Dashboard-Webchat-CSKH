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
    assert data[0]["topic"] == "Sát hạch CNTT (Sát hạch Công nghệ thông tin)"
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
    assert by_keyword["rot"]["topicLabel"] == "Sát hạch CNTT (Sát hạch Công nghệ thông tin)"


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
    assert "CHARINDEX(NCHAR(63), a.RawQuestion) > 0" in query
    assert "CHARINDEX(N'phải không', LOWER(a.RawQuestion)) > 0" in query
    assert "CHARINDEX(N'đúng không', LOWER(a.RawQuestion)) > 0" in query
    assert "CHARINDEX(N'làm sao', LOWER(a.RawQuestion)) > 0" in query
    assert "CHARINDEX(N'khi nào', LOWER(a.RawQuestion)) > 0" in query
    assert "CHARINDEX(N'bao nhiêu', LOWER(a.RawQuestion)) > 0" in query
    assert "CHARINDEX(N'được không', LOWER(a.RawQuestion)) > 0" in query
    assert "CHARINDEX(N'là gì', LOWER(a.RawQuestion)) > 0" in query
    assert "dbo.WebChat_ConversationStatus" in query
    assert "a.issueType = N'Không tìm thấy dữ liệu'" in query
    assert captured["params"] == []


def test_suggested_faqs_keyword_scope_filters_questions_by_group_keywords():
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
            "keywords": ["lịch thi", "TOEIC"],
            "candidateLimit": 7,
        })

    query = captured["query"]
    assert "SELECT TOP 7" in query
    assert "ISNULL(a.QuestionText, N'') LIKE ? ESCAPE '~'" in query
    assert "ISNULL(a.RawQuestion, N'') LIKE ? ESCAPE '~'" in query
    assert "ISNULL(a.MatchedNegativeKeywords, N'') LIKE ? ESCAPE '~'" in query
    assert "ISNULL(a.detectedTopics, N'') LIKE ? ESCAPE '~'" in query
    assert "GROUP BY a.QuestionText" in query
    assert captured["params"] == [
        "%lịch thi%",
        "%lịch thi%",
        "%lịch thi%",
        "%lịch thi%",
        "%TOEIC%",
        "%TOEIC%",
        "%TOEIC%",
        "%TOEIC%",
    ]


def test_suggested_faqs_keyword_scope_requires_topic_identity_keywords():
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
            "keywords": ["cấp chứng chỉ"],
            "scopeKeywords": ["VSTEP", "B1", "B2"],
            "candidateLimit": 7,
        })

    query = captured["query"]
    assert "AND (((\n            (" in query
    assert captured["params"] == [
        "%cấp chứng chỉ%",
        "%cấp chứng chỉ%",
        "%cấp chứng chỉ%",
        "%cấp chứng chỉ%",
        "%VSTEP%",
        "%VSTEP%",
        "%VSTEP%",
        "%VSTEP%",
        "%B1%",
        "%B1%",
        "%B1%",
        "%B1%",
        "%B2%",
        "%B2%",
        "%B2%",
        "%B2%",
    ]


def test_suggested_faqs_excludes_cross_topic_terms_without_trusting_detected_topic_metadata():
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
            "keywords": ["lịch thi"],
            "scopeKeywords": ["VSTEP"],
            "excludeKeywords": ["Tin học"],
            "candidateLimit": 7,
        })

    query = captured["query"]
    exclude_section = query.split("NOT (", 1)[1]
    assert "ISNULL(a.detectedTopics, N'') LIKE ? ESCAPE '~'" not in exclude_section
    assert captured["params"][-3:] == ["%Tin học%", "%Tin học%", "%Tin học%"]


def test_keyword_scoped_suggested_faqs_uses_db_fallback_when_ai_grouping_fails():
    from app.services.legacy_dashboard_service import QuestionGroupingAIError

    service = AnalyticsService(
        repository=FakeSuggestedFaqRepository([
            {
                "question": "Khi nào có lịch thi TOEIC?",
                "suggestedAnswer": "DB answer",
                "detectedTopics": '["TOEIC"]',
                "source": "Facebook",
                "freq": 5,
            },
        ])
    )

    with patch(
        "app.services.legacy_dashboard_service.cluster_question_items",
        side_effect=QuestionGroupingAIError("quota"),
    ):
        data = service.get_suggested_faqs({
            "keywords": ["lịch thi"],
            "topicLabel": "TOEIC",
            "limit": 1,
        })

    assert len(data) == 1
    assert data[0]["topic"] == "TOEIC"
    assert data[0]["freq"] == 5
    assert data[0]["suggestedAnswer"] == "DB answer"
    assert data[0]["aiGenerated"] is False
    assert data[0]["source"] == "Tổng hợp từ 5 hội thoại chứa từ khóa chủ đề"


def test_keyword_scoped_suggested_faqs_adds_topic_context_to_generic_fallback_question():
    from app.services.legacy_dashboard_service import QuestionGroupingAIError

    service = AnalyticsService(
        repository=FakeSuggestedFaqRepository([
            {
                "question": "Khi nào có chứng chỉ?",
                "suggestedAnswer": "DB answer",
                "detectedTopics": '["VSTEP"]',
                "source": "Facebook",
                "freq": 3,
            },
        ])
    )

    with patch(
        "app.services.legacy_dashboard_service.cluster_question_items",
        side_effect=QuestionGroupingAIError("quota"),
    ):
        data = service.get_suggested_faqs({
            "keywords": ["chứng chỉ"],
            "topicLabel": "Học Tiếng Anh",
            "limit": 1,
        })

    assert data[0]["question"] == "Khi nào có chứng chỉ Tiếng Anh?"


def test_keyword_scoped_suggested_faqs_adds_graduation_context_for_output_standard_topic():
    from app.services.legacy_dashboard_service import QuestionGroupingAIError

    service = AnalyticsService(
        repository=FakeSuggestedFaqRepository([
            {
                "question": "Khi nào có chứng chỉ?",
                "suggestedAnswer": "DB answer",
                "detectedTopics": '["Chuẩn đầu ra"]',
                "source": "Facebook",
                "freq": 3,
            },
        ])
    )

    with patch(
        "app.services.legacy_dashboard_service.cluster_question_items",
        side_effect=QuestionGroupingAIError("quota"),
    ):
        data = service.get_suggested_faqs({
            "keywords": ["chứng chỉ"],
            "topicLabel": "Học Tiếng Anh",
            "limit": 1,
        })

    assert data[0]["question"] == "Khi nào có chứng chỉ Tiếng Anh?"
