import os
import sys
import types
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock

sys.path.insert(0, str(Path(__file__).parent.parent))

# Fixture to reload packages with clean env
@pytest.fixture(autouse=True)
def clean_env():
    # Store old variables
    old_vars = {
        "ENABLE_VISOBERT": os.environ.get("ENABLE_VISOBERT"),
        "REQUIRE_VISOBERT": os.environ.get("REQUIRE_VISOBERT"),
        "VISOBERT_MODEL_NAME": os.environ.get("VISOBERT_MODEL_NAME"),
        "SENTIMENT_MODE": os.environ.get("SENTIMENT_MODE"),
    }
    yield
    # Restore
    for k, v in old_vars.items():
        if v is None:
            os.environ.pop(k, None)
        else:
            os.environ[k] = v

def mock_phobert_predict(texts):
    results = []
    for text in texts:
        lower_text = text.lower()
        if "chưa nhận được" in lower_text or "không" in lower_text:
            label = "negative"
            conf = 0.92
        elif "cảm ơn" in lower_text:
            label = "positive"
            conf = 0.88
        else:
            label = "neutral"
            conf = 0.85
            
        score = 0.0
        if label == "positive":
            score = conf
        elif label == "negative":
            score = -conf
            
        probabilities = {"positive": 0.0, "neutral": 0.0, "negative": 0.0}
        probabilities[label] = conf
        probabilities["neutral" if label != "neutral" else "positive"] = round(1 - conf, 4)
        
        results.append({
            "text": text,
            "label": label,
            "score": score,
            "confidence": conf,
            "source": "phobert",
            "rawLabel": label.upper(),
            "probabilities": probabilities,
        })
    return results

@pytest.fixture(autouse=True)
def mock_phobert():
    with patch("app.ensemble.predict_batch", side_effect=mock_phobert_predict):
        yield

def test_visobert_disabled():
    with patch.dict(os.environ, {"ENABLE_VISOBERT": "false"}):
        from app.ensemble import VisobertSentimentAdapter, EnsembleSentimentService
        
        adapter = VisobertSentimentAdapter()
        assert adapter.enabled is False
        assert adapter._ensure_loaded() is False
        
        # Test fallback version
        service = EnsembleSentimentService(visobert_adapter=adapter)
        res = service.predict_batch(["xin chào"])
        assert res[0]["analyzerVersion"] == "ensemble-phobert-rule-v1"
        assert res[0]["visobert"]["available"] is False

def test_visobert_enabled_and_loaded():
    with patch.dict(os.environ, {"ENABLE_VISOBERT": "true", "VISOBERT_MODEL_NAME": "dummy"}):
        from app.ensemble import VisobertSentimentAdapter, EnsembleSentimentService
        
        adapter = VisobertSentimentAdapter()
        # Mock pipeline
        mock_pipe = MagicMock()
        mock_pipe.return_value = [[{"label": "neutral", "score": 0.85}]]
        
        with patch.object(adapter, "_ensure_loaded", return_value=True):
            adapter._pipeline = mock_pipe
            
            service = EnsembleSentimentService(visobert_adapter=adapter)
            res = service.predict_batch(["xin chào"])
            assert res[0]["analyzerVersion"] == "ensemble-phobert-visobert-v1"
            assert res[0]["visobert"]["available"] is True

def test_visobert_load_failed_require_false():
    with patch.dict(os.environ, {"ENABLE_VISOBERT": "true", "VISOBERT_MODEL_NAME": "dummy", "REQUIRE_VISOBERT": "false"}):
        from app.ensemble import VisobertSentimentAdapter, EnsembleSentimentService
        
        adapter = VisobertSentimentAdapter()
        
        # Mock _ensure_loaded failing (returning False)
        with patch.object(adapter, "_ensure_loaded", return_value=False):
            service = EnsembleSentimentService(visobert_adapter=adapter)
            res = service.predict_batch(["xin chào"])
            assert res[0]["analyzerVersion"] == "ensemble-phobert-rule-v1"
            assert res[0]["visobert"]["available"] is False

def test_visobert_load_failed_require_true():
    with patch.dict(os.environ, {"ENABLE_VISOBERT": "true", "VISOBERT_MODEL_NAME": "dummy", "REQUIRE_VISOBERT": "true"}):
        from app.ensemble import VisobertSentimentAdapter
        
        adapter = VisobertSentimentAdapter()
        
        transformers_stub = types.SimpleNamespace(
            pipeline=MagicMock(side_effect=Exception("Failed to download"))
        )
        # Trigger actual pipeline fail during ensure_loaded even when transformers
        # is not installed in this optional ViSoBERT test environment.
        with patch.dict(sys.modules, {"transformers": transformers_stub}):
            with pytest.raises(RuntimeError) as excinfo:
                adapter._ensure_loaded()
            assert "REQUIRE_VISOBERT=true but ViSoBERT load failed" in str(excinfo.value)

def test_sample_predictions():
    # 5. Sample predictions
    # "hồ sơ thi tin học cơ bản gồm những gì ạ" → neutral
    # "Dạ em cảm ơn chị nhiều ạ" → positive
    # "em chưa nhận được email xác nhận" → negative + needStaffReview=true
    # "Dạ" → neutral
    from app.ensemble import ensemble_service
    
    res = ensemble_service.predict_batch([
        "hồ sơ thi tin học cơ bản gồm những gì ạ",
        "Dạ em cảm ơn chị nhiều ạ",
        "em chưa nhận được email xác nhận",
        "Dạ"
    ])
    
    assert res[0]["final"]["label"] == "neutral"
    assert res[0]["final"]["needStaffReview"] is False
    
    assert res[1]["final"]["label"] == "positive"
    assert res[1]["final"]["needStaffReview"] is False
    
    assert res[2]["final"]["label"] == "negative"
    assert res[2]["final"]["needStaffReview"] is True
    
    assert res[3]["final"]["label"] == "neutral"
    assert res[3]["final"]["needStaffReview"] is False
