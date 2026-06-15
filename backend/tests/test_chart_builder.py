import sys
from datetime import date
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app
from app.repositories.chart_builder_repository import ChartBuilderRepository
from app.routers.chart_builder import get_chart_builder_service
from app.schemas.chart_builder import ChartDataRequest, SavedChartConfigCreate
from app.services.chart_builder_service import ChartBuilderService


class FakeChartBuilderService:
    def get_available_sources(self):
        return [
            {
                "id": "sentiment_by_date",
                "name": "Cam xuc theo ngay",
                "description": "Du lieu cam xuc tu SQL Server.",
                "available": True,
                "unavailableReason": None,
                "dimensions": [{"id": "date", "label": "Ngay", "dataType": "date"}],
                "metrics": [{"id": "positive_count", "label": "Tich cuc", "dataType": "number"}],
                "supportedFilters": ["fromDate", "toDate", "channel"],
            },
            {
                "id": "agent_performance",
                "name": "Hieu suat nhan vien",
                "description": "Chua co du lieu agent da xac minh.",
                "available": False,
                "unavailableReason": "Missing verified agent performance columns.",
                "dimensions": [],
                "metrics": [],
                "supportedFilters": [],
            },
        ]

    def get_chart_data(self, request):
        return {
            "sourceId": request.source_id,
            "rows": [{"date": "2026-06-01", "positive_count": 12}],
            "series": [{"key": "positive_count", "label": "Tich cuc", "color": "#D73C01"}],
            "generatedAt": "2026-06-12T00:00:00Z",
        }

    def get_saved_configs(self, limit):
        return []

    def save_chart_config(self, config):
        return {
            "id": "61ac6d32-b886-4aa4-9e5b-bdb19ac2a020",
            "name": config.name,
            "description": config.description,
            "config": config.config.model_dump(by_alias=True, mode="json"),
            "createdAt": "2026-06-12T00:00:00Z",
            "updatedAt": "2026-06-12T00:00:00Z",
            "isActive": True,
        }

    def delete_chart_config(self, config_id):
        return True


@pytest.fixture()
def client():
    app.dependency_overrides[get_chart_builder_service] = FakeChartBuilderService
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_sources_expose_verified_and_unavailable_sources(client):
    response = client.get("/api/chart-builder/sources")

    assert response.status_code == 200
    sources = response.json()["data"]
    assert sources[0]["id"] == "sentiment_by_date"
    assert sources[0]["available"] is True
    assert sources[1]["id"] == "agent_performance"
    assert sources[1]["available"] is False


def test_data_endpoint_returns_recharts_rows(client):
    response = client.post(
        "/api/chart-builder/data",
        json={
            "sourceId": "sentiment_by_date",
            "chartType": "line",
            "groupBy": "date",
            "yAxes": [{"column": "positive_count", "color": "#D73C01"}],
            "filters": {"fromDate": "2026-06-01", "toDate": "2026-06-12"},
        },
    )

    assert response.status_code == 200
    assert response.json()["data"]["rows"] == [{"date": "2026-06-01", "positive_count": 12}]


def test_service_rejects_metric_not_owned_by_source():
    repository = MagicMock(spec=ChartBuilderRepository)
    repository.get_available_sources.return_value = [
        {
            "id": "conversation_volume",
            "available": True,
            "dimensions": [{"id": "channel"}],
            "metrics": [{"id": "total_conversations"}],
            "supportedFilters": ["fromDate", "toDate", "channel"],
        }
    ]
    service = ChartBuilderService(repository=repository)
    request = ChartDataRequest.model_validate(
        {
            "sourceId": "conversation_volume",
            "chartType": "bar",
            "groupBy": "channel",
            "yAxes": [{"column": "negative_count"}],
        }
    )

    with pytest.raises(ValueError, match="negative_count"):
        service.get_chart_data(request)


def test_service_rejects_inverted_date_range():
    service = ChartBuilderService(repository=MagicMock(spec=ChartBuilderRepository))
    request = ChartDataRequest.model_validate(
        {
            "sourceId": "conversation_volume",
            "chartType": "bar",
            "groupBy": "date",
            "yAxes": [{"column": "total_conversations"}],
            "filters": {"fromDate": date(2026, 6, 12), "toDate": date(2026, 6, 1)},
        }
    )

    with pytest.raises(ValueError, match="Ngày bắt đầu"):
        service.get_chart_data(request)


def test_service_does_not_save_invalid_metric_config():
    repository = MagicMock(spec=ChartBuilderRepository)
    repository.get_available_sources.return_value = [
        {
            "id": "conversation_volume",
            "available": True,
            "dimensions": [{"id": "channel"}],
            "metrics": [{"id": "total_conversations", "label": "Tong hoi thoai"}],
            "supportedFilters": ["channel"],
        }
    ]
    service = ChartBuilderService(repository=repository)
    config = SavedChartConfigCreate.model_validate(
        {
            "name": "Invalid config",
            "config": {
                "sourceId": "conversation_volume",
                "chartType": "bar",
                "groupBy": "channel",
                "yAxes": [{"column": "raw_sql_metric"}],
                "title": "Invalid",
            },
        }
    )

    with pytest.raises(ValueError, match="raw_sql_metric"):
        service.save_chart_config(config)
    repository.save_chart_config.assert_not_called()


def test_repository_parameterizes_channel_filter():
    cursor = MagicMock()
    cursor.description = [("channel",), ("total_conversations",)]
    cursor.fetchall.return_value = [("Facebook", 4)]
    connection = MagicMock()
    connection.cursor.return_value = cursor
    context = MagicMock()
    context.__enter__.return_value = connection
    repository = ChartBuilderRepository(connection_factory=lambda: context)
    request = ChartDataRequest.model_validate(
        {
            "sourceId": "conversation_volume",
            "chartType": "bar",
            "groupBy": "channel",
            "yAxes": [{"column": "total_conversations"}],
            "filters": {"channel": "Facebook"},
        }
    )

    rows = repository.get_chart_data(request)

    query, params = cursor.execute.call_args.args
    assert rows == [{"channel": "Facebook", "total_conversations": 4}]
    assert "Facebook" not in query
    assert params == ("Facebook",)


def test_config_crud_endpoints(client):
    payload = {
        "name": "Bieu do cam xuc",
        "description": "Theo doi cam xuc hang ngay",
        "config": {
            "sourceId": "sentiment_by_date",
            "chartType": "line",
            "groupBy": "date",
            "yAxes": [{"column": "positive_count"}],
            "title": "Cam xuc",
            "filters": {},
        },
    }

    create_response = client.post("/api/chart-builder/configs", json=payload)
    list_response = client.get("/api/chart-builder/configs")
    delete_response = client.delete(
        "/api/chart-builder/configs/61ac6d32-b886-4aa4-9e5b-bdb19ac2a020"
    )

    assert create_response.status_code == 201
    assert SavedChartConfigCreate.model_validate(payload).name == "Bieu do cam xuc"
    assert list_response.status_code == 200
    assert delete_response.status_code == 200


def test_sql_server_disconnected_returns_safe_500_response():
    def disconnected():
        raise ConnectionError("SQL Server unavailable")

    service = ChartBuilderService(
        repository=ChartBuilderRepository(connection_factory=disconnected)
    )
    app.dependency_overrides[get_chart_builder_service] = lambda: service
    try:
        with TestClient(app, raise_server_exceptions=False) as test_client:
            response = test_client.get("/api/chart-builder/sources")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 500
    assert response.json() == {
        "success": False,
        "message": "Internal server error while processing the request.",
        "data": None,
    }
