import re

file_path = 'backend/app/settings/user_repository.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

correct_create_user = '''
    def create_user(self, username: str, password: str, name: str, email: str, phone: str, active: bool = True, role: str = "Nhân viên CSKH") -> dict:
        username = username.strip()
        if not username:
            raise Exception("Tên đăng nhập là bắt buộc.")
        if not password:
            raise Exception("Mật khẩu là bắt buộc.")

        conn = None
        try:
            conn = get_db_connection()
            cursor = conn.cursor(as_dict=True)
            cursor.execute("SELECT UserName FROM [WebChat_User] WHERE UserName = %s", (username,))
            if cursor.fetchone():
                raise Exception(f"Tên đăng nhập {username} đã tồn tại.")

            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO [WebChat_User] (UserName, Password, DangHoatDong, HoTen, ShortName, Email, DienThoai, VaiTro)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (username, password, 1 if active else 0, name or username, name or username, email or None, phone or None, role)
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
                "UPDATE [WebChat_User] SET HoTen = %s, Email = %s, DienThoai = %s WHERE UserName = %s",
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
'''

import re
pattern = re.compile(r'    def create_user\(self, username: str, password: str, name: str, email: str, phone: str, active: bool = True, role: str = "Nhân viên CSKH"\) -> dict:.*?(?=    def update_password\(self, username: str, new_password: str\) -> bool:)', re.DOTALL)
new_content = pattern.sub(correct_create_user + '\n', content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)
