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
                    "username": row["UserName"],
                    "name": row["HoTen"] or row["ShortName"] or row["UserName"],
                    "email": row["Email"] or f"{row['UserName']}@flic.edu.vn",
                    "phone": row["DienThoai"] or "",
                    "role": role,
                    "channels": channels,
                    "permissions": permissions,
                    "active": bool(row["DangHoatDong"]),
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

    def create_user(self, username: str, password: str, name: str, email: str, phone: str, active: bool = True) -> dict:
        username = username.strip()
        if not username:
            raise Exception("Tên đăng nhập là bắt buộc.")
        if not password:
            raise Exception("Mật khẩu là bắt buộc.")

        conn = None
        try:
            conn = get_db_connection()
            cursor = conn.cursor(as_dict=True)
            cursor.execute("SELECT UserName FROM [User] WHERE UserName = %s", (username,))
            if cursor.fetchone():
                raise Exception(f"Tên đăng nhập {username} đã tồn tại.")

            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO [User] (UserName, Password, DangHoatDong, HoTen, ShortName, Email, DienThoai)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (username, password, 1 if active else 0, name or username, name or username, email or None, phone or None)
            )
            conn.commit()
        except Exception as e:
            if conn:
                conn.rollback()
            print(f"[UserRepository] Lỗi tạo user DB: {e}")
            raise e
        finally:
            if conn:
                conn.close()

        created = self.get_user_by_username(username)
        if not created:
            raise Exception("Không thể lấy thông tin người dùng sau khi tạo.")
        created.pop("password", None)
        return created

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
            return cursor.rowcount > 0
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
            return cursor.rowcount > 0
        except Exception as e:
            print(f"[UserRepository] Lỗi cập nhật mật khẩu DB: {e}")
            raise e
        finally:
            if conn:
                conn.close()
        return False

    def set_active(self, username: str, active: bool) -> bool:
        username = username.strip()
        conn = None
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE [User] SET DangHoatDong = %s WHERE UserName = %s",
                (1 if active else 0, username)
            )
            conn.commit()
            return cursor.rowcount > 0
        except Exception as e:
            print(f"[UserRepository] Lỗi cập nhật trạng thái user DB: {e}")
            raise e
        finally:
            if conn:
                conn.close()
        return False

user_repository = UserRepository()
