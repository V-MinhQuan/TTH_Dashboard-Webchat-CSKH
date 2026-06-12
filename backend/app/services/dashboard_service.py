from __future__ import annotations

from typing import Any, Dict

from app.repositories.dashboard_repository import DashboardRepository


class DashboardService:
    def __init__(self, repository: DashboardRepository | None = None):
        self.repository = repository or DashboardRepository()

    def get_kpi(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        return self.repository.get_kpi(filters)

