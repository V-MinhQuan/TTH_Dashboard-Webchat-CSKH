"""
Router for authentication endpoints.
Thay thế /api/auth/login trong legacy.py bằng modular FastAPI router.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.services.auth_service import AuthService

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


def get_auth_service() -> AuthService:
    return AuthService()


@router.post("/login")
def login(
    request: LoginRequest,
    service: AuthService = Depends(get_auth_service),
):
    """
    Đăng nhập và trả về thông tin user.

    Role được xác định hoàn toàn trong code thông qua biến môi trường
    MANAGER_USERNAMES, không phụ thuộc vào database.
    """
    result = service.login(request.username, request.password)
    status_code = result.pop("status_code", 200)

    if not result["success"]:
        return JSONResponse(status_code=status_code, content=result)

    return result
