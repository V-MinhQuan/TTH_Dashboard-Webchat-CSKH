"""
model_loader.py
───────────────
Module tải ONNX model và tokenizer một lần khi service khởi động.
Không reload model trên mỗi request để đảm bảo hiệu suất tốt nhất.
"""

from pathlib import Path
from typing import Optional, Tuple

# ─── Đường dẫn đến thư mục chứa ONNX model ────────────────────────────────────
# Dùng pathlib để hoạt động đúng trên cả Windows và Linux
MODEL_DIR = Path(__file__).parent.parent / "models" / "phobert-sentiment-onnx"

MODEL_NAME = "wonrax/phobert-base-vietnamese-sentiment"

# ─── Biến global lưu tokenizer và model sau khi load ──────────────────────────
_tokenizer = None
_ort_model = None
_model_loaded: bool = False
_load_error: Optional[str] = None


def load_model() -> Tuple[bool, Optional[str]]:
    """
    Tải tokenizer và ONNX model từ thư mục local.
    Được gọi một lần khi FastAPI startup.

    Returns:
        (success: bool, error_message: Optional[str])
    """
    global _tokenizer, _ort_model, _model_loaded, _load_error

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
        from transformers import AutoTokenizer
        from optimum.onnxruntime import ORTModelForSequenceClassification

        # ── Tải tokenizer ─────────────────────────────────────────────────────
        print(f"[ModelLoader] Đang tải tokenizer từ: {MODEL_DIR}")
        _tokenizer = AutoTokenizer.from_pretrained(str(MODEL_DIR))
        print("[ModelLoader] Tokenizer đã tải thành công.")

        # ── Tải ONNX model qua optimum ────────────────────────────────────────
        # export=False → chỉ load model đã export sẵn, không convert lại
        print(f"[ModelLoader] Đang tải ONNX model từ: {MODEL_DIR}")
        _ort_model = ORTModelForSequenceClassification.from_pretrained(
            str(MODEL_DIR),
            export=False
        )
        print("[ModelLoader] ONNX model đã tải thành công.")

        _model_loaded = True
        _load_error = None
        return True, None

    except ImportError as e:
        _load_error = f"Thiếu thư viện: {e}. Hãy chạy: pip install -r requirements.txt"
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


def is_model_loaded() -> bool:
    """Kiểm tra model đã sẵn sàng để inference chưa."""
    return _model_loaded


def get_load_error() -> Optional[str]:
    """Trả về thông báo lỗi nếu tải model thất bại."""
    return _load_error
