from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import SessionClaims, require_roles
from app.schemas.feedback import (
    FeedbackCreateRequest,
    FeedbackMergeRequest,
    FeedbackStatusRequest,
    FeedbackUpdateRequest,
)
from app.sheet_chatbot.service import (
    SheetChatbotConflictError,
    SheetChatbotNotFoundError,
    SheetChatbotService,
    SheetChatbotValidationError,
    sheet_chatbot_service,
)

router = APIRouter(prefix="/api/admin/sheet-chatbot", tags=["feedback-library"])


def get_feedback_service() -> SheetChatbotService:
    return sheet_chatbot_service


def _raise_domain_error(error: Exception) -> None:
    if isinstance(error, SheetChatbotNotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    if isinstance(error, SheetChatbotConflictError):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    if isinstance(error, SheetChatbotValidationError):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    raise error


@router.get("")
async def list_feedback(
    session: SessionClaims = Depends(require_roles("manager", "staff")),
    service: SheetChatbotService = Depends(get_feedback_service),
    page: Annotated[int, Query(ge=1)] = 1,
    pageSize: Annotated[int, Query(ge=1, le=1000)] = 500,
    search: Annotated[str | None, Query(max_length=200)] = None,
    status_filter: Annotated[str | None, Query(alias="status", max_length=50)] = None,
    risk: Annotated[str | None, Query(max_length=50)] = None,
    addedBy: Annotated[str | None, Query(max_length=255)] = None,
    role: Annotated[str | None, Query(max_length=50)] = None,
):
    filters = {
        "page": page,
        "pageSize": pageSize,
        "search": search,
        "status": status_filter,
        "risk": risk,
        "addedBy": session.username if session.role == "staff" else addedBy,
        "role": session.role if session.role == "staff" else role,
    }
    result = await service.get_rows(filters)
    return {
        "success": True,
        "message": "Lấy danh sách thư viện phản hồi thành công.",
        "data": result["rows"],
        "total": result["total"],
        "page": result["page"],
        "pageSize": result["pageSize"],
        "stats": result["stats"],
    }


@router.get("/stats")
async def feedback_stats(
    _: SessionClaims = Depends(require_roles("manager", "staff")),
    service: SheetChatbotService = Depends(get_feedback_service),
):
    return {"success": True, "message": "Lấy thống kê thư viện phản hồi thành công.", "data": service.get_stats()}


@router.get("/duplicates")
async def feedback_duplicates(
    question: Annotated[str, Query(min_length=1, max_length=2000)],
    minSimilarity: Annotated[float, Query(ge=0, le=1)] = 0.75,
    limit: Annotated[int, Query(ge=1, le=50)] = 5,
    _: SessionClaims = Depends(require_roles("manager", "staff")),
    service: SheetChatbotService = Depends(get_feedback_service),
):
    try:
        data = await service.find_duplicates(question, minSimilarity, limit)
    except Exception as error:
        _raise_domain_error(error)
    return {"success": True, "message": "Kiểm tra phản hồi trùng thành công.", "data": data}


@router.get("/{row_id}")
async def get_feedback(
    row_id: str,
    _: SessionClaims = Depends(require_roles("manager", "staff")),
    service: SheetChatbotService = Depends(get_feedback_service),
):
    try:
        data = await service.get_row_by_id(row_id)
    except Exception as error:
        _raise_domain_error(error)
    return {"success": True, "message": "Lấy phản hồi thành công.", "data": data}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_feedback(
    request: FeedbackCreateRequest,
    session: SessionClaims = Depends(require_roles("manager", "staff")),
    service: SheetChatbotService = Depends(get_feedback_service),
):
    payload = request.model_dump(by_alias=True)
    payload["addedBy"] = session.username
    try:
        data = await service.create_row(payload)
    except Exception as error:
        _raise_domain_error(error)
    return {"success": True, "message": "Thêm phản hồi thành công.", "data": data}


@router.put("/{row_id}")
async def update_feedback(
    row_id: str,
    request: FeedbackUpdateRequest,
    _: SessionClaims = Depends(require_roles("manager", "staff")),
    service: SheetChatbotService = Depends(get_feedback_service),
):
    try:
        data = await service.update_row(row_id, request.model_dump(by_alias=True, exclude_none=True))
    except Exception as error:
        _raise_domain_error(error)
    return {"success": True, "message": "Cập nhật phản hồi thành công.", "data": data}


@router.patch("/{row_id}/status")
async def update_feedback_status(
    row_id: str,
    request: FeedbackStatusRequest,
    session: SessionClaims = Depends(require_roles("manager", "staff")),
    service: SheetChatbotService = Depends(get_feedback_service),
):
    try:
        data = await service.update_status(row_id, request.status, reviewer=session.username, notes=request.notes)
    except Exception as error:
        _raise_domain_error(error)
    return {"success": True, "message": "Cập nhật trạng thái phản hồi thành công.", "data": data}


@router.post("/{row_id}/merge-faq")
async def merge_feedback_to_faq(
    row_id: str,
    _: FeedbackMergeRequest,
    session: SessionClaims = Depends(require_roles("manager")),
    service: SheetChatbotService = Depends(get_feedback_service),
):
    try:
        data = await service.merge_to_faq(row_id, reviewer=session.username)
    except Exception as error:
        _raise_domain_error(error)
    return {"success": True, "message": "Gộp phản hồi vào FAQ thành công.", "data": data}


@router.delete("/{row_id}")
async def delete_feedback(
    row_id: str,
    _: SessionClaims = Depends(require_roles("manager")),
    service: SheetChatbotService = Depends(get_feedback_service),
):
    try:
        await service.delete_row(row_id)
    except Exception as error:
        _raise_domain_error(error)
    return {"success": True, "message": "Xóa phản hồi thành công.", "data": None}

