"""
schemas.py
──────────
Định nghĩa Pydantic schema cho request/response của ml-service.
"""

from typing import Dict, List, Optional
from pydantic import BaseModel, field_validator


# ─── Request ──────────────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    """Request body cho endpoint POST /predict."""
    # Sau khi validate, texts luôn là List[str] (không còn Optional[str])
    texts: List[str]

    @field_validator("texts", mode="before")
    @classmethod
    def validate_texts(cls, v):
        """
        Chuẩn hóa mọi phần tử trong texts thành str an toàn:
          - Nếu v không phải list → raise ValueError (Pydantic trả 422)
          - None           → ""
          - Non-string     → str(item)  (VD: 123 → "123", True → "True")
          - String         → giữ nguyên
        Sau bước này, texts luôn là List[str], tokenizer không nhận None.
        """
        if not isinstance(v, list):
            raise ValueError("Trường 'texts' phải là một mảng (list).")

        normalized = []
        for item in v:
            if item is None:
                normalized.append("")
            elif isinstance(item, str):
                normalized.append(item)
            else:
                # Bao gồm int, float, bool, ... → ép sang str để an toàn
                try:
                    normalized.append(str(item))
                except Exception:
                    normalized.append("")
        return normalized


# ─── Response items ────────────────────────────────────────────────────────────

class Probabilities(BaseModel):
    """Phân phối xác suất cho 3 nhãn cảm xúc."""
    positive: float
    neutral: float
    negative: float


class PredictItem(BaseModel):
    """Kết quả phân tích cảm xúc cho một văn bản."""
    text: str
    label: str          # "positive" | "neutral" | "negative"
    score: float        # Thang điểm [-1, 1]
    confidence: float   # Xác suất cao nhất [0, 1]
    source: str         # Luôn là "phobert" với service này
    rawLabel: str       # Nhãn gốc từ model (VD: "POS", "NEU", "NEG")
    probabilities: Probabilities


class PredictResponse(BaseModel):
    """Response body cho endpoint POST /predict."""
    success: bool
    model: str
    engine: str
    count: int
    results: List[PredictItem]


# ─── Health check ──────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    """Response body cho endpoint GET /health."""
    success: bool
    status: str
    modelLoaded: bool
    modelName: str
    engine: str
    message: Optional[str] = None
    sentimentMode: Optional[str] = None
    phobertAvailable: Optional[bool] = None
    visobertAvailable: Optional[bool] = None
    visobertError: Optional[str] = None
    requireVisobert: Optional[bool] = None
    ensembleVersion: Optional[str] = None
    actualAnalyzerVersion: Optional[str] = None
    phobertLoaded: Optional[bool] = None
    visobertModelName: Optional[str] = None
    activeAnalyzerVersion: Optional[str] = None


class EnsembleFinal(BaseModel):
    label: str
    confidence: float
    score: float
    needStaffReview: bool
    reason: str
    probabilities: Probabilities


class EnsembleRule(BaseModel):
    label: Optional[str] = None
    confidence: float = 0.0
    reason: str
    needStaffReview: bool
    matchedKeyword: Optional[str] = None
    priority: str


class EnsembleIssue(BaseModel):
    issueFlag: bool
    issueType: str
    issueConfidence: float
    issueReason: str


class EnsembleSentiment(BaseModel):
    label: str
    reason: str


class EnsemblePredictItem(BaseModel):
    text: str
    mode: Optional[str] = None
    final: EnsembleFinal
    rule: EnsembleRule
    phobert: Dict
    visobert: Dict
    analyzerVersion: str
    actualAnalyzerVersion: Optional[str] = None
    visobertError: Optional[str] = None
    issue: Optional[EnsembleIssue] = None
    sentiment: Optional[EnsembleSentiment] = None


class EnsemblePredictResponse(BaseModel):
    success: bool
    mode: str
    model: str
    engine: str
    count: int
    results: List[EnsemblePredictItem]
