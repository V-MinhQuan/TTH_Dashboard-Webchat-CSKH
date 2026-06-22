import sys
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

# Add backend package root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.conversation_cleaner import conversation_cleaner_service
from app.services.legacy_dashboard_service import DashboardService, clear_dashboard_cache
from app.repositories.legacy_conversation_repository import ConversationRepository
from app.core.auth import create_session_manager
from app.main import app

client = TestClient(app)


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
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_top_questions_data')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_priority_conversations_data')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_daily_conversation_summary')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_ai_daily_stats')
def test_dashboard_service_computes_correct_kpis(
    mock_ai_daily, mock_daily, mock_priority, mock_top_q, mock_alerts, mock_trends, mock_counts, mock_summary
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

@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_conversation_summary')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_message_counts_filtered')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_trends')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_urgent_alerts_data')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_top_questions_data')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_priority_conversations_data')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_daily_conversation_summary')
@patch('app.repositories.legacy_conversation_repository.ConversationRepository.get_ai_daily_stats')
def test_dashboard_service_priority_conversations_mapping(
    mock_ai_daily, mock_daily, mock_priority, mock_top_q, mock_alerts, mock_trends, mock_counts, mock_summary
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
            "status": "pending",
            "source": "facebook",
            "wait_mins": 30,
        },
        {
            "id": 2,
            "customer_id": "C2",
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
    mock_top_q.return_value = []
    mock_daily.return_value = []
    mock_ai_daily.return_value = []

    service = DashboardService()
    kpi = service.get_kpis()
    
    priority_convs = kpi["priorityConversations"]
    assert len(priority_convs) == 2
    
    # C1 (status pending) -> Chờ xử lý
    c1 = next(c for c in priority_convs if c["customerId"] == "C1")
    assert c1["status"] == "Chờ xử lý"
    
    # C2 (status open) -> Đang xử lý
    c2 = next(c for c in priority_convs if c["customerId"] == "C2")
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
