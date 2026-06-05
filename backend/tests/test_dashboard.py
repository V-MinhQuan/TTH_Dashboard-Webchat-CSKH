import sys
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

# Add project root to sys.path
sys.path.append(str(Path(__file__).resolve().parents[2]))

from backend.services.conversation_cleaner import conversation_cleaner_service
from backend.services.dashboard_service import DashboardService, hash_str, classify_topic
from backend.main import app

client = TestClient(app)

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

@patch('backend.repositories.conversation_repository.ConversationRepository.get_conversations')
@patch('backend.repositories.conversation_repository.ConversationRepository.get_message_counts')
@patch('backend.repositories.conversation_repository.ConversationRepository.get_ai_failures_count')
@patch('backend.repositories.conversation_repository.ConversationRepository.get_trends')
@patch('backend.repositories.conversation_repository.ConversationRepository.get_urgent_alerts_data')
@patch('backend.repositories.conversation_repository.ConversationRepository.get_top_questions_data')
@patch('backend.repositories.conversation_repository.ConversationRepository.get_ai_grouped_stats')
@patch('backend.repositories.conversation_repository.ConversationRepository.get_message_texts')
def test_dashboard_service_computes_correct_kpis(
    mock_msg_texts, mock_ai_grouped, mock_top_q, mock_alerts, mock_trends, mock_ai_fail, mock_counts, mock_convs
):
    # Setup mocks
    mock_convs.return_value = [
        {
            "id": 1,
            "customer_id": "C1",
            "customer_name": "Nguyen Van A",
            "status": "mới",
            "source": "facebook",
            "created_at": datetime(2026, 6, 1, 8, 0),
            "first_response_at": datetime(2026, 6, 1, 8, 10),  # 10 mins response
            "updated_at": datetime(2026, 6, 1, 8, 15)
        },
        {
            "id": 2,
            "customer_id": "C2",
            "customer_name": "Le Thi B",
            "status": "đang xử lý",
            "source": "zalooa",
            "created_at": datetime(2026, 6, 1, 8, 30),
            "first_response_at": datetime(2026, 6, 1, 8, 50),  # 20 mins response
            "updated_at": datetime(2026, 6, 1, 8, 55)
        },
        {
            "id": 3,
            "customer_id": "C1",  # duplicate customer
            "customer_name": "Nguyen Van A",
            "status": "closed",
            "source": "chatwidget",
            "created_at": datetime(2026, 6, 1, 9, 0),
            "first_response_at": None,
            "updated_at": datetime(2026, 6, 1, 9, 5)
        }
    ]
    mock_counts.return_value = []
    mock_ai_fail.return_value = 0
    mock_trends.return_value = {
        "totalConversations": 12,
        "totalMessages": 8,
        "activeConversations": 18,
        "closedConversations": 11,
        "aiFailures": 15
    }
    mock_alerts.return_value = []
    mock_top_q.return_value = []
    mock_ai_grouped.return_value = []
    mock_msg_texts.return_value = []

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

@patch('backend.services.dashboard_service.dashboard_service.get_kpis')
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

@patch('backend.services.dashboard_service.dashboard_service.close_conversation')
def test_api_close_conversation_success(mock_close):
    mock_close.return_value = True
    response = client.post("/api/conversations/close", json={"customerId": "123", "source": "Facebook"})
    assert response.status_code == 200
    assert response.json()["success"] is True
    assert "xử lý thành công" in response.json()["message"]

def test_api_close_conversation_missing_params():
    response = client.post("/api/conversations/close", json={"customerId": "", "source": "Facebook"})
    assert response.status_code == 400
    assert response.json()["success"] is False
    assert "Thiếu" in response.json()["message"]

@patch('backend.repositories.conversation_repository.ConversationRepository.get_conversations')
@patch('backend.repositories.conversation_repository.ConversationRepository.get_message_counts')
@patch('backend.repositories.conversation_repository.ConversationRepository.get_ai_failures_count')
@patch('backend.repositories.conversation_repository.ConversationRepository.get_trends')
@patch('backend.repositories.conversation_repository.ConversationRepository.get_urgent_alerts_data')
@patch('backend.repositories.conversation_repository.ConversationRepository.get_top_questions_data')
@patch('backend.repositories.conversation_repository.ConversationRepository.get_ai_grouped_stats')
@patch('backend.repositories.conversation_repository.ConversationRepository.get_message_texts')
def test_dashboard_service_priority_conversations_mapping(
    mock_msg_texts, mock_ai_grouped, mock_top_q, mock_alerts, mock_trends, mock_ai_fail, mock_counts, mock_convs
):
    mock_convs.return_value = [
        {
            "id": 1,
            "customer_id": "C1",
            "customer_name": "Nguyen Van A",
            "status": "pending",
            "source": "facebook",
            "created_at": datetime(2026, 6, 1, 8, 0),
            "first_response_at": None,
            "updated_at": datetime(2026, 6, 1, 8, 15)
        },
        {
            "id": 2,
            "customer_id": "C2",
            "customer_name": "Le Thi B",
            "status": "open",
            "source": "zalooa",
            "created_at": datetime(2026, 6, 1, 8, 30),
            "first_response_at": datetime(2026, 6, 1, 8, 50),
            "updated_at": datetime(2026, 6, 1, 8, 55)
        }
    ]
    mock_counts.return_value = []
    mock_ai_fail.return_value = 0
    mock_trends.return_value = {
        "totalConversations": 2,
        "totalMessages": 2,
        "activeConversations": 2,
        "closedConversations": 0,
        "aiFailures": 0
    }
    mock_alerts.return_value = []
    mock_top_q.return_value = []
    mock_ai_grouped.return_value = []
    mock_msg_texts.return_value = []

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

