"""
Repository for authentication.
Truy vấn thông tin user từ SQL Server.
"""
from __future__ import annotations

from typing import Any, Dict, Optional

from app.db.session import execute_one, get_connection


class AuthRepository:
    def __init__(self, connection_factory=get_connection):
        self._connection_factory = connection_factory

    def find_user(self, username: str, password: str) -> Optional[Dict[str, Any]]:
        """
        Tra cứu user theo username và password.
        Trả về None nếu không tìm thấy.
        Trả về dict với: UserName, DangHoatDong, HoTen, ShortName, Role (nếu có).
        """
        with self._connection_factory() as conn:
            row = execute_one(
                conn,
                """
                SELECT
                    UserName,
                    DangHoatDong,
                    HoTen,
                    ShortName,
                    Email,
                    DienThoai
                FROM [User]
                WHERE UserName = ? AND Password = ?
                """,
                [username, password],
            )
        return row if row and row.get("UserName") else None


