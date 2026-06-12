from fastapi.testclient import TestClient

from app.main import app
from app.routers import dashboard as dashboard_router


class FakeDashboardService:
    def get_kpi(self, filters):
        assert filters["dateRange"] == "all_time"
        return {
            "totalConversations": 3437,
            "totalMessages": 20183,
            "pendingConversations": 0,
            "completedConversations": 0,
            "aiFailedCount": 0,
            "needStaffReviewCount": 299,
        }


def test_dashboard_kpi_with_mocked_service():
    app.dependency_overrides[dashboard_router.get_dashboard_service] = lambda: FakeDashboardService()
    try:
        response = TestClient(app).get("/api/dashboard/kpi?dateRange=all_time")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["needStaffReviewCount"] == 299

