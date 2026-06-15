from fastapi import APIRouter, HTTPException, status, Query
from pydantic import BaseModel
from typing import Optional

from app.settings.service import settings_service
from app.settings.user_service import user_service

router = APIRouter(prefix="/api/settings", tags=["settings"])


# --- Schemas ---
class SettingsUpdateSchema(BaseModel):
    emailNotif: Optional[bool] = None
    slackNotif: Optional[bool] = None
    aiFailAlert: Optional[bool] = None
    weeklyReport: Optional[bool] = None
    autoEscalate: Optional[bool] = None
    hallucinationDetect: Optional[bool] = None
    autoFAQ: Optional[bool] = None
    compactView: Optional[bool] = None
    language: Optional[str] = None
    exportFormat: Optional[str] = None
    dataRetention: Optional[str] = None
    showAiFailed: Optional[bool] = None
    sortBy: Optional[str] = None
    pageSize: Optional[str] = None
    channelZaloOA: Optional[bool] = None
    channelZaloBiz: Optional[bool] = None
    channelFacebook: Optional[bool] = None
    channelWidget: Optional[bool] = None
    alertFailRate: Optional[int] = None
    alertResponseTime: Optional[int] = None
    alertUncertainRate: Optional[int] = None
    dataSourceZalo: Optional[bool] = None
    dataSourceZaloBiz: Optional[bool] = None
    dataSourceFb: Optional[bool] = None
    dataSourceWidget: Optional[bool] = None
    dataSyncInterval: Optional[str] = None


class ProfileUpdateSchema(BaseModel):
    username: str
    name: str
    email: str
    phone: str


class UserCreateSchema(BaseModel):
    username: str
    password: str
    name: str
    email: str = ""
    phone: str = ""
    active: bool = True


class UserStatusSchema(BaseModel):
    active: bool


class UserResetPasswordSchema(BaseModel):
    newPassword: Optional[str] = None


class OTPRequestSchema(BaseModel):
    username: str
    currentPassword: str


class OTPVerifySchema(BaseModel):
    username: str
    otp: str


class PasswordConfirmSchema(BaseModel):
    username: str
    otp: str
    newPassword: str


# --- Settings endpoints ---
@router.get("")
def get_settings():
    try:
        data = settings_service.get_settings()
        return {
            "success": True,
            "message": "Get settings successfully",
            "data": data
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.put("")
def update_settings(body: SettingsUpdateSchema):
    try:
        updates = body.model_dump(exclude_unset=True)
        data = settings_service.update_settings(updates)
        return {
            "success": True,
            "message": "Update settings successfully",
            "data": data
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# --- User Management endpoints ---
@router.get("/users")
def get_all_users():
    try:
        data = user_service.get_all_users()
        return {
            "success": True,
            "message": "Get users successfully",
            "data": data
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(body: UserCreateSchema):
    try:
        data = user_service.create_user(
            username=body.username,
            password=body.password,
            name=body.name,
            email=body.email,
            phone=body.phone,
            active=body.active,
        )
        return {
            "success": True,
            "message": "Tạo người dùng thành công.",
            "data": data
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.patch("/users/{username}/status")
def update_user_status(username: str, body: UserStatusSchema):
    try:
        data = user_service.set_user_active(username, body.active)
        return {
            "success": True,
            "message": "Cập nhật trạng thái người dùng thành công.",
            "data": data
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/users/{username}/reset-password")
def reset_user_password(username: str, body: UserResetPasswordSchema):
    try:
        data = user_service.reset_user_password(username, body.newPassword)
        return {
            "success": True,
            "message": "Reset mật khẩu người dùng thành công.",
            "data": data
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# --- User Profile endpoints ---
@router.get("/profile")
def get_profile(username: str = Query(..., description="Tên đăng nhập của user")):
    profile = user_service.get_profile(username)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy thông tin cho user: {username}"
        )
    return {
        "success": True,
        "message": "Get profile successfully",
        "data": profile
    }


@router.put("/profile")
def update_profile(body: ProfileUpdateSchema):
    try:
        data = user_service.update_profile(
            username=body.username,
            name=body.name,
            email=body.email,
            phone=body.phone
        )
        return {
            "success": True,
            "message": "Cập nhật thông tin tài khoản thành công.",
            "data": data
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# --- Password Change with OTP endpoints ---
@router.post("/profile/change-password/request")
def request_password_change_otp(body: OTPRequestSchema):
    try:
        res = user_service.request_password_change_otp(
            username=body.username,
            current_password=body.currentPassword
        )
        return res
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/profile/change-password/verify-otp")
def verify_otp(body: OTPVerifySchema):
    try:
        user_service.verify_otp(
            username=body.username,
            otp_code=body.otp
        )
        return {
            "success": True,
            "message": "Mã OTP hợp lệ."
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/profile/change-password/confirm")
def confirm_password_change(body: PasswordConfirmSchema):
    try:
        user_service.confirm_password_change(
            username=body.username,
            otp_code=body.otp,
            new_password=body.newPassword
        )
        return {
            "success": True,
            "message": "Đổi mật khẩu thành công."
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
