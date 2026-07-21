import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.keywords import service as keyword_service_module
from app.services.analytics_service import AnalyticsService


class FailureTrendRepository:
    def get_ai_failure_trend(self, _filters):
        return {
            "rows": [
                {"date": "2026-06-01", "failure": 2, "thieuDL": 2, "khongChac": 0},
            ],
        }


def test_ai_failure_trend_keeps_every_filtered_day():
    rows = AnalyticsService(repository=FailureTrendRepository()).get_ai_failure_trend({
        "startDate": "2026-06-01",
        "endDate": "2026-06-03",
    })

    assert [row["date"] for row in rows] == ["2026-06-01", "2026-06-02", "2026-06-03"]
    assert [row["failure"] for row in rows] == [2, 0, 0]


def test_keyword_trend_keeps_trailing_zero_days(monkeypatch):
    keyword_service_module.clear_keyword_cache()
    monkeypatch.setattr(keyword_service_module.keyword_repository, "get_all", lambda: [
        {"status": "active", "groupId": "toeic", "word": "TOEIC"},
    ])
    monkeypatch.setattr(
        keyword_service_module.keyword_repository,
        "get_trend_counts_for_groups",
        lambda *_args, **_kwargs: [
            {"bucket_key": "2026-06-01", "toeic": 3},
        ],
    )

    rows = asyncio.run(
        keyword_service_module.KeywordService().get_trend_data(
            start_date="2026-06-01", end_date="2026-06-03", granularity="day",
        )
    )

    assert [row["date"] for row in rows] == ["01/06", "02/06", "03/06"]
    assert [row["TOEIC"] for row in rows] == [3, 0, 0]
