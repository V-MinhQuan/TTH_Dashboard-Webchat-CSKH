from __future__ import annotations

from copy import deepcopy

from fastapi.testclient import TestClient

from app.core.auth import create_session_manager
from app.main import app
from app.routers.feedback import get_feedback_service
from app.sheet_chatbot.service import SheetChatbotConflictError


class FakeFeedbackService:
    def __init__(self):
        self.created_payload = None

    async def get_rows(self, filters):
        return {"rows": [], "total": 0, "page": filters["page"], "pageSize": filters["pageSize"], "stats": {}}

    async def create_row(self, payload):
        self.created_payload = deepcopy(payload)
        return {"id": "CS-001", **payload}

    async def find_duplicates(self, question, min_similarity, limit):
        return []


def _auth(role="staff", username="qa-user"):
    token = create_session_manager().issue(username=username, role=role)
    return {"Authorization": f"Bearer {token}"}


def test_feedback_endpoints_require_auth_and_use_session_identity():
    service = FakeFeedbackService()
    app.dependency_overrides[get_feedback_service] = lambda: service
    client = TestClient(app)
    try:
        assert client.get("/api/admin/sheet-chatbot").status_code == 401
        response = client.post(
            "/api/admin/sheet-chatbot",
            headers=_auth(),
            json={
                "question": "Câu hỏi thật",
                "correctAnswer": "Câu trả lời đã xác nhận",
                "topic": "TOEIC",
                "source": "Nhân viên đề xuất",
                "risk": "Thấp",
                "status": "Chờ xử lý",
                "notes": "conversationId=100",
            },
        )
        assert response.status_code == 201
        assert service.created_payload["addedBy"] == "qa-user"
        assert service.created_payload["question"] == "Câu hỏi thật"
    finally:
        app.dependency_overrides.pop(get_feedback_service, None)


def test_feedback_create_maps_duplicate_to_409():
    class DuplicateService(FakeFeedbackService):
        async def create_row(self, payload):
            raise SheetChatbotConflictError("Câu hỏi này đã tồn tại trong thư viện phản hồi.")

    app.dependency_overrides[get_feedback_service] = DuplicateService
    client = TestClient(app)
    try:
        response = client.post(
            "/api/admin/sheet-chatbot",
            headers=_auth(role="manager"),
            json={"question": "Trùng", "correctAnswer": "Đã xác nhận"},
        )
        assert response.status_code == 409
        assert response.json()["success"] is False
    finally:
        app.dependency_overrides.pop(get_feedback_service, None)


def test_feedback_delete_is_manager_only():
    client = TestClient(app)
    response = client.delete("/api/admin/sheet-chatbot/CS-001", headers=_auth(role="staff"))
    assert response.status_code == 403
