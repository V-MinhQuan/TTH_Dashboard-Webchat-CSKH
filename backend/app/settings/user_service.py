import random
import secrets
import string
import time
from typing import Optional

from app.settings.user_repository import user_repository
from app.settings.mail_service import mail_service

# Temp in-memory store for OTPs
# Format: { username: { "otp": "123456", "expires_at": 1718000000 } }
_otp_store = {}
OTP_EXPIRATION_SECONDS = 300  # 5 minutes


class UserService:
    def get_profile(self, username: str) -> Optional[dict]:
        user = user_repository.get_user_by_username(username)
        if not user:
            return None
        # Do not return password to frontend
        profile = user.copy()
        profile.pop("password", None)
        return profile

    def get_all_users(self) -> list[dict]:
        return user_repository.get_all_users()

    def create_user(self, username: str, password: str, name: str, email: str, phone: str, active: bool = True) -> dict:
        if len(password or "") < 6:
            raise Exception("Mật khẩu phải có ít nhất 6 ký tự.")
        return user_repository.create_user(
            username=username,
            password=password,
            name=name,
            email=email,
            phone=phone,
            active=active,
        )

    def update_profile(self, username: str, name: str, email: str, phone: str) -> dict:
        success = user_repository.update_profile(username, name, email, phone)
        if not success:
            raise Exception("Lỗi khi cập nhật thông tin người dùng trong cơ sở dữ liệu.")
        
        updated_user = user_repository.get_user_by_username(username)
        if not updated_user:
            raise Exception("Lỗi khi lấy thông tin người dùng sau khi cập nhật.")
            
        profile = updated_user.copy()
        profile.pop("password", None)
        return profile

    def request_password_change_otp(self, username: str, current_password: str) -> dict:
        user = user_repository.get_user_by_username(username)
        if not user:
            raise Exception("Không tìm thấy thông tin tài khoản người dùng.")
            
        if user["password"] != current_password:
            raise Exception("Mật khẩu hiện tại không chính xác.")
            
        # Generate 6-digit OTP
        otp_code = "".join([str(random.randint(0, 9)) for _ in range(6)])
        expires_at = time.time() + OTP_EXPIRATION_SECONDS
        
        _otp_store[username.lower()] = {
            "otp": otp_code,
            "expires_at": expires_at
        }
        
        # Send OTP
        to_email = user["email"]
        sent = mail_service.send_otp_email(to_email, otp_code)
        
        return {
            "success": True,
            "message": f"Mã xác thực đã được gửi tới email {to_email}." if sent else f"Không thể gửi mail thực tế. Mã xác thực đã được log ra cửa sổ console của hệ thống.",
            "email": to_email,
            "sent_via_smtp": sent
        }

    def verify_otp(self, username: str, otp_code: str) -> bool:
        key = username.lower()
        if key not in _otp_store:
            raise Exception("Chưa có yêu cầu mã xác thực nào được khởi tạo.")
            
        record = _otp_store[key]
        if time.time() > record["expires_at"]:
            _otp_store.pop(key, None)
            raise Exception("Mã xác thực OTP đã hết hạn (5 phút). Vui lòng yêu cầu mã mới.")
            
        if record["otp"] != otp_code.strip():
            raise Exception("Mã xác thực OTP không chính xác.")
            
        return True

    def confirm_password_change(self, username: str, otp_code: str, new_password: str) -> bool:
        # Validate OTP
        self.verify_otp(username, otp_code)
        
        # Update DB password
        success = user_repository.update_password(username, new_password)
        if not success:
            raise Exception("Không thể cập nhật mật khẩu mới trong cơ sở dữ liệu.")
            
        # Clear OTP from memory store
        _otp_store.pop(username.lower(), None)
        return True

    def set_user_active(self, username: str, active: bool) -> dict:
        success = user_repository.set_active(username, active)
        if not success:
            raise Exception(f"Không tìm thấy người dùng {username}.")

        user = user_repository.get_user_by_username(username)
        if not user:
            raise Exception("Không thể lấy thông tin người dùng sau khi cập nhật trạng thái.")
        user.pop("password", None)
        return user

    def reset_user_password(self, username: str, new_password: Optional[str] = None) -> dict:
        password = new_password or self._generate_temporary_password()
        if len(password) < 6:
            raise Exception("Mật khẩu mới phải có ít nhất 6 ký tự.")

        success = user_repository.update_password(username, password)
        if not success:
            raise Exception(f"Không tìm thấy người dùng {username}.")

        return {
            "username": username,
            "temporaryPassword": password,
        }

    def _generate_temporary_password(self) -> str:
        alphabet = string.ascii_letters + string.digits
        return "".join(secrets.choice(alphabet) for _ in range(10))


user_service = UserService()
