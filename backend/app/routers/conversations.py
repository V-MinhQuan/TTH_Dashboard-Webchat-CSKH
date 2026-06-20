from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse

from app.core.auth import SessionClaims, require_roles
from app.schemas.conversation import (
    BulkCloseRequest,
    CloseConversationRequest,
    ConversationFilters,
)
from app.services.conversation_service import ConversationService

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


def get_conversation_service() -> ConversationService:
    return ConversationService()


@router.get("")
def list_conversations(
    filters: Annotated[ConversationFilters, Query()],
    service: ConversationService = Depends(get_conversation_service),
):
    data = service.list_conversations(filters.to_repository_filters())
    return {
        "success": True,
        "message": "Lấy danh sách hội thoại thành công.",
        "data": data,
    }


@router.post("/bulk-close")
def close_conversations_bulk(
    request: BulkCloseRequest,
    session: SessionClaims = Depends(require_roles("manager")),
    service: ConversationService = Depends(get_conversation_service),
):
    result = service.close_conversations(request.conversation_ids, session.username)
    data = {
        "requested": result["requestedCount"],
        "matched": result["matchedCount"],
        "affected": result["affectedCount"],
        "alreadyClosed": result["alreadyClosedCount"],
        **result,
    }
    return {
        "success": True,
        "message": f"Đã đóng {result['affectedCount']} hội thoại.",
        "data": data,
    }


@router.post("/close")
def close_conversation(
    request: CloseConversationRequest,
    session: SessionClaims = Depends(require_roles("manager", "staff")),
    service: ConversationService = Depends(get_conversation_service),
):
    data = service.close_conversation(
        conversation_id=request.conversation_id,
        customer_id=request.customer_id,
        source=request.source,
        actor=session.username,
    )
    message = (
        "Đã đóng hội thoại thành công."
        if data["affectedCount"]
        else "Hội thoại đã được đóng trước đó."
    )
    return {"success": True, "message": message, "data": data}


@router.get("/by-message/{message_id}")
def get_by_message(
    message_id: int,
    service: ConversationService = Depends(get_conversation_service),
):
    data = service.get_by_message(message_id)
    if not data:
        return JSONResponse(
            status_code=404,
            content={"success": False, "message": "Không tìm thấy hội thoại.", "data": None},
        )
    return {
        "success": True,
        "message": "Lấy hội thoại theo tin nhắn thành công.",
        "data": data,
    }


@router.get("/{conversation_id}")
def get_conversation(
    conversation_id: int,
    service: ConversationService = Depends(get_conversation_service),
):
    data = service.get_conversation(conversation_id)
    if not data:
        return JSONResponse(
            status_code=404,
            content={"success": False, "message": "Không tìm thấy hội thoại.", "data": None},
        )
    return {
        "success": True,
        "message": "Lấy chi tiết hội thoại thành công.",
        "data": data,
    }
