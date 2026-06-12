from datetime import date, datetime

import pytest

from app.core.exceptions import AppError
from app.utils.date_filters import build_date_filter


def test_all_time_returns_no_condition():
    result = build_date_filter(column="a.messageAt", date_range="all_time")
    assert result.condition == ""
    assert result.params == []


def test_today_uses_single_day_window():
    result = build_date_filter(column="a.messageAt", date_range="today", today=date(2026, 6, 10))
    assert result.condition == "a.messageAt >= ? AND a.messageAt < ?"
    assert result.params == [datetime(2026, 6, 10), datetime(2026, 6, 11)]


def test_last7days_uses_inclusive_current_day():
    result = build_date_filter(column="a.messageAt", date_range="last7days", today=date(2026, 6, 10))
    assert result.params == [datetime(2026, 6, 4), datetime(2026, 6, 11)]


def test_custom_valid_range():
    result = build_date_filter(
        column="a.messageAt",
        date_range="custom",
        from_date="2026-06-01",
        to_date="2026-06-10",
    )
    assert result.params == [datetime(2026, 6, 1), datetime(2026, 6, 11)]


def test_custom_invalid_range_raises():
    with pytest.raises(AppError):
        build_date_filter(
            column="a.messageAt",
            date_range="custom",
            from_date="2026-06-10",
            to_date="2026-06-01",
        )

