"""
metrics.py
──────────
Module quản lý và lưu trữ metrics in-memory + persistent JSON.

Thiết kế:
  - MetricsManager giữ toàn bộ state metrics trong memory.
  - Khi METRICS_PERSIST_ENABLED=true:
      * Đọc file JSON lúc khởi động (load history từ lần chạy trước).
      * Ghi file JSON mỗi METRICS_FLUSH_INTERVAL requests (tránh I/O quá nhiều).
      * Ghi file khi service tắt (graceful shutdown).
  - Ghi file dùng atomic write (temp file + rename) để tránh corrupt khi crash.
  - Không dùng lock (FastAPI single-threaded per worker).
  - Không bao giờ crash service dù file JSON bị corrupt.

Biến môi trường:
  METRICS_PERSIST_ENABLED    Bật/tắt lưu file (mặc định: true)
  METRICS_FILE_PATH          Đường dẫn file metrics (mặc định: ./data/metrics.json)
  METRICS_FLUSH_INTERVAL     Số requests giữa mỗi lần ghi file (mặc định: 10)
"""

import json
import os
import time
from pathlib import Path
from typing import Optional

from .sentiment_predictor import log_event

# ─── Đọc cấu hình từ biến môi trường ─────────────────────────────────────────
_RAW_ENABLED       = os.environ.get("METRICS_PERSIST_ENABLED", "true")
PERSIST_ENABLED: bool = _RAW_ENABLED.strip().lower() not in ("false", "0", "no")

METRICS_FILE_PATH: str = os.environ.get("METRICS_FILE_PATH", "./data/metrics.json")
FLUSH_INTERVAL: int    = max(1, int(os.environ.get("METRICS_FLUSH_INTERVAL", "10")))


class MetricsManager:
    """
    Quản lý metrics dịch vụ ml-service với khả năng lưu persistent.

    Attributes:
        persist_enabled  bool   Có lưu file JSON không
        file_path        Path   Đường dẫn file metrics
        flush_interval   int    Số requests giữa mỗi lần ghi

    Counters được load từ file nếu persist_enabled và file tồn tại.
    """

    def __init__(
        self,
        persist_enabled: bool  = PERSIST_ENABLED,
        file_path:        str   = METRICS_FILE_PATH,
        flush_interval:   int   = FLUSH_INTERVAL,
        model_name:       str   = "",
        engine:           str   = "onnxruntime",
    ) -> None:
        self.persist_enabled = persist_enabled
        self.file_path       = Path(file_path)
        self.flush_interval  = flush_interval

        # Counters in-memory
        self._total_requests:   int   = 0
        self._total_texts:      int   = 0
        self._total_errors:     int   = 0
        self._total_latency_ms: float = 0.0
        self._last_request_at:  Optional[str] = None

        # Metadata (set sau khi model tải)
        self._model_name:  str  = model_name
        self._engine:      str  = engine
        self._model_loaded: bool = False

        # Thời điểm khởi động service (không load từ file)
        self._started_at: str = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        # Đếm requests kể từ lần flush cuối (dùng để quyết định khi nào flush)
        self._requests_since_flush: int = 0

    # ─── Load metrics từ file ──────────────────────────────────────────────────

    def load(self) -> None:
        """
        Đọc metrics đã lưu từ file JSON (nếu persist_enabled).

        Nếu file không tồn tại → khởi tạo mới (bình thường).
        Nếu file JSON bị corrupt → log cảnh báo, khởi tạo mới, KHÔNG crash.
        """
        if not self.persist_enabled:
            log_event("metrics_persist_disabled", action="load_skipped")
            return

        # Tạo thư mục nếu chưa tồn tại
        try:
            self.file_path.parent.mkdir(parents=True, exist_ok=True)
        except OSError as e:
            log_event("metrics_dir_error", error=str(e), path=str(self.file_path.parent))
            return

        if not self.file_path.exists():
            log_event("metrics_file_not_found", path=str(self.file_path), action="starting_fresh")
            return

        try:
            raw = self.file_path.read_text(encoding="utf-8")
            data = json.loads(raw)

            self._total_requests   = int(data.get("totalRequests",   0))
            self._total_texts      = int(data.get("totalTexts",      0))
            self._total_errors     = int(data.get("totalErrors",     0))
            self._total_latency_ms = float(data.get("totalLatencyMs", 0.0))
            self._last_request_at  = data.get("lastRequestAt")

            log_event(
                "metrics_loaded",
                path=str(self.file_path),
                totalRequests=self._total_requests,
                totalTexts=self._total_texts
            )

        except (json.JSONDecodeError, ValueError, KeyError) as e:
            # File JSON bị corrupt → log cảnh báo tiếng Việt, reset về 0
            log_event(
                "metrics_load_failed",
                path=str(self.file_path),
                error=str(e),
                action="Khoi_tao_moi_do_file_bi_hong"
            )
            # Reset về 0 — không crash
            self._reset_counters()

        except OSError as e:
            log_event("metrics_read_error", path=str(self.file_path), error=str(e))

    # ─── Cập nhật metrics sau mỗi request ────────────────────────────────────

    def update(self, text_count: int, latency_ms: float, success: bool) -> None:
        """
        Cập nhật counters sau mỗi request /predict.

        Tự động flush sau mỗi flush_interval requests.

        Args:
            text_count  Số văn bản trong request
            latency_ms  Latency của request (ms)
            success     True nếu không có lỗi
        """
        self._total_requests   += 1
        self._total_texts      += text_count
        self._total_latency_ms += latency_ms
        if not success:
            self._total_errors += 1
        self._last_request_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        self._requests_since_flush += 1

        # Flush theo interval — tránh ghi file sau mỗi request lẻ
        if self.persist_enabled and self._requests_since_flush >= self.flush_interval:
            self.flush()
            self._requests_since_flush = 0

    # ─── Cập nhật trạng thái model ────────────────────────────────────────────

    def set_model_info(self, model_name: str, engine: str, model_loaded: bool) -> None:
        """Cập nhật thông tin model sau khi tải xong."""
        self._model_name   = model_name
        self._engine       = engine
        self._model_loaded = model_loaded

    # ─── Flush ra file ────────────────────────────────────────────────────────

    def flush(self) -> None:
        """
        Ghi metrics hiện tại ra file JSON.

        Dùng atomic write (temp → rename) để tránh file bị corrupt khi crash.
        Không bao giờ raise exception ra ngoài.
        """
        if not self.persist_enabled:
            return

        try:
            self.file_path.parent.mkdir(parents=True, exist_ok=True)

            data = self._build_payload()
            tmp_path = self.file_path.with_suffix(".json.tmp")

            tmp_path.write_text(
                json.dumps(data, ensure_ascii=False, indent=2),
                encoding="utf-8"
            )
            # Atomic rename
            tmp_path.replace(self.file_path)

        except OSError as e:
            log_event("metrics_flush_error", path=str(self.file_path), error=str(e))
        except Exception as e:
            log_event("metrics_flush_unexpected_error", error=str(e))

    # ─── Public read ──────────────────────────────────────────────────────────

    def to_dict(self) -> dict:
        """
        Trả về metrics dưới dạng dict cho endpoint GET /metrics.

        Bao gồm các trường:
          success, totalRequests, totalTexts, totalErrors,
          avgLatencyMs, totalLatencyMs, lastRequestAt, startedAt,
          modelLoaded, engine, modelName,
          persistEnabled, metricsFilePath
        """
        payload = self._build_payload()
        payload["success"] = True
        return payload

    # ─── Internal helpers ─────────────────────────────────────────────────────

    def _build_payload(self) -> dict:
        """Xây dựng dict đầy đủ để ghi file hoặc trả về API."""
        total_req = self._total_requests
        avg_latency = (
            round(self._total_latency_ms / total_req, 2)
            if total_req > 0 else 0.0
        )

        return {
            "totalRequests":  total_req,
            "totalTexts":     self._total_texts,
            "totalErrors":    self._total_errors,
            "avgLatencyMs":   avg_latency,
            "totalLatencyMs": round(self._total_latency_ms, 2),
            "lastRequestAt":  self._last_request_at,
            "startedAt":      self._started_at,
            "modelLoaded":    self._model_loaded,
            "engine":         self._engine,
            "modelName":      self._model_name,
            "persistEnabled": self.persist_enabled,
            "metricsFilePath": str(self.file_path),
        }

    def _reset_counters(self) -> None:
        """Reset toàn bộ counters về 0."""
        self._total_requests   = 0
        self._total_texts      = 0
        self._total_errors     = 0
        self._total_latency_ms = 0.0
        self._last_request_at  = None
        self._requests_since_flush = 0
