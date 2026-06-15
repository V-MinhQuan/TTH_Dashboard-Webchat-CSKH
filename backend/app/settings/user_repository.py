import sys
from pathlib import Path
from typing import Optional

sys.path.append(str(Path(__file__).resolve().parents[2]))
from app.core.legacy_db import get_db_connection

class UserRepository:
    def get_user_by_username(self, username: str) -> Optional[dict]:
        username = username.strip()
        conn = None
        try:
            conn = get_db_connection()
            cursor = conn.cursor(as_dict=True)
            cursor.execute(
                "SELECT UserName, DangHoatDong, HoTen, ShortName, Email, DienThoai, Password FROM [User] WHERE UserName = %s",
                (username,)
            )
            row = cursor.fetchone()
            if row:
                return {
                    "username": row["UserName"],
                    "name": row["HoTen"] or row["ShortName"] or row["UserName"],
                    "email": row["Email"] or f"{row['UserName']}@flic.edu.vn",
                    "phone": row["DienThoai"] or "0123456789",
                    "role": "manager" if row["UserName"] in ("test", "thuynt", "admin") else "staff",
                    "password": row["Password"],
                    "active": bool(row["DangHoatDong"])
                }
        except Exception as e:
            print(f"[UserRepository] Lỗi truy vấn DB: {e}")
            raise e
        finally:
            if conn:
                conn.close()
        return None

    def get_all_users(self) -> list[dict]:
        conn = None
        try:
            conn = get_db_connection()
            cursor = conn.cursor(as_dict=True)
            cursor.execute(
                "SELECT UserName, DangHoatDong, HoTen, ShortName, Email, DienThoai FROM [User]"
            )
            rows = cursor.fetchall()
            users = []
            for row in rows:
                role = "Quản lý CSKH" if row["UserName"] in ("test", "thuynt", "admin") else "Nhân viên CSKH"
                channels = "Tất cả" if role == "Quản lý CSKH" else "Zalo Business, Facebook"
                permissions = "Toàn quyền hệ thống" if role == "Quản lý CSKH" else "Xử lý hội thoại"
                
                users.append({
                    "id": row["UserName"],
                    "name": row["HoTen"] or row["ShortName"] or row["UserName"],
                    "email": row["Email"] or f"{row['UserName']}@flic.edu.vn",
                    "role": role,
                    "channels": channels,
                    "permissions": permissions,
                    "status": "Đang hoạt động" if bool(row["DangHoatDong"]) else "Ngừng hoạt động",
                    "lastLogin": "Hôm nay"
                })
            return users
        except Exception as e:
            print(f"[UserRepository] Lỗi truy vấn danh sách DB: {e}")
            raise e
        finally:
            if conn:
                conn.close()
        return []

    def update_profile(self, username: str, name: str, email: str, phone: str) -> bool:
        username = username.strip()
        conn = None
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE [User] SET HoTen = %s, Email = %s, DienThoai = %s WHERE UserName = %s",
                (name, email, phone, username)
            )
            conn.commit()
            return True
        except Exception as e:
            print(f"[UserRepository] Lỗi cập nhật Profile DB: {e}")
            raise e
        finally:
            if conn:
                conn.close()
        return False

    def update_password(self, username: str, new_password: str) -> bool:
        username = username.strip()
        conn = None
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE [User] SET Password = %s WHERE UserName = %s",
                (new_password, username)
            )
            conn.commit()
            return True
        except Exception as e:
            print(f"[UserRepository] Lỗi cập nhật mật khẩu DB: {e}")
            raise e
        finally:
            if conn:
                conn.close()
        return False

user_repository = UserRepository()
