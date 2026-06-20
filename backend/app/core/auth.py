from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from typing import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings


class InvalidSessionToken(ValueError):
    """Raised when a bearer session cannot be trusted."""


@dataclass(frozen=True)
class SessionClaims:
    username: str
    role: str
    issued_at: int
    expires_at: int


class HMACBearerSessions:
    """Issue and verify compact, stateless HMAC-SHA256 bearer sessions."""

    _ALLOWED_ROLES = frozenset({"manager", "staff"})

    def __init__(
        self,
        *,
        secret: str,
        ttl_seconds: int,
        clock: Callable[[], float] = time.time,
    ) -> None:
        secret_bytes = secret.encode("utf-8")
        if len(secret_bytes) < 32:
            raise ValueError("APP_AUTH_SECRET phải có ít nhất 32 ký tự.")
        if ttl_seconds < 60:
            raise ValueError("Thời hạn phiên đăng nhập phải từ 60 giây trở lên.")
        self._secret = secret_bytes
        self._ttl_seconds = int(ttl_seconds)
        self._clock = clock

    @property
    def ttl_seconds(self) -> int:
        return self._ttl_seconds

    def issue(self, *, username: str, role: str) -> str:
        normalized_username = username.strip()
        normalized_role = role.strip().lower()
        if not normalized_username or normalized_role not in self._ALLOWED_ROLES:
            raise ValueError("Thông tin phiên đăng nhập không hợp lệ.")

        issued_at = int(self._clock())
        payload = {
            "exp": issued_at + self._ttl_seconds,
            "iat": issued_at,
            "role": normalized_role,
            "sub": normalized_username,
            "v": 1,
        }
        payload_bytes = json.dumps(
            payload,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        ).encode("utf-8")
        encoded_payload = self._encode(payload_bytes)
        return f"{encoded_payload}.{self._signature(encoded_payload)}"

    def verify(self, token: str) -> SessionClaims:
        if not token or len(token) > 4096:
            raise InvalidSessionToken("Phiên đăng nhập không hợp lệ.")
        try:
            encoded_payload, supplied_signature = token.split(".", maxsplit=1)
        except ValueError as exc:
            raise InvalidSessionToken("Phiên đăng nhập không hợp lệ.") from exc

        expected_signature = self._signature(encoded_payload)
        if not hmac.compare_digest(supplied_signature, expected_signature):
            raise InvalidSessionToken("Phiên đăng nhập không hợp lệ.")

        try:
            payload = json.loads(self._decode(encoded_payload).decode("utf-8"))
        except (UnicodeDecodeError, ValueError, json.JSONDecodeError) as exc:
            raise InvalidSessionToken("Phiên đăng nhập không hợp lệ.") from exc

        username = payload.get("sub")
        role = payload.get("role")
        issued_at = payload.get("iat")
        expires_at = payload.get("exp")
        if (
            payload.get("v") != 1
            or not isinstance(username, str)
            or not username.strip()
            or role not in self._ALLOWED_ROLES
            or not self._is_timestamp(issued_at)
            or not self._is_timestamp(expires_at)
            or expires_at <= issued_at
        ):
            raise InvalidSessionToken("Phiên đăng nhập không hợp lệ.")

        now = int(self._clock())
        if expires_at <= now:
            raise InvalidSessionToken("Phiên đăng nhập đã hết hạn.")
        if issued_at > now + 30:
            raise InvalidSessionToken("Phiên đăng nhập không hợp lệ.")

        return SessionClaims(
            username=username.strip(),
            role=role,
            issued_at=issued_at,
            expires_at=expires_at,
        )

    def _signature(self, encoded_payload: str) -> str:
        digest = hmac.new(
            self._secret,
            encoded_payload.encode("ascii"),
            hashlib.sha256,
        ).digest()
        return self._encode(digest)

    @staticmethod
    def _encode(value: bytes) -> str:
        return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")

    @staticmethod
    def _decode(value: str) -> bytes:
        padding = "=" * (-len(value) % 4)
        return base64.b64decode(value + padding, altchars=b"-_", validate=True)

    @staticmethod
    def _is_timestamp(value: object) -> bool:
        return isinstance(value, int) and not isinstance(value, bool)


_bearer = HTTPBearer(auto_error=False)


def create_session_manager() -> HMACBearerSessions:
    settings = get_settings()
    return HMACBearerSessions(
        secret=settings.app_auth_secret,
        ttl_seconds=settings.app_auth_ttl_seconds,
    )


def get_session_manager(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> HMACBearerSessions | None:
    if credentials is None:
        return None
    return create_session_manager()


def get_current_session(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    sessions: HMACBearerSessions | None = Depends(get_session_manager),
) -> SessionClaims:
    if credentials is None or credentials.scheme.lower() != "bearer" or sessions is None:
        raise _unauthorized("Vui lòng đăng nhập để tiếp tục.")
    try:
        return sessions.verify(credentials.credentials)
    except InvalidSessionToken as exc:
        raise _unauthorized(str(exc)) from exc


def require_roles(*roles: str) -> Callable[..., SessionClaims]:
    allowed_roles = frozenset(role.strip().lower() for role in roles)

    def dependency(session: SessionClaims = Depends(get_current_session)) -> SessionClaims:
        if session.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền thực hiện thao tác này.",
            )
        return session

    return dependency


def _unauthorized(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=message,
        headers={"WWW-Authenticate": "Bearer"},
    )
