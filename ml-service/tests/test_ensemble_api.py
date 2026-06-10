import importlib
import os
import sys
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parent.parent))


MOCK_ENSEMBLE_RESULT = {
    "text": "em chưa nhận được email xác nhận",
    "final": {
        "label": "negative",
        "confidence": 0.95,
        "score": -0.95,
        "needStaffReview": True,
        "reason": "issue_keyword_rule",
        "probabilities": {"positive": 0.0, "neutral": 0.05, "negative": 0.95},
    },
    "rule": {
        "label": "negative",
        "confidence": 0.95,
        "reason": "contains_issue_keyword: chưa nhận được email",
        "needStaffReview": True,
        "matchedKeyword": "chưa nhận được email",
        "priority": "issue_negative",
    },
    "phobert": {
        "text": "em chưa nhận được email xác nhận",
        "label": "neutral",
        "score": 0.0,
        "confidence": 0.7,
        "source": "phobert",
        "rawLabel": "NEU",
        "probabilities": {"positive": 0.1, "neutral": 0.7, "negative": 0.2},
    },
    "visobert": {
        "text": "em chưa nhận được email xác nhận",
        "label": "neutral",
        "score": 0.0,
        "confidence": 0.0,
        "source": "visobert",
        "rawLabel": "UNAVAILABLE",
        "probabilities": {"positive": 0.0, "neutral": 1.0, "negative": 0.0},
        "available": False,
    },
    "analyzerVersion": "ensemble-phobert-visobert-v1",
    "actualAnalyzerVersion": "ensemble-phobert-visobert-v1",
    "issue": {
        "issueFlag": True,
        "issueType": "missing_email_or_notification",
        "issueConfidence": 0.9,
        "issueReason": "matched pattern: chua nhan email",
    },
    "sentiment": {
        "label": "negative",
        "reason": "issue_keyword_rule",
    },
}


@pytest.fixture
def client_and_module():
    previous_mode = os.environ.pop("SENTIMENT_MODE", None)
    import app.main as main_module

    main_module = importlib.reload(main_module)
    with patch.object(main_module, "load_model", return_value=(True, None)), \
         patch.object(main_module, "is_model_loaded", return_value=True), \
         patch.object(main_module, "get_load_error", return_value=None):
        with TestClient(main_module.app) as client:
            yield client, main_module

    if previous_mode is not None:
        os.environ["SENTIMENT_MODE"] = previous_mode


def test_predict_ensemble_returns_adapter_audit_fields(client_and_module):
    client, main_module = client_and_module

    with patch.object(main_module.ensemble_service, "predict_batch", return_value=[MOCK_ENSEMBLE_RESULT]):
        response = client.post("/predict-ensemble", json={
            "texts": ["em chưa nhận được email xác nhận"]
        })

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["mode"] == "ensemble"
    assert data["count"] == 1
    item = data["results"][0]
    assert item["final"]["label"] == "negative"
    assert item["final"]["needStaffReview"] is True
    assert item["rule"]["priority"] == "issue_negative"
    assert "phobert" in item
    assert "visobert" in item
    assert item["issue"]["issueFlag"] is True
    assert item["issue"]["issueType"] == "missing_email_or_notification"
    assert item["sentiment"]["label"] == "negative"
    assert item["analyzerVersion"] == "ensemble-phobert-visobert-v1"
    assert item["actualAnalyzerVersion"] == "ensemble-phobert-visobert-v1"


def test_metrics_includes_label_distribution(client_and_module):
    client, main_module = client_and_module

    with patch.object(main_module.ensemble_service, "predict_batch", return_value=[MOCK_ENSEMBLE_RESULT]):
        client.post("/predict-ensemble", json={"texts": ["em chưa nhận được email xác nhận"]})

    response = client.get("/metrics")
    assert response.status_code == 200
    data = response.json()
    assert "labelDistribution" in data
    assert data["labelDistribution"]["negative"] >= 1
