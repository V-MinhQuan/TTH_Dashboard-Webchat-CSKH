import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.keywords import repository as keyword_repository_module
from app.keywords import service as keyword_service_module
from app.keywords.repository import KEYWORD_COUNT_BATCH_SIZE, KeywordRepository


def test_group_stats_without_dates_defaults_to_recent_window(monkeypatch):
    class FixedDateTime(datetime):
        @classmethod
        def now(cls):
            return cls(2026, 7, 1)

    monkeypatch.setattr(keyword_service_module, "datetime", FixedDateTime)

    filters = keyword_service_module.with_default_group_stats_date_range({"channel": "Facebook"})

    assert filters["startDate"] == "2026-06-01"
    assert filters["endDate"] == "2026-07-01"
    assert filters["channel"] == "Facebook"


def test_keyword_occurrence_count_splits_large_batches(monkeypatch):
    calls = []

    def fake_execute_query(query, params):
        calls.append((query, params))
        column_count = query.count(" AS col_")
        return [{f"col_{idx}": 1 for idx in range(column_count)}]

    monkeypatch.setattr(keyword_repository_module, "execute_query", fake_execute_query)

    words = [f"keyword-{idx}" for idx in range(KEYWORD_COUNT_BATCH_SIZE + 1)]
    result = KeywordRepository().batch_count_keyword_occurrences(words)

    assert len(calls) == 2
    assert all(value == 1 for value in result.values())
    assert calls[0][0].count(" AS col_") == KEYWORD_COUNT_BATCH_SIZE
    assert calls[1][0].count(" AS col_") == 1


def test_keyword_message_filters_match_channel_aliases(monkeypatch):
    calls = []

    def fake_execute_query(query, params):
        calls.append((query, params))
        return [{"col_0": 2}]

    monkeypatch.setattr(keyword_repository_module, "execute_query", fake_execute_query)

    result = KeywordRepository().batch_count_keyword_occurrences(
        ["TOEIC"],
        start_date="2026-01-01",
        end_date="2026-07-06",
        channel="ZaloBusiness",
    )

    query, params = calls[0]
    assert result["TOEIC"] == 2
    assert "LOWER(LTRIM(RTRIM(m.Source))) IN" in query
    assert "m.Source = ?" not in query
    assert "zalobusiness" in params
    assert "zalobiz" in params
