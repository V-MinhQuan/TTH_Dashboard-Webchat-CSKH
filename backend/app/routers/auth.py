"""Router xác thực modular."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from app.services.auth_service import AuthService

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=1024)


def get_auth_service() -> AuthService:
    return AuthService()


@router.post("/login")
def login(
    request: LoginRequest,
    service: AuthService = Depends(get_auth_service),
):
    """Đăng nhập và trả về thông tin người dùng cùng bearer token."""
    result = service.login(request.username, request.password)
    status_code = int(result.get("status_code", 200))
    response = {key: value for key, value in result.items() if key != "status_code"}
    if not response["success"]:
        return JSONResponse(status_code=status_code, content=response)
    return response
