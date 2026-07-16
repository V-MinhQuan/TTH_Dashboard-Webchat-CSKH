import sys
import json
import sys
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

# Add backend package root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.auth import SessionClaims, get_current_session
from app.services import legacy_dashboard_service as dashboard_module
from app.services.conversation_cleaner import conversation_cleaner_service
from app.services.legacy_dashboard_service import (
    AI_OVERLOAD_MESSAGE,
    DashboardService,
    QuestionGroupingAIError,
    build_top_question_rows,
    classify_topic,
    clear_dashboard_cache,
    hash_str,
    prepare_question_items,
)
from app.repositories.legacy_conversation_repository import ConversationRepository
from app.core.auth import create_session_manager
from app.main import app

client = TestClient(app)


class NoopQuestionGroupCache:
    def get(self, *_args, **_kwargs):
        return None

    def upsert(self, *_args, **_kwargs):
        return None


@pytest.fixture(autouse=True)
def disable_question_group_db_cache(monkeypatch):
    dashboard_module.reset_ai_gateway_state()
    monkeypatch.setattr(
        dashboard_module,
        "ai_question_group_cache_repository",
        NoopQuestionGroupCache(),
    )


def auth_headers(role="staff"):
    token = create_session_manager().issue(username="dashboard-test", role=role)
    return {"Authorization": f"Bearer {token}"}

# ==========================================
# 1. Tests for Conversation Cleaner Service
# ==========================================

def test_cleaner_removes_invalid_records():
    raw_data = [
        {"id": 1, "created_at": "2026-06-01T08:00:00Z", "customer_id": "C1", "source": "Facebook"},
        {"id": 2, "customer_id": "C2", "source": "ZaloOA"},  # missing created_at
        {"created_at": "2026-06-01T08:00:00Z", "customer_id": "C3", "source": "ChatWidget"},  # missing id
        {"id": 4, "created_at": "invalid-date", "customer_id": "C4", "source": "Facebook"}  # invalid date
    ]
    result = conversation_cleaner_service.clean_and_normalize(raw_data)
    assert len(result) == 1
    assert result[0]["id"] == "1"

def test_cleaner_removes_duplicate_ids():
    raw_data = [
        {"id": "1", "created_at": "2026-06-01T08:00:00Z", "customer_id": "C1", "source": "Facebook"},
        {"id": "1", "created_at": "2026-06-01T09:00:00Z", "customer_id": "C1", "source": "Facebook"}  # duplicate
    ]
    result = conversation_cleaner_service.clean_and_normalize(raw_data)
    assert len(result) == 1
    assert result[0]["id"] == "1"

def test_cleaner_normalizes_status():
    raw_data = [
        {"id": 1, "created_at": "2026-06-01T08:00:00Z", "status": "mới"},
        {"id": 2, "created_at": "2026-06-01T08:00:00Z", "status": "processing"},
        {"id": 3, "created_at": "2026-06-01T08:00:00Z", "status": "chờ xử lý"},
        {"id": 4, "created_at": "2026-06-01T08:00:00Z", "status": "done"},
        {"id": 5, "created_at": "2026-06-01T08:00:00Z", "status": "hành tinh lạ"}
    ]
    result = conversation_cleaner_service.clean_and_normalize(raw_data)
    assert result[0]["status"] == "new"
    assert result[1]["status"] == "open"
    assert result[2]["status"] == "pending"
    assert result[3]["status"] == "closed"
    assert result[4]["status"] == "unknown"

def test_cleaner_normalizes_source():
    raw_data = [
        {"id": 1, "created_at": "2026-06-01T08:00:00Z", "source": "fb"},
        {"id": 2, "created_at": "2026-06-01T08:00:00Z", "source": "zalooa"},
        {"id": 3, "created_at": "2026-06-01T08:00:00Z", "source": "zalobusiness"},
        {"id": 4, "created_at": "2026-06-01T08:00:00Z", "source": "chatwidget"},
        {"id": 5, "created_at": "2026-06-01T08:00:00Z", "source": "tiktok"}
    ]
    result = conversation_cleaner_service.clean_and_normalize(raw_data)
    assert result[0]["source"] == "Facebook"
    assert result[1]["source"] == "ZaloOA"
    assert result[2]["source"] == "ZaloBusiness"
    assert result[3]["source"] == "ChatWidget"
    assert result[4]["source"] == "other"

# ==========================================
# 2. Tests for Dashboard Service
# ==========================================

@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_conversation_summary')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_message_counts_filtered')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_trends')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_urgent_alerts_data')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_overtime_alerts_data')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_top_questions_data')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_priority_conversations_data')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_daily_conversation_summary')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_ai_daily_stats')
def test_dashboard_service_computes_correct_kpis(
    mock_ai_daily, mock_daily, mock_priority, mock_top_q, mock_overtime, mock_alerts, mock_trends, mock_counts, mock_summary
):
    clear_dashboard_cache()
    mock_summary.return_value = {
        "totalConversations": 3,
        "newCustomers": 2,
        "statusSummary": {
            "new": 1,
            "open": 1,
            "pending": 0,
            "closed": 1,
            "unknown": 0
        },
        "sourceSummary": {
            "Facebook": 1,
            "ZaloOA": 1,
            "ZaloBusiness": 0,
            "ChatWidget": 1
        },
        "averageResponseTimeMinutes": 15
    }
    mock_counts.return_value = []
    mock_trends.return_value = {
        "totalConversations": 12,
        "totalMessages": 8,
        "activeConversations": 18,
        "closedConversations": 11,
        "aiFailures": 15
    }
    mock_alerts.return_value = []
    mock_overtime.return_value = []
    mock_top_q.return_value = []
    mock_priority.return_value = []
    mock_daily.return_value = []
    mock_ai_daily.return_value = []

    service = DashboardService()
    kpi = service.get_kpis("2026-06-01", "2026-06-30")

    assert kpi["totalConversations"] == 3
    assert kpi["newCustomers"] == 2
    assert kpi["statusSummary"] == {
        "new": 1,
        "open": 1,
        "pending": 0,
        "closed": 1,
        "unknown": 0
    }
    assert kpi["sourceSummary"] == {
        "Facebook": 1,
        "ZaloOA": 1,
        "ZaloBusiness": 0,
        "ChatWidget": 1
    }
    assert kpi["averageResponseTimeMinutes"] == 15


@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_conversation_summary')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_message_counts_filtered')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_trends')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_urgent_alerts_data')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_overtime_alerts_data')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_top_questions_data')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_priority_conversations_data')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_daily_conversation_summary')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_ai_daily_stats')
def test_dashboard_service_can_skip_priority_conversations_for_fast_kpis(
    mock_ai_daily, mock_daily, mock_priority, mock_top_q, mock_overtime, mock_alerts, mock_trends, mock_counts, mock_summary
):
    clear_dashboard_cache()
    mock_summary.return_value = {
        "totalConversations": 1,
        "newCustomers": 1,
        "statusSummary": {"new": 0, "open": 1, "pending": 0, "closed": 0, "unknown": 0},
        "sourceSummary": {"Facebook": 1},
        "averageResponseTimeMinutes": 0,
    }
    mock_counts.return_value = []
    mock_trends.return_value = {}
    mock_alerts.return_value = []
    mock_overtime.return_value = []
    mock_top_q.return_value = []
    mock_daily.return_value = []
    mock_ai_daily.return_value = []

    kpi = DashboardService().get_kpis(
        "2026-06-01",
        "2026-06-30",
        {
            "includePriorityConversations": False,
            "includeUrgentAlerts": False,
            "includeTopQuestions": False,
            "includeTrendComparison": False,
        },
    )

    mock_priority.assert_not_called()
    mock_alerts.assert_not_called()
    mock_overtime.assert_not_called()
    mock_top_q.assert_not_called()
    assert mock_summary.call_count == 1
    assert mock_counts.call_count == 1
    assert mock_ai_daily.call_count == 1
    assert kpi["priorityConversations"] == []
    assert kpi["urgentAlerts"] == []
    assert kpi["topQuestions"] == []


def test_dashboard_service_runs_expanded_topic_kpis_without_thread_pool(monkeypatch):
    clear_dashboard_cache()

    class TopicRepo:
        def get_conversation_summary(self, *args):
            return {
                "totalConversations": 1,
                "newCustomers": 1,
                "statusSummary": {"new": 0, "open": 1, "pending": 0, "closed": 0, "unknown": 0},
                "sourceSummary": {"ZaloOA": 0, "ZaloBusiness": 0, "Facebook": 1, "ChatWidget": 0},
                "averageResponseTimeMinutes": 0,
            }

        def get_message_counts_filtered(self, *args):
            return [{"source": "Facebook", "count": 2}]

        def get_daily_conversation_summary(self, *args):
            return []

        def get_ai_daily_stats(self, *args):
            return []

        def get_urgent_alerts_data(self, *args, **kwargs):
            return []

        def get_overtime_alerts_data(self, *args, **kwargs):
            return []

    def fail_thread_pool(*_args, **_kwargs):
        raise AssertionError("Topic-filtered KPI queries must not use the thread pool")

    monkeypatch.setattr(dashboard_module, "ThreadPoolExecutor", fail_thread_pool)
    service = DashboardService()
    service.repository = TopicRepo()

    result = service.get_kpis(
        "2026-01-01",
        "2026-06-01",
        {
            "topic": "Học Tiếng Anh",
            "includePriorityConversations": False,
            "includeUrgentAlerts": True,
            "includeTopQuestions": False,
            "includeTrendComparison": False,
        },
    )

    assert result["totalConversations"] == 1
    assert result["totalMessages"] == 2


def test_prepare_question_items_cleans_noise_and_merges_duplicates():
    raw_rows = [
        {"question": " Học phí là bao nhiêu??? ", "source": "facebook"},
        {"question": "hoc phi la bao nhieu", "source": "fb"},
        {"question": "http://example.com/banner", "source": "zalooa"},
        {"question": "Xin chào", "source": "chatwidget"},
        {"question": "Lịch thi TOEIC khi nào ạ?", "source": "zalooa", "count": 2},
    ]

    items = prepare_question_items(raw_rows)

    assert len(items) == 2
    tuition_item = next(
        item for item in items
        if any("hoc phi" in variant["question"].lower() or "học phí" in variant["question"].lower() for variant in item["variants"])
    )
    schedule_item = next(item for item in items if "Lịch thi TOEIC" in item["question"])

    assert tuition_item["count"] == 2
    assert tuition_item["sourceCounts"]["Facebook"] == 2
    assert schedule_item["count"] == 2


def test_build_top_question_rows_uses_ai_groups(monkeypatch):
    raw_rows = [
        {"question": "Học phí là bao nhiêu?", "source": "facebook", "count": 2},
        {"question": "Giá khóa học thế nào?", "source": "zalooa", "count": 3},
        {"question": "Trung tâm ở đâu?", "source": "chatwidget", "count": 1},
    ]

    def fake_request_ai_question_groups(prompt: str) -> str:
        assert "Học phí là bao nhiêu?" in prompt
        return (
            '{"groups":['
            '{"question":"Học phí và chi phí khóa học là bao nhiêu?","itemIds":["g1","g2"]},'
            '{"question":"Trung tâm ở đâu?","itemIds":["g3"]}'
            ']}'
        )

    monkeypatch.setattr(dashboard_module, "request_ai_question_groups", fake_request_ai_question_groups)

    rows, status, message = build_top_question_rows(raw_rows)

    assert status == "ok"
    assert message == ""
    assert rows[0]["question"] == "Học phí và chi phí khóa học là bao nhiêu?"
    assert rows[0]["count"] == 5
    assert rows[0]["sourceQuestionCount"] == 2
    assert {item["question"] for item in rows[0]["relatedQuestions"]} == {
        "Học phí là bao nhiêu?",
        "Giá khóa học thế nào?",
    }


def test_build_top_question_rows_keeps_more_than_display_top_five(monkeypatch):
    raw_rows = [
        {"question": "Học phí TOEIC là bao nhiêu?", "source": "facebook", "count": 9},
        {"question": "Lịch thi VSTEP khi nào?", "source": "zalooa", "count": 8},
        {"question": "Cách đăng ký khóa học tin học thế nào?", "source": "chatwidget", "count": 7},
        {"question": "Khi nào nhận chứng chỉ MOS?", "source": "facebook", "count": 6},
        {"question": "Trung tâm ở đâu?", "source": "zalooa", "count": 5},
        {"question": "Cách tra cứu điểm TOEIC?", "source": "chatwidget", "count": 4},
        {"question": "Hồ sơ xét miễn chuẩn đầu ra gồm gì?", "source": "facebook", "count": 3},
    ]

    def fake_request_ai_question_groups(_: str) -> str:
        return json.dumps({
            "groups": [
                {"question": row["question"], "itemIds": [f"g{index}"]}
                for index, row in enumerate(raw_rows, start=1)
            ]
        }, ensure_ascii=False)

    monkeypatch.setattr(dashboard_module, "request_ai_question_groups", fake_request_ai_question_groups)

    rows, status, message = build_top_question_rows(raw_rows)

    assert status == "ok"
    assert message == ""
    assert len(rows) == len(raw_rows)


def test_build_top_question_rows_limits_ai_prompt_to_display_candidates(monkeypatch):
    questions = [
        "Học phí TOEIC là bao nhiêu?",
        "Lịch thi VSTEP khi nào?",
        "Cách đăng ký MOS như thế nào?",
        "Làm sao nhận phiếu điểm IC3?",
        "Trung tâm ở đâu?",
        "Khi nào có chứng chỉ đầu ra?",
        "Hồ sơ miễn chuẩn đầu ra cần gì?",
        "Cách tra cứu điểm TOEIC như thế nào?",
        "Lệ phí thi VSTEP bao nhiêu?",
        "Ca thi tin học lúc nào?",
        "Kết quả thi MOS khi nào?",
        "Đổi lịch thi có được không?",
        "Bảo lưu khóa học có được không?",
        "Hủy đăng ký khóa học như thế nào?",
        "Nhận chứng nhận ở đâu?",
        "Thời hạn nộp hồ sơ là khi nào?",
        "Mã lớp học dùng như thế nào?",
        "Học online có được không?",
        "Gia hạn tài khoản e-learning có được không?",
        "Liên hệ phòng đào tạo ở đâu?",
    ]
    raw_rows = [
        {"question": question, "source": "facebook", "count": 100 - index}
        for index, question in enumerate(questions, start=1)
    ]
    captured_candidate_count = None

    def fake_request_ai_question_groups(prompt: str) -> str:
        nonlocal captured_candidate_count
        payload = json.loads(prompt.split("Các cụm ứng viên:\n", 1)[1])
        captured_candidate_count = len(payload)
        assert captured_candidate_count <= dashboard_module.TOP_QUESTIONS_AI_CANDIDATE_LIMIT
        assert all(str(item["id"]).startswith("g") for item in payload)
        return json.dumps({
            "groups": [
                {"question": item["question"], "itemIds": [item["id"]]}
                for item in payload
            ]
        }, ensure_ascii=False)

    monkeypatch.setattr(dashboard_module, "request_ai_question_groups", fake_request_ai_question_groups)

    rows, status, message = build_top_question_rows(raw_rows)

    assert status == "ok"
    assert message == ""
    assert captured_candidate_count == dashboard_module.TOP_QUESTIONS_AI_CANDIDATE_LIMIT
    assert dashboard_module.TOP_QUESTIONS_DISPLAY_LIMIT < len(rows) <= dashboard_module.TOP_QUESTIONS_RESPONSE_LIMIT


def test_build_top_question_rows_uses_database_fallback_without_ai_result(monkeypatch):
    raw_rows = [
        {"question": "Học phí là bao nhiêu?", "source": "facebook", "count": 2},
        {"question": "Giá khóa học thế nào?", "source": "zalooa", "count": 3},
    ]

    def fake_request_ai_question_groups(_: str) -> str:
        raise QuestionGroupingAIError("quota exceeded")

    monkeypatch.setattr(dashboard_module, "request_ai_question_groups", fake_request_ai_question_groups)

    rows, status, message = build_top_question_rows(raw_rows)

    assert status == "fallback"
    assert "database" in message
    assert rows[0]["question"] == "Học phí và chi phí khóa học là bao nhiêu?"
    assert rows[0]["count"] == 5
    assert rows[0]["aiGenerated"] is False


def test_database_fallback_does_not_merge_unrelated_short_question_cues(monkeypatch):
    raw_rows = [
        {"question": "Dạ lịch thi xem chỗ nào ạ", "source": "facebook", "count": 6},
        {"question": "Flic cho e xin lịch thi nâng cao với ạ", "source": "zalobusiness", "count": 4},
        {"question": "Ko được nhận bằng sớm hơn ạ?", "source": "facebook", "count": 3},
        {"question": "Dạ cho em hỏi là nhóm 3 người trở lên được không ạ?", "source": "facebook", "count": 2},
        {"question": "Dạ khi nào ạ", "source": "zalooa", "count": 2},
    ]

    def fake_request_ai_question_groups(_: str) -> str:
        raise QuestionGroupingAIError("quota exceeded")

    monkeypatch.setattr(dashboard_module, "request_ai_question_groups", fake_request_ai_question_groups)

    rows, status, _message = build_top_question_rows(raw_rows)

    assert status == "fallback"
    schedule_row = next(row for row in rows if row["question"].startswith("Lịch thi"))
    related_questions = {item["question"] for item in schedule_row["relatedQuestions"]}
    assert related_questions == {
        "Dạ lịch thi xem chỗ nào ạ",
        "Flic cho e xin lịch thi nâng cao với ạ",
    }


def test_database_fallback_does_not_mix_cntt_schedule_with_english_schedule(monkeypatch):
    raw_rows = [
        {"question": "Dạ lịch thi tin học ạ", "source": "facebook", "count": 4},
        {
            "question": "Với có lịch học V-step tháng 5 tầm tháng 8 - 9 thi không ạ",
            "source": "zalobusiness",
            "count": 2,
        },
        {"question": "Em muốn hỏi lịch thi tin học nâng cao ạ", "source": "facebook", "count": 2},
    ]

    def fake_request_ai_question_groups(_: str) -> str:
        raise QuestionGroupingAIError("quota exceeded")

    monkeypatch.setattr(dashboard_module, "request_ai_question_groups", fake_request_ai_question_groups)

    rows, status, _message = build_top_question_rows(raw_rows)

    assert status == "fallback"
    cntt_row = next(row for row in rows if row["question"] == "Lịch thi Sát hạch CNTT là khi nào?")
    english_row = next(
        row
        for row in rows
        if any("V-step" in item["question"] for item in row["relatedQuestions"])
    )
    cntt_related = {item["question"] for item in cntt_row["relatedQuestions"]}
    english_related = {item["question"] for item in english_row["relatedQuestions"]}

    assert english_row["topic"] == "Học Tiếng Anh"
    assert "Với có lịch học V-step tháng 5 tầm tháng 8 - 9 thi không ạ" not in cntt_related
    assert cntt_related == {
        "Dạ lịch thi tin học ạ",
        "Em muốn hỏi lịch thi tin học nâng cao ạ",
    }
    assert english_related == {
        "Với có lịch học V-step tháng 5 tầm tháng 8 - 9 thi không ạ",
    }


def test_database_fallback_separates_it_certificate_from_english_certificate(monkeypatch):
    it_question = (
        "Dạ cho em hỏi về việc nộp bằng tin học cho trường để xét chuẩn đầu ra "
        "thì có quy định ngày nộp cụ thể không ạ?"
    )
    english_question = "Dạ chị cho em khi nào nộp bằng Tiếng Anh xét đầu ra vậy ạ"
    raw_rows = [
        {"question": english_question, "source": "facebook", "count": 4},
        {"question": it_question, "source": "zalobusiness", "count": 3},
        {"question": "Em đăng ký thi chứng chỉ ngoại ngữ làm thủ tục onl rồi ạ", "source": "facebook", "count": 2},
    ]

    def fake_request_ai_question_groups(_: str) -> str:
        raise QuestionGroupingAIError("quota exceeded")

    monkeypatch.setattr(dashboard_module, "request_ai_question_groups", fake_request_ai_question_groups)

    rows, status, _message = build_top_question_rows(raw_rows)

    assert status == "fallback"
    english_row = next(
        row for row in rows
        if any(english_question == item["question"] for item in row["relatedQuestions"])
    )
    it_row = next(
        row for row in rows
        if any(it_question == item["question"] for item in row["relatedQuestions"])
    )
    english_related = {item["question"] for item in english_row["relatedQuestions"]}
    it_related = {item["question"] for item in it_row["relatedQuestions"]}

    assert english_row["topic"] == "Học Tiếng Anh"
    assert it_row["topic"] == "Sát hạch CNTT"
    assert it_question not in english_related
    assert it_related == {it_question}


def test_database_fallback_does_not_turn_center_mentions_into_address_question(monkeypatch):
    raw_rows = [
        {
            "question": "Cho em hỏi là nộp hồ sơ trực tiếp tại trung tâm phải không ạ?",
            "source": "facebook",
            "count": 3,
        },
        {
            "question": "Lý thuyết thì ôn ở đâu ạ?",
            "source": "zalobusiness",
            "count": 2,
        },
    ]

    def fake_request_ai_question_groups(_: str) -> str:
        raise QuestionGroupingAIError("quota exceeded")

    monkeypatch.setattr(dashboard_module, "request_ai_question_groups", fake_request_ai_question_groups)

    rows, status, _message = build_top_question_rows(raw_rows)

    assert status == "fallback"
    questions = {row["question"] for row in rows}
    assert "Trung tâm ở đâu?" not in questions
    assert any("nộp hồ sơ" in question.lower() for question in questions)
    assert any("ôn ở đâu" in question.lower() for question in questions)


def test_prepare_question_items_filters_reminder_announcements():
    raw_rows = [
        {
            "question": "All [NHẮC LẠI: LỊCH HỌC PHỤ ĐẠO GIẢI ĐỀ CNTT CƠ BẢN THÁNG 5/2026] Ngày mai là buổi học phụ đạo đầu tiên",
            "source": "facebook",
            "count": 10,
        },
        {"question": "Dạ lịch thi tin học ạ", "source": "facebook", "count": 2},
    ]

    items = prepare_question_items(raw_rows)

    assert len(items) == 1
    assert items[0]["question"] == "Dạ lịch thi tin học ạ"


def test_prepare_question_items_filters_marketing_pitches():
    raw_rows = [
        {
            "question": (
                "Anh ơi, bên em đang có gói Audit Web giúp Organic Traffic tăng đều. "
                "Anh quan tâm nhắn em Website để em tư vấn cụ thể tới anh?"
            ),
            "source": "zalobusiness",
            "count": 1,
        },
        {"question": "Dạ lịch thi tin học ạ", "source": "facebook", "count": 2},
    ]

    items = prepare_question_items(raw_rows)

    assert len(items) == 1
    assert items[0]["question"] == "Dạ lịch thi tin học ạ"


def test_ai_group_validation_rejects_child_with_wrong_intent(monkeypatch):
    raw_rows = [
        {"question": "Lịch thi TOEIC khi nào ạ?", "source": "facebook", "count": 10},
        {"question": "Khi nào có chứng chỉ TOEIC?", "source": "zalooa", "count": 8},
        {"question": "Học phí TOEIC là bao nhiêu?", "source": "chatwidget", "count": 6},
    ]

    def fake_request_ai_question_groups(_: str) -> str:
        return json.dumps({
            "groups": [
                {
                    "question": "Lịch thi TOEIC là khi nào?",
                    "itemIds": ["g1", "g2"],
                }
            ]
        }, ensure_ascii=False)

    monkeypatch.setattr(dashboard_module, "request_ai_question_groups", fake_request_ai_question_groups)

    rows, status, _message = build_top_question_rows(raw_rows)

    assert status == "ok"
    schedule_row = next(row for row in rows if row["question"] == "Lịch thi TOEIC là khi nào?")
    assert {item["question"] for item in schedule_row["relatedQuestions"]} == {
        "Lịch thi TOEIC khi nào ạ?"
    }
    assert any(row["question"].startswith("Khi nào có chứng chỉ TOEIC") for row in rows)
    validation = dashboard_module.get_last_question_group_validation()
    assert validation["rejectedCount"] >= 1
    assert any(item["reason"] == "intent_mismatch" for item in validation["rejectedItems"])


def test_ai_group_validation_rejects_child_with_wrong_canonical_topic(monkeypatch):
    raw_rows = [
        {"question": "Lịch thi TOEIC khi nào ạ?", "source": "facebook", "count": 10},
        {"question": "Lịch thi MOS khi nào ạ?", "source": "zalooa", "count": 8},
    ]

    def fake_request_ai_question_groups(_: str) -> str:
        return json.dumps({
            "groups": [
                {
                    "question": "Lịch thi TOEIC là khi nào?",
                    "itemIds": ["g1", "g2"],
                }
            ]
        }, ensure_ascii=False)

    monkeypatch.setattr(dashboard_module, "request_ai_question_groups", fake_request_ai_question_groups)

    rows, status, _message = build_top_question_rows(raw_rows)

    assert status == "ok"
    toeic_row = next(row for row in rows if row["question"] == "Lịch thi TOEIC là khi nào?")
    assert {item["question"] for item in toeic_row["relatedQuestions"]} == {
        "Lịch thi TOEIC khi nào ạ?"
    }
    assert any("MOS" in row["question"] for row in rows)
    validation = dashboard_module.get_last_question_group_validation()
    assert any(item["reason"] == "topic_mismatch" for item in validation["rejectedItems"])


def test_ai_gateway_provider_cooldown_skips_recently_failed_provider(monkeypatch):
    calls = []

    def fail_gemini(_prompt, _timeout):
        calls.append("gemini")
        raise QuestionGroupingAIError("quota exhausted")

    def ok_openai(_prompt, _timeout):
        calls.append("openai")
        return '{"groups":[]}'

    monkeypatch.setattr(dashboard_module, "request_gemini_question_groups", fail_gemini)
    monkeypatch.setattr(dashboard_module, "request_openai_question_groups", ok_openai)

    assert dashboard_module.request_ai_question_groups("prompt") == '{"groups":[]}'
    calls.clear()
    assert dashboard_module.request_ai_question_groups("prompt") == '{"groups":[]}'
    assert calls == ["openai"]


def test_dashboard_top_question_reads_db_cache_before_rebuilding(monkeypatch):
    clear_dashboard_cache()
    service = DashboardService()
    cached_value = (
        [{"question": "Lịch thi TOEIC là khi nào?", "count": 12, "aiGenerated": True}],
        "ok",
        "",
    )

    class FakeQuestionGroupCache:
        def get(self, cache_key, **_kwargs):
            assert cache_key.startswith(f"top_questions_ai:{dashboard_module.AI_GATEWAY_PROMPT_VERSION}:all")
            return {"value": cached_value, "is_expired": False}

        def upsert(self, *_args, **_kwargs):
            raise AssertionError("Cache hit must not be overwritten.")

    monkeypatch.setattr(dashboard_module, "ai_question_group_cache_repository", FakeQuestionGroupCache())
    monkeypatch.setattr(
        service,
        "_cached_repo_call",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("DB source query should not run")),
    )

    assert service._get_cached_top_question_rows("2026-06-01", "2026-06-30") == cached_value


def test_dashboard_top_question_writes_ok_result_to_db_cache(monkeypatch):
    clear_dashboard_cache()
    service = DashboardService()
    raw_rows = [{"question": "Học phí TOEIC là bao nhiêu?", "source": "facebook", "count": 2}]
    upsert_calls = []

    class FakeQuestionGroupCache:
        def get(self, *_args, **_kwargs):
            return None

        def upsert(self, *args, **kwargs):
            upsert_calls.append((args, kwargs))

    monkeypatch.setattr(dashboard_module, "ai_question_group_cache_repository", FakeQuestionGroupCache())
    monkeypatch.setattr(service, "_cached_repo_call", lambda *_args, **_kwargs: raw_rows)
    monkeypatch.setattr(
        dashboard_module,
        "build_top_question_rows",
        lambda _rows: ([{"question": "Học phí TOEIC là bao nhiêu?", "count": 2, "aiGenerated": True}], "ok", ""),
    )
    dashboard_module._ai_gateway_last_success.update({"provider": "gemini", "model": "gemini-2.5-flash"})

    result = service._get_cached_top_question_rows("2026-06-01", "2026-06-30", channel="Facebook")

    assert result[1] == "ok"
    assert len(upsert_calls) == 1
    args, kwargs = upsert_calls[0]
    assert args[0].startswith(f"top_questions_ai:{dashboard_module.AI_GATEWAY_PROMPT_VERSION}:Facebook")
    assert kwargs["source_row_count"] == 1
    assert kwargs["source_filters"] == {"channel": "Facebook"}
    assert kwargs["provider"] == "gemini"
    assert kwargs["model"] == "gemini-2.5-flash"


def test_dashboard_top_question_uses_last_good_ai_result_when_current_ai_fails(monkeypatch, tmp_path):
    clear_dashboard_cache()
    monkeypatch.setattr(
        dashboard_module,
        "AI_QUESTION_LAST_GOOD_CACHE_FILE",
        tmp_path / "dashboard_top_questions_last_good.json",
    )
    service = DashboardService()
    raw_rows = [{"question": "Học phí là bao nhiêu?", "source": "facebook", "count": 1}]
    responses = [
        ([{"question": "Học phí khóa học là bao nhiêu?", "count": 1, "aiGenerated": True}], "ok", ""),
        ([], "ai_overloaded", AI_OVERLOAD_MESSAGE),
    ]
    calls = []

    def fake_cached_repo_call(*_args, **_kwargs):
        return raw_rows

    def fake_build_top_question_rows(_raw_rows):
        calls.append("build")
        return responses.pop(0)

    monkeypatch.setattr(service, "_cached_repo_call", fake_cached_repo_call)
    monkeypatch.setattr(dashboard_module, "build_top_question_rows", fake_build_top_question_rows)

    first = service._get_cached_top_question_rows("2026-06-01", "2026-06-30")
    assert dashboard_module.AI_QUESTION_LAST_GOOD_CACHE_FILE.exists()
    clear_dashboard_cache()
    second = service._get_cached_top_question_rows("2026-06-01", "2026-06-30")
    third = service._get_cached_top_question_rows("2026-06-01", "2026-06-30")

    assert first[1] == "ok"
    assert second[1] == "stale"
    assert second[0] == first[0]
    assert third[1] == "stale"
    assert calls == ["build", "build"]


def test_dashboard_top_question_ignores_empty_last_good_cache(monkeypatch, tmp_path):
    clear_dashboard_cache()
    monkeypatch.setattr(
        dashboard_module,
        "AI_QUESTION_LAST_GOOD_CACHE_FILE",
        tmp_path / "dashboard_top_questions_last_good.json",
    )
    service = DashboardService()
    raw_rows = [{"question": "Học phí là bao nhiêu?", "source": "facebook", "count": 1}]

    def fake_cached_repo_call(*_args, **_kwargs):
        return raw_rows

    def fake_build_top_question_rows(_raw_rows):
        return [], "ai_overloaded", AI_OVERLOAD_MESSAGE

    monkeypatch.setattr(service, "_cached_repo_call", fake_cached_repo_call)
    monkeypatch.setattr(dashboard_module, "build_top_question_rows", fake_build_top_question_rows)

    last_good_cache_key = dashboard_module.make_cache_key(
        "top_questions_ai_last_good:all",
        "2026-06-01",
        "2026-06-30",
        {},
    )
    dashboard_module.set_persistent_last_good_value(last_good_cache_key, ([], "ok", ""))

    result = service._get_cached_top_question_rows("2026-06-01", "2026-06-30")

    assert result == ([], "ai_overloaded", AI_OVERLOAD_MESSAGE)


def test_dashboard_question_ai_budget_stays_under_fast_load_target():
    total_budget = (
        dashboard_module.GEMINI_PROVIDER_BUDGET_SECONDS
        + dashboard_module.OPENAI_PROVIDER_BUDGET_SECONDS
    )

    assert total_budget <= 4.0
    assert dashboard_module.DEFAULT_KPI_DATE_WINDOW_DAYS == 30
    assert dashboard_module.QUESTION_RAW_ROW_LIMIT <= 6000
    assert dashboard_module.QUESTION_ANALYSIS_ITEM_LIMIT <= 1200
    assert dashboard_module.GEMINI_REQUEST_TIMEOUT_SECONDS <= dashboard_module.GEMINI_PROVIDER_BUDGET_SECONDS
    assert dashboard_module.OPENAI_REQUEST_TIMEOUT_SECONDS <= dashboard_module.OPENAI_PROVIDER_BUDGET_SECONDS


@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_conversation_summary')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_message_counts_filtered')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_trends')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_urgent_alerts_data')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_overtime_alerts_data')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_top_questions_data')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_priority_conversations_data')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_daily_conversation_summary')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_ai_daily_stats')
def test_dashboard_service_defaults_unbounded_kpis_to_fast_date_window(
    mock_ai_daily, mock_daily, mock_priority, mock_top_q, mock_overtime, mock_alerts, mock_trends, mock_counts, mock_summary
):
    clear_dashboard_cache()
    mock_summary.return_value = {
        "totalConversations": 0,
        "newCustomers": 0,
        "statusSummary": {"new": 0, "open": 0, "pending": 0, "closed": 0, "unknown": 0},
        "sourceSummary": {"ZaloOA": 0, "ZaloBusiness": 0, "Facebook": 0, "ChatWidget": 0},
        "averageResponseTimeMinutes": 0,
    }
    mock_counts.return_value = []
    mock_trends.return_value = {}
    mock_alerts.return_value = []
    mock_overtime.return_value = []
    mock_top_q.return_value = []
    mock_priority.return_value = []
    mock_daily.return_value = []
    mock_ai_daily.return_value = []

    DashboardService().get_kpis()

    start_arg, end_arg = mock_alerts.call_args.args[:2]
    assert start_arg is not None
    assert end_arg is not None
    assert (
        datetime.strptime(end_arg, "%Y-%m-%d") - datetime.strptime(start_arg, "%Y-%m-%d")
    ).days == dashboard_module.DEFAULT_KPI_DATE_WINDOW_DAYS
    assert any(call.args[:2] == (start_arg, end_arg) for call in mock_summary.call_args_list)

    assert mock_alerts.call_count == 1
    assert mock_alerts.call_args.args[:2] == (start_arg, end_arg)
    assert mock_alerts.call_args.kwargs == {
        "include_overtime": False,
        "channel": None,
        "conversation_status": None,
        "topic": None,
        "ai_status": None,
    }
    assert mock_overtime.call_count == 1
    assert mock_overtime.call_args.args[:2] == (start_arg, end_arg)


@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_conversation_summary')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_message_counts_filtered')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_trends')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_urgent_alerts_data')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_overtime_alerts_data')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_top_questions_data')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_priority_conversations_data')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_daily_conversation_summary')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_ai_daily_stats')
def test_dashboard_service_filters_urgent_alerts_by_topic_and_date_scope(
    mock_ai_daily, mock_daily, mock_priority, mock_top_q, mock_overtime, mock_alerts, mock_trends, mock_counts, mock_summary
):
    clear_dashboard_cache()
    mock_summary.return_value = {
        "totalConversations": 0,
        "newCustomers": 0,
        "statusSummary": {"new": 0, "open": 0, "pending": 0, "closed": 0, "unknown": 0},
        "sourceSummary": {"ZaloOA": 0, "ZaloBusiness": 0, "Facebook": 0, "ChatWidget": 0},
        "averageResponseTimeMinutes": 0,
    }
    mock_counts.return_value = []
    mock_trends.return_value = {}
    mock_alerts.return_value = []
    mock_overtime.return_value = [
        {
            "id": "toeic-1",
            "conversation_id": "conv-toeic",
            "customer_id": "C1",
            "customer_name": None,
            "source": "facebook",
            "alert_type": "overtime",
            "detected_topics": "TOEIC",
            "wait_mins": 700,
            "last_cust_text": "Tư vấn TOEIC",
            "last_ai_text": "",
        },
        {
            "id": "mos-1",
            "conversation_id": "conv-mos",
            "customer_id": "C2",
            "customer_name": None,
            "source": "facebook",
            "alert_type": "overtime",
            "detected_topics": "MOS",
            "wait_mins": 800,
            "last_cust_text": "Tư vấn MOS",
            "last_ai_text": "",
        },
    ]
    mock_top_q.return_value = []
    mock_priority.return_value = []
    mock_daily.return_value = []
    mock_ai_daily.return_value = []

    result = DashboardService().get_kpis("2026-06-01", "2026-06-30", {"topic": "TOEIC"})

    assert mock_overtime.call_args.args[:2] == ("2026-06-01", "2026-06-30")
    assert [alert["conversationId"] for alert in result["urgentAlerts"]] == ["conv-toeic"]

# ==========================================
# 3. Tests for API Endpoints
# ==========================================

def test_api_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is (payload["readiness"] == "ready")
    assert payload["readiness"] in {"ready", "degraded"}
    assert payload["status"] in {"ok", "degraded"}
    assert payload["message"] in {
        "Backend is running successfully.",
        "Backend is running with degraded dependencies.",
    }

@patch('app.services.legacy_dashboard_service.dashboard_service.get_kpis')
def test_api_get_kpis_success(mock_get_kpis):
    mock_kpi_data = {
        "totalConversations": 10,
        "totalMessages": 100,
        "newCustomers": 8,
        "aiFailures": 5,
        "statusSummary": {"new": 5, "open": 3, "pending": 0, "closed": 2, "unknown": 0},
        "sourceSummary": {"ZaloOA": 4, "ZaloBusiness": 2, "Facebook": 3, "ChatWidget": 1},
        "messageSummary": {"ZaloOA": 40, "ZaloBusiness": 20, "Facebook": 30, "ChatWidget": 10, "other": 0},
        "dateRange": {"startDate": "01/06/2026", "endDate": "30/06/2026"},
        "trends": {"totalConversations": 10, "totalMessages": 5, "activeConversations": 0, "closedConversations": 12, "aiFailures": 0},
        "averageResponseTimeMinutes": 12,
        "urgentAlerts": [],
        "topQuestions": [],
        "priorityConversations": [],
        "dailyTrends": []
    }
    mock_get_kpis.return_value = mock_kpi_data

    response = client.get("/api/dashboard/kpi")
    assert response.status_code == 200
    assert response.json()["success"] is True
    assert response.json()["data"] == mock_kpi_data


@patch('app.services.legacy_dashboard_service.dashboard_service.get_kpis')
def test_api_get_kpis_returns_controlled_error_when_required_summary_failed(mock_get_kpis):
    mock_get_kpis.return_value = {
        "totalConversations": 0,
        "totalMessages": 0,
        "partialErrors": [
            {"branch": "summary", "message": "database unavailable"},
        ],
    }

    response = client.get("/api/dashboard/kpi")

    assert response.status_code == 503
    assert response.json()["success"] is False
    assert response.json()["message"]


def test_dashboard_service_does_not_cache_kpi_when_required_summary_failed(monkeypatch):
    clear_dashboard_cache()
    service = DashboardService()
    partial_result = {
        "totalConversations": 0,
        "totalMessages": 0,
        "partialErrors": [
            {"branch": "summary", "message": "database unavailable"},
        ],
    }
    cache_writes = []

    monkeypatch.setattr(service, "_get_fast_kpis", lambda *_args, **_kwargs: partial_result)
    monkeypatch.setattr(
        dashboard_module,
        "set_cached_value",
        lambda key, value: cache_writes.append((key, value)),
    )

    result = service.get_kpis(
        "2026-01-01",
        "2026-07-15",
        {"includeTrendComparison": False},
    )

    assert result is partial_result
    assert cache_writes == []


def test_dashboard_service_retries_required_summary_once(monkeypatch):
    clear_dashboard_cache()
    service = DashboardService()
    partial_result = {
        "totalConversations": 0,
        "partialErrors": [{"branch": "summary", "message": "temporary timeout"}],
    }
    successful_result = {
        "totalConversations": 2905,
        "totalMessages": 44543,
        "partialErrors": [],
    }
    calls = []

    def fake_fast_kpis(*_args, **_kwargs):
        calls.append(1)
        return partial_result if len(calls) == 1 else successful_result

    monkeypatch.setattr(service, "_get_fast_kpis", fake_fast_kpis)

    result = service.get_kpis(
        None,
        None,
        {"dateRange": "all_time", "includeTrendComparison": False},
    )

    assert result is successful_result
    assert len(calls) == 2


def test_dashboard_query_concurrency_is_safe_for_the_weak_sql_server():
    assert dashboard_module.DASHBOARD_QUERY_WORKERS == 1


def test_explicit_kpi_dates_take_precedence_over_all_time_mode():
    service = DashboardService()

    assert service._normalize_kpi_date_range(
        "2026-05-01",
        "2026-05-31",
        "all_time",
    ) == ("2026-05-01", "2026-05-31")


def test_all_time_kpi_keeps_historical_daily_trends():
    service = DashboardService()
    service.repository = MagicMock()
    service.repository.get_conversation_summary.return_value = {
        "totalConversations": 2,
        "statusSummary": {},
        "sourceSummary": {},
    }
    service.repository.get_message_counts_filtered.return_value = []
    service.repository.get_daily_conversation_summary.return_value = [
        {"date_str": "2025-11-07", "total": 1, "processed": 1, "unprocessed": 0},
        {"date_str": "2026-06-12", "total": 1, "processed": 0, "unprocessed": 1},
    ]
    service.repository.get_ai_daily_stats.return_value = []

    result = service._get_fast_kpis(
        None,
        None,
        {
            "includePriorityConversations": False,
            "includeUrgentAlerts": False,
            "includeTopQuestions": False,
            "includeTrendComparison": False,
        },
        False,
    )

    assert [row["date"] for row in result["dailyTrends"]] == ["7/11", "12/6"]
    assert [row["total"] for row in result["dailyTrends"]] == [1, 1]


def test_kpi_partial_errors_are_sanitized():
    service = DashboardService()
    service.repository = MagicMock()
    service.repository.get_conversation_summary.return_value = {
        "totalConversations": 1,
        "statusSummary": {},
        "sourceSummary": {},
    }
    service.repository.get_message_counts_filtered.return_value = []
    service.repository.get_daily_conversation_summary.side_effect = RuntimeError(
        "server=db.internal password=do-not-expose"
    )
    service.repository.get_ai_daily_stats.return_value = []

    result = service._get_fast_kpis(
        "2026-06-01",
        "2026-06-12",
        {
            "includePriorityConversations": False,
            "includeUrgentAlerts": False,
            "includeTopQuestions": False,
            "includeTrendComparison": False,
        },
        False,
    )

    error = result["partialErrors"][0]
    assert error == {
        "branch": "daily_conversations",
        "code": "query_failed",
        "type": "RuntimeError",
    }
    assert "do-not-expose" not in json.dumps(result)

def test_api_get_kpis_invalid_start_date():
    response = client.get("/api/dashboard/kpi?startDate=invalid-date")
    assert response.status_code == 400
    assert response.json()["success"] is False
    assert "startDate không hợp lệ" in response.json()["message"]

def test_api_get_kpis_start_greater_than_end():
    response = client.get("/api/dashboard/kpi?startDate=2026-06-30&endDate=2026-06-01")
    assert response.status_code == 400
    assert response.json()["success"] is False
    assert "không thể lớn hơn ngày kết thúc" in response.json()["message"]


@patch('app.repositories.legacy_conversation_repository.get_db_connection')
def test_conversation_summary_with_topic_uses_fast_topic_scope(mock_get_db):
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cursor
    cursor.fetchone.return_value = {
        "total_conversations": 3,
        "new_customers": 2,
        "open_count": 1,
        "pending_count": 1,
        "closed_count": 1,
        "unknown_count": 0,
        "zalooa_count": 0,
        "zalobusiness_count": 0,
        "facebook_count": 3,
        "chatwidget_count": 0,
        "other_count": 0,
        "zalooa_unresolved": 0,
        "zalobusiness_unresolved": 0,
        "facebook_unresolved": 2,
        "chatwidget_unresolved": 0,
        "avg_response_minutes": 12.4,
    }
    mock_get_db.return_value = conn

    result = ConversationRepository().get_conversation_summary(
        "2026-01-01",
        "2026-06-01",
        topic="Học Tiếng Anh",
    )

    query, params = cursor.execute.call_args.args
    assert "WITH topic_scope AS" in query
    assert "FROM WebChat_MessageAnalytics topic_a" in query
    assert "INNER JOIN topic_scope" in query
    assert "FROM WebChat_Conversations c" in query
    assert "OUTER APPLY" in query
    assert "topic_scope_msg" not in query
    assert "topic_a.detectedTopics LIKE %s" in query
    assert '%"Học Tiếng Anh"%' in params
    assert "Học Tiếng Anh" not in query
    assert query.count("%s") == len(params)
    assert params[0] == "2026-01-01"
    assert params[1] == "2026-06-01 23:59:59.999"
    assert result["totalConversations"] == 3
    assert result["statusSummary"]["pending"] == 1
    assert result["sourceSummary"]["Facebook"] == 3
    assert result["unresolvedSummary"]["Facebook"] == 2
    assert result["averageResponseTimeMinutes"] == 12
    conn.close.assert_called_once()


@patch('app.repositories.legacy_conversation_repository.get_db_connection')
def test_message_counts_with_topic_counts_messages_from_topic_scope(mock_get_db):
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cursor
    cursor.fetchall.return_value = [{"source": "Facebook", "count": 12}]
    mock_get_db.return_value = conn

    result = ConversationRepository().get_message_counts_filtered(
        "2026-01-01",
        "2026-06-01",
        topic="Học Tiếng Anh",
    )

    query, params = cursor.execute.call_args.args
    assert result == [{"source": "Facebook", "count": 12}]
    assert "WITH topic_scope AS" in query
    assert "FROM WebChat_MessageAnalytics topic_a" in query
    assert "INNER JOIN topic_scope" in query
    assert "FROM WebChat_MessageLogs m" in query
    assert "topic_scope_msg" not in query
    assert "topic_a.detectedTopics LIKE %s" in query
    assert "LOWER(m.TextContent) LIKE %s" not in query
    assert '%"Học Tiếng Anh"%' in params
    assert "Học Tiếng Anh" not in query
    assert query.count("%s") == len(params)
    assert params[0] == "2026-01-01"
    assert params[1] == "2026-06-01 23:59:59.999"
    conn.close.assert_called_once()


@patch('app.repositories.legacy_conversation_repository.get_db_connection')
def test_topic_scope_matches_sat_hach_analytics_label_from_database(mock_get_db):
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cursor
    cursor.fetchone.return_value = {
        "total_conversations": 0,
        "new_customers": 0,
        "open_count": 0,
        "pending_count": 0,
        "closed_count": 0,
        "unknown_count": 0,
        "zalooa_count": 0,
        "zalobusiness_count": 0,
        "facebook_count": 0,
        "chatwidget_count": 0,
        "other_count": 0,
        "zalooa_unresolved": 0,
        "zalobusiness_unresolved": 0,
        "facebook_unresolved": 0,
        "chatwidget_unresolved": 0,
        "avg_response_minutes": 0,
    }
    mock_get_db.return_value = conn

    ConversationRepository().get_conversation_summary(
        "2026-01-01",
        "2026-06-01",
        topic="Sát hạch CNTT",
    )

    query, params = cursor.execute.call_args.args
    assert "FROM WebChat_MessageAnalytics topic_a" in query
    assert "topic_scope_msg" not in query
    assert '%"Sát hạch CNTT (Sát hạch Công nghệ thông tin)"%' in params
    assert query.count("%s") == len(params)
    conn.close.assert_called_once()


@patch('app.routers.dashboard.legacy_ds.get_kpi_comparison')
def test_api_get_dashboard_kpi_comparison_uses_filter_params(mock_get_kpi_comparison):
    mock_get_kpi_comparison.return_value = {
        "previous": {
            "totalConversations": 10,
            "totalMessages": 20,
            "activeConversations": 3,
            "closedConversations": 7,
            "aiFailures": 1,
        }
    }

    response = client.get(
        "/api/dashboard/kpi-comparison"
        "?startDate=2026-06-01"
        "&endDate=2026-06-30"
        "&channel=Facebook"
        "&topic=TOEIC"
        "&conversationStatus=Chờ xử lý"
        "&aiStatus=AI trả lời thất bại"
    )

    assert response.status_code == 200
    assert response.json()["success"] is True
    mock_get_kpi_comparison.assert_called_once_with(
        "2026-06-01",
        "2026-06-30",
        {
            "channel": "Facebook",
            "topic": "TOEIC",
            "conversationStatus": "Chờ xử lý",
            "aiStatus": "AI trả lời thất bại",
        },
    )

@patch('app.routers.dashboard.legacy_ds.get_urgent_alerts')
def test_api_get_dashboard_urgent_alerts_uses_filter_params(mock_get_urgent_alerts):
    mock_get_urgent_alerts.return_value = []

    response = client.get(
        "/api/dashboard/urgent-alerts"
        "?startDate=2026-06-01"
        "&endDate=2026-06-30"
        "&channel=facebook"
        "&topic=TOEIC"
        "&conversationStatus=Đang xử lý"
        "&aiStatus=AI trả lời thất bại"
    )

    assert response.status_code == 200
    assert response.json()["success"] is True
    mock_get_urgent_alerts.assert_called_once_with(
        "2026-06-01",
        "2026-06-30",
        {
            "channel": "facebook",
            "topic": "TOEIC",
            "conversationStatus": "Đang xử lý",
            "aiStatus": "AI trả lời thất bại",
        },
    )

@patch('app.routers.dashboard.legacy_ds.get_top_questions')
def test_api_get_dashboard_top_questions_uses_filter_params(mock_get_top_questions):
    mock_get_top_questions.return_value = {
        "topQuestions": [],
        "topQuestionsStatus": "ok",
        "topQuestionsMessage": "",
    }

    response = client.get(
        "/api/dashboard/top-questions"
        "?startDate=2026-06-01"
        "&endDate=2026-06-30"
        "&channel=facebook"
        "&topic=TOEIC"
        "&forceRefresh=true"
        "&limit=12"
    )

    assert response.status_code == 200
    assert response.json()["success"] is True
    mock_get_top_questions.assert_called_once_with(
        "2026-06-01",
        "2026-06-30",
        {
            "channel": "facebook",
            "topic": "TOEIC",
            "forceRefresh": True,
        },
        limit=12,
    )

def test_api_unknown_route_returns_404():
    response = client.get("/api/unknown-route")
    assert response.status_code == 404
    assert response.json()["success"] is False
    assert "không tồn tại" in response.json()["message"]

@patch('app.services.conversation_service.ConversationService.close_conversation')
def test_api_close_conversation_success(mock_close):
    mock_close.return_value = {
        "requestedCount": 1,
        "matchedCount": 1,
        "affectedCount": 1,
        "alreadyClosedCount": 0,
    }
    response = client.post(
        "/api/conversations/close",
        headers=auth_headers(),
        json={"customerId": "123", "source": "Facebook"},
    )
    assert response.status_code == 200
    assert response.json()["success"] is True
    assert "thành công" in response.json()["message"]

def test_api_close_conversation_missing_params():
    response = client.post(
        "/api/conversations/close",
        headers=auth_headers(),
        json={"customerId": "", "source": "Facebook"},
    )
    assert response.status_code == 422

def test_api_close_conversation_requires_login():
    response = client.post("/api/conversations/close", json={"customerId": "123", "source": "Facebook"})
    assert response.status_code == 401
    assert response.json()["success"] is False
    assert "Vui lòng đăng nhập" in response.json()["message"]

@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_conversation_summary')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_message_counts_filtered')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_trends')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_urgent_alerts_data')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_overtime_alerts_data')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_top_questions_data')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_priority_conversations_data')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_daily_conversation_summary')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_ai_daily_stats')
def test_dashboard_service_priority_conversations_mapping(
    mock_ai_daily, mock_daily, mock_priority, mock_top_q, mock_overtime, mock_alerts, mock_trends, mock_counts, mock_summary
):
    clear_dashboard_cache()
    mock_summary.return_value = {
        "totalConversations": 2,
        "newCustomers": 2,
        "statusSummary": {"new": 0, "open": 1, "pending": 1, "closed": 0, "unknown": 0},
        "sourceSummary": {"ZaloOA": 1, "ZaloBusiness": 0, "Facebook": 1, "ChatWidget": 0},
        "averageResponseTimeMinutes": 10,
    }
    mock_priority.return_value = [
        {
            "id": 1,
            "customer_id": "C1",
            "customer_name": "Mai Ly",
            "phone_number": None,
            "status": "pending",
            "source": "facebook",
            "wait_mins": 30,
        },
        {
            "id": 2,
            "customer_id": "C2",
            "customer_name": None,
            "phone_number": "0901000000",
            "status": "open",
            "source": "zalooa",
            "wait_mins": 90,
        }
    ]
    mock_counts.return_value = []
    mock_trends.return_value = {
        "totalConversations": 2,
        "totalMessages": 2,
        "activeConversations": 2,
        "closedConversations": 0,
        "aiFailures": 0
    }
    mock_alerts.return_value = []
    mock_overtime.return_value = []
    mock_top_q.return_value = []
    mock_daily.return_value = []
    mock_ai_daily.return_value = []

    service = DashboardService()
    kpi = service.get_kpis()
    
    priority_convs = kpi["priorityConversations"]
    assert len(priority_convs) == 2
    
    # C1 (status pending) -> Chờ xử lý
    c1 = next(c for c in priority_convs if c["customerId"] == "C1")
    assert c1["conversationId"] == 1
    assert c1["customer"] == "Mai Ly"
    assert c1["customerDisplayName"] == "Mai Ly"
    assert c1["status"] == "Chờ xử lý"
    
    # C2 (status open) -> Đang tư vấn
    c2 = next(c for c in priority_convs if c["customerId"] == "C2")
    assert c2["customer"] == "C2"
    assert c2["status"] == "Đang tư vấn"

@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_channel_conversation_stats')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_channel_ai_summary')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_channel_topic_stats')
def test_dashboard_service_channel_analytics_uses_filters_and_ai_stats(
    mock_topic_stats, mock_ai_summary, mock_channel_stats
):
    clear_dashboard_cache()
    mock_channel_stats.return_value = [
        {"source": "facebook", "date_str": "2026-06-01", "status": "pending", "total": 1, "avg_response_minutes": 5},
        {"source": "facebook", "date_str": "2026-06-02", "status": "closed", "total": 1, "avg_response_minutes": 20},
        {"source": "zalobusiness", "date_str": "2026-06-02", "status": "open", "total": 1, "avg_response_minutes": 10},
        {"source": "tiktok", "date_str": "2026-06-02", "status": "open", "total": 1, "avg_response_minutes": 10},
    ]
    mock_ai_summary.return_value = [
        {"source": "facebook", "ai_ok": 2, "ai_fail": 1},
        {"source": "zalobusiness", "ai_ok": 1, "ai_fail": 0},
    ]
    mock_topic_stats.return_value = [
        {"source": "facebook", "topic": "Khác", "value": 2},
        {"source": "zalobusiness", "topic": "Khác", "value": 1},
    ]

    service = DashboardService()
    result = service.get_channel_analytics("2026-06-01", "2026-06-02", {"channel": "Facebook"})

    assert result["channels"][0]["channel"] == "Facebook"
    assert result["channels"][0]["total"] == 2
    assert result["channels"][0]["unresolved"] == 1
    assert result["channels"][0]["ai_ok"] == 2
    assert result["channels"][0]["ai_fail"] == 1
    assert result["statusByChannel"][0]["Chờ xử lý"] == 1
    assert result["statusByChannel"][0]["Hoàn thành"] == 1
    assert len(result["trend"]) == 2
    assert any(cell["topic"] == "Khác" and cell["value"] == 2 for cell in result["heatmap"])

    all_channels_result = service.get_channel_analytics("2026-06-01", "2026-06-02")
    assert all_channels_result["channelsList"] == ["Zalo Business", "Facebook", "Zalo OA", "Chat Widget"]
    assert "Khác" not in [row["channel"] for row in all_channels_result["channels"]]


@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_channel_conversation_stats')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_channel_ai_summary')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_channel_topic_stats')
def test_channel_analytics_returns_partial_data_when_heatmap_branch_fails(
    mock_topic_stats, mock_ai_summary, mock_channel_stats
):
    clear_dashboard_cache()
    mock_channel_stats.return_value = [
        {"source": "facebook", "date_str": "2026-06-01", "status": "pending", "total": 3, "avg_response_minutes": 5},
    ]
    mock_ai_summary.return_value = [{"source": "facebook", "ai_ok": 2, "ai_fail": 1}]
    mock_topic_stats.side_effect = RuntimeError("topic stats timeout")

    result = DashboardService().get_channel_analytics(
        "2026-01-01",
        "2026-07-06",
        {"channel": "Facebook", "topic": "TOEIC"},
    )

    assert result["channels"][0]["channel"] == "Facebook"
    assert result["channels"][0]["total"] == 3
    assert result["channels"][0]["ai_fail"] == 1
    assert result["heatmap"] == []
    assert result["partialErrors"][0]["branch"] == "topic_stats"


@patch('app.repositories.legacy_conversation_repository.get_db_connection')
def test_channel_topic_stats_counts_only_failed_ai_messages(mock_get_db):
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cursor
    cursor.fetchall.return_value = [{"source": "facebook", "topic": "TOEIC", "value": 1}]
    mock_get_db.return_value = conn

    result = ConversationRepository().get_channel_topic_stats("2026-06-01", "2026-06-30")

    query, params = cursor.execute.call_args.args
    assert result == [{"source": "facebook", "topic": "TOEIC", "value": 1}]
    assert "WITH filtered AS" in query
    assert "FROM WebChat_MessageAnalytics a" in query
    assert "a.issueFlag = 1" in query
    assert "FROM filtered topic_row" in query
    assert "UNION ALL" in query
    assert "LIKE %s" in query
    assert query.count("%s") == len(params)
    assert params[:2] == ("2026-06-01", "2026-06-30 23:59:59.999")
    assert "TOEIC" in params
    assert '%"TOEIC"%' in params
    conn.close.assert_called_once()

@patch('app.repositories.legacy_conversation_repository.get_db_connection')
def test_channel_topic_stats_returns_empty_for_ai_success_filter(mock_get_db):
    assert ConversationRepository().get_channel_topic_stats(ai_status="AI trả lời thành công") == []
    mock_get_db.assert_not_called()

@patch('app.services.legacy_dashboard_service.dashboard_service.get_channel_analytics')
def test_api_get_channel_analytics_success(mock_get_channel_analytics):
    mock_data = {
        "channels": [],
        "trend": [],
        "statusByChannel": [],
        "heatmap": [],
        "topics": [],
        "channelsList": [],
        "dateRange": {"startDate": "2026-06-01", "endDate": "2026-06-30", "granularity": "day"},
    }
    mock_get_channel_analytics.return_value = mock_data

    response = client.get("/api/dashboard/channels?startDate=2026-06-01&endDate=2026-06-30&channel=Facebook")

    assert response.status_code == 200
    assert response.json()["success"] is True
    assert response.json()["data"] == mock_data
