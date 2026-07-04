from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse

from app.services.legacy_dashboard_service import dashboard_service as legacy_ds

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])



@router.get("/kpi")
def get_dashboard_kpi(
    dateRange: Optional[str] = Query(default=None),
    fromDate: Optional[str] = Query(default=None),
    toDate: Optional[str] = Query(default=None),
    startDate: Optional[str] = Query(default=None),
    endDate: Optional[str] = Query(default=None),
    channel: Optional[str] = Query(default=None),
    topic: Optional[str] = Query(default=None),
    conversationStatus: Optional[str] = Query(default=None),
    aiStatus: Optional[str] = Query(default=None),
    forceRefresh: bool = Query(default=False),
    includePriorityConversations: bool = Query(default=True),
    includeUrgentAlerts: bool = Query(default=True),
    includeTopQuestions: bool = Query(default=True),
    includeTrendComparison: bool = Query(default=True),
):
    if startDate:
        try:
            datetime.strptime(startDate, "%Y-%m-%d")
        except ValueError:
            return JSONResponse(status_code=400, content={
                "success": False,
                "message": "Định dạng startDate không hợp lệ. Vui lòng truyền định dạng YYYY-MM-DD hoặc một chuỗi ngày hợp lệ."
            })

    if endDate:
        try:
            datetime.strptime(endDate, "%Y-%m-%d")
        except ValueError:
            return JSONResponse(status_code=400, content={
                "success": False,
                "message": "Định dạng endDate không hợp lệ. Vui lòng truyền định dạng YYYY-MM-DD hoặc một chuỗi ngày hợp lệ."
            })

    if startDate and endDate:
        if datetime.strptime(startDate, "%Y-%m-%d") > datetime.strptime(endDate, "%Y-%m-%d"):
            return JSONResponse(status_code=400, content={
                "success": False,
                "message": "Ngày bắt đầu (startDate) không thể lớn hơn ngày kết thúc (endDate)."
            })

    filters = {
        "channel": channel,
        "topic": topic,
        "conversationStatus": conversationStatus,
        "aiStatus": aiStatus,
        "forceRefresh": forceRefresh,
        "includePriorityConversations": includePriorityConversations,
        "includeUrgentAlerts": includeUrgentAlerts,
        "includeTopQuestions": includeTopQuestions,
        "includeTrendComparison": includeTrendComparison,
    }
    
    data = legacy_ds.get_kpis(startDate, endDate, filters)
    return {"success": True, "message": "Dashboard KPI fetched successfully", "data": data}


@router.get("/kpi-comparison")
def get_dashboard_kpi_comparison(
    startDate: Optional[str] = Query(default=None),
    endDate: Optional[str] = Query(default=None),
    channel: Optional[str] = Query(default=None),
    topic: Optional[str] = Query(default=None),
    conversationStatus: Optional[str] = Query(default=None),
    aiStatus: Optional[str] = Query(default=None),
):
    if startDate:
        try:
            datetime.strptime(startDate, "%Y-%m-%d")
        except ValueError:
            return JSONResponse(status_code=400, content={
                "success": False,
                "message": "Định dạng startDate không hợp lệ. Vui lòng truyền định dạng YYYY-MM-DD hoặc một chuỗi ngày hợp lệ."
            })

    if endDate:
        try:
            datetime.strptime(endDate, "%Y-%m-%d")
        except ValueError:
            return JSONResponse(status_code=400, content={
                "success": False,
                "message": "Định dạng endDate không hợp lệ. Vui lòng truyền định dạng YYYY-MM-DD hoặc một chuỗi ngày hợp lệ."
            })

    if startDate and endDate:
        if datetime.strptime(startDate, "%Y-%m-%d") > datetime.strptime(endDate, "%Y-%m-%d"):
            return JSONResponse(status_code=400, content={
                "success": False,
                "message": "Ngày bắt đầu (startDate) không thể lớn hơn ngày kết thúc (endDate)."
            })

    filters = {
        "channel": channel,
        "topic": topic,
        "conversationStatus": conversationStatus,
        "aiStatus": aiStatus,
    }
    data = legacy_ds.get_kpi_comparison(startDate, endDate, filters)
    return {
        "success": True,
        "message": "Dashboard KPI comparison fetched successfully",
        "data": data,
    }


@router.get("/urgent-alerts")
def get_dashboard_urgent_alerts(
    startDate: Optional[str] = Query(default=None),
    endDate: Optional[str] = Query(default=None),
    channel: Optional[str] = Query(default=None),
    topic: Optional[str] = Query(default=None),
    conversationStatus: Optional[str] = Query(default=None),
    aiStatus: Optional[str] = Query(default=None),
):
    if startDate:
        try:
            datetime.strptime(startDate, "%Y-%m-%d")
        except ValueError:
            return JSONResponse(status_code=400, content={
                "success": False,
                "message": "Định dạng startDate không hợp lệ. Vui lòng truyền định dạng YYYY-MM-DD hoặc một chuỗi ngày hợp lệ."
            })

    if endDate:
        try:
            datetime.strptime(endDate, "%Y-%m-%d")
        except ValueError:
            return JSONResponse(status_code=400, content={
                "success": False,
                "message": "Định dạng endDate không hợp lệ. Vui lòng truyền định dạng YYYY-MM-DD hoặc một chuỗi ngày hợp lệ."
            })

    if startDate and endDate:
        if datetime.strptime(startDate, "%Y-%m-%d") > datetime.strptime(endDate, "%Y-%m-%d"):
            return JSONResponse(status_code=400, content={
                "success": False,
                "message": "Ngày bắt đầu (startDate) không thể lớn hơn ngày kết thúc (endDate)."
            })

    filters = {
        "channel": channel,
        "topic": topic,
        "conversationStatus": conversationStatus,
        "aiStatus": aiStatus,
    }
    data = legacy_ds.get_urgent_alerts(startDate, endDate, filters)
    return {
        "success": True,
        "message": "Urgent alerts fetched successfully",
        "data": data,
    }


@router.get("/top-questions")
def get_dashboard_top_questions(
    startDate: Optional[str] = Query(default=None),
    endDate: Optional[str] = Query(default=None),
    channel: Optional[str] = Query(default=None),
    topic: Optional[str] = Query(default=None),
    forceRefresh: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=100),
):
    if startDate:
        try:
            datetime.strptime(startDate, "%Y-%m-%d")
        except ValueError:
            return JSONResponse(status_code=400, content={
                "success": False,
                "message": "Định dạng startDate không hợp lệ. Vui lòng truyền định dạng YYYY-MM-DD hoặc một chuỗi ngày hợp lệ."
            })

    if endDate:
        try:
            datetime.strptime(endDate, "%Y-%m-%d")
        except ValueError:
            return JSONResponse(status_code=400, content={
                "success": False,
                "message": "Định dạng endDate không hợp lệ. Vui lòng truyền định dạng YYYY-MM-DD hoặc một chuỗi ngày hợp lệ."
            })

    if startDate and endDate:
        if datetime.strptime(startDate, "%Y-%m-%d") > datetime.strptime(endDate, "%Y-%m-%d"):
            return JSONResponse(status_code=400, content={
                "success": False,
                "message": "Ngày bắt đầu (startDate) không thể lớn hơn ngày kết thúc (endDate)."
            })

    filters = {
        "channel": channel,
        "topic": topic,
        "forceRefresh": forceRefresh,
    }
    data = legacy_ds.get_top_questions(startDate, endDate, filters, limit=limit)
    return {
        "success": True,
        "message": "Top questions fetched successfully",
        "data": data,
    }


@router.get("/priority-conversations")
def get_dashboard_priority_conversations(
    startDate: Optional[str] = Query(default=None),
    endDate: Optional[str] = Query(default=None),
    channel: Optional[str] = Query(default=None),
    topic: Optional[str] = Query(default=None),
    conversationStatus: Optional[str] = Query(default=None),
    aiStatus: Optional[str] = Query(default=None),
    limit: int = Query(default=10, ge=1, le=50),
):
    if startDate:
        try:
            datetime.strptime(startDate, "%Y-%m-%d")
        except ValueError:
            return JSONResponse(status_code=400, content={
                "success": False,
                "message": "Định dạng startDate không hợp lệ. Vui lòng truyền định dạng YYYY-MM-DD hoặc một chuỗi ngày hợp lệ."
            })

    if endDate:
        try:
            datetime.strptime(endDate, "%Y-%m-%d")
        except ValueError:
            return JSONResponse(status_code=400, content={
                "success": False,
                "message": "Định dạng endDate không hợp lệ. Vui lòng truyền định dạng YYYY-MM-DD hoặc một chuỗi ngày hợp lệ."
            })

    if startDate and endDate:
        if datetime.strptime(startDate, "%Y-%m-%d") > datetime.strptime(endDate, "%Y-%m-%d"):
            return JSONResponse(status_code=400, content={
                "success": False,
                "message": "Ngày bắt đầu (startDate) không thể lớn hơn ngày kết thúc (endDate)."
            })

    filters = {
        "channel": channel,
        "topic": topic,
        "conversationStatus": conversationStatus,
        "aiStatus": aiStatus,
    }
    data = legacy_ds.get_priority_conversations(startDate, endDate, filters, limit=limit)
    return {
        "success": True,
        "message": "Priority conversations fetched successfully",
        "data": data,
    }
