from __future__ import annotations

import html
import re
import unicodedata
from typing import Any, Dict, Optional

import httpx

from app.core.config import Settings, get_settings


FALLBACK_ISSUE_PATTERNS = {
    "missing_email_or_notification": [
        "chua nhan duoc email",
        "chua nhan email",
        "chua nhan mail",
        "chx nhan dc mail",
        "chua thay mail",
    ],
    "payment_or_qr_issue": [
        "khong thay ma qr",
        "khong co ma qr",
        "khong thay ma",
        "ko thay ma qr",
    ],
    "file_extract_or_document_issue": [
        "khong mo duoc file",
        "khong mo dc file",
        "k mo dc file",
        "extract",
        "giai nen",
        "yeu cau mat khau",
    ],
    "access_or_login_issue": [
        "khong vao duoc",
        "kh vao duoc",
        "web bi sao",
        "khong dang nhap duoc",
    ],
    "contact_failure": [
        "tra loi dum",
        "tra loi giup",
        "khong ai tra loi",
        "khong phan hoi",
    ],
}


class SentimentService:
    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or get_settings()

    def predict(self, text: str) -> Dict[str, Any]:
        cleaned = (text or "").strip()
        try:
            with httpx.Client(timeout=self.settings.ml_timeout_seconds) as client:
                response = client.post(
                    f"{self.settings.ml_service_url.rstrip('/')}/predict-ensemble",
                    json={"texts": [cleaned]},
                )
            payload = _response_json(response)
            if response.status_code >= 400:
                raise RuntimeError(_ml_error_message(response.status_code, payload))
            return _normalize_predict_payload(payload)
        except Exception as exc:
            return _fallback_prediction(cleaned, str(exc))

    def get_ml_health(self) -> Dict[str, Any]:
        try:
            with httpx.Client(timeout=self.settings.ml_timeout_seconds) as client:
                response = client.get(f"{self.settings.ml_service_url.rstrip('/')}/health")
            payload = _response_json(response)
            if not payload:
                raise RuntimeError(f"ml-service returned HTTP {response.status_code} without JSON")
            return _normalize_health_payload(payload, reachable=True)
        except Exception as exc:
            return {
                "status": "unreachable",
                "mlServiceReachable": False,
                "sentimentMode": "unavailable",
                "phobertAvailable": False,
                "visobertAvailable": False,
                "visobertError": str(exc),
                "activeAnalyzerVersion": "unavailable",
                "actualAnalyzerVersion": "unavailable",
                "issueDetectorAvailable": False,
                "visobertStatus": "experimental_not_active",
                "visobertNote": "ViSoBERT is experimental and not active because ml-service is unreachable.",
                "error": str(exc),
            }


def _response_json(response: httpx.Response) -> Dict[str, Any]:
    try:
        payload = response.json()
        return payload if isinstance(payload, dict) else {}
    except ValueError:
        return {}


def _ml_error_message(status_code: int, payload: Dict[str, Any]) -> str:
    detail = payload.get("detail") or payload.get("message") or payload.get("status")
    return f"ml-service /predict-ensemble HTTP {status_code}: {detail or 'unknown error'}"


def _normalize_predict_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    if payload.get("success") is not True or not isinstance(payload.get("results"), list):
        raise RuntimeError("ml-service /predict-ensemble response is invalid")
    item = payload["results"][0] if payload["results"] else None
    if not isinstance(item, dict):
        raise RuntimeError("ml-service /predict-ensemble returned no prediction item")
    final = item.get("final") if isinstance(item.get("final"), dict) else {}
    issue = item.get("issue") if isinstance(item.get("issue"), dict) else {}
    label = _valid_label(final.get("label") or item.get("label") or item.get("sentiment", {}).get("label"))
    confidence = _probability(final.get("confidence") if final else item.get("confidence"))
    issue_flag = bool(issue.get("issueFlag", False))
    analyzer_version = (
        item.get("actualAnalyzerVersion")
        or item.get("analyzerVersion")
        or payload.get("model")
        or "ensemble-phobert-rule-v1"
    )
    return {
        "sentiment": {
            "label": label,
            "confidence": confidence,
        },
        "issue": {
            "issueFlag": issue_flag,
            "issueType": issue.get("issueType") or "none",
            "issueReason": issue.get("issueReason") or "no_issue",
            "issueConfidence": _probability(issue.get("issueConfidence")),
        },
        "needStaffReview": bool(final.get("needStaffReview")) or issue_flag or label == "negative",
        "analyzerVersion": analyzer_version,
        "actualAnalyzerVersion": analyzer_version,
        "source": "ml-service",
        "endpoint": "/predict-ensemble",
        "sentimentMode": item.get("mode") or payload.get("mode") or "ensemble",
        "phobert": item.get("phobert"),
        "visobert": item.get("visobert"),
        "rule": item.get("rule"),
    }


def _normalize_health_payload(payload: Dict[str, Any], *, reachable: bool) -> Dict[str, Any]:
    visobert_available = payload.get("visobertAvailable") is True
    phobert_available = (
        payload.get("phobertAvailable") is True
        or payload.get("phobertLoaded") is True
        or payload.get("modelLoaded") is True
    )
    actual_version = (
        payload.get("actualAnalyzerVersion")
        or payload.get("activeAnalyzerVersion")
        or payload.get("ensembleVersion")
        or ("ensemble-phobert-visobert-v1" if visobert_available else "ensemble-phobert-rule-v1")
    )
    status = payload.get("status") or ("ok" if payload.get("success") is True else "model_not_loaded")
    return {
        "status": status,
        "mlServiceReachable": reachable,
        "sentimentMode": payload.get("sentimentMode") or "ensemble",
        "phobertAvailable": phobert_available,
        "visobertAvailable": visobert_available,
        "visobertError": None if visobert_available else (payload.get("visobertError") or "ENABLE_VISOBERT=false"),
        "requireVisobert": payload.get("requireVisobert") is True,
        "activeAnalyzerVersion": payload.get("activeAnalyzerVersion") or actual_version,
        "actualAnalyzerVersion": actual_version,
        "issueDetectorAvailable": True,
        "modelLoaded": payload.get("modelLoaded") is True,
        "modelName": payload.get("modelName") or "",
        "engine": payload.get("engine") or "",
        "visobertModelName": payload.get("visobertModelName"),
        "visobertStatus": (
            "experimental_active_not_production_approved"
            if visobert_available
            else "experimental_not_active"
        ),
        "visobertNote": (
            "ViSoBERT is reachable but remains experimental until separately approved for production automation."
            if visobert_available
            else "ViSoBERT is experimental and not active in production runtime."
        ),
        "success": payload.get("success") is True,
        "message": payload.get("message"),
    }


def _fallback_prediction(text: str, reason: str) -> Dict[str, Any]:
    issue = _detect_fallback_issue(text)
    label = "neutral"
    return {
        "sentiment": {"label": label, "confidence": 0.0},
        "issue": issue,
        "needStaffReview": bool(issue["issueFlag"]),
        "analyzerVersion": "rule-based-fallback-v1",
        "actualAnalyzerVersion": "rule-based-fallback-v1",
        "source": "fallback",
        "endpoint": "/predict-ensemble",
        "mlServiceReachable": False,
        "fallbackSource": "fastapi-rule-based",
        "fallbackReason": reason,
    }


def _detect_fallback_issue(text: str) -> Dict[str, Any]:
    normalized = f" {_normalize_for_match(text)} "
    for issue_type, patterns in FALLBACK_ISSUE_PATTERNS.items():
        for pattern in patterns:
            candidate = _normalize_for_match(pattern)
            if candidate and f" {candidate} " in normalized:
                return {
                    "issueFlag": True,
                    "issueType": issue_type,
                    "issueReason": f"fallback matched pattern: {pattern}",
                    "issueConfidence": 0.7,
                }
    return {
        "issueFlag": False,
        "issueType": "none",
        "issueReason": "fallback no issue pattern matched",
        "issueConfidence": 0.0,
    }


def _normalize_for_match(value: str) -> str:
    text = html.unescape(str(value or ""))
    text = re.sub(r"<[^>]+>", " ", text)
    text = unicodedata.normalize("NFD", text.lower())
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = text.replace("đ", "d").replace("Đ", "D")
    text = re.sub(r"[\W_]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _valid_label(value: Any) -> str:
    label = str(value or "neutral").lower()
    return label if label in {"positive", "neutral", "negative"} else "neutral"


def _probability(value: Any) -> float:
    try:
        number = float(value if value is not None else 0)
    except (TypeError, ValueError):
        number = 0.0
    return round(max(0.0, min(1.0, number)), 4)

