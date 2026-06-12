from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def get_dashboard_service() -> DashboardService:
    return DashboardService()


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
    service: DashboardService = Depends(get_dashboard_service),
):
    data = service.get_kpi(
        {
            "dateRange": dateRange,
            "fromDate": fromDate,
            "toDate": toDate,
            "startDate": startDate,
            "endDate": endDate,
            "channel": channel,
            "topic": topic,
            "conversationStatus": conversationStatus,
            "aiStatus": aiStatus,
        }
    )
    return {"success": True, "message": "Dashboard KPI fetched successfully", "data": data}

