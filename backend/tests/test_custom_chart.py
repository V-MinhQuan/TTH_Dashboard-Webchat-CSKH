import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app
from app.repositories.analytics_repository import AnalyticsRepository
from app.services.analytics_service import AnalyticsService


client = TestClient(app)


def test_custom_chart_rejects_unknown_axis():
    response = client.post(
        "/api/analytics/custom-chart",
        json={"xAxis": "a.source; DROP TABLE dbo.WebChat_MessageAnalytics", "yAxis": "total_messages"},
    )

    assert response.status_code == 422


def test_custom_chart_rejects_unknown_metric():
    response = client.post(
        "/api/analytics/custom-chart",
        json={"xAxis": "channel", "yAxis": "raw_sql_count"},
    )

    assert response.status_code == 422


def test_custom_chart_service_passes_only_validated_values():
    repository = MagicMock()
    repository.get_custom_chart_data.return_value = [{"name": "Facebook", "value": 12}]
    service = AnalyticsService(repository=repository)

    result = service.get_custom_chart_data(
        {
            "xAxis": "channel",
            "yAxis": "total_conversations",
            "chartType": "bar",
            "filters": {"channel": "Facebook"},
        }
    )

    assert result == [{"name": "Facebook", "value": 12}]
    repository.get_custom_chart_data.assert_called_once_with(
        {
            "xAxis": "channel",
            "yAxis": "total_conversations",
            "chartType": "bar",
            "filters": {"channel": "Facebook"},
        }
    )


def test_repository_uses_parameterized_filters():
    cursor = MagicMock()
    cursor.description = [("name",), ("value",)]
    cursor.fetchall.return_value = [("Facebook", 3)]
    connection = MagicMock()
    connection.cursor.return_value = cursor
    context = MagicMock()
    context.__enter__.return_value = connection
    repository = AnalyticsRepository(connection_factory=lambda: context)

    rows = repository.get_custom_chart_data(
        {
            "xAxis": "channel",
            "yAxis": "total_conversations",
            "chartType": "bar",
            "filters": {"channel": "Facebook"},
        }
    )

    query, params = cursor.execute.call_args.args
    assert rows == [{"name": "Facebook", "value": 3}]
    assert "c.Source = ?" in query
    assert "Facebook" not in query
    assert params == ("Facebook",)


@pytest.mark.parametrize("x_axis", ["channel", "date", "month", "topic", "sentiment", "status"])
def test_supported_axes_are_accepted(x_axis):
    response = client.post(
        "/api/analytics/custom-chart",
        json={"xAxis": x_axis, "yAxis": "sentiment_count"},
    )

    assert response.status_code != 422
