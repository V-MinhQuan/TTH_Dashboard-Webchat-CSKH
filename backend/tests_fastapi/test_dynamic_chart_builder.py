from __future__ import annotations

import json
import sys
import unicodedata
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config.chart_builder_catalog import (
    DatasetDefinition,
    FieldDefinition,
    get_dataset_catalog,
)
from app.main import app
from app.repositories import chart_builder_repository as repository_module
from app.repositories.chart_builder_repository import ChartBuilderRepository
from app.routers.chart_builder import get_chart_builder_service
from app.schemas.chart_builder import CustomChartRequest, SavedChartConfigCreate
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
        "sort": [{"fieldId": "record_count", "direction": "desc"}],
        "topN": 10,
        "limit": 500,
    }
    payload.update(overrides)
    return CustomChartRequest.model_validate(payload)


def test_catalog_hides_sensitive_columns_and_exposes_metadata():
    catalog = get_dataset_catalog()

    assert "message_analytics" in catalog
    analytics = catalog["message_analytics"]
    field_ids = set(analytics.fields)
    assert "customer_id" not in field_ids
    assert "issue_reason" not in field_ids
    assert analytics.fields["message_at"].date_grains == ("day", "week", "month", "quarter", "year")
    assert "avg" in analytics.fields["sentiment_score"].aggregations


def test_conversation_identifier_is_count_distinct_metric_with_business_label():
    catalog = get_dataset_catalog()

    for dataset_id in ("conversations", "agent_performance"):
        field = catalog[dataset_id].fields["conversation_id"]
        assert field.label == "Số lượng hội thoại"
        assert field.semantic_type == "identifier"
        assert field.default_aggregation == "count_distinct"
        assert set(field.aggregations) == {"count", "count_distinct"}
        assert "sum" not in field.aggregations


def test_conversation_channel_dataset_scopes_to_known_operating_channels():
    compiler = ChartQueryCompiler(get_dataset_catalog())
    request = CustomChartRequest.model_validate(
        {
            "version": 2,
            "mode": "custom",
            "datasetId": "conversations",
            "chartType": "bar",
            "dimensions": [
                {
                    "fieldId": "channel",
                    "alias": "channel",
                    "nullHandling": "label",
                }
            ],
            "metrics": [
                {
                    "fieldId": "conversation_id",
                    "aggregation": "count_distinct",
                    "alias": "n",
                }
            ],
            "filters": [],
            "sort": [{"fieldId": "n", "direction": "desc"}],
            "limit": 100,
        }
    )

    compiled = compiler.compile(request)

    assert "c.Source IN" in compiled.sql
    assert "ZaloBusiness" in compiled.sql
    assert "ChatWidget" in compiled.sql


@pytest.mark.parametrize("field_id", ["topic", "keyword"])
def test_compiler_rejects_unavailable_fields(field_id):
    compiler = ChartQueryCompiler(get_dataset_catalog())
    request = custom_request(
        dimensions=[{"fieldId": field_id, "alias": field_id}],
    )

    with pytest.raises(ValueError, match="chưa được hỗ trợ"):
        compiler.compile(request)


def test_catalog_preserves_vietnamese_unicode_and_hides_sql_explanation():
    catalog = get_dataset_catalog()
    payload = {
        dataset_id: {
            "label": dataset.label,
            "description": dataset.description,
            "fields": {
                field_id: {
                    "label": field.label,
                    "unavailableReason": field.unavailable_reason,
                }
                for field_id, field in dataset.fields.items()
            },
        }
        for dataset_id, dataset in catalog.items()
    }
    encoded = json.dumps(payload, ensure_ascii=False)

    assert "Số lượng hội thoại" in encoded
    assert "Thời gian cập nhật trạng thái" in encoded
    assert "OPENJSON" not in encoded
    assert unicodedata.is_normalized("NFC", encoded)


def test_compiler_rejects_unknown_dataset():
    compiler = ChartQueryCompiler(get_dataset_catalog())
    request = custom_request(datasetId="users")

    with pytest.raises(ValueError, match="Bộ dữ liệu"):
        compiler.compile(request)


def test_compiler_rejects_unknown_column_and_sql_injection():
    with pytest.raises(ValidationError, match="pattern"):
        custom_request(
            dimensions=[
                {
                    "fieldId": (
                        "source]; DROP TABLE "
                        "dbo.WebChat_MessageAnalytics;--"
                    )
                }
            ],
        )


def test_compiler_rejects_invalid_aggregation_for_string_field():
    compiler = ChartQueryCompiler(get_dataset_catalog())
    request = custom_request(
        metrics=[
            {
                "fieldId": "record_id",
                "aggregation": "sum",
                "alias": "bad_sum",
            }
        ]
    )

    with pytest.raises(ValueError, match="Phép tổng hợp"):
        compiler.compile(request)


def test_compiler_parameterizes_filter_values_and_escapes_like():
    compiler = ChartQueryCompiler(get_dataset_catalog())
    request = custom_request(
        filters=[
            {
                "fieldId": "channel",
                "operator": "contains",
                "value": "Face%'; DROP TABLE dbo.WebChat_MessageAnalytics;--",
            }
        ]
    )

    compiled = compiler.compile(request)

    assert "DROP TABLE" not in compiled.sql
    assert "LIKE ? ESCAPE '\\'" in compiled.sql
    assert compiled.params[-1] == "%Face\\%'; DROP TABLE dbo.WebChat\\_MessageAnalytics;--%"


def test_compiler_supports_date_grain_group_by_and_count_distinct():
    compiler = ChartQueryCompiler(get_dataset_catalog())
    request = custom_request(
        dimensions=[
            {
                "fieldId": "message_at",
                "alias": "month",
                "dateGrain": "month",
            }
        ],
        metrics=[
            {
                "fieldId": "conversation_id",
                "aggregation": "count_distinct",
                "alias": "conversation_count",
            }
        ],
        sort=[{"fieldId": "month", "direction": "asc"}],
    )

    compiled = compiler.compile(request)

    assert "DATEFROMPARTS(YEAR(a.messageAt), MONTH(a.messageAt), 1)" in compiled.sql
    assert "COUNT(DISTINCT a.conversationId)" in compiled.sql
    assert "GROUP BY DATEFROMPARTS" in compiled.sql
    assert "ORDER BY [month] ASC" in compiled.sql


def test_date_range_filter_includes_the_complete_end_date():
    compiler = ChartQueryCompiler(get_dataset_catalog())
    request = custom_request(
        filters=[
            {
                "fieldId": "message_at",
                "operator": "between",
                "value": "2026-06-01",
                "valueTo": "2026-06-15",
            }
        ]
    )

    compiled = compiler.compile(request)

    assert "a.messageAt >= ?" in compiled.sql
    assert "a.messageAt < DATEADD(day, 1, ?)" in compiled.sql


def test_compiler_enforces_top_n_and_maximum_limit():
    compiler = ChartQueryCompiler(get_dataset_catalog())

    compiled = compiler.compile(custom_request(topN=25, limit=5000))

    assert "SELECT TOP 25" in compiled.sql
    with pytest.raises(ValueError):
        CustomChartRequest.model_validate(
            custom_request().model_dump(by_alias=True) | {"limit": 5001}
        )


def test_compiler_rejects_invalid_join_field_combination():
    compiler = ChartQueryCompiler(get_dataset_catalog())
    request = custom_request(
        datasetId="messages",
        dimensions=[{"fieldId": "channel"}],
        metrics=[{"fieldId": "satisfaction_score", "aggregation": "avg"}],
    )

    with pytest.raises(ValueError, match="Trường"):
        compiler.compile(request)


def test_compiler_uses_only_approved_agent_relation():
    compiler = ChartQueryCompiler(get_dataset_catalog())
    request = custom_request(
        datasetId="agent_performance",
        dimensions=[{"fieldId": "agent_name", "alias": "agent"}],
        metrics=[
            {
                "fieldId": "response_minutes",
                "aggregation": "avg",
                "alias": "avg_response_minutes",
            }
        ],
        sort=[{"fieldId": "avg_response_minutes", "direction": "desc"}],
    )

    compiled = compiler.compile(request)

    assert "OUTER APPLY" in compiled.sql
    assert "WebChat_MessageLogs" in compiled.sql
    assert "agent.HostDisplayName" in compiled.sql


def test_type_aware_filter_validation_rejects_contains_on_number():
    compiler = ChartQueryCompiler(get_dataset_catalog())
    request = custom_request(
        filters=[
            {
                "fieldId": "sentiment_score",
                "operator": "contains",
                "value": "1",
            }
        ]
    )

    with pytest.raises(ValueError, match="Toán tử"):
        compiler.compile(request)


def test_schema_rejects_incompatible_scatter_before_query_compilation():
    with pytest.raises(ValidationError, match="ít nhất hai chỉ số"):
        custom_request(chartType="scatter")


def test_compiler_rejects_boolean_dimension_null_label():
    compiler = ChartQueryCompiler(get_dataset_catalog())
    request = CustomChartRequest.model_validate(
        {
            "version": 2,
            "mode": "custom",
            "datasetId": "conversations",
            "chartType": "stacked_bar",
            "dimensions": [
                {
                    "fieldId": "channel",
                    "alias": "channel",
                    "nullHandling": "label",
                }
            ],
            "metrics": [
                {
                    "fieldId": "conversation_id",
                    "aggregation": "count_distinct",
                    "alias": "n",
                }
            ],
            "series": {
                "fieldId": "no_response_needed",
                "alias": "no_response_needed",
                "nullHandling": "label",
            },
            "filters": [],
            "sort": [],
            "limit": 100,
        }
    )

    with pytest.raises(ValueError, match="Chỉ trường văn bản"):
        compiler.compile(request)


def test_service_does_not_execute_sql_when_custom_validation_fails():
    repository = MagicMock(spec=ChartBuilderRepository)
    service = ChartBuilderService(repository=repository)
    request = custom_request(
        filters=[
            {
                "fieldId": "message_at",
                "operator": "between",
                "value": "2026-06-12",
                "valueTo": "2026-06-01",
            }
        ]
    )

    with pytest.raises(ValueError, match="Ngày bắt đầu"):
        service.get_chart_data(request)

    repository.execute_custom_query.assert_not_called()


def test_compiler_rejects_overlong_text_filter_before_query_execution():
    repository = MagicMock(spec=ChartBuilderRepository)
    service = ChartBuilderService(repository=repository)
    request = custom_request(
        filters=[
            {
                "fieldId": "channel",
                "operator": "contains",
                "value": "x" * 501,
            }
        ]
    )

    with pytest.raises(ValueError, match="quá dài"):
        service.get_chart_data(request)

    repository.execute_custom_query.assert_not_called()


def test_scatter_requires_two_numeric_metric_fields_not_just_two_metrics():
    catalog = {
        "toy": DatasetDefinition(
            id="toy",
            label="Toy",
            description="Toy dataset",
            root_sql="dbo.Toy t",
            root_alias="t",
            fields={
                "category": FieldDefinition(
                    id="category",
                    label="Category",
                    expression="t.Category",
                    data_type="string",
                    semantic_type="category",
                    roles=("dimension",),
                ),
                "text_metric": FieldDefinition(
                    id="text_metric",
                    label="Text metric",
                    expression="t.TextValue",
                    data_type="string",
                    semantic_type="text",
                    roles=("metric",),
                    aggregations=("count",),
                    default_aggregation="count",
                ),
                "number_metric": FieldDefinition(
                    id="number_metric",
                    label="Number metric",
                    expression="t.NumberValue",
                    data_type="number",
                    semantic_type="number",
                    roles=("metric",),
                    aggregations=("sum",),
                    default_aggregation="sum",
                ),
            },
            relations={},
            required_objects={},
            default_date_field=None,
            default_dimension="category",
            default_metric="number_metric",
        )
    }
    compiler = ChartQueryCompiler(catalog)
    request = CustomChartRequest.model_validate(
        {
            "version": 2,
            "mode": "custom",
            "datasetId": "toy",
            "chartType": "scatter",
            "dimensions": [],
            "metrics": [
                {
                    "fieldId": "text_metric",
                    "aggregation": "count",
                    "alias": "text_count",
                },
                {
                    "fieldId": "number_metric",
                    "aggregation": "sum",
                    "alias": "number_sum",
                },
            ],
            "filters": [],
            "sort": [],
            "limit": 100,
        }
    )

    with pytest.raises(ValueError, match="hai chỉ số số"):
        compiler.compile(request)


def test_version_1_saved_config_is_normalized_without_rewriting():
    repository = MagicMock(spec=ChartBuilderRepository)
    repository.get_saved_configs.return_value = [
        {
            "id": UUID("61ac6d32-b886-4aa4-9e5b-bdb19ac2a020"),
            "name": "Legacy",
            "description": None,
            "configJson": json.dumps(
                {
                    "sourceId": "conversation_volume",
                    "chartType": "bar",
                    "groupBy": "channel",
                    "yAxes": [{"column": "total_conversations"}],
                    "title": "Legacy",
                    "filters": {},
                }
            ),
            "createdAt": datetime(2026, 6, 1),
            "updatedAt": datetime(2026, 6, 1),
            "isActive": True,
        }
    ]
    service = ChartBuilderService(repository=repository)

    config = service.get_saved_configs()[0]["config"]

    assert config["version"] == 1
    assert config["mode"] == "predefined"
    repository.save_chart_config.assert_not_called()


def test_version_2_config_is_validated_before_save():
    repository = MagicMock(spec=ChartBuilderRepository)
    repository.save_chart_config.return_value = {
        "id": UUID("61ac6d32-b886-4aa4-9e5b-bdb19ac2a020"),
        "name": "Dynamic",
        "description": None,
        "configJson": None,
        "createdAt": datetime(2026, 6, 1),
        "updatedAt": datetime(2026, 6, 1),
        "isActive": True,
    }
    config = SavedChartConfigCreate.model_validate(
        {
            "name": "Dynamic",
            "config": custom_request().model_dump(by_alias=True)
            | {
                "title": "Dynamic chart",
                "chartSettings": {"showLegend": True},
            },
        }
    )
    repository.save_chart_config.side_effect = lambda item: {
        **repository.save_chart_config.return_value,
        "configJson": json.dumps(item.config.model_dump(by_alias=True, mode="json")),
    }
    service = ChartBuilderService(repository=repository)

    saved = service.save_chart_config(config)

    assert saved["config"]["version"] == 2
    assert saved["config"]["mode"] == "custom"
    repository.save_chart_config.assert_called_once()


def test_repository_sets_query_timeout_and_returns_empty_rows():
    cursor = MagicMock()
    cursor.description = [("channel",), ("record_count",)]
    cursor.fetchall.return_value = []
    connection = MagicMock()
    connection.cursor.return_value = cursor
    context = MagicMock()
    context.__enter__.return_value = connection
    repository = ChartBuilderRepository(connection_factory=lambda: context, query_timeout_seconds=9)

    result = repository.execute_custom_query(
        "SELECT TOP 10 a.source AS [channel], COUNT(a.id) AS [record_count] "
        "FROM dbo.WebChat_MessageAnalytics a GROUP BY a.source ORDER BY [record_count] DESC",
        (),
    )

    assert result == []
    assert cursor.timeout == 9


def test_repository_reads_catalog_capabilities_from_sql_server_metadata():
    cursor = MagicMock()
    cursor.description = [("objectName",), ("columnName",)]
    cursor.fetchall.return_value = [
        ("dbo.WebChat_Conversations", "Id"),
        ("dbo.WebChat_Conversations", "Source"),
        ("dbo.WebChat_MessageAnalytics", "messageAt"),
    ]
    connection = MagicMock()
    connection.cursor.return_value = cursor
    context = MagicMock()
    context.__enter__.return_value = connection
    repository = ChartBuilderRepository(
        connection_factory=lambda: context,
        query_timeout_seconds=7,
    )

    capabilities = repository.get_catalog_capabilities()

    assert capabilities == {
        "dbo.WebChat_Conversations": {"Id", "Source"},
        "dbo.WebChat_MessageAnalytics": {"messageAt"},
    }
    assert cursor.timeout == 7
    assert "sys.objects" in cursor.execute.call_args.args[0]
    assert cursor.execute.call_args.args[1]


def test_repository_marks_predefined_sources_from_schema_capabilities(monkeypatch):
    connection = MagicMock()
    context = MagicMock()
    context.__enter__.return_value = connection
    monkeypatch.setattr(
        repository_module,
        "execute_one",
        MagicMock(return_value={"analytics": 1, "conversations": 1}),
    )
    repository = ChartBuilderRepository(connection_factory=lambda: context)

    sources = repository.get_available_sources()
    by_id = {source["id"]: source for source in sources}

    assert by_id["sentiment_by_date"]["available"] is True
    assert by_id["keyword_frequency"]["available"] is True
    assert by_id["conversation_volume"]["available"] is True
    assert by_id["agent_performance"]["available"] is False
    assert "hiệu suất nhân viên" in by_id["agent_performance"]["unavailableReason"]


def test_repository_persists_lists_and_soft_deletes_saved_configs(monkeypatch):
    config_id = UUID("61ac6d32-b886-4aa4-9e5b-bdb19ac2a020")
    saved_row = {
        "id": config_id,
        "name": "Biểu đồ hội thoại",
        "description": "Dữ liệu thật",
        "configJson": "{}",
        "createdAt": datetime(2026, 6, 15),
        "updatedAt": datetime(2026, 6, 15),
        "isActive": True,
    }
    execute_one_mock = MagicMock(return_value=saved_row)
    execute_all_mock = MagicMock(return_value=[saved_row])
    monkeypatch.setattr(repository_module, "execute_one", execute_one_mock)
    monkeypatch.setattr(repository_module, "execute_all", execute_all_mock)

    cursor = MagicMock()
    cursor.rowcount = 1
    connection = MagicMock()
    connection.cursor.return_value = cursor
    context = MagicMock()
    context.__enter__.return_value = connection
    repository = ChartBuilderRepository(connection_factory=lambda: context)
    config = SavedChartConfigCreate.model_validate(
        {
            "name": "  Biểu đồ hội thoại  ",
            "description": "Dữ liệu thật",
            "config": custom_request(
                metrics=[
                    {
                        "fieldId": "record_id",
                        "aggregation": "count",
                        "alias": "record_count",
                        "label": "Số lượng bản ghi",
                    }
                ]
            ).model_dump(by_alias=True),
        }
    )

    assert repository.save_chart_config(config) == saved_row
    assert repository.get_saved_configs(25) == [saved_row]
    assert repository.delete_chart_config(config_id) is True

    insert_params = execute_one_mock.call_args.args[2]
    assert insert_params[0] == "Biểu đồ hội thoại"
    assert "Số lượng bản ghi" in insert_params[2]
    assert "\\u" not in insert_params[2]
    assert '"datasetId":"message_analytics"' in insert_params[2]
    assert "SELECT TOP 25" in execute_all_mock.call_args.args[1]
    assert cursor.execute.call_args.args[1] == (str(config_id),)
    assert connection.commit.call_count == 2


def test_repository_parses_json_arrays_without_executing_sql_content():
    assert ChartBuilderRepository._json_array([" Chủ đề ", "", "CSKH"]) == [
        "Chủ đề",
        "CSKH",
    ]
    assert ChartBuilderRepository._json_array('["từ khóa", "hỗ trợ"]') == [
        "từ khóa",
        "hỗ trợ",
    ]
    assert ChartBuilderRepository._json_array("không phải JSON") == []
    assert ChartBuilderRepository._json_array(None) == []


def test_custom_series_preserves_false_boolean_value():
    repository = MagicMock(spec=ChartBuilderRepository)
    repository.execute_custom_query.return_value = [
        {"channel": "Facebook", "need_review": False, "record_count": 12},
        {"channel": "Facebook", "need_review": True, "record_count": 3},
    ]
    service = ChartBuilderService(repository=repository)
    request = custom_request(
        dimensions=[{"fieldId": "channel", "alias": "channel"}],
        metrics=[
            {
                "fieldId": "record_id",
                "aggregation": "count",
                "alias": "record_count",
            }
        ],
        series={"fieldId": "need_staff_review", "alias": "need_review"},
        sort=[{"fieldId": "record_count", "direction": "desc"}],
    )

    result = service.get_chart_data(request)

    assert result["rows"][0]["record_count__false"] == 12
    assert result["rows"][0]["record_count__true"] == 3


class FakeDynamicService:
    def get_catalog(self):
        return {
            "version": 2,
            "datasets": [
                {
                    "id": "conversations",
                    "label": "Hội thoại",
                    "fields": [
                        {
                            "id": "conversation_id",
                            "label": "Số lượng hội thoại",
                        }
                    ],
                }
            ],
        }

    def preview_chart_data(self, request):
        return {
            "mode": "custom",
            "datasetId": request.dataset_id,
            "rows": [],
            "series": [],
            "dimensionKeys": [],
            "generatedAt": "2026-06-15T00:00:00Z",
            "execution": {"rowCount": 0, "executionTimeMs": 1, "limit": 200, "truncated": False},
        }

    def get_available_sources(self):
        return []

    def get_chart_data(self, request):
        return self.preview_chart_data(request)

    def get_saved_configs(self, limit=50):
        return []

    def save_chart_config(self, config):
        raise AssertionError("not used")

    def delete_chart_config(self, config_id):
        return False


@pytest.fixture()
def dynamic_client():
    app.dependency_overrides[get_chart_builder_service] = FakeDynamicService
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


def test_catalog_and_preview_endpoints(dynamic_client):
    catalog_response = dynamic_client.get("/api/chart-builder/catalog")
    preview_response = dynamic_client.post(
        "/api/chart-builder/preview",
        json=custom_request().model_dump(by_alias=True),
    )

    assert catalog_response.status_code == 200
    assert preview_response.status_code == 200
    assert preview_response.json()["data"]["execution"]["rowCount"] == 0
    assert "Số lượng hội thoại" in catalog_response.content.decode("utf-8")


def test_preview_endpoint_rejects_boolean_null_label_before_repository_call():
    repository = MagicMock(spec=ChartBuilderRepository)
    service = ChartBuilderService(repository=repository)
    app.dependency_overrides[get_chart_builder_service] = lambda: service
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/chart-builder/preview",
                json={
                    "version": 2,
                    "mode": "custom",
                    "datasetId": "conversations",
                    "chartType": "stacked_bar",
                    "dimensions": [
                        {
                            "fieldId": "channel",
                            "alias": "channel",
                            "nullHandling": "label",
                        }
                    ],
                    "metrics": [
                        {
                            "fieldId": "conversation_id",
                            "aggregation": "count_distinct",
                            "alias": "n",
                        }
                    ],
                    "series": {
                        "fieldId": "no_response_needed",
                        "alias": "no_response_needed",
                        "nullHandling": "label",
                    },
                    "filters": [],
                    "sort": [],
                    "limit": 100,
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 400
    assert "Chỉ trường văn bản" in response.json()["message"]
    repository.execute_custom_query.assert_not_called()


def test_catalog_returns_safe_500_when_sql_server_is_disconnected():
    def disconnected():
        raise ConnectionError("SQL Server unavailable")

    service = ChartBuilderService(
        repository=ChartBuilderRepository(connection_factory=disconnected)
    )
    app.dependency_overrides[get_chart_builder_service] = lambda: service
    try:
        with TestClient(app, raise_server_exceptions=False) as client:
            response = client.get("/api/chart-builder/catalog")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 500
    assert response.json() == {
        "success": False,
        "message": "Internal server error while processing the request.",
        "data": None,
    }
