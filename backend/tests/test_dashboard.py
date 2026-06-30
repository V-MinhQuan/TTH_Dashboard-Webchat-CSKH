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
            assert cache_key.startswith("top_questions_ai:all")
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
    assert args[0].startswith("top_questions_ai:Facebook")
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

    start_arg, end_arg = mock_summary.call_args.args[:2]
    assert start_arg is not None
    assert end_arg is not None
    assert (
        datetime.strptime(end_arg, "%Y-%m-%d") - datetime.strptime(start_arg, "%Y-%m-%d")
    ).days == dashboard_module.DEFAULT_KPI_DATE_WINDOW_DAYS

    assert mock_alerts.call_count == 1
    assert mock_alerts.call_args.args[:2] == (start_arg, end_arg)
    assert mock_overtime.call_count == 1

# ==========================================
# 3. Tests for API Endpoints
# ==========================================

def test_api_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["success"] is True
    assert "running successfully" in response.json()["message"]

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
    
    # C2 (status open) -> Đang xử lý
    c2 = next(c for c in priority_convs if c["customerId"] == "C2")
    assert c2["customer"] == "C2"
    assert c2["status"] == "Đang xử lý"

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
    assert "OUTER APPLY" in query
    assert "customer.SentAt <= m.SentAt" in query
    assert "m.FromHost = 1" in query
    assert "m.HostDisplayName = 'AI Assistant'" in query
    assert "m.TextContent LIKE N'%không tìm thấy%'" in query
    assert params == ("2026-06-01", "2026-06-30 23:59:59.999")
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
