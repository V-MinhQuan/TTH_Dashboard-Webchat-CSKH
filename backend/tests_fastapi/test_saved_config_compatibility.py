"""
Saved configuration compatibility tests.
Covers v1/v2 normalization, field preservation (axisGroup, seriesType,
filters, dateGrain), no-rewrite guarantee for v1 configs, and save failure
propagation. All tests use mocked repositories – no DB writes.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock
from uuid import UUID

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.repositories.chart_builder_repository import ChartBuilderRepository
from app.schemas.chart_builder import SavedChartConfigCreate, CustomChartConfig
from app.services.chart_builder_service import ChartBuilderService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_repo_with_configs(config_jsons: list[str]) -> MagicMock:
    """Return a mock repository that returns the given raw config JSON rows."""
    repository = MagicMock(spec=ChartBuilderRepository)
    repository.get_saved_configs.return_value = [
        {
            "id": UUID(f"aaaaaaaa-0000-0000-0000-{str(i).zfill(12)}"),
            "name": f"Config {i}",
            "description": None,
            "configJson": cfg_json,
            "createdAt": datetime(2026, 1, 1),
            "updatedAt": datetime(2026, 1, 1),
            "isActive": True,
        }
        for i, cfg_json in enumerate(config_jsons)
    ]
    return repository


V1_CONFIG_JSON = json.dumps(
    {
        "sourceId": "conversation_volume",
        "chartType": "bar",
        "groupBy": "channel",
        "yAxes": [
            {
                "column": "total_conversations",
                "label": "Tổng hội thoại",
                "color": "#ED5206",
                "axisGroup": "left",
                "seriesType": None,
            }
        ],
        "title": "Hội thoại theo kênh (v1)",
        "filters": {},
    }
)

V2_CONFIG_JSON = json.dumps(
    {
        "version": 2,
        "mode": "custom",
        "datasetId": "message_analytics",
        "chartType": "combo",
        "dimensions": [
            {
                "fieldId": "message_at",
                "alias": "month",
                "dateGrain": "month",
                "nullHandling": "include",
            }
        ],
        "metrics": [
            {
                "fieldId": "record_id",
                "aggregation": "count",
                "alias": "msg_count",
                "label": "Tin nhắn",
                "color": "#ED5206",
                "axisGroup": "right",
                "seriesType": "bar",
                "numberFormat": "number",
            },
            {
                "fieldId": "sentiment_score",
                "aggregation": "avg",
                "alias": "avg_sentiment",
                "label": "Cảm xúc TB",
                "color": "#003865",
                "axisGroup": "left",
                "seriesType": "line",
                "numberFormat": "number",
            },
        ],
        "series": None,
        "tooltipFields": [],
        "filters": [
            {
                "fieldId": "channel",
                "operator": "eq",
                "value": "Facebook",
                "values": [],
                "valueTo": None,
            }
        ],
        "sort": [{"fieldId": "msg_count", "direction": "desc"}],
        "topN": 10,
        "limit": 200,
        "title": "Tin nhắn theo tháng (v2)",
        "chartSettings": {
            "showLegend": True,
            "showDataLabels": False,
            "showGrid": True,
            "showTooltip": True,
            "theme": "flic",
        },
    }
)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_v1_config_without_version_field_normalizes_to_v1():
    """
    A saved config JSON that has no 'version' key (old format)
    must be loaded as version=1 with mode='predefined'.
    """
    repository = _make_repo_with_configs([V1_CONFIG_JSON])
    service = ChartBuilderService(repository=repository)

    configs = service.get_saved_configs()
    assert len(configs) == 1

    config = configs[0]["config"]
    assert config["version"] == 1
    assert config["mode"] == "predefined"


def test_v1_config_preserves_source_id_and_y_axes():
    """sourceId and yAxes must survive the normalization process unchanged."""
    repository = _make_repo_with_configs([V1_CONFIG_JSON])
    service = ChartBuilderService(repository=repository)

    config = service.get_saved_configs()[0]["config"]
    assert config["sourceId"] == "conversation_volume"
    assert config["yAxes"][0]["column"] == "total_conversations"
    assert config["yAxes"][0]["axisGroup"] == "left"


def test_v2_config_preserves_axis_group():
    """
    axisGroup='right' set on a metric in a v2 config must survive
    serialization → storage → deserialization unchanged.
    """
    repository = _make_repo_with_configs([V2_CONFIG_JSON])
    service = ChartBuilderService(repository=repository)

    config = service.get_saved_configs()[0]["config"]
    assert config["version"] == 2
    assert config["mode"] == "custom"

    # Find the metric with axisGroup='right'
    right_metric = next(
        (m for m in config["metrics"] if m["alias"] == "msg_count"), None
    )
    assert right_metric is not None
    assert right_metric["axisGroup"] == "right"


def test_v2_config_preserves_series_type():
    """seriesType='bar' and 'line' must be round-tripped correctly."""
    repository = _make_repo_with_configs([V2_CONFIG_JSON])
    service = ChartBuilderService(repository=repository)

    config = service.get_saved_configs()[0]["config"]
    metrics_by_alias = {m["alias"]: m for m in config["metrics"]}

    assert metrics_by_alias["msg_count"]["seriesType"] == "bar"
    assert metrics_by_alias["avg_sentiment"]["seriesType"] == "line"


def test_v2_config_preserves_filters_and_date_grains():
    """Filters and dateGrain must survive the round-trip."""
    repository = _make_repo_with_configs([V2_CONFIG_JSON])
    service = ChartBuilderService(repository=repository)

    config = service.get_saved_configs()[0]["config"]

    # Filters
    assert len(config["filters"]) == 1
    assert config["filters"][0]["fieldId"] == "channel"
    assert config["filters"][0]["value"] == "Facebook"

    # Date grain on dimension
    assert config["dimensions"][0]["dateGrain"] == "month"


def test_loading_v1_config_does_not_call_save():
    """
    The service must NEVER call save_chart_config when loading and
    normalizing a v1 config – it must be read-only.
    """
    repository = _make_repo_with_configs([V1_CONFIG_JSON])
    service = ChartBuilderService(repository=repository)

    service.get_saved_configs()

    repository.save_chart_config.assert_not_called()


def test_save_failure_propagates_as_controlled_error():
    """
    If the repository raises a generic Exception during save,
    the service must propagate it so callers can show a controlled error.
    """
    repository = MagicMock(spec=ChartBuilderRepository)
    repository.get_available_sources.return_value = []  # not used
    repository.save_chart_config.side_effect = RuntimeError("DB write failed")
    service = ChartBuilderService(repository=repository)

    config = SavedChartConfigCreate.model_validate(
        {
            "name": "Fail Config",
            "config": {
                "version": 1,
                "mode": "predefined",
                "sourceId": "conversation_volume",
                "chartType": "bar",
                "groupBy": "channel",
                "yAxes": [{"column": "total_conversations"}],
                "title": "Test",
                "filters": {},
            },
        }
    )

    with pytest.raises(Exception):
        service.save_chart_config(config)


def test_v2_config_sort_preserved():
    """Sort direction must survive the round-trip."""
    repository = _make_repo_with_configs([V2_CONFIG_JSON])
    service = ChartBuilderService(repository=repository)

    config = service.get_saved_configs()[0]["config"]
    assert len(config["sort"]) == 1
    assert config["sort"][0]["fieldId"] == "msg_count"
    assert config["sort"][0]["direction"] == "desc"
