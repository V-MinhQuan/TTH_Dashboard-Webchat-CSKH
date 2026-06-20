from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.core.auth import require_role
from app.core.exceptions import AppError
from app.schemas.ai_error_keywords import (
    AiErrorGroup,
    AiErrorKeywordCreate,
    AiErrorKeywordStatus,
    AiErrorKeywordUpdate,
)
from app.services.ai_error_keywords import (
    AiErrorKeywordNotFoundError,
    AiErrorKeywordService,
    DuplicateAiErrorKeywordError,
)


router = APIRouter(prefix="/api/ai-error-keywords", tags=["ai-error-keywords"])
require_manager = require_role("manager")


def get_ai_error_keyword_service() -> AiErrorKeywordService:
    return AiErrorKeywordService()


def _creator_from_principal(principal: Any) -> str:
    if isinstance(principal, dict):
        creator = (
            principal.get("username")
            or principal.get("userName")
            or principal.get("sub")
        )
    else:
        creator = (
            getattr(principal, "username", None)
            or getattr(principal, "user_name", None)
            or getattr(principal, "sub", None)
        )
    if not creator:
        raise AppError("Không xác định được người dùng đã xác thực.", status_code=401)
    return str(creator)


@router.get("")
def list_ai_error_keywords(
    keyword_status: AiErrorKeywordStatus | None = Query(default=None, alias="status"),
    error_group: AiErrorGroup | None = None,
    topic: str | None = Query(default=None, max_length=100),
    care_hub: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _: Any = Depends(require_manager),
    service: AiErrorKeywordService = Depends(get_ai_error_keyword_service),
):
    try:
        data = service.list(
            status=keyword_status,
            error_group=error_group,
            topic=topic,
            care_hub=care_hub,
            limit=limit,
            offset=offset,
        )
    except ValueError as exc:
        raise AppError(str(exc), status_code=status.HTTP_400_BAD_REQUEST) from exc
    return {
        "success": True,
        "message": "Lấy danh sách từ khóa lỗi AI thành công.",
        "data": data.model_dump(mode="json"),
    }


@router.get("/{keyword_id}")
def get_ai_error_keyword(
    keyword_id: UUID,
    _: Any = Depends(require_manager),
    service: AiErrorKeywordService = Depends(get_ai_error_keyword_service),
):
    try:
        data = service.get(keyword_id)
    except AiErrorKeywordNotFoundError as exc:
        raise AppError(str(exc), status_code=status.HTTP_404_NOT_FOUND) from exc
    return {
        "success": True,
        "message": "Lấy từ khóa lỗi AI thành công.",
        "data": data.model_dump(mode="json"),
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_ai_error_keyword(
    payload: AiErrorKeywordCreate,
    principal: Any = Depends(require_manager),
    service: AiErrorKeywordService = Depends(get_ai_error_keyword_service),
):
    try:
        data = service.create(
            payload,
            creator=_creator_from_principal(principal),
        )
    except DuplicateAiErrorKeywordError as exc:
        raise AppError(str(exc), status_code=status.HTTP_409_CONFLICT) from exc
    except ValueError as exc:
        raise AppError(str(exc), status_code=status.HTTP_400_BAD_REQUEST) from exc
    return {
        "success": True,
        "message": "Tạo từ khóa lỗi AI thành công.",
        "data": data.model_dump(mode="json"),
    }


@router.patch("/{keyword_id}")
def update_ai_error_keyword(
    keyword_id: UUID,
    payload: AiErrorKeywordUpdate,
    _: Any = Depends(require_manager),
    service: AiErrorKeywordService = Depends(get_ai_error_keyword_service),
):
    try:
        data = service.update(keyword_id, payload)
    except DuplicateAiErrorKeywordError as exc:
        raise AppError(str(exc), status_code=status.HTTP_409_CONFLICT) from exc
    except AiErrorKeywordNotFoundError as exc:
        raise AppError(str(exc), status_code=status.HTTP_404_NOT_FOUND) from exc
    except ValueError as exc:
        raise AppError(str(exc), status_code=status.HTTP_400_BAD_REQUEST) from exc
    return {
        "success": True,
        "message": "Cập nhật từ khóa lỗi AI thành công.",
        "data": data.model_dump(mode="json"),
    }
