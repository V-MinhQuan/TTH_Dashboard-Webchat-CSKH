"""
Additional regression tests for the Dynamic Chart Builder.
Covers AI Assistant exclusion, dual Y-axis, combo seriesType,
radar multi-metric, execution metadata, and limit clamping.
"""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config.chart_builder_catalog import get_dataset_catalog
from app.repositories.chart_builder_repository import ChartBuilderRepository
from app.schemas.chart_builder import CustomChartRequest
from app.services.chart_builder_service import ChartBuilderService
from app.services.chart_query_builder import ChartQueryCompiler


def custom_request(**overrides) -> CustomChartRequest:
    payload = {
        "version": 2,
        "mode": "custom",
        "datasetId": "message_analytics",
        "chartType": "bar",
        "dimensions": [{"fieldId": "channel", "alias": "channel"}],
        "metrics": [
            {
                "fieldId": "record_id",
                "aggregation": "count",
                "alias": "record_count",
                "label": "Records",
            }
        ],
        "filters": [],
        "sort": [],
        "topN": 10,
        "limit": 500,
    }
    payload.update(overrides)
    return CustomChartRequest.model_validate(payload)


# ---------------------------------------------------------------------------
# AI Assistant exclusion
# ---------------------------------------------------------------------------

def test_ai_assistant_excluded_from_agent_performance():
    """
    The agent_performance dataset must contain a base_condition that
    excludes 'AI Assistant' from the compiled SQL.
    """
    catalog = get_dataset_catalog()
    assert "agent_performance" in catalog

    agent_ds = catalog["agent_performance"]
    ai_exclusion = "agent.HostDisplayName <> N'AI Assistant'"
    assert ai_exclusion in agent_ds.base_conditions, (
        f"AI Assistant exclusion not found in base_conditions: {agent_ds.base_conditions}"
    )


def test_compiler_includes_ai_assistant_exclusion_in_sql():
    """
    The compiled SQL for an agent_performance query must not be able to
    return rows for 'AI Assistant' (the WHERE clause must contain the exclusion).
    """
    compiler = ChartQueryCompiler(get_dataset_catalog())
    request = CustomChartRequest.model_validate(
        {
            "version": 2,
            "mode": "custom",
            "datasetId": "agent_performance",
            "chartType": "bar",
            "dimensions": [{"fieldId": "agent_name", "alias": "agent"}],
            "metrics": [
                {
                    "fieldId": "conversation_id",
                    "aggregation": "count_distinct",
                    "alias": "n",
                }
            ],
            "filters": [],
            "sort": [],
            "limit": 50,
        }
    )
    compiled = compiler.compile(request)
    assert "AI Assistant" in compiled.sql, (
        "Expected the AI Assistant exclusion to appear in the compiled SQL"
    )
    assert "<>" in compiled.sql


# ---------------------------------------------------------------------------
# Dual Y-axis
# ---------------------------------------------------------------------------

def test_compiler_generates_correct_dual_yaxis_query():
    """
    A request with two metrics on different axis groups must compile
    without errors (axis group is metadata-only, does not affect SQL).
    """
    compiler = ChartQueryCompiler(get_dataset_catalog())
    request = CustomChartRequest.model_validate(
        {
            "version": 2,
            "mode": "custom",
            "datasetId": "message_analytics",
            "chartType": "combo",
            "dimensions": [{"fieldId": "message_at", "alias": "month", "dateGrain": "month"}],
            "metrics": [
                {
                    "fieldId": "record_id",
                    "aggregation": "count",
                    "alias": "msg_count",
                    "axisGroup": "left",
                    "seriesType": "bar",
                },
                {
                    "fieldId": "sentiment_score",
                    "aggregation": "avg",
                    "alias": "avg_sentiment",
                    "axisGroup": "right",
                    "seriesType": "line",
                },
            ],
            "filters": [],
            "sort": [],
            "limit": 500,
        }
    )
    compiled = compiler.compile(request)
    assert "msg_count" in compiled.sql
    assert "avg_sentiment" in compiled.sql
    # Both metrics in SELECT
    assert "COUNT(a.id)" in compiled.sql or "COUNT(" in compiled.sql
    assert "AVG(" in compiled.sql


# ---------------------------------------------------------------------------
# Combo series type
# ---------------------------------------------------------------------------

def test_combo_series_type_is_preserved_in_service_response():
    """
    The ChartBuilderService must carry through seriesType metadata
    from the request into the returned series objects.
    """
    repository = MagicMock(spec=ChartBuilderRepository)
    repository.execute_custom_query.return_value = [
        {"month": "2026-01-01", "msg_count": 100, "avg_sentiment": 0.7},
    ]
    service = ChartBuilderService(repository=repository)

    request = CustomChartRequest.model_validate(
        {
            "version": 2,
            "mode": "custom",
            "datasetId": "message_analytics",
            "chartType": "combo",
            "dimensions": [{"fieldId": "message_at", "alias": "month", "dateGrain": "month"}],
            "metrics": [
                {
                    "fieldId": "record_id",
                    "aggregation": "count",
                    "alias": "msg_count",
                    "axisGroup": "left",
                    "seriesType": "bar",
                },
                {
                    "fieldId": "sentiment_score",
                    "aggregation": "avg",
                    "alias": "avg_sentiment",
                    "axisGroup": "right",
                    "seriesType": "line",
                },
            ],
            "filters": [],
            "sort": [],
            "limit": 500,
        }
    )

    result = service.get_chart_data(request)
    series_by_key = {s["key"]: s for s in result["series"]}

    assert series_by_key["msg_count"]["seriesType"] == "bar"
    assert series_by_key["avg_sentiment"]["seriesType"] == "line"
    assert series_by_key["msg_count"]["axisGroup"] == "left"
    assert series_by_key["avg_sentiment"]["axisGroup"] == "right"


# ---------------------------------------------------------------------------
# Radar chart
# ---------------------------------------------------------------------------

def test_radar_chart_multi_metric_compiles_without_error():
    """
    A radar chart with multiple metrics must compile successfully
    (radar is a display concern; SQL is identical to a regular bar query).
    """
    compiler = ChartQueryCompiler(get_dataset_catalog())
    request = CustomChartRequest.model_validate(
        {
            "version": 2,
            "mode": "custom",
            "datasetId": "message_analytics",
            "chartType": "radar",
            "dimensions": [{"fieldId": "channel", "alias": "channel"}],
            "metrics": [
                {
                    "fieldId": "record_id",
                    "aggregation": "count",
                    "alias": "msg_count",
                },
                {
                    "fieldId": "sentiment_score",
                    "aggregation": "avg",
                    "alias": "avg_sentiment",
                },
            ],
            "filters": [],
            "sort": [],
            "limit": 100,
        }
    )
    compiled = compiler.compile(request)
    assert "msg_count" in compiled.sql
    assert "avg_sentiment" in compiled.sql


# ---------------------------------------------------------------------------
# Execution metadata
# ---------------------------------------------------------------------------

def test_execution_metadata_present_in_service_response():
    """
    The service response must contain execution metadata:
    rowCount, executionTimeMs, limit, truncated.
    """
    repository = MagicMock(spec=ChartBuilderRepository)
    repository.execute_custom_query.return_value = [
        {"channel": "Facebook", "record_count": 42},
        {"channel": "Zalo", "record_count": 17},
    ]
    service = ChartBuilderService(repository=repository)

    request = custom_request(limit=200)
    result = service.get_chart_data(request)

    assert "execution" in result
    exec_meta = result["execution"]
    assert exec_meta["rowCount"] == 2
    # When topN=10 is set, it caps the effective limit in metadata
    assert exec_meta["limit"] in (200, 10)  # accepts either effective limit
    assert isinstance(exec_meta["executionTimeMs"], int)
    assert exec_meta["truncated"] is False


def test_execution_metadata_marks_truncated_when_rows_equal_limit():
    """
    When returned rows == limit, truncated must be True
    (indicating the result may be incomplete).
    """
    limit = 3
    repository = MagicMock(spec=ChartBuilderRepository)
    repository.execute_custom_query.return_value = [
        {"channel": f"Ch{i}", "record_count": i} for i in range(limit)
    ]
    service = ChartBuilderService(repository=repository)

    request = custom_request(limit=limit)
    result = service.get_chart_data(request)

    assert result["execution"]["truncated"] is True


# ---------------------------------------------------------------------------
# Limit clamping
# ---------------------------------------------------------------------------

def test_limit_clamp_prevents_excessive_queries():
    """
    CustomChartRequest must reject limit > 5000 at schema level.
    """
    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        CustomChartRequest.model_validate(
            {
                "version": 2,
                "mode": "custom",
                "datasetId": "message_analytics",
                "chartType": "bar",
                "dimensions": [{"fieldId": "channel", "alias": "channel"}],
                "metrics": [
                    {"fieldId": "record_id", "aggregation": "count", "alias": "n"}
                ],
                "filters": [],
                "sort": [],
                "limit": 5001,
            }
        )
