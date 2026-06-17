from __future__ import annotations

from typing import Any, Dict

from app.repositories.dashboard_repository import DashboardRepository
from app.services.legacy_dashboard_service import dashboard_service as legacy_dashboard_service


class DashboardService:
    def __init__(self, repository: DashboardRepository | None = None):
        self.repository = repository

    def get_kpi(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        if self.repository is not None:
            return self.repository.get_kpi(filters)

        start_date = filters.get("startDate") or filters.get("fromDate")
        end_date = filters.get("endDate") or filters.get("toDate")
        return legacy_dashboard_service.get_kpis(start_date, end_date, filters)

