from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse

from app.services.conversation_service import ConversationService

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


def get_conversation_service() -> ConversationService:
    return ConversationService()


@router.get("")
def list_conversations(
    dateRange: Optional[str] = Query(default=None),
    fromDate: Optional[str] = Query(default=None),
    toDate: Optional[str] = Query(default=None),
    startDate: Optional[str] = Query(default=None),
    endDate: Optional[str] = Query(default=None),
    channel: Optional[str] = Query(default=None),
    source: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    page: int = Query(default=1),
    pageSize: int = Query(default=20),
    service: ConversationService = Depends(get_conversation_service),
):
    data = service.list_conversations(
        {
            "dateRange": dateRange,
            "fromDate": fromDate,
            "toDate": toDate,
            "startDate": startDate,
            "endDate": endDate,
            "channel": channel,
            "source": source,
            "search": search,
            "page": page,
            "pageSize": pageSize,
        }
    )
    return {"success": True, "message": "Lay danh sach hoi thoai thanh cong.", "data": data}


@router.get("/by-message/{message_id}")
def get_by_message(
    message_id: int,
    service: ConversationService = Depends(get_conversation_service),
):
    data = service.get_by_message(message_id)
    if not data:
        return JSONResponse(
            status_code=404,
            content={"success": False, "message": "Conversation not found.", "data": None},
        )
    return {"success": True, "message": "Lay hoi thoai theo message thanh cong.", "data": data}


@router.get("/{conversation_id}")
def get_conversation(
    conversation_id: int,
    service: ConversationService = Depends(get_conversation_service),
):
    data = service.get_conversation(conversation_id)
    if not data:
        return JSONResponse(
            status_code=404,
            content={"success": False, "message": "Conversation not found.", "data": None},
        )
    return {"success": True, "message": "Lay chi tiet hoi thoai thanh cong.", "data": data}

