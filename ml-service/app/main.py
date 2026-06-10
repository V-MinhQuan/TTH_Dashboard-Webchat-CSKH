"""
main.py
───────
Entry point của FastAPI ml-service.

Endpoints:
    GET  /         → Thông tin service
    GET  /health   → Kiểm tra trạng thái service và model
    GET  /metrics  → Thống kê (in-memory + persistent nếu bật)
    POST /predict  → Phân tích cảm xúc batch

Biến môi trường:
    ML_ALLOWED_ORIGINS       Danh sách origin CORS, phân cách bằng dấu phẩy
                             Mặc định: http://localhost:5000,http://127.0.0.1:5000
    METRICS_PERSIST_ENABLED  Bật/tắt lưu metrics ra file JSON (mặc định: true)
    METRICS_FILE_PATH        Đường dẫn file metrics (mặc định: ./data/metrics.json)
    METRICS_FLUSH_INTERVAL   Số requests giữa mỗi lần ghi file (mặc định: 10)

Khởi động:
    uvicorn app.main:app --host 0.0.0.0 --port 8001
"""

import os
import sys
import time
from collections import Counter
from contextlib import asynccontextmanager
from typing import Dict, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .model_loader import load_model, is_model_loaded, get_load_error, MODEL_NAME
from .ensemble import ENSEMBLE_VERSION, REQUIRE_VISOBERT, ensemble_service
from .schemas import (
    EnsemblePredictItem,
    EnsemblePredictResponse,
    HealthResponse,
    PredictItem,
    PredictRequest,
    PredictResponse,
    Probabilities,
)
from .sentiment_predictor import predict_batch, log_event
from .metrics import MetricsManager

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# ─── Cấu hình ─────────────────────────────────────────────────────────────────
MAX_BATCH_SIZE = 128
ENGINE_NAME    = "onnxruntime"
ENSEMBLE_ENGINE_NAME = "ensemble"
SENTIMENT_MODE = os.environ.get("SENTIMENT_MODE", "phobert").strip().lower()
if SENTIMENT_MODE not in ("phobert", "visobert", "ensemble"):
    SENTIMENT_MODE = "phobert"

# ─── CORS: đọc từ biến môi trường ML_ALLOWED_ORIGINS ─────────────────────────
_RAW_ORIGINS = os.environ.get("ML_ALLOWED_ORIGINS", "")
if _RAW_ORIGINS.strip():
    ALLOWED_ORIGINS: List[str] = [o.strip() for o in _RAW_ORIGINS.split(",") if o.strip()]
else:
    # Mặc định: chỉ cho phép localhost (FastAPI/Node.js backend gọi nội bộ)
    ALLOWED_ORIGINS = [
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:5000",
        "http://127.0.0.1:5000"
    ]

# ─── MetricsManager — thay thế _metrics dict đơn giản ────────────────────────
_metrics_mgr = MetricsManager(model_name=MODEL_NAME, engine=ENGINE_NAME)
_label_distribution: Counter[str] = Counter()


def _record_label_distribution(labels: List[str]) -> None:
    for label in labels:
        if label in ("positive", "neutral", "negative"):
            _label_distribution[label] += 1


def _predict_item_from_raw(result: Dict) -> PredictItem:
    return PredictItem(
        text=result["text"],
        label=result["label"],
        score=result["score"],
        confidence=result["confidence"],
        source=result["source"],
        rawLabel=result["rawLabel"],
        probabilities=Probabilities(**result["probabilities"])
    )


def _predict_item_from_ensemble(result: Dict) -> PredictItem:
    final = result["final"]
    return PredictItem(
        text=result["text"],
        label=final["label"],
        score=final["score"],
        confidence=final["confidence"],
        source="ensemble",
        rawLabel=final["label"].upper(),
        probabilities=Probabilities(**final["probabilities"])
    )


# ─── Lifecycle: tải model khi service khởi động ───────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Tải ONNX model và khởi tạo metrics khi FastAPI khởi động."""
    log_event("service_startup", stage="loading_model")

    # Load metrics từ file (nếu persist_enabled) — trước khi model load
    _metrics_mgr.load()

    success, error = load_model()

    # Cập nhật trạng thái model vào MetricsManager
    _metrics_mgr.set_model_info(
        model_name=MODEL_NAME,
        engine=ENGINE_NAME,
        model_loaded=success
    )

    if success:
        log_event("model_loaded", model=MODEL_NAME, engine=ENGINE_NAME, success=True)
    else:
        log_event("model_load_failed", error=str(error), success=False)

    # Tải ViSoBERT model chủ động
    if "pytest" not in sys.modules:
        try:
            from .ensemble import ensemble_service
            ensemble_service.visobert._ensure_loaded()
        except Exception as e:
            log_event("visobert_load_failed_startup", error=str(e))
            from .ensemble import REQUIRE_VISOBERT
            if REQUIRE_VISOBERT:
                raise RuntimeError(f"REQUIRE_VISOBERT=true but ViSoBERT load failed: {e}")

    log_event("cors_config", allowed_origins_count=len(ALLOWED_ORIGINS))
    log_event(
        "metrics_config",
        persist_enabled=_metrics_mgr.persist_enabled,
        flush_interval=_metrics_mgr.flush_interval,
        file_path=str(_metrics_mgr.file_path)
    )

    yield

    # Graceful shutdown: flush metrics trước khi tắt service
    _metrics_mgr.flush()
    log_event("service_shutdown")


# ─── Khởi tạo FastAPI app ─────────────────────────────────────────────────────
app = FastAPI(
    title="FLIC PhoBERT Sentiment Service",
    description="Phan tich cam xuc tieng Viet bang PhoBERT + ONNX Runtime",
    version="1.0.0",
    lifespan=lifespan
)

# CORS: đọc từ ML_ALLOWED_ORIGINS, không hard-code
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


# ─── Endpoint: Root ────────────────────────────────────────────────────────────
@app.get("/", tags=["Info"])
def root():
    """Thông tin cơ bản về ml-service."""
    return {
        "service":  "FLIC PhoBERT Sentiment Service",
        "version":  "1.0.0",
        "model":    MODEL_NAME,
        "engine":   ENGINE_NAME,
        "sentimentMode": SENTIMENT_MODE,
        "endpoints": {
            "health":  "GET /health",
            "metrics": "GET /metrics",
            "predict": "POST /predict",
            "predictEnsemble": "POST /predict-ensemble"
        }
    }


# ─── Endpoint: Health check ────────────────────────────────────────────────────
@app.get("/health", response_model=HealthResponse, tags=["Health"])
def health_check():
    """
    Kiểm tra trạng thái service và model.

    Trả về HTTP 200 nếu service đang chạy.
    Trả về HTTP 503 nếu model chưa được tải.
    """
    model_loaded = is_model_loaded()
    load_error   = get_load_error()
    ensemble_health = ensemble_service.health()

    visobert_available = bool(ensemble_health["visobert"]["available"])
    visobert_model_name = ensemble_health["visobert"]["model_name"]
    visobert_error = ensemble_health.get("visobertError") or ensemble_health["visobert"]["error"]
    active_analyzer_version = ensemble_health.get("actualAnalyzerVersion")

    if not model_loaded:
        return HealthResponse(
            success=False,
            status="model_not_loaded",
            modelLoaded=False,
            modelName=MODEL_NAME,
            engine=ENGINE_NAME,
            sentimentMode=SENTIMENT_MODE,
            phobertAvailable=False,
            visobertAvailable=visobert_available,
            visobertError=visobert_error,
            requireVisobert=REQUIRE_VISOBERT,
            ensembleVersion=ENSEMBLE_VERSION,
            actualAnalyzerVersion=active_analyzer_version,
            message=load_error or "Model chua duoc tai. Vui long chay: python download_model.py",
            phobertLoaded=False,
            visobertModelName=visobert_model_name,
            activeAnalyzerVersion=active_analyzer_version
        )

    return HealthResponse(
        success=True,
        status="ok",
        modelLoaded=True,
        modelName=MODEL_NAME,
        engine=ENGINE_NAME,
        sentimentMode=SENTIMENT_MODE,
        phobertAvailable=True,
        visobertAvailable=visobert_available,
        visobertError=visobert_error,
        requireVisobert=REQUIRE_VISOBERT,
        ensembleVersion=ENSEMBLE_VERSION,
        actualAnalyzerVersion=active_analyzer_version,
        phobertLoaded=True,
        visobertModelName=visobert_model_name,
        activeAnalyzerVersion=active_analyzer_version
    )


# ─── Endpoint: Metrics ────────────────────────────────────────────────────────
@app.get("/metrics", tags=["Metrics"])
def get_metrics():
    """
    Trả về thống kê của service.

    Nếu METRICS_PERSIST_ENABLED=true:
      - Metrics tích lũy qua các lần restart
      - Bao gồm persistEnabled=true và metricsFilePath

    Nếu METRICS_PERSIST_ENABLED=false:
      - Metrics chỉ in-memory, reset khi restart

    Không bao gồm nội dung tin nhắn người dùng.
    """
    payload = _metrics_mgr.to_dict()
    payload["sentimentMode"] = SENTIMENT_MODE
    payload["labelDistribution"] = {
        "positive": _label_distribution.get("positive", 0),
        "neutral": _label_distribution.get("neutral", 0),
        "negative": _label_distribution.get("negative", 0),
    }
    return payload


# ─── Endpoint: Predict ────────────────────────────────────────────────────────
@app.post("/predict", response_model=PredictResponse, tags=["Prediction"])
def predict(request: PredictRequest):
    """
    Phân tích cảm xúc batch tiếng Việt.

    - texts: Danh sách văn bản (tối đa 128 văn bản/request)
    - Trả về kết quả theo thứ tự tương ứng với input
    - Không log nội dung văn bản đầy đủ (chỉ log số lượng)
    """
    if not is_model_loaded():
        _metrics_mgr.update(len(request.texts), 0.0, success=False)
        raise HTTPException(
            status_code=503,
            detail=(
                "Model chua duoc tai. "
                "Vui long chay 'python download_model.py' roi khoi dong lai service."
            )
        )

    if len(request.texts) > MAX_BATCH_SIZE:
        raise HTTPException(
            status_code=400,
            detail=(
                f"So van ban gui len ({len(request.texts)}) "
                f"vuot qua gioi han {MAX_BATCH_SIZE} van ban/request."
            )
        )

    if len(request.texts) == 0:
        return PredictResponse(
            success=True,
            model=MODEL_NAME,
            engine=ENGINE_NAME,
            count=0,
            results=[]
        )

    log_event("predict_request", batch_size=len(request.texts), mode=SENTIMENT_MODE)

    start_time = time.time()

    try:
        if SENTIMENT_MODE == "ensemble":
            raw_results = ensemble_service.predict_batch(request.texts)
            items = [_predict_item_from_ensemble(result) for result in raw_results]
            response_model_name = raw_results[0].get("actualAnalyzerVersion", ENSEMBLE_VERSION) if raw_results else ENSEMBLE_VERSION
            response_engine_name = ENSEMBLE_ENGINE_NAME
        elif SENTIMENT_MODE == "visobert":
            raw_results = ensemble_service.visobert.predict_batch(request.texts)
            items = [_predict_item_from_raw(result) for result in raw_results]
            response_model_name = ensemble_service.visobert.model_name or "visobert"
            response_engine_name = "pytorch"
        else:
            raw_results = predict_batch(request.texts)
            items = [_predict_item_from_raw(result) for result in raw_results]
            response_model_name = MODEL_NAME
            response_engine_name = ENGINE_NAME
    except Exception as e:
        latency_ms = round((time.time() - start_time) * 1000)
        _metrics_mgr.update(len(request.texts), latency_ms, success=False)
        log_event("predict_error", batch_size=len(request.texts), latency_ms=latency_ms, error_type=type(e).__name__, mode=SENTIMENT_MODE)
        raise HTTPException(
            status_code=500,
            detail=f"Loi khi phan tich cam xuc: {str(e)}"
        )

    latency_ms = round((time.time() - start_time) * 1000)
    _metrics_mgr.update(len(request.texts), latency_ms, success=True)
    _record_label_distribution([item.label for item in items])

    log_event(
        "predict_response",
        batch_size=len(request.texts),
        result_count=len(items),
        latency_ms=latency_ms,
        mode=SENTIMENT_MODE,
        success=True
    )

    return PredictResponse(
        success=True,
        model=response_model_name,
        engine=response_engine_name,
        count=len(items),
        results=items
    )


@app.post("/predict-ensemble", response_model=EnsemblePredictResponse, tags=["Prediction"])
def predict_ensemble(request: PredictRequest):
    """
    Phan tich cam xuc bang ensemble PhoBERT + ViSoBERT adapter + rule.

    Endpoint nay tra ve ca audit fields cua tung adapter de chay dry-run,
    so sanh va reprocess co the resume. Khong ghi database tu ml-service.
    """
    if not is_model_loaded():
        _metrics_mgr.update(len(request.texts), 0.0, success=False)
        raise HTTPException(
            status_code=503,
            detail=(
                "Model chua duoc tai. "
                "Vui long chay 'python download_model.py' roi khoi dong lai service."
            )
        )

    # If REQUIRE_VISOBERT=true and ViSoBERT cannot be loaded, refuse to run
    # so the dry-run/reprocess caller gets a clear error instead of silently
    # running with the wrong analyzerVersion.
    if REQUIRE_VISOBERT:
        ensemble_health = ensemble_service.health()
        if not ensemble_health["visobert"]["available"]:
            visobert_error = ensemble_health.get("visobertError") or "unknown error"
            _metrics_mgr.update(len(request.texts), 0.0, success=False)
            raise HTTPException(
                status_code=503,
                detail=(
                    f"REQUIRE_VISOBERT=true but ViSoBERT is unavailable: {visobert_error}. "
                    "Set REQUIRE_VISOBERT=false to allow phobert-rule fallback "
                    "(analyzerVersion will be ensemble-phobert-rule-v1)."
                )
            )

    if len(request.texts) > MAX_BATCH_SIZE:
        raise HTTPException(
            status_code=400,
            detail=(
                f"So van ban gui len ({len(request.texts)}) "
                f"vuot qua gioi han {MAX_BATCH_SIZE} van ban/request."
            )
        )

    if len(request.texts) == 0:
        return EnsemblePredictResponse(
            success=True,
            mode="ensemble",
            model=ENSEMBLE_VERSION,
            engine=ENSEMBLE_ENGINE_NAME,
            count=0,
            results=[]
        )

    log_event("predict_ensemble_request", batch_size=len(request.texts))
    start_time = time.time()

    try:
        raw_results = ensemble_service.predict_batch(request.texts)
    except Exception as e:
        latency_ms = round((time.time() - start_time) * 1000)
        _metrics_mgr.update(len(request.texts), latency_ms, success=False)
        log_event(
            "predict_ensemble_error",
            batch_size=len(request.texts),
            latency_ms=latency_ms,
            error_type=type(e).__name__
        )
        raise HTTPException(
            status_code=500,
            detail=f"Loi khi phan tich cam xuc ensemble: {str(e)}"
        )

    latency_ms = round((time.time() - start_time) * 1000)
    _metrics_mgr.update(len(request.texts), latency_ms, success=True)
    _record_label_distribution([result["final"]["label"] for result in raw_results])

    items = [EnsemblePredictItem(**result) for result in raw_results]
    response_mode = raw_results[0].get("mode", "ensemble") if raw_results else "ensemble"
    response_model_name = raw_results[0].get("actualAnalyzerVersion", ENSEMBLE_VERSION) if raw_results else ENSEMBLE_VERSION
    log_event(
        "predict_ensemble_response",
        batch_size=len(request.texts),
        result_count=len(items),
        latency_ms=latency_ms,
        success=True
    )

    return EnsemblePredictResponse(
        success=True,
        mode=response_mode,
        model=response_model_name,
        engine=ENSEMBLE_ENGINE_NAME,
        count=len(items),
        results=items
    )
