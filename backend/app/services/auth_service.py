"""Xác thực người dùng và phát hành phiên bearer không trạng thái."""
from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime, timezone
from typing import Any, Dict

from app.core.auth import HMACBearerSessions, create_session_manager
from app.core.config import get_settings
from app.repositories.auth_repository import AuthRepository


class AuthService:
    def __init__(
        self,
        repository: AuthRepository | None = None,
        sessions: HMACBearerSessions | None = None,
        manager_usernames: Iterable[str] | None = None,
    ) -> None:
        settings = get_settings()
        self.repository = repository or AuthRepository()
        self.sessions = sessions or create_session_manager()
        configured_managers = (
            settings.manager_username_list
            if manager_usernames is None
            else manager_usernames
        )
        self.manager_usernames = frozenset(
            username.strip().lower()
            for username in configured_managers
            if username.strip()
        )

    def login(self, username: str, password: str) -> Dict[str, Any]:
        """Xác thực thông tin đăng nhập và trả về bearer token có thời hạn."""
        if not username or not password:
            return {
                "success": False,
                "status_code": 400,
                "message": "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.",
            }

        row = self.repository.find_user(username.strip(), password)
        if row is None:
            return {
                "success": False,
                "status_code": 401,
                "message": "Tên đăng nhập hoặc mật khẩu không đúng.",
            }
        if not row.get("DangHoatDong"):
            return {
                "success": False,
                "status_code": 403,
                "message": "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.",
            }

        user_name = str(row.get("UserName") or "").strip()
        role = "manager" if user_name.lower() in self.manager_usernames else "staff"
        token = self.sessions.issue(username=user_name, role=role)
        token_claims = self.sessions.verify(token)
        token_expires_at = datetime.fromtimestamp(
            token_claims.expires_at,
            tz=timezone.utc,
        ).isoformat().replace("+00:00", "Z")
        return {
            "success": True,
            "status_code": 200,
            "message": "Đăng nhập thành công.",
            "data": {
                "username": user_name,
                "name": row.get("HoTen") or row.get("ShortName") or user_name,
                "email": row.get("Email") or f"{user_name}@flic.edu.vn",
                "phone": row.get("DienThoai") or "",
                "role": role,
                "shortName": row.get("ShortName") or "",
                "token": token,
                "accessToken": token,
                "tokenType": "Bearer",
                "expiresIn": self.sessions.ttl_seconds,
                "tokenExpiresAt": token_expires_at,
            },
        }
