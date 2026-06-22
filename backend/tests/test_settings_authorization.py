import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.auth import HMACBearerSessions, get_session_manager
from app.routers.settings import router


SECRET = "settings-test-secret-that-is-at-least-32-characters"


def make_client():
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_session_manager] = lambda: HMACBearerSessions(
        secret=SECRET,
        ttl_seconds=3600,
    )
    return TestClient(app)


def token(role: str, username: str = "tester") -> str:
    return HMACBearerSessions(secret=SECRET, ttl_seconds=3600).issue(
        username=username,
        role=role,
    )


def test_settings_rejects_missing_and_invalid_sessions():
    with make_client() as client:
        missing = client.get("/api/settings")
        invalid = client.get("/api/settings", headers={"Authorization": "Bearer invalid"})

    assert missing.status_code == 401
    assert invalid.status_code == 401


def test_staff_cannot_manage_users():
    with make_client() as client:
        response = client.get(
            "/api/settings/users",
            headers={"Authorization": f"Bearer {token('staff')}"},
        )

    assert response.status_code == 403
