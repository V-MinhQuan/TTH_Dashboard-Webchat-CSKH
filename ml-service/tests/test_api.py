"""
tests/test_api.py
─────────────────
Test tự động cho ml-service FastAPI endpoints.

Cách chạy (từ thư mục ml-service/):
    pytest tests/test_api.py -v

Lưu ý:
    - Các test này MOCK model_loader để không cần tải model thật.
    - Chạy test được ngay cả khi chưa download model.
    - Để test tích hợp thật, cần chạy service riêng và dùng httpx/requests.
"""

import json
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock


import pytest
from fastapi.testclient import TestClient

# ─── Đảm bảo Python tìm được module app/ ──────────────────────────────────────
sys.path.insert(0, str(Path(__file__).parent.parent))
os.environ["SENTIMENT_MODE"] = "phobert"


# ─── Dữ liệu mock: kết quả predict giả để không cần model thật ────────────────
MOCK_PREDICT_RESULTS = [
    {
        "text":          "em không đăng nhập được",
        "label":         "negative",
        "score":         -0.92,
        "confidence":    0.92,
        "source":        "phobert",
        "rawLabel":      "NEG",
        "probabilities": {"positive": 0.02, "neutral": 0.06, "negative": 0.92}
    },
    {
        "text":          "cảm ơn tư vấn rõ rồi",
        "label":         "positive",
        "score":         0.88,
        "confidence":    0.88,
        "source":        "phobert",
        "rawLabel":      "POS",
        "probabilities": {"positive": 0.88, "neutral": 0.09, "negative": 0.03}
    }
]

MOCK_NEUTRAL_RESULT = [
    {
        "text":          "",
        "label":         "neutral",
        "score":         0.0,
        "confidence":    0.0,
        "source":        "phobert",
        "rawLabel":      "NEU",
        "probabilities": {"positive": 0.0, "neutral": 1.0, "negative": 0.0}
    }
]


# ─── Fixture: client với model mock sẵn sàng ──────────────────────────────────
@pytest.fixture
def client_model_ready():
    """FastAPI test client với model đã được mock là loaded."""
    import importlib
    import app.main as main_module

    main_module = importlib.reload(main_module)
    with patch.object(main_module, "load_model", return_value=(True, None)), \
         patch.object(main_module, "is_model_loaded", return_value=True), \
         patch.object(main_module, "get_load_error", return_value=None):
        with TestClient(main_module.app) as c:
            yield c


# ─── Fixture: client với model CHƯA được tải ──────────────────────────────────
@pytest.fixture
def client_model_not_loaded():
    """FastAPI test client khi model chưa được tải."""
    import importlib
    import app.main as main_module

    main_module = importlib.reload(main_module)
    error = "Không tìm thấy ONNX model. Vui lòng chạy python download_model.py trước."
    with patch.object(main_module, "load_model", return_value=(False, error)), \
         patch.object(main_module, "is_model_loaded", return_value=False), \
         patch.object(main_module, "get_load_error", return_value=error):
        with TestClient(main_module.app, raise_server_exceptions=False) as c:
            yield c


# ═══════════════════════════════════════════════════════════════════════════════
# Test: GET /health
# ═══════════════════════════════════════════════════════════════════════════════

class TestHealthEndpoint:

    def test_health_ok_when_model_loaded(self, client_model_ready):
        """GET /health trả về ok khi model đã tải."""
        response = client_model_ready.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["status"] == "ok"
        assert data["modelLoaded"] is True
        assert "phobert" in data["modelName"].lower()
        assert data["engine"] == "onnxruntime"

    def test_health_model_not_loaded(self, client_model_not_loaded):
        """GET /health trả về modelLoaded=False khi model chưa tải."""
        response = client_model_not_loaded.get("/health")
        data = response.json()
        assert data["modelLoaded"] is False
        assert data["success"] is False


# ═══════════════════════════════════════════════════════════════════════════════
# Test: POST /predict
# ═══════════════════════════════════════════════════════════════════════════════

class TestPredictEndpoint:

    def test_predict_two_texts_returns_two_results(self, client_model_ready):
        """POST /predict với 2 văn bản trả về đúng 2 kết quả."""
        with patch("app.main.predict_batch", return_value=MOCK_PREDICT_RESULTS):
            response = client_model_ready.post("/predict", json={
                "texts": ["em không đăng nhập được", "cảm ơn tư vấn rõ rồi"]
            })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["count"] == 2
        assert len(data["results"]) == 2

        item = data["results"][0]
        assert "label" in item
        assert "score" in item
        assert "confidence" in item
        assert "source" in item
        assert "rawLabel" in item
        assert "probabilities" in item
        assert item["source"] == "phobert"

    def test_predict_empty_texts_returns_empty_results(self, client_model_ready):
        """POST /predict với texts=[] trả về results rỗng."""
        response = client_model_ready.post("/predict", json={"texts": []})
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["count"] == 0
        assert data["results"] == []

    def test_predict_more_than_128_texts_returns_400(self, client_model_ready):
        """POST /predict với > 128 văn bản trả về HTTP 400."""
        texts = [f"văn bản số {i}" for i in range(130)]
        response = client_model_ready.post("/predict", json={"texts": texts})
        assert response.status_code == 400

    def test_predict_empty_text_returns_neutral(self, client_model_ready):
        """POST /predict với văn bản rỗng "" trả về neutral."""
        with patch("app.main.predict_batch", return_value=MOCK_NEUTRAL_RESULT):
            response = client_model_ready.post("/predict", json={"texts": [""]})
        assert response.status_code == 200
        data = response.json()
        assert data["results"][0]["label"] == "neutral"
        assert data["results"][0]["score"] == 0.0
        assert data["results"][0]["confidence"] == 0.0

    def test_predict_model_not_loaded_returns_503(self, client_model_not_loaded):
        """POST /predict trả về 503 khi model chưa tải."""
        response = client_model_not_loaded.post("/predict", json={
            "texts": ["xin chào"]
        })
        assert response.status_code == 503

    def test_predict_result_order_matches_input(self, client_model_ready):
        """Thứ tự kết quả phải khớp với thứ tự input."""
        mock_results = [
            {**MOCK_PREDICT_RESULTS[0], "text": "văn bản 1"},
            {**MOCK_PREDICT_RESULTS[1], "text": "văn bản 2"},
        ]
        with patch("app.main.predict_batch", return_value=mock_results):
            response = client_model_ready.post("/predict", json={
                "texts": ["văn bản 1", "văn bản 2"]
            })
        data = response.json()
        assert data["results"][0]["text"] == "văn bản 1"
        assert data["results"][1]["text"] == "văn bản 2"

    def test_predict_probabilities_sum_to_one(self, client_model_ready):
        """Xác suất positive + neutral + negative ≈ 1.0."""
        with patch("app.main.predict_batch", return_value=[MOCK_PREDICT_RESULTS[0]]):
            response = client_model_ready.post("/predict", json={
                "texts": ["em không đăng nhập được"]
            })
        data = response.json()
        probs = data["results"][0]["probabilities"]
        total = probs["positive"] + probs["neutral"] + probs["negative"]
        assert abs(total - 1.0) < 0.01

    def test_predict_invalid_texts_field(self, client_model_ready):
        """POST /predict với texts không phải array trả về 422."""
        response = client_model_ready.post("/predict", json={"texts": "không phải mảng"})
        assert response.status_code == 422


# ═══════════════════════════════════════════════════════════════════════════════
# Test: ISSUE 1 — Null-safe input (null, non-string, whitespace)
# ═══════════════════════════════════════════════════════════════════════════════

class TestNullSafeInput:
    """
    Kiểm tra rằng POST /predict xử lý an toàn:
      - null (Python None) → neutral
      - số nguyên (123) → không crash, được xử lý như chuỗi
      - chuỗi rỗng ("") → neutral
      - whitespace ("   ") → neutral
      - chuỗi bình thường ("xin chào") → xử lý bình thường
    """

    def _make_neutral(self, text: str) -> dict:
        return {
            "text":          text,
            "label":         "neutral",
            "score":         0.0,
            "confidence":    0.0,
            "source":        "phobert",
            "rawLabel":      "NEU",
            "probabilities": {"positive": 0.0, "neutral": 1.0, "negative": 0.0}
        }

    def test_null_and_mixed_inputs_do_not_crash(self, client_model_ready):
        """
        POST /predict với [null, "xin chào", 123, "", "   "] không crash.
        Trả về đúng 5 kết quả.
        """
        mock_results = [
            self._make_neutral(""),        # null → "" → neutral
            {**MOCK_PREDICT_RESULTS[0], "text": "xin chào"},  # bình thường
            {**MOCK_PREDICT_RESULTS[1], "text": "123"},        # 123 → "123"
            self._make_neutral(""),        # "" → neutral
            self._make_neutral(""),        # "   " → neutral (whitespace)
        ]
        with patch("app.main.predict_batch", return_value=mock_results):
            response = client_model_ready.post("/predict", json={
                "texts": [None, "xin chào", 123, "", "   "]
            })

        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["success"] is True
        # Phải trả về đúng 5 kết quả, khớp với số đầu vào
        assert len(data["results"]) == 5

    def test_null_item_converted_to_neutral(self, client_model_ready):
        """
        null trong texts được chuyển thành "" và trả về neutral.
        Schema validate_texts phải convert None → "".
        """
        neutral = self._make_neutral("")
        with patch("app.main.predict_batch", return_value=[neutral]) as mock_pred:
            response = client_model_ready.post("/predict", json={
                "texts": [None]
            })
            # predict_batch phải được gọi với [""] (không phải [None])
            if mock_pred.called:
                called_texts = mock_pred.call_args[0][0]
                assert called_texts[0] == "", \
                    f"Tokenizer nhận '{called_texts[0]}' thay vì '' — None chưa được convert"

        assert response.status_code == 200
        data = response.json()
        assert data["results"][0]["label"] == "neutral"

    def test_integer_input_does_not_crash(self, client_model_ready):
        """
        Số nguyên (123) trong texts không crash service.
        Được convert thành chuỗi "123" và xử lý bình thường.
        """
        mock_result = [{**MOCK_PREDICT_RESULTS[0], "text": "123"}]
        with patch("app.main.predict_batch", return_value=mock_result) as mock_pred:
            response = client_model_ready.post("/predict", json={
                "texts": [123]
            })
            if mock_pred.called:
                called_texts = mock_pred.call_args[0][0]
                # Tokenizer nhận str, không phải int
                assert isinstance(called_texts[0], str), \
                    f"Tokenizer nhận int thay vì str: {type(called_texts[0])}"

        assert response.status_code == 200

    def test_whitespace_only_returns_neutral(self, client_model_ready):
        """Chuỗi chỉ có khoảng trắng trả về neutral."""
        neutral = self._make_neutral("   ")
        with patch("app.main.predict_batch", return_value=[neutral]):
            response = client_model_ready.post("/predict", json={
                "texts": ["   "]
            })
        assert response.status_code == 200
        data = response.json()
        assert data["results"][0]["label"] == "neutral"

    def test_mixed_input_result_count_matches_input_length(self, client_model_ready):
        """
        Số lượng kết quả phải khớp chính xác với số đầu vào,
        kể cả khi có null và số nguyên.
        """
        inputs = [None, "xin chào", 123, "", "   ", "em không đăng nhập được"]
        neutral = self._make_neutral("")
        normal  = {**MOCK_PREDICT_RESULTS[0], "text": "xin chào"}
        mock_results = [neutral, normal, normal, neutral, neutral, normal]

        with patch("app.main.predict_batch", return_value=mock_results):
            response = client_model_ready.post("/predict", json={"texts": inputs})

        assert response.status_code == 200
        data = response.json()
        assert len(data["results"]) == len(inputs), \
            f"Số kết quả ({len(data['results'])}) không khớp số đầu vào ({len(inputs)})"


# ═══════════════════════════════════════════════════════════════════════════════
# Test: SUGGESTION 2 — GET /metrics
# ═══════════════════════════════════════════════════════════════════════════════

class TestMetricsEndpoint:

    def test_metrics_returns_success(self, client_model_ready):
        """GET /metrics trả về success=True và các trường cơ bản."""
        response = client_model_ready.get("/metrics")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "totalRequests" in data
        assert "totalTexts" in data
        assert "totalErrors" in data
        assert "avgLatencyMs" in data
        assert "modelLoaded" in data
        assert "engine" in data
        assert "modelName" in data

    def test_metrics_engine_is_onnxruntime(self, client_model_ready):
        """GET /metrics phải báo engine = onnxruntime."""
        response = client_model_ready.get("/metrics")
        data = response.json()
        assert data["engine"] == "onnxruntime"

    def test_metrics_model_name_contains_phobert(self, client_model_ready):
        """GET /metrics phải chứa tên model phobert."""
        response = client_model_ready.get("/metrics")
        data = response.json()
        assert "phobert" in data["modelName"].lower()

    def test_metrics_totalRequests_increases_after_predict(self, client_model_ready):
        """
        Sau khi gọi POST /predict thành công,
        GET /metrics phải thấy totalRequests tăng.
        """
        # Đọc metrics trước
        r_before = client_model_ready.get("/metrics")
        before = r_before.json()["totalRequests"]

        # Gọi predict
        with patch("app.main.predict_batch", return_value=[MOCK_PREDICT_RESULTS[0]]):
            client_model_ready.post("/predict", json={
                "texts": ["em không đăng nhập được"]
            })

        # Đọc metrics sau
        r_after = client_model_ready.get("/metrics")
        after = r_after.json()["totalRequests"]

        assert after > before, \
            f"totalRequests không tăng: trước={before}, sau={after}"

    def test_metrics_totalTexts_increases_after_predict(self, client_model_ready):
        """Sau khi predict 2 văn bản, totalTexts tăng thêm 2."""
        r_before = client_model_ready.get("/metrics")
        before_texts = r_before.json()["totalTexts"]

        with patch("app.main.predict_batch", return_value=MOCK_PREDICT_RESULTS):
            client_model_ready.post("/predict", json={
                "texts": ["em không đăng nhập được", "cảm ơn tư vấn rõ rồi"]
            })

        r_after = client_model_ready.get("/metrics")
        after_texts = r_after.json()["totalTexts"]

        assert after_texts == before_texts + 2, \
            f"totalTexts không tăng đúng: trước={before_texts}, sau={after_texts}"


# ═══════════════════════════════════════════════════════════════════════════════
# Test: ISSUE 3 — CORS từ ML_ALLOWED_ORIGINS env
# ═══════════════════════════════════════════════════════════════════════════════

class TestCorsConfig:

    def test_cors_default_origins_when_env_not_set(self):
        """
        Khi ML_ALLOWED_ORIGINS không được set,
        dùng mặc định [localhost:5000, 127.0.0.1:5000].
        """
        import importlib
        import app.main as main_module

        env_backup = os.environ.pop("ML_ALLOWED_ORIGINS", None)
        try:
            main_module = importlib.reload(main_module)
            origins = main_module.ALLOWED_ORIGINS
            assert "http://localhost:5000" in origins
            assert "http://127.0.0.1:5000" in origins
        finally:
            if env_backup is not None:
                os.environ["ML_ALLOWED_ORIGINS"] = env_backup

    def test_cors_reads_from_env_variable(self):
        """
        Khi ML_ALLOWED_ORIGINS được set,
        ALLOWED_ORIGINS phải phản ánh đúng giá trị đó.
        """
        import importlib
        import app.main as main_module

        test_origins = "http://localhost:5000,http://localhost:5010,http://example.com"
        os.environ["ML_ALLOWED_ORIGINS"] = test_origins
        try:
            main_module = importlib.reload(main_module)
            origins = main_module.ALLOWED_ORIGINS
            assert "http://localhost:5000"  in origins
            assert "http://localhost:5010"  in origins
            assert "http://example.com"     in origins
            assert len(origins) == 3
        finally:
            del os.environ["ML_ALLOWED_ORIGINS"]

    def test_cors_env_with_whitespace_is_trimmed(self):
        """
        Origins có khoảng trắng thừa phải được trim.
        Ví dụ: " http://localhost:5000 , http://localhost:5010 "
        """
        import importlib
        import app.main as main_module

        os.environ["ML_ALLOWED_ORIGINS"] = "  http://localhost:5000  ,  http://localhost:5010  "
        try:
            main_module = importlib.reload(main_module)
            origins = main_module.ALLOWED_ORIGINS
            assert "http://localhost:5000" in origins
            assert "http://localhost:5010" in origins
            # Đảm bảo không có khoảng trắng thừa
            for o in origins:
                assert o == o.strip(), f"Origin chưa được trim: '{o}'"
        finally:
            del os.environ["ML_ALLOWED_ORIGINS"]


# ═══════════════════════════════════════════════════════════════════════════════
# Test: GET /
# ═══════════════════════════════════════════════════════════════════════════════

class TestRootEndpoint:

    def test_root_returns_service_info(self, client_model_ready):
        """GET / trả về thông tin service."""
        response = client_model_ready.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "service" in data
        assert "model" in data
        assert "endpoints" in data

    def test_root_endpoints_includes_metrics(self, client_model_ready):
        """GET / phải liệt kê endpoint /metrics."""
        response = client_model_ready.get("/")
        data = response.json()
        endpoints = data.get("endpoints", {})
        assert "metrics" in endpoints, \
            "Root endpoint phải liệt kê GET /metrics"


# ═══════════════════════════════════════════════════════════════════════════════
# Test: TASK 3 — GET /metrics nâng cao (startedAt, persistEnabled, metricsFilePath)
# ═══════════════════════════════════════════════════════════════════════════════

class TestMetricsEnhanced:
    """Kiểm tra các trường mới được thêm bởi MetricsManager."""

    def test_metrics_includes_startedAt(self, client_model_ready):
        """GET /metrics phải có trường startedAt."""
        response = client_model_ready.get("/metrics")
        assert response.status_code == 200
        data = response.json()
        assert "startedAt" in data, "Thiếu trường startedAt trong /metrics"
        assert data["startedAt"] is not None

    def test_metrics_includes_persistEnabled(self, client_model_ready):
        """GET /metrics phải có trường persistEnabled."""
        response = client_model_ready.get("/metrics")
        data = response.json()
        assert "persistEnabled" in data, "Thiếu trường persistEnabled trong /metrics"
        assert isinstance(data["persistEnabled"], bool)

    def test_metrics_includes_metricsFilePath(self, client_model_ready):
        """GET /metrics phải có trường metricsFilePath."""
        response = client_model_ready.get("/metrics")
        data = response.json()
        assert "metricsFilePath" in data, "Thiếu trường metricsFilePath trong /metrics"
        assert isinstance(data["metricsFilePath"], str)
        assert len(data["metricsFilePath"]) > 0

    def test_metrics_success_is_true(self, client_model_ready):
        """GET /metrics phải có success=True."""
        response = client_model_ready.get("/metrics")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True


# ═══════════════════════════════════════════════════════════════════════════════
# Test: TASK 3 — MetricsManager trực tiếp (persistent JSON, corrupt file)
# ═══════════════════════════════════════════════════════════════════════════════

class TestPersistentMetrics:
    """
    Kiểm tra MetricsManager trực tiếp (không qua HTTP) để verify:
      - File JSON được tạo khi flush
      - Counters được load từ file
      - File bị corrupt không crash service
      - update() tăng đúng counters
    """

    def _make_manager(self, tmp_dir: str, flush_interval: int = 1) -> object:
        """Tạo MetricsManager với đường dẫn temp để tránh ảnh hưởng file thật."""
        from app.metrics import MetricsManager
        file_path = str(Path(tmp_dir) / "test_metrics.json")
        return MetricsManager(
            persist_enabled=True,
            file_path=file_path,
            flush_interval=flush_interval,
            model_name="wonrax/phobert-base-vietnamese-sentiment",
            engine="onnxruntime"
        )

    def test_metrics_file_created_after_flush(self):
        """File metrics.json được tạo sau khi flush()."""
        with tempfile.TemporaryDirectory() as tmp:
            mgr = self._make_manager(tmp)
            mgr.update(text_count=5, latency_ms=300.0, success=True)
            # flush_interval=1 → flush ngay sau 1 update
            assert mgr.file_path.exists(), \
                f"File {mgr.file_path} chưa được tạo sau flush()"

    def test_metrics_file_contains_valid_json(self):
        """File metrics.json chứa JSON hợp lệ sau khi flush."""
        with tempfile.TemporaryDirectory() as tmp:
            mgr = self._make_manager(tmp)
            mgr.update(text_count=3, latency_ms=150.0, success=True)

            content = mgr.file_path.read_text(encoding="utf-8")
            data = json.loads(content)  # Không nên raise

            assert data["totalRequests"] == 1
            assert data["totalTexts"] == 3
            assert data["totalErrors"] == 0
            assert data["totalLatencyMs"] == 150.0

    def test_metrics_loaded_from_file_on_restart(self):
        """
        Sau khi load(), counters phải phản ánh giá trị từ file
        (mô phỏng restart service).
        """
        with tempfile.TemporaryDirectory() as tmp:
            file_path = str(Path(tmp) / "test_metrics.json")

            # Ghi file với dữ liệu giả (mô phỏng metrics trước khi restart)
            previous_data = {
                "totalRequests":  50,
                "totalTexts":     1600,
                "totalErrors":    2,
                "totalLatencyMs": 22500.0,
                "lastRequestAt":  "2026-06-05T02:00:00Z",
                "startedAt":      "2026-06-05T01:00:00Z",
                "modelLoaded":    True,
                "engine":         "onnxruntime",
                "modelName":      "wonrax/phobert-base-vietnamese-sentiment",
                "persistEnabled": True,
                "metricsFilePath": file_path
            }
            Path(file_path).write_text(
                json.dumps(previous_data),
                encoding="utf-8"
            )

            # Tạo manager mới và load (= khởi động lại service)
            from app.metrics import MetricsManager
            mgr = MetricsManager(
                persist_enabled=True,
                file_path=file_path,
                flush_interval=10
            )
            mgr.load()

            # Counters phải bằng giá trị trong file
            data = mgr.to_dict()
            assert data["totalRequests"] == 50, \
                f"totalRequests sau load phải = 50, nhận được {data['totalRequests']}"
            assert data["totalTexts"] == 1600
            assert data["totalErrors"] == 2

    def test_corrupt_json_file_does_not_crash(self):
        """
        File JSON bị corrupt không crash service.
        Counters phải reset về 0 sau khi phát hiện lỗi.
        """
        with tempfile.TemporaryDirectory() as tmp:
            file_path = str(Path(tmp) / "test_metrics.json")

            # Ghi file JSON bị hỏng
            Path(file_path).write_text(
                "{invalid json content *** corrupted ***",
                encoding="utf-8"
            )

            from app.metrics import MetricsManager
            mgr = MetricsManager(
                persist_enabled=True,
                file_path=file_path,
                flush_interval=10
            )

            # Không được raise exception
            try:
                mgr.load()
            except Exception as e:
                pytest.fail(f"MetricsManager.load() raise exception với file corrupt: {e}")

            # Counters phải về 0
            data = mgr.to_dict()
            assert data["totalRequests"] == 0, \
                f"Sau file corrupt, totalRequests phải = 0, nhận được {data['totalRequests']}"
            assert data["totalTexts"] == 0

    def test_error_counter_increments_on_failure(self):
        """totalErrors tăng đúng khi success=False."""
        with tempfile.TemporaryDirectory() as tmp:
            mgr = self._make_manager(tmp, flush_interval=100)
            mgr.update(text_count=5, latency_ms=100.0, success=True)
            mgr.update(text_count=3, latency_ms=200.0, success=False)
            mgr.update(text_count=2, latency_ms=150.0, success=False)

            data = mgr.to_dict()
            assert data["totalRequests"] == 3
            assert data["totalErrors"] == 2
            assert data["totalTexts"] == 10

    def test_avg_latency_computed_correctly(self):
        """avgLatencyMs = totalLatencyMs / totalRequests."""
        with tempfile.TemporaryDirectory() as tmp:
            mgr = self._make_manager(tmp, flush_interval=100)
            mgr.update(text_count=1, latency_ms=100.0, success=True)
            mgr.update(text_count=1, latency_ms=200.0, success=True)
            mgr.update(text_count=1, latency_ms=300.0, success=True)

            data = mgr.to_dict()
            assert data["avgLatencyMs"] == 200.0, \
                f"avgLatencyMs phải = 200.0, nhận được {data['avgLatencyMs']}"

    def test_persist_disabled_does_not_create_file(self):
        """Khi persist_enabled=False, không tạo file dù update() và flush()."""
        with tempfile.TemporaryDirectory() as tmp:
            file_path = str(Path(tmp) / "should_not_exist.json")
            from app.metrics import MetricsManager
            mgr = MetricsManager(
                persist_enabled=False,
                file_path=file_path,
                flush_interval=1
            )
            mgr.update(text_count=5, latency_ms=100.0, success=True)
            mgr.flush()

            assert not Path(file_path).exists(), \
                "File metrics không được tạo khi persist_enabled=False"

    def test_to_dict_returns_required_fields(self):
        """to_dict() phải bao gồm tất cả trường bắt buộc."""
        with tempfile.TemporaryDirectory() as tmp:
            mgr = self._make_manager(tmp)
            data = mgr.to_dict()

            required_fields = [
                "success", "totalRequests", "totalTexts", "totalErrors",
                "avgLatencyMs", "totalLatencyMs", "lastRequestAt", "startedAt",
                "modelLoaded", "engine", "modelName",
                "persistEnabled", "metricsFilePath"
            ]
            for field in required_fields:
                assert field in data, f"Thiếu trường '{field}' trong to_dict()"

    def test_flush_interval_controls_write_frequency(self):
        """File chỉ được tạo sau khi đạt flush_interval requests."""
        with tempfile.TemporaryDirectory() as tmp:
            file_path = str(Path(tmp) / "test_metrics.json")
            from app.metrics import MetricsManager
            mgr = MetricsManager(
                persist_enabled=True,
                file_path=file_path,
                flush_interval=5  # Chỉ flush sau 5 requests
            )

            # Sau 4 requests: file chưa nên tồn tại
            for _ in range(4):
                mgr.update(text_count=1, latency_ms=100.0, success=True)
            assert not Path(file_path).exists(), \
                "File không được tạo trước khi đạt flush_interval"

            # Request thứ 5: file phải được tạo
            mgr.update(text_count=1, latency_ms=100.0, success=True)
            assert Path(file_path).exists(), \
                "File phải được tạo sau khi đạt flush_interval (5 requests)"
