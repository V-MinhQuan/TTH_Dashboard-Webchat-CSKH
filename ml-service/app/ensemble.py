"""
Ensemble sentiment pipeline for FLIC WebChat.

This module keeps PhoBERT as the stable production model and adds a ViSoBERT
adapter surface that can be enabled later when the checkpoint is confirmed.
The final label remains one of: positive, neutral, negative.

Version logic:
  - ViSoBERT available  → analyzerVersion = ensemble-phobert-visobert-v1
  - ViSoBERT unavailable → analyzerVersion = ensemble-phobert-rule-v1
"""

from __future__ import annotations

import html
import os
import re
import time
import unicodedata
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from .sentiment_predictor import predict_batch
from .issue_detector import IssueDetector


PHOBERT_VISOBERT_VERSION = os.environ.get("MODEL_VERSION", "ensemble-phobert-visobert-v1")
PHOBERT_RULE_VERSION     = os.environ.get("ENSEMBLE_PHOBERT_RULE_VERSION", "ensemble-phobert-rule-v1")

# ENSEMBLE_VERSION is kept for backward-compatibility in health/metrics responses.
# The actual per-prediction version is determined by _version_for().
ENSEMBLE_VERSION = PHOBERT_VISOBERT_VERSION

REQUIRE_VISOBERT = os.environ.get("REQUIRE_VISOBERT", "false").strip().lower() in (
    "true",
    "1",
    "yes",
)
NEGATIVE_THRESHOLD = float(os.environ.get("ENSEMBLE_NEGATIVE_THRESHOLD", "0.60"))
POSITIVE_THRESHOLD = float(os.environ.get("ENSEMBLE_POSITIVE_THRESHOLD", "0.65"))
NEUTRAL_THRESHOLD  = float(os.environ.get("ENSEMBLE_NEUTRAL_THRESHOLD",  "0.55"))


# ─── Text helpers ─────────────────────────────────────────────────────────────

def _strip_accents(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value)
    without_marks = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    # Handle Vietnamese đ/Đ which survives NFD decomposition
    return without_marks.replace("\u0111", "d").replace("\u0110", "D")


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    text = html.unescape(str(value))
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _norm_for_match(value: str) -> str:
    return _strip_accents(normalize_text(value).lower())


def _word_count(value: str) -> int:
    return len(re.findall(r"\w+", _norm_for_match(value), flags=re.UNICODE))


def _contains_any(normalized_text: str, phrases: List[str]) -> Optional[str]:
    """Return the first phrase found in normalized_text (padded with spaces)."""
    padded = f" {normalized_text} "
    for phrase in phrases:
        normalized_phrase = _norm_for_match(phrase)
        if normalized_phrase and normalized_phrase in padded:
            return phrase
    return None


def _is_url_only(cleaned_text: str) -> bool:
    text = cleaned_text.strip()
    return bool(re.fullmatch(r"(https?://\S+|www\.\S+)", text, flags=re.IGNORECASE))


def _is_command_only(normalized_text: str) -> bool:
    return bool(re.fullmatch(r"#[a-z0-9_:-]+", normalized_text))


def _is_punctuation_only(normalized_text: str) -> bool:
    return bool(normalized_text and re.fullmatch(r"[\W_]+", normalized_text))


def _probabilities_for(label: str, confidence: float) -> Dict[str, float]:
    confidence = max(0.0, min(1.0, float(confidence or 0.0)))
    if label == "positive":
        return {
            "positive": round(confidence, 4),
            "neutral":  round(1 - confidence, 4),
            "negative": 0.0,
        }
    if label == "negative":
        return {
            "positive": 0.0,
            "neutral":  round(1 - confidence, 4),
            "negative": round(confidence, 4),
        }
    return {"positive": 0.0, "neutral": 1.0, "negative": 0.0}


def _score_for(label: str, confidence: float) -> float:
    confidence = max(0.0, min(1.0, float(confidence or 0.0)))
    if label == "positive":
        return round(confidence, 4)
    if label == "negative":
        return round(-confidence, 4)
    return 0.0


# ─── Keyword lists (ASCII/accent-stripped for stable matching via _norm_for_match) ──

# System markers — exact full-text match
SYSTEM_MARKERS = {"", ".", "#time", "#kq1", "#kq2", "#kq3", "#help"}

# Short acknowledgements — exact full-text match (accent-stripped)
SHORT_ACKS = [
    "a",
    "da",
    "da a",
    "da chi",
    "da c",
    "da vang",
    "da vang a",
    "ok",
    "oke",
    "vang",
    "vang a",
    "v",
    "hi",
    "hello",
    "chao",
    "chao chi",
    "chao ad",
    "chao em",
]

# Strong issue phrases — require exact substring match (with space padding)
ISSUE_KEYWORDS = [
    # Email / mail not received
    "chua nhan duoc mail",
    "chua nhan duoc email",
    "chua nhan email",
    "chua co mail",
    "chua co email",
    "khong nhan duoc email",
    "khong nhan duoc mail",
    # QR code not found
    "khong thay ma qr",
    "khong co ma qr",
    "khong thay ma",
    "ko thay ma qr",
    "ko co ma qr",
    "ko thay ma",
    # Login / access issues
    "khong dang nhap duoc",
    "khong vao duoc",
    "khong bam dang ky duoc",
    "khong bam dang ki duoc",
    "ko dang nhap duoc",
    "ko vao duoc",
    # File / archive issues
    "khong mo duoc file",
    "khong mo duoc",
    "khong tai duoc",
    "khong giai nen duoc",
    "ko mo duoc file",
    "ko mo duoc",
    "ko tai duoc",
    "extract",
    "extract loi",
    "giai nen",
    "giai nen loi",
    "loi giai nen",
    "yeu cau mat khau",
    "file yeu cau mat khau",
    "file can mat khau",
    "can mat khau",
    # System errors
    "bi loi",
    "loi he thong",
    # Validation (also covers colloquial 'ko hop le')
    "khong hop le",
    "ko hop le",
    # Phone / contact
    "khong goi duoc",
    "khong nghe may",
    "khong co ai nghe may",
    "khong lien he duoc",
    "khong the truy cap",
    "ko goi duoc",
    "ko nghe may",
    "ko lien he duoc",
    "ko the truy cap",
    # Wrong selection / submission
    "chon nham",
    "nop nham",
    "chuyen khoan sai",
    # Credentials / documents
    "quen mat khau",
    "quen pass",
    "mat cccd",
    "mat the sinh vien",
    # Failed exam
    "rot thuc hanh",
    "rot excel",
    "rot",
    # Deadlines
    "khong kip nop bang",
    "so khong kip",
    "khong kip tot nghiep",
    "ko kip nop bang",
    "so ko kip",
    "tre han",
    "nop tre",
    # Urgency
    "can gap",
    # Slot with urgency (handled separately via issue_requires_context)
    "het slot",
]

# Urgent context keywords — required alongside `het slot` to fire as negative
URGENT_CONTEXT_KEYWORDS = [
    "tot nghiep",
    "xet tot nghiep",
    "ra truong",
    "nop bang",
    "nop chung chi",
    "nop ho so",
    "han nop",
    "truoc ngay",
    "can gap",
    "gap",
    "khong kip",
    "so khong kip",
    "tre han",
]

# Clear positive keywords — require word count ≥ 3 and no issue keyword
POSITIVE_KEYWORDS = [
    "cam on",
    "cam on chi",
    "cam on ad",
    "cam on trung tam",
    "cam on nhieu",
    "em hieu roi",
    "ok roi",
    "oke roi",
    "duoc roi",
    "ro roi",
    "tu van ro",
    "tu van ro qua",
    "huong dan ro",
    "tot qua",
    "huu ich",
    "tuyet voi",
    "ho tro tot",
]

# Informational keywords — if present and NO issue keyword, force neutral
INFO_KEYWORDS = [
    "lich thi",
    "han nop ho so",
    "ho so gom gi",
    "ho so gom nhung gi",
    "can giay to gi",
    "giay to gi",
    "gia bao nhieu",
    "hoc phi",
    "le phi",
    "dang ky o dau",
    "dang ki o dau",
    "link dang ky",
    "link dang ki",
    "gio lam viec",
    "toeic online",
    "toeic offline",
    "vstep",
    "cntt co ban",
    "cntt nang cao",
    "tin hoc co ban",
    "tin hoc nang cao",
    "nhom 3 nguoi",
    "cccd co can cong chung khong",
    "cong chung khong",
    "dieu kien ra truong",
    "dieu kien tot nghiep",
    "dieu kien chuan dau ra",
    "con slot",
    "slot",
    "danh sach thi",
    "chung chi",
    "ho so",
]

# Question cue words — if present alongside no issue keyword, force neutral
INFO_QUESTION_CUES = [
    "khi nao",
    "bao gio",
    "bao nhieu",
    "o dau",
    "gom gi",
    "can gi",
    "dung khong",
    "duoc khong",
    "co can khong",
    "co chua",
    "con khong",
    "con kh",
    "khong a",
    "kh a",
    "la gi",
    "nhu the nao",
]


# ─── Dataclass for adapter health ─────────────────────────────────────────────

@dataclass
class AdapterHealth:
    name: str
    available: bool
    model_name: str
    engine: str
    error: Optional[str] = None


# ─── Rule adapter ──────────────────────────────────────────────────────────────

class RuleSentimentAdapter:
    """
    Domain-specific rule-based sentiment adapter for FLIC WebChat.

    Priority order (highest → lowest):
      1. invalid_or_system_text  — NULL, empty, dot, #cmd, URL-only
      2. short_acknowledgement   — exact short ack match
      3. issue_negative          — strong issue phrase (runs BEFORE info-neutral)
      4. clear_positive          — positive keyword + word_count ≥ 3 + no issue keyword
      5. informational_neutral   — info keyword OR question_cue, ONLY if no issue keyword
      6. none                    — defer to model
    """

    name = "rule"

    def predict_one(self, text: Any) -> Dict[str, Any]:
        cleaned    = normalize_text(text)
        normalized = _norm_for_match(cleaned)
        words      = _word_count(cleaned)

        # ── 1. Invalid / system text ───────────────────────────────────────────
        if (
            normalized in SYSTEM_MARKERS
            or _is_url_only(cleaned)
            or _is_command_only(normalized)
            or _is_punctuation_only(normalized)
        ):
            return self._result("neutral", 1.0, "invalid_or_system_text", False)

        # ── 2. Short acknowledgement (exact match) ─────────────────────────────
        #    This must NOT be overridden by PhoBERT positive.
        is_short_ack = normalized in {_norm_for_match(item) for item in SHORT_ACKS}
        if is_short_ack:
            return self._result("neutral", 1.0, "short_acknowledgement", False)

        # ── Pre-compute shared signals ─────────────────────────────────────────
        issue_keyword      = _contains_any(normalized, ISSUE_KEYWORDS)
        positive_keyword   = _contains_any(normalized, POSITIVE_KEYWORDS)
        info_keyword       = _contains_any(normalized, INFO_KEYWORDS)
        has_question_cue   = _contains_any(normalized, INFO_QUESTION_CUES) is not None

        # Some issue keywords require additional context to fire.
        # `het slot` alone (e.g. "Còn slot kh ạ") → stays neutral unless urgent.
        issue_requires_context = issue_keyword == "het slot"
        urgent_context = _contains_any(normalized, URGENT_CONTEXT_KEYWORDS)
        issue_active = (
            issue_keyword is not None
            and (not issue_requires_context or urgent_context is not None)
        )

        # ── 3. Issue negative (Runs before clear_positive and informational) ───
        if issue_active:
            return self._result(
                "negative",
                0.95,
                f"contains_issue_keyword: {issue_keyword}",
                True,
                matched_keyword=issue_keyword,
                priority="issue_negative",
            )

        # ── 4. Clear positive ──────────────────────────────────────────────────
        #    Must have explicit positive keyword, word count ≥ 3, and no active issue.
        if positive_keyword and words >= 3 and not issue_active:
            return self._result(
                "positive",
                0.9,
                f"positive_keyword_rule: {positive_keyword}",
                False,
                matched_keyword=positive_keyword,
                priority="clear_positive",
            )

        # ── 5. Informational neutral ───────────────────────────────────────────
        #    Only fires if there is NO active issue keyword in the text.
        if (info_keyword or has_question_cue) and not issue_active:
            return self._result(
                "neutral",
                0.9,
                f"informational_question_rule: {info_keyword or 'question_cue'}",
                False,
                matched_keyword=info_keyword,
                priority="informational_neutral",
            )

        # ── 6. No rule matched — defer to model ───────────────────────────────
        return self._result(
            None,
            0.0,
            "no_priority_rule",
            False,
            matched_keyword=None,
            priority="none",
        )

    def _result(
        self,
        label: Optional[str],
        confidence: float,
        reason: str,
        need_review: bool,
        matched_keyword: Optional[str] = None,
        priority: str = "none",
    ) -> Dict[str, Any]:
        return {
            "label":          label,
            "confidence":     confidence,
            "reason":         reason,
            "needStaffReview": need_review,
            "matchedKeyword": matched_keyword,
            "priority":       priority,
        }


# ─── PhoBERT adapter ──────────────────────────────────────────────────────────

class PhobertSentimentAdapter:
    name       = "phobert"
    model_name = "wonrax/phobert-base-vietnamese-sentiment"
    engine     = "onnxruntime"

    def predict_batch(self, texts: List[str]) -> List[Dict[str, Any]]:
        return predict_batch(texts)

    def health(self) -> AdapterHealth:
        return AdapterHealth(
            name=self.name,
            available=True,
            model_name=self.model_name,
            engine=self.engine,
        )


# ─── ViSoBERT adapter ─────────────────────────────────────────────────────────

class VisobertSentimentAdapter:
    name = "visobert"

    def __init__(self) -> None:
        self.enabled = os.environ.get("ENABLE_VISOBERT", "false").strip().lower() in (
            "true", "1", "yes",
        )
        self.model_name = os.environ.get("VISOBERT_MODEL_NAME", "") or os.environ.get("VISOBERT_MODEL_PATH", "")
        self._pipeline      = None
        self._load_error: Optional[str] = None

    def _ensure_loaded(self) -> bool:
        if not self.enabled:
            self._load_error = "ENABLE_VISOBERT=false"
            return False
        if not self.model_name:
            self._load_error = "VISOBERT_MODEL_NAME is not configured"
            return False
        if self._pipeline is not None:
            return True

        try:
            from transformers import pipeline  # type: ignore

            device = os.environ.get("VISOBERT_DEVICE", "cpu")
            device_idx = -1 if device == "cpu" else 0

            print(f"[VisobertSentimentAdapter] Loading model: {self.model_name} on device: {device}")
            self._pipeline = pipeline(
                "sentiment-analysis",
                model=self.model_name,
                tokenizer=self.model_name,
                device=device_idx,
                return_all_scores=True,
            )
            self._load_error = None
            return True
        except Exception as exc:
            self._load_error = str(exc)
            self._pipeline   = None
            print(f"[VisobertSentimentAdapter] Failed to load ViSoBERT: {exc}")
            if os.environ.get("REQUIRE_VISOBERT", "false").strip().lower() in ("true", "1", "yes"):
                raise RuntimeError(f"REQUIRE_VISOBERT=true but ViSoBERT load failed: {exc}")
            return False

    def predict_batch(self, texts: List[str]) -> List[Dict[str, Any]]:
        if not self._ensure_loaded():
            return [self._unavailable_result(text) for text in texts]

        assert self._pipeline is not None
        raw_results = self._pipeline(texts)
        return [self._normalize_pipeline_item(text, raw) for text, raw in zip(texts, raw_results)]

    def _normalize_pipeline_item(self, text: str, raw: Any) -> Dict[str, Any]:
        probabilities = {"positive": 0.0, "neutral": 0.0, "negative": 0.0}
        if isinstance(raw, dict):
            raw = [raw]
        for item in raw or []:
            raw_label = str(item.get("label", "")).upper()
            score     = float(item.get("score", 0.0) or 0.0)
            label     = self._map_label(raw_label)
            probabilities[label] = max(probabilities[label], round(score, 4))

        label      = max(probabilities, key=probabilities.get)
        confidence = probabilities[label]
        return {
            "text":          text,
            "label":         label,
            "score":         _score_for(label, confidence),
            "confidence":    confidence,
            "source":        "visobert",
            "rawLabel":      label.upper(),
            "probabilities": probabilities,
            "available":     True,
        }

    def _map_label(self, raw_label: str) -> str:
        label_upper = raw_label.upper()
        if "NEG" in label_upper or label_upper in ("LABEL_0", "TIEU_CUC", "TIÊU CỰC", "0"):
            return "negative"
        if "POS" in label_upper or label_upper in ("LABEL_1", "TICH_CUC", "TÍCH CỰC", "1"):
            return "positive"
        return "neutral"

    def _unavailable_result(self, text: str) -> Dict[str, Any]:
        return {
            "available":     False,
            "error":         self._load_error or "visobert_unavailable",
            "label":         None,
            "confidence":    None,
            "text":          text,
            "score":         0.0,
            "source":        "visobert",
            "rawLabel":      "UNAVAILABLE",
            "probabilities": {"positive": 0.0, "neutral": 1.0, "negative": 0.0},
        }

    def health(self) -> AdapterHealth:
        available = self._ensure_loaded()
        return AdapterHealth(
            name=self.name,
            available=available,
            model_name=self.model_name or "not_configured",
            engine="pytorch" if available else "disabled",
            error=None if available else self._load_error,
        )


# ─── Ensemble service ─────────────────────────────────────────────────────────

class EnsembleSentimentService:

    def __init__(
        self,
        phobert_adapter: Optional[PhobertSentimentAdapter] = None,
        visobert_adapter: Optional[VisobertSentimentAdapter] = None,
        rule_adapter: Optional[RuleSentimentAdapter] = None,
    ) -> None:
        self.phobert  = phobert_adapter  or PhobertSentimentAdapter()
        self.visobert = visobert_adapter or VisobertSentimentAdapter()
        self.rule     = rule_adapter     or RuleSentimentAdapter()
        self.issue_detector = IssueDetector()

    def predict_batch(self, texts: List[str]) -> List[Dict[str, Any]]:
        # Guard: if REQUIRE_VISOBERT=true but ViSoBERT is unavailable, refuse to run.
        if REQUIRE_VISOBERT:
            vi_health = self.visobert.health()
            if not vi_health.available:
                raise RuntimeError(
                    f"REQUIRE_VISOBERT=true but ViSoBERT is unavailable: "
                    f"{vi_health.error or 'unknown error'}. "
                    "Set REQUIRE_VISOBERT=false to allow phobert-rule fallback."
                )

        safe_texts       = [normalize_text(text) for text in texts]
        phobert_results  = self.phobert.predict_batch(safe_texts)
        visobert_results = self.visobert.predict_batch(safe_texts)

        results: List[Dict[str, Any]] = []
        for text, phobert_item, visobert_item in zip(safe_texts, phobert_results, visobert_results):
            rule_item = self.rule.predict_one(text)
            issue_item = self.issue_detector.detect(text)
            res_dict = self._decide(text, rule_item, phobert_item, visobert_item)
            res_dict = self._add_issue_metadata(res_dict, issue_item)
            results.append(res_dict)
        return results

    def _add_issue_metadata(self, res_dict: Dict[str, Any], issue_item: Dict[str, Any]) -> Dict[str, Any]:
        final = res_dict.get("final", {})
        label = final.get("label", "neutral")
        reason = final.get("reason", "unknown")
        need_review = final.get("needStaffReview", False)
        
        final_need_review = need_review
        final_reason = reason
        
        if issue_item.get("issueFlag"):
            final_need_review = True
            if reason != "issue_keyword_rule":
                final_reason = "issue_detection"
            
        res_dict["final"]["needStaffReview"] = final_need_review
        res_dict["final"]["reason"] = final_reason
        
        res_dict["issue"] = {
            "issueFlag": issue_item.get("issueFlag", False),
            "issueType": issue_item.get("issueType", "none"),
            "issueConfidence": issue_item.get("issueConfidence", 0.0),
            "issueReason": issue_item.get("issueReason", "no_issue")
        }
        
        res_dict["sentiment"] = {
            "label": label,
            "reason": reason
        }
        
        return res_dict

    def _decide(
        self,
        text: str,
        rule_item: Dict[str, Any],
        phobert_item: Dict[str, Any],
        visobert_item: Dict[str, Any],
    ) -> Dict[str, Any]:
        priority = rule_item.get("priority")
        normalized = _norm_for_match(text)

        # ── Rule high-priority paths (override everything) ─────────────────────

        if rule_item.get("reason") == "invalid_or_system_text":
            return self._response(
                text, "neutral", 1.0, False,
                "invalid_or_system_text",
                rule_item, phobert_item, visobert_item,
            )

        if rule_item.get("reason") == "short_acknowledgement":
            return self._response(
                text, "neutral", 1.0, False,
                "short_acknowledgement",
                rule_item, phobert_item, visobert_item,
            )

        if priority == "issue_negative":
            return self._response(
                text, "negative", 0.95, True,
                "issue_keyword_rule",
                rule_item, phobert_item, visobert_item,
            )

        if priority == "clear_positive":
            return self._response(
                text, "positive", 0.9, False,
                "positive_keyword_rule",
                rule_item, phobert_item, visobert_item,
            )

        if priority == "informational_neutral":
            return self._response(
                text, "neutral", 0.9, False,
                "informational_question_rule",
                rule_item, phobert_item, visobert_item,
            )

        # ── Model-based decision ───────────────────────────────────────────────
        ph_label  = phobert_item.get("label", "neutral")
        ph_conf   = float(phobert_item.get("confidence", 0.0) or 0.0)
        vi_available = bool(visobert_item.get("available", False))
        vi_label  = visobert_item.get("label", "neutral")
        vi_conf   = float(visobert_item.get("confidence", 0.0) or 0.0)

        if vi_available:
            # Both models available — ensemble mode
            if ph_label == vi_label:
                confidence = round((ph_conf + vi_conf) / 2, 4)
                return self._response(
                    text, ph_label, confidence, ph_label == "negative",
                    "model_agreement",
                    rule_item, phobert_item, visobert_item,
                )

            # Disagreement — apply tie-breaking rules
            has_issue_keyword = _contains_any(normalized, ISSUE_KEYWORDS) is not None
            positive_keyword  = _contains_any(normalized, POSITIVE_KEYWORDS) is not None
            info_keyword      = _contains_any(normalized, INFO_KEYWORDS) is not None
            has_question_cue  = _contains_any(normalized, INFO_QUESTION_CUES) is not None

            # a) issue keyword + ViSoBERT or PhoBERT negative confidence >= 0.55 → negative
            if has_issue_keyword:
                if (ph_label == "negative" and ph_conf >= 0.55) or (vi_label == "negative" and vi_conf >= 0.55):
                    confidence = ph_conf if ph_label == "negative" else vi_conf
                    return self._response(
                        text, "negative", confidence, True,
                        "disagreement_issue_keyword_fallback",
                        rule_item, phobert_item, visobert_item,
                    )

            # b) positive keyword + ViSoBERT or PhoBERT positive confidence >= 0.60 → positive
            if positive_keyword:
                if (ph_label == "positive" and ph_conf >= 0.60) or (vi_label == "positive" and vi_conf >= 0.60):
                    confidence = ph_conf if ph_label == "positive" else vi_conf
                    return self._response(
                        text, "positive", confidence, False,
                        "disagreement_positive_keyword_fallback",
                        rule_item, phobert_item, visobert_item,
                    )

            # c) informational question + no issue phrase → neutral
            if (info_keyword or has_question_cue) and not has_issue_keyword:
                return self._response(
                    text, "neutral", max(ph_conf, vi_conf), False,
                    "disagreement_informational_question_fallback",
                    rule_item, phobert_item, visobert_item,
                )

            # d) choose higher confidence model if gap is meaningful
            gap = abs(ph_conf - vi_conf)
            if gap >= 0.15:
                if ph_conf > vi_conf:
                    return self._response(
                        text, ph_label, ph_conf, ph_label == "negative",
                        f"disagreement_resolved_by_phobert_confidence_gap_{round(gap, 2)}",
                        rule_item, phobert_item, visobert_item,
                    )
                else:
                    return self._response(
                        text, vi_label, vi_conf, vi_label == "negative",
                        f"disagreement_resolved_by_visobert_confidence_gap_{round(gap, 2)}",
                        rule_item, phobert_item, visobert_item,
                    )

            # e) if uncertain → neutral with reason=low_confidence_disagreement
            return self._response(
                text, "neutral", max(ph_conf, vi_conf), False,
                "low_confidence_disagreement",
                rule_item, phobert_item, visobert_item,
            )

        # ── PhoBERT + rule mode (ViSoBERT unavailable) ────────────────────────
        if ph_label == "negative" and ph_conf >= NEGATIVE_THRESHOLD:
            return self._response(
                text, "neutral", ph_conf, False,
                "phobert_negative_without_issue_keyword",
                rule_item, phobert_item, visobert_item,
            )
        if ph_label == "positive" and ph_conf >= POSITIVE_THRESHOLD:
            return self._response(
                text, "neutral", ph_conf, False,
                "phobert_positive_without_positive_keyword",
                rule_item, phobert_item, visobert_item,
            )
        if ph_label == "neutral" and ph_conf >= NEUTRAL_THRESHOLD:
            return self._response(
                text, "neutral", ph_conf, False,
                "phobert_only_neutral",
                rule_item, phobert_item, visobert_item,
            )

        return self._response(
            text, "neutral", ph_conf, False,
            "low_confidence_phobert_only",
            rule_item, phobert_item, visobert_item,
        )

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _mode_for(self, visobert_item: Dict[str, Any]) -> str:
        return "ensemble" if bool(visobert_item.get("available", False)) else "phobert_rule"

    def _version_for(self, visobert_item: Dict[str, Any]) -> str:
        return (
            PHOBERT_VISOBERT_VERSION
            if self._mode_for(visobert_item) == "ensemble"
            else PHOBERT_RULE_VERSION
        )

    def _response(
        self,
        text: str,
        label: str,
        confidence: float,
        need_review: bool,
        reason: str,
        rule_item: Dict[str, Any],
        phobert_item: Dict[str, Any],
        visobert_item: Dict[str, Any],
    ) -> Dict[str, Any]:
        confidence      = round(max(0.0, min(1.0, float(confidence or 0.0))), 4)
        mode            = self._mode_for(visobert_item)
        analyzer_version = self._version_for(visobert_item)
        visobert_error  = None if mode == "ensemble" else (visobert_item.get("error") or visobert_item.get("reason"))
        return {
            "text":   text,
            "mode":   mode,
            "final": {
                "label":           label,
                "confidence":      confidence,
                "score":           _score_for(label, confidence),
                "needStaffReview": bool(need_review),
                "reason":          reason,
                "probabilities":   _probabilities_for(label, confidence),
            },
            "rule":                  rule_item,
            "phobert":               phobert_item,
            "visobert":              visobert_item,
            "analyzerVersion":       analyzer_version,
            "actualAnalyzerVersion": analyzer_version,
            "visobertError":         visobert_error,
        }

    def health(self) -> Dict[str, Any]:
        ph = self.phobert.health()
        vi = self.visobert.health()
        actual_version = PHOBERT_VISOBERT_VERSION if vi.available else PHOBERT_RULE_VERSION
        return {
            "phobert":             ph.__dict__,
            "visobert":            vi.__dict__,
            "ensembleVersion":     ENSEMBLE_VERSION,
            "actualAnalyzerVersion": actual_version,
            "requireVisobert":     REQUIRE_VISOBERT,
            "visobertError":       vi.error,
        }


ensemble_service = EnsembleSentimentService()
