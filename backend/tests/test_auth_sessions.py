import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.auth import HMACBearerSessions, InvalidSessionToken
from app.routers.auth import get_auth_service, router
from app.services.auth_service import AuthService


class StubAuthRepository:
    def __init__(self, row):
        self.row = row

    def find_user(self, username: str, password: str):
        return self.row


def test_hmac_session_round_trip_and_tamper_detection():
    sessions = HMACBearerSessions(
        secret="s" * 32,
        ttl_seconds=900,
        clock=lambda: 1_000,
    )

    token = sessions.issue(username="manager01", role="manager")
    claims = sessions.verify(token)

    assert claims.username == "manager01"
    assert claims.role == "manager"
    assert claims.issued_at == 1_000
    assert claims.expires_at == 1_900

    payload, signature = token.split(".")
    tampered = f"{payload[:-1]}A.{signature}"
    with pytest.raises(InvalidSessionToken, match="không hợp lệ"):
        sessions.verify(tampered)


def test_hmac_session_rejects_expired_token():
    now = [1_000]
    sessions = HMACBearerSessions(
        secret="s" * 32,
        ttl_seconds=60,
        clock=lambda: now[0],
    )
    token = sessions.issue(username="staff01", role="staff")

    now[0] = 1_061

    with pytest.raises(InvalidSessionToken, match="hết hạn"):
        sessions.verify(token)


def test_hmac_session_requires_a_strong_configured_secret():
    with pytest.raises(ValueError, match="APP_AUTH_SECRET"):
        HMACBearerSessions(secret="too-short", ttl_seconds=900)


def test_login_returns_bearer_token_without_mutating_user_payload():
    row = {
        "UserName": "manager01",
        "DangHoatDong": True,
        "HoTen": "Nguyễn Quản Lý",
        "ShortName": "QL",
        "Email": "manager01@flic.edu.vn",
        "DienThoai": "0900000000",
    }
    sessions = HMACBearerSessions(
        secret="s" * 32,
        ttl_seconds=900,
        clock=lambda: 1_000,
    )
    service = AuthService(
        repository=StubAuthRepository(row),
        sessions=sessions,
        manager_usernames=("manager01",),
    )

    result = service.login(" manager01 ", "password")

    assert result["success"] is True
    assert result["data"]["tokenType"] == "Bearer"
    assert result["data"]["expiresIn"] == 900
    assert result["data"]["accessToken"] == result["data"]["token"]
    assert result["data"]["tokenExpiresAt"] == "1970-01-01T00:31:40Z"
    assert sessions.verify(result["data"]["token"]).role == "manager"
    assert "token" not in row
    assert result["message"] == "Đăng nhập thành công."


def test_login_endpoint_returns_token_in_data_envelope():
    sessions = HMACBearerSessions(
        secret="s" * 32,
        ttl_seconds=900,
        clock=lambda: 1_000,
    )
    service = AuthService(
        repository=StubAuthRepository(
            {
                "UserName": "staff01",
                "DangHoatDong": True,
                "HoTen": "Nguyễn Nhân Viên",
            }
        ),
        sessions=sessions,
        manager_usernames=(),
    )
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_auth_service] = lambda: service

    response = TestClient(app).post(
        "/api/auth/login",
        json={"username": "staff01", "password": "password"},
    )

    assert response.status_code == 200
    assert response.json()["data"]["tokenType"] == "Bearer"
    assert response.json()["data"]["accessToken"] == response.json()["data"]["token"]
    assert sessions.verify(response.json()["data"]["token"]).username == "staff01"
    assert "status_code" not in response.json()


@pytest.mark.parametrize(
    ("row", "expected_status", "expected_message"),
    [
        (None, 401, "Tên đăng nhập hoặc mật khẩu không đúng."),
        (
            {"UserName": "staff01", "DangHoatDong": False},
            403,
            "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.",
        ),
    ],
)
def test_login_rejects_invalid_or_inactive_accounts(row, expected_status, expected_message):
    service = AuthService(
        repository=StubAuthRepository(row),
        sessions=HMACBearerSessions(secret="s" * 32, ttl_seconds=900),
        manager_usernames=(),
    )

    result = service.login("staff01", "password")

    assert result["status_code"] == expected_status
    assert result["message"] == expected_message
    assert "data" not in result
