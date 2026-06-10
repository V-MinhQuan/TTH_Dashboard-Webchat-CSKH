from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Any, List, Optional

from app.core.exceptions import AppError


@dataclass(frozen=True)
class SqlDateFilter:
    condition: str
    params: List[Any]


def _parse_yyyy_mm_dd(value: Optional[str], field_name: str) -> Optional[date]:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as exc:
        raise AppError(f"{field_name} must use YYYY-MM-DD format.", status_code=400) from exc


def _start_of_day(value: date) -> datetime:
    return datetime.combine(value, time.min)


def _exclusive_next_day(value: date) -> datetime:
    return datetime.combine(value + timedelta(days=1), time.min)


def _quarter_start(value: date) -> date:
    month = ((value.month - 1) // 3) * 3 + 1
    return date(value.year, month, 1)


def build_date_filter(
    *,
    column: str,
    date_range: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    today: Optional[date] = None,
) -> SqlDateFilter:
    """Return a parameterized SQL date condition for a trusted column name."""

    range_key = (date_range or "all_time").strip()
    current = today or date.today()

    if start_date or end_date:
        start = _parse_yyyy_mm_dd(start_date, "startDate")
        end = _parse_yyyy_mm_dd(end_date, "endDate")
    elif range_key == "all_time":
        return SqlDateFilter("", [])
    elif range_key == "today":
        start = current
        end = current
    elif range_key == "last7days":
        start = current - timedelta(days=6)
        end = current
    elif range_key == "thisMonth":
        start = date(current.year, current.month, 1)
        end = current
    elif range_key == "thisQuarter":
        start = _quarter_start(current)
        end = current
    elif range_key == "custom":
        start = _parse_yyyy_mm_dd(from_date, "fromDate")
        end = _parse_yyyy_mm_dd(to_date, "toDate")
        if start is None or end is None:
            raise AppError("custom dateRange requires fromDate and toDate.", status_code=400)
    else:
        raise AppError(f"Unsupported dateRange: {range_key}", status_code=400)

    conditions: List[str] = []
    params: List[Any] = []
    if start is not None:
        conditions.append(f"{column} >= ?")
        params.append(_start_of_day(start))
    if end is not None:
        conditions.append(f"{column} < ?")
        params.append(_exclusive_next_day(end))
    if start is not None and end is not None and start > end:
        raise AppError("Start date cannot be after end date.", status_code=400)

    return SqlDateFilter(" AND ".join(conditions), params)

