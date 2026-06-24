"""
model_loader.py
───────────────
Module tải ONNX model và tokenizer một lần khi service khởi động.
Không reload model trên mỗi request để đảm bảo hiệu suất tốt nhất.
"""

import json
from pathlib import Path
from typing import Dict, Optional, Tuple

# ─── Đường dẫn đến thư mục chứa ONNX model ────────────────────────────────────
# Dùng pathlib để hoạt động đúng trên cả Windows và Linux
MODEL_DIR = Path(__file__).parent.parent / "models" / "phobert-sentiment-onnx"

MODEL_NAME = "wonrax/phobert-base-vietnamese-sentiment"

# ─── Biến global lưu tokenizer và model sau khi load ──────────────────────────
_tokenizer = None
_ort_model = None
_id2label: Dict[int, str] = {0: "NEG", 1: "POS", 2: "NEU"}
_model_loaded: bool = False
_load_error: Optional[str] = None


def load_model() -> Tuple[bool, Optional[str]]:
    """
    Tải tokenizer và ONNX model từ thư mục local.
    Được gọi một lần khi FastAPI startup.

    Returns:
        (success: bool, error_message: Optional[str])
    """
    global _tokenizer, _ort_model, _id2label, _model_loaded, _load_error

    # ── Kiểm tra thư mục model tồn tại ───────────────────────────────────────
    if not MODEL_DIR.exists():
        _load_error = (
            f"Không tìm thấy ONNX model tại: {MODEL_DIR}. "
            "Vui lòng chạy python download_model.py trước."
        )
        _model_loaded = False
        return False, _load_error

    # ── Kiểm tra file model.onnx tồn tại ─────────────────────────────────────
    onnx_file = MODEL_DIR / "model.onnx"
    if not onnx_file.exists():
        _load_error = (
            f"Không tìm thấy ONNX model tại: {onnx_file}. "
            "Vui lòng chạy python download_model.py trước."
        )
        _model_loaded = False
        return False, _load_error

    try:
        # ── Import thư viện (lazy import để tránh lỗi nếu chưa cài) ──────────
        import onnxruntime as ort
        from transformers import AutoTokenizer

        # ── Tải tokenizer ─────────────────────────────────────────────────────
        print(f"[ModelLoader] Đang tải tokenizer từ: {MODEL_DIR}")
        _tokenizer = AutoTokenizer.from_pretrained(str(MODEL_DIR))
        print("[ModelLoader] Tokenizer đã tải thành công.")

        config_file = MODEL_DIR / "config.json"
        if config_file.exists():
            with config_file.open("r", encoding="utf-8") as fh:
                config = json.load(fh)
            raw_id2label = config.get("id2label") or {}
            _id2label = {int(idx): label for idx, label in raw_id2label.items()} or _id2label

        # ── Tải ONNX model bằng onnxruntime thuần, không cần PyTorch/Optimum ───
        print(f"[ModelLoader] Đang tải ONNX model từ: {MODEL_DIR}")
        _ort_model = ort.InferenceSession(
            str(onnx_file),
            providers=["CPUExecutionProvider"],
        )
        print("[ModelLoader] ONNX model đã tải thành công.")

        _model_loaded = True
        _load_error = None
        return True, None

    except ImportError as e:
        _load_error = f"Thiếu thư viện: {e}. Hãy chạy từ thư mục gốc repo: pip install -r requirements.txt"
        _model_loaded = False
        return False, _load_error

    except Exception as e:
        _load_error = f"Lỗi khi tải model: {e}"
        _model_loaded = False
        return False, _load_error


def get_tokenizer():
    """Trả về tokenizer đã được tải. Raise nếu chưa tải."""
    if not _model_loaded or _tokenizer is None:
        raise RuntimeError(
            "Model chưa được tải. "
            "Vui lòng chạy python download_model.py rồi khởi động lại service."
        )
    return _tokenizer


def get_ort_model():
    """Trả về ONNX model đã được tải. Raise nếu chưa tải."""
    if not _model_loaded or _ort_model is None:
        raise RuntimeError(
            "Model chưa được tải. "
            "Vui lòng chạy python download_model.py rồi khởi động lại service."
        )
    return _ort_model


def get_id2label() -> Dict[int, str]:
    """Trả về mapping id → label từ config của model."""
    return _id2label


def is_model_loaded() -> bool:
    """Kiểm tra model đã sẵn sàng để inference chưa."""
    return _model_loaded


def get_load_error() -> Optional[str]:
    """Trả về thông báo lỗi nếu tải model thất bại."""
    return _load_error
