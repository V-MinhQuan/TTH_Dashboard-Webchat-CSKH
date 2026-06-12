"""
sentiment_predictor.py
──────────────────────
Module thực hiện batch inference bằng ONNX Runtime.

Luồng xử lý:
    texts (list[str])
    → normalize (defensive — tránh None / non-string)
    → tách empty texts (trả về neutral ngay, không tokenize)
    → tokenize (chỉ non-empty)
    → ONNX Runtime inference
    → softmax → probabilities
    → normalize labels
    → merge kết quả theo thứ tự ban đầu
    → list[dict] results
"""

import json
import time
import numpy as np
from typing import List, Dict, Any

from .model_loader import get_tokenizer, get_ort_model

# ─── Tên model HuggingFace (để điền vào response) ─────────────────────────────
MODEL_NAME = "wonrax/phobert-base-vietnamese-sentiment"


# ─── Mapping nhãn model → nhãn chuẩn của hệ thống ────────────────────────────
# Model wonrax/phobert-base-vietnamese-sentiment có id2label:
#   {0: 'NEG', 1: 'POS', 2: 'NEU'}
# Nguồn tham khảo: https://huggingface.co/wonrax/phobert-base-vietnamese-sentiment
# QUAN TRỌNG: Nếu sử dụng model khác, hãy kiểm tra lại id2label trước khi dùng.
LABEL_MAP = {
    "NEG": "negative",
    "POS": "positive",
    "NEU": "neutral",
    # Fallback nếu model trả về dạng LABEL_X
    "LABEL_0": "negative",
    "LABEL_1": "positive",
    "LABEL_2": "neutral",
}


# ─── Structured logging helper ────────────────────────────────────────────────

def log_event(event: str, **kwargs) -> None:
    """
    Ghi log dạng JSON line an toàn UTF-8.
    Chỉ ghi các trường kỹ thuật — KHÔNG ghi nội dung văn bản đầy đủ.

    Ví dụ:
        log_event("predict_batch", batch_size=32, latency_ms=420, success=True)
    """
    try:
        record = {"event": event}
        record.update(kwargs)
        print(json.dumps(record, ensure_ascii=True), flush=True)
    except Exception:
        # Logging không bao giờ crash app
        pass


# ─── Normalize label ──────────────────────────────────────────────────────────

def _normalize_label(raw_label: str) -> str:
    """
    Chuẩn hóa nhãn gốc từ model sang nhãn chuẩn của hệ thống.

    Args:
        raw_label: Nhãn gốc từ model (VD: "NEG", "POS", "NEU")

    Returns:
        "positive" | "neutral" | "negative"
    """
    # Thử tra trong LABEL_MAP (case-insensitive)
    normalized = LABEL_MAP.get(raw_label.upper())
    if normalized:
        return normalized

    # Fallback: nếu nhãn chứa từ khóa rõ ràng
    label_upper = raw_label.upper()
    if "POS" in label_upper:
        return "positive"
    if "NEG" in label_upper:
        return "negative"
    if "NEU" in label_upper:
        return "neutral"

    # Không xác định được → trả về neutral và ghi log
    log_event("unknown_label", raw_label=raw_label, fallback="neutral")
    return "neutral"


def _softmax(logits: np.ndarray) -> np.ndarray:
    """Áp dụng softmax trên mảng logits 1D hoặc 2D."""
    # Trừ max để tránh overflow khi exp()
    exp_logits = np.exp(logits - np.max(logits, axis=-1, keepdims=True))
    return exp_logits / np.sum(exp_logits, axis=-1, keepdims=True)


def _build_probabilities(probs_row: np.ndarray, id2label: Dict[int, str]) -> Dict[str, float]:
    """
    Xây dựng dict probabilities {positive, neutral, negative} từ mảng probs.

    Args:
        probs_row: Mảng xác suất ứng với các nhãn theo thứ tự id2label
        id2label:  Mapping id → nhãn gốc của model

    Returns:
        {"positive": float, "neutral": float, "negative": float}
    """
    result = {"positive": 0.0, "neutral": 0.0, "negative": 0.0}
    for idx, raw_label in id2label.items():
        normalized = _normalize_label(raw_label)
        if normalized in result:
            result[normalized] = round(float(probs_row[idx]), 4)
    return result


def _neutral_result(text: str) -> Dict[str, Any]:
    """Trả về kết quả neutral chuẩn cho văn bản rỗng/whitespace."""
    return {
        "text": text,
        "label": "neutral",
        "score": 0.0,
        "confidence": 0.0,
        "source": "phobert",
        "rawLabel": "NEU",
        "probabilities": {"positive": 0.0, "neutral": 1.0, "negative": 0.0}
    }


def predict_batch(texts: List[str]) -> List[Dict[str, Any]]:
    """
    Thực hiện batch inference bằng ONNX Runtime.

    Input được normalize an toàn trước khi tokenize:
      - None → "" (trả về neutral, không tokenize)
      - non-string → str(value) (tokenize bình thường)
      - Chuỗi rỗng / whitespace → trả về neutral ngay, không tokenize

    Args:
        texts: Danh sách văn bản cần phân tích

    Returns:
        Danh sách kết quả theo thứ tự input. Mỗi item là dict:
        {
            text, label, score, confidence, source,
            rawLabel, probabilities
        }

    Raises:
        RuntimeError: Khi model chưa được tải hoặc inference thất bại
    """
    # ── Xử lý batch rỗng ──────────────────────────────────────────────────────
    if not texts:
        return []

    # ── Defensive normalize: đảm bảo mọi phần tử là str ──────────────────────
    # Dù schemas.py đã validate, tầng này tự bảo vệ khi gọi trực tiếp
    safe_texts: List[str] = []
    for item in texts:
        if item is None:
            safe_texts.append("")
        elif isinstance(item, str):
            safe_texts.append(item)
        else:
            try:
                safe_texts.append(str(item))
            except Exception:
                safe_texts.append("")

    # ── Tách: empty texts (không cần inference) vs non-empty (cần inference) ──
    # Giữ nguyên thứ tự bằng index
    results: List[Dict[str, Any]] = [None] * len(safe_texts)
    non_empty_indices: List[int] = []
    non_empty_texts: List[str] = []

    for i, text in enumerate(safe_texts):
        if not text or not text.strip():
            # Empty/whitespace → neutral ngay, không tokenize
            results[i] = _neutral_result(text)
        else:
            non_empty_indices.append(i)
            non_empty_texts.append(text)

    # ── Nếu không có text nào cần inference, trả về ngay ──────────────────────
    if not non_empty_texts:
        log_event(
            "predict_batch",
            batch_size=len(safe_texts),
            non_empty=0,
            latency_ms=0,
            success=True
        )
        return results

    # ── Lấy model/tokenizer ───────────────────────────────────────────────────
    tokenizer = get_tokenizer()
    ort_model  = get_ort_model()

    # ── Lấy id2label từ config của model ──────────────────────────────────────
    id2label: Dict[int, str] = getattr(ort_model.config, "id2label", {
        0: "NEG", 1: "POS", 2: "NEU"
    })

    start_time = time.time()

    # ── Tokenize chỉ non-empty texts ──────────────────────────────────────────
    # padding=True: đệm đồng đều, truncation=True: cắt nếu quá dài
    # return_tensors="pt": trả về PyTorch tensor (optimum ORTModel xử lý được)
    encodings = tokenizer(
        non_empty_texts,
        padding=True,
        truncation=True,
        max_length=256,
        return_tensors="pt"
    )

    # ── Chạy ONNX Runtime inference ───────────────────────────────────────────
    outputs = ort_model(**encodings)

    # logits shape: (batch_size, num_labels)
    logits = outputs.logits.detach().numpy()

    # ── Áp dụng softmax để lấy xác suất ──────────────────────────────────────
    probs_batch = _softmax(logits)

    latency_ms = round((time.time() - start_time) * 1000)

    # ── Xây dựng kết quả cho từng non-empty text ──────────────────────────────
    for batch_idx, orig_idx in enumerate(non_empty_indices):
        text = non_empty_texts[batch_idx]
        probs_row = probs_batch[batch_idx]

        # Tìm nhãn có xác suất cao nhất
        predicted_idx   = int(np.argmax(probs_row))
        raw_label       = id2label.get(predicted_idx, f"LABEL_{predicted_idx}")
        normalized_label = _normalize_label(raw_label)
        confidence      = round(float(probs_row[predicted_idx]), 4)

        # Chuyển confidence sang thang điểm [-1, 1] như rule-based analyzer
        if normalized_label == "positive":
            score = confidence
        elif normalized_label == "negative":
            score = -confidence
        else:
            score = 0.0

        # Giới hạn score trong [-1, 1]
        score = max(-1.0, min(1.0, round(score, 4)))

        probabilities = _build_probabilities(probs_row, id2label)

        results[orig_idx] = {
            "text":          text,
            "label":         normalized_label,
            "score":         score,
            "confidence":    confidence,
            "source":        "phobert",
            "rawLabel":      raw_label,
            "probabilities": probabilities
        }

    log_event(
        "predict_batch",
        batch_size=len(safe_texts),
        non_empty=len(non_empty_texts),
        latency_ms=latency_ms,
        success=True
    )

    return results
