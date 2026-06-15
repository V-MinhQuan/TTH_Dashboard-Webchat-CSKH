"""
Service for authentication and role resolution.
Xác thực user và phân quyền từ database.
"""
from __future__ import annotations

import os
from typing import Any, Dict, Optional

from app.repositories.auth_repository import AuthRepository

# Danh sách manager cấu hình qua env.
# Phân quyền được xử lý trong code theo yêu cầu, không dùng cột Role ở DB.
_FALLBACK_MANAGER_USERNAMES = {
    u.strip().lower()
    for u in os.getenv("MANAGER_USERNAMES", "test,thuynt").split(",")
    if u.strip()
}


class AuthService:
    def __init__(self, repository: AuthRepository | None = None):
        self.repository = repository or AuthRepository()

    def login(self, username: str, password: str) -> Dict[str, Any]:
        """
        Thực hiện đăng nhập.
        Returns dict với 'success', 'message', và 'data' nếu thành công.
        """
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

        # Phân quyền hoàn toàn trong code, đọc từ biến môi trường MANAGER_USERNAMES
        user_lower = (row.get("UserName") or "").strip().lower()
        role = "manager" if user_lower in _FALLBACK_MANAGER_USERNAMES else "staff"

        user_name = row.get("UserName", "")
        return {
            "success": True,
            "status_code": 200,
            "message": "Đăng nhập thành công.",
            "data": {
                "username": user_name,
                "name": row.get("HoTen") or row.get("ShortName") or user_name,
                "email": f"{user_name}@flic.edu.vn",
                "role": role,
                "shortName": row.get("ShortName") or "",
            },
        }
