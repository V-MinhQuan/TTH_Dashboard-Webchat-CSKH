"""
test_ensemble.py
─────────────────
Unit tests for the FLIC ensemble sentiment pipeline.

Groups:
  A — Must be neutral (informational questions, short acks, system markers)
  B — Must be positive (clear positive keywords)
  C — Must be negative + needStaffReview=true (strong issue phrases)

  test_phobert_rule_mode_*   — version / mode fields when ViSoBERT unavailable
  test_visobert_agreement_*  — ensemble mode when ViSoBERT available
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.ensemble import EnsembleSentimentService, PHOBERT_RULE_VERSION, RuleSentimentAdapter


# ─── Helpers ──────────────────────────────────────────────────────────────────

def model_item(text, label="neutral", confidence=0.72, source="phobert", available=True):
    score = 0.0
    if label == "positive":
        score = confidence
    elif label == "negative":
        score = -confidence
    probabilities = {"positive": 0.0, "neutral": 0.0, "negative": 0.0}
    probabilities[label] = confidence
    if label != "neutral":
        probabilities["neutral"] = round(1 - confidence, 4)
    else:
        probabilities["neutral"] = confidence
    item = {
        "text": text,
        "label": label,
        "score": score,
        "confidence": confidence,
        "source": source,
        "rawLabel": label.upper(),
        "probabilities": probabilities,
    }
    if source == "visobert":
        item["available"] = available
        if not available:
            item["reason"] = "test_unavailable"
            item["confidence"] = 0.0
            item["rawLabel"] = "UNAVAILABLE"
            item["probabilities"] = {"positive": 0.0, "neutral": 1.0, "negative": 0.0}
    return item


class StubPhobertAdapter:
    def __init__(self, label="neutral", confidence=0.72):
        self.label = label
        self.confidence = confidence

    def predict_batch(self, texts):
        return [model_item(text, self.label, self.confidence, "phobert") for text in texts]


class StubVisobertUnavailableAdapter:
    def predict_batch(self, texts):
        return [model_item(text, "neutral", 0.0, "visobert", available=False) for text in texts]


class StubVisobertAvailableAdapter:
    def __init__(self, label="neutral", confidence=0.7):
        self.label = label
        self.confidence = confidence

    def predict_batch(self, texts):
        return [model_item(text, self.label, self.confidence, "visobert", available=True) for text in texts]


def make_service(phobert_label="neutral", phobert_confidence=0.72, visobert_adapter=None):
    return EnsembleSentimentService(
        phobert_adapter=StubPhobertAdapter(phobert_label, phobert_confidence),
        visobert_adapter=visobert_adapter or StubVisobertUnavailableAdapter(),
        rule_adapter=RuleSentimentAdapter(),
    )


def prediction_for(text, phobert_label="neutral", phobert_confidence=0.72, visobert_adapter=None):
    return make_service(phobert_label, phobert_confidence, visobert_adapter).predict_batch([text])[0]


# ═══════════════════════════════════════════════════════════════════════════════
# Group A — Must be neutral (even when PhoBERT says positive or negative)
# ═══════════════════════════════════════════════════════════════════════════════

# A.1 — PhoBERT positive must NOT override these cases
REQUIRED_NEUTRAL_SAMPLES = [
    "vậy còn nộp hồ sơ thì cũng là ngày 11/5 đúng k ạ",
    "Có chứng chỉ là đc ạ",
    "Dạ em 49K ạ",        # short acknowledgement variant — PhoBERT often says positive
    "Danh sách thi ấy ạ",  # informational, no positive keyword
    "Còn slot kh ạ",       # "còn slot" = info keyword
    "Tin học cơ bản ạ",    # info keyword
    "hồ sơ gồm những gì ạ",
    "lịch thi tháng 6 có chưa ạ",
    "lệ phí thi bao nhiêu ạ",
    "Dạ",
    "Vâng ạ",
    "#time",
]


def test_required_neutral_cases_stay_neutral_even_when_phobert_is_positive():
    for text in REQUIRED_NEUTRAL_SAMPLES:
        final = prediction_for(text, phobert_label="positive", phobert_confidence=0.95)["final"]
        assert final["label"] == "neutral", (
            f"Expected neutral but got {final['label']!r} for: {text!r}\n"
            f"  reason={final['reason']}"
        )
        assert final["needStaffReview"] is False, (
            f"needStaffReview should be False for neutral text: {text!r}"
        )


def test_required_neutral_cases_stay_neutral_even_when_phobert_is_negative():
    samples_also_neutral_when_negative = [
        "vậy còn nộp hồ sơ thì cũng là ngày 11/5 đúng k ạ",
        "Có chứng chỉ là đc ạ",
        "Còn slot kh ạ",
        "Tin học cơ bản ạ",
        "lịch thi tháng 6 có chưa ạ",
        "lệ phí thi bao nhiêu ạ",
    ]
    for text in samples_also_neutral_when_negative:
        final = prediction_for(text, phobert_label="negative", phobert_confidence=0.95)["final"]
        assert final["label"] == "neutral", (
            f"Expected neutral but got {final['label']!r} for: {text!r}\n"
            f"  reason={final['reason']}"
        )
        assert final["needStaffReview"] is False


# ═══════════════════════════════════════════════════════════════════════════════
# Group B — Must be positive (clear positive keywords)
# ═══════════════════════════════════════════════════════════════════════════════

REQUIRED_POSITIVE_SAMPLES = [
    "Dạ em cảm ơn chị",
    "Em cảm ơn ạ",
    "Dạ vâng em cảm ơn ad ạ",
    "ok rồi ạ em hiểu rồi",
    "trung tâm tư vấn rõ quá ạ",
]


def test_required_positive_cases_are_positive_by_clear_keyword():
    for text in REQUIRED_POSITIVE_SAMPLES:
        # Test with PhoBERT neutral — the rule must detect positive keyword
        final = prediction_for(text, phobert_label="neutral")["final"]
        assert final["label"] == "positive", (
            f"Expected positive but got {final['label']!r} for: {text!r}\n"
            f"  reason={final['reason']}"
        )
        assert final["needStaffReview"] is False


# ═══════════════════════════════════════════════════════════════════════════════
# Group C — Must be negative + needStaffReview=true (strong issue phrases)
# ═══════════════════════════════════════════════════════════════════════════════

REQUIRED_NEGATIVE_SAMPLES = [
    "em chưa nhận được email xác nhận",
    "tụi em hôm nay vẫn chưa nhận được email ạ",
    "em đăng ký thành công từ hôm qua nhưng đến giờ vẫn chưa nhận được mail thông báo thanh toán ạ",
    "em không thấy mã QR code để chuyển ạ",
    "em bị mất cccd rồi",
    "em rớt excel thì đăng ký thi lại như nào ạ",
    "em không mở được file ôn tập",
    "extract file bị lỗi thì phải làm sao ạ",
    "em extract file thi yeu cau mat khau",
    "file yeu cau mat khau thi lam sao a",
    "em khong giai nen duoc file on tap",
    "loi giai nen file tai lieu",
    "em giai nen thi bi yeu cau mat khau",
    "em không gọi được ạ",
    "không có ai nghe máy ạ",
    "em sợ không kịp nộp bằng để tốt nghiệp",
    "em không thể truy cập được ạ",
    "E điền mà ko hợp lệ",
]


def test_required_issue_cases_are_negative_and_need_review():
    for text in REQUIRED_NEGATIVE_SAMPLES:
        prediction = prediction_for(text, phobert_label="neutral")
        final = prediction["final"]
        assert final["label"] == "negative", (
            f"Expected negative but got {final['label']!r} for: {text!r}\n"
            f"  reason={final['reason']}, rule_priority={prediction['rule']['priority']}"
        )
        assert final["needStaffReview"] is True, (
            f"needStaffReview should be True for: {text!r}"
        )
        assert final["reason"] == "issue_keyword_rule", (
            f"reason should be 'issue_keyword_rule' but got {final['reason']!r} for: {text!r}"
        )
        assert prediction["rule"]["priority"] == "issue_negative", (
            f"rule.priority should be 'issue_negative' for: {text!r}"
        )


def test_issue_overrides_info_keyword_in_same_sentence():
    """
    A text containing both an info keyword and an issue keyword must be
    classified as negative, NOT neutral.
    """
    text = "em đăng ký thành công từ hôm qua nhưng đến giờ vẫn chưa nhận được mail thanh toán"
    final = prediction_for(text, phobert_label="neutral")["final"]
    assert final["label"] == "negative", (
        f"Expected negative but got {final['label']!r}. Issue keyword must override info keyword."
    )
    assert final["needStaffReview"] is True


# ═══════════════════════════════════════════════════════════════════════════════
# Version / mode field checks
# ═══════════════════════════════════════════════════════════════════════════════

def test_phobert_rule_mode_uses_rule_version_when_visobert_unavailable():
    prediction = prediction_for("em chưa nhận được email xác nhận")

    assert prediction["mode"] == "phobert_rule"
    assert prediction["analyzerVersion"] == PHOBERT_RULE_VERSION
    assert prediction["actualAnalyzerVersion"] == PHOBERT_RULE_VERSION
    assert prediction["visobertError"] == "test_unavailable"
    assert prediction["final"]["reason"] != "model_agreement", (
        "reason must not be 'model_agreement' in phobert_rule mode"
    )


def test_visobert_agreement_can_use_ensemble_version():
    prediction = prediction_for(
        "em chưa nhận được email xác nhận",
        phobert_label="negative",
        phobert_confidence=0.8,
        visobert_adapter=StubVisobertAvailableAdapter("negative", 0.7),
    )

    # Rule fires first (issue_negative), so mode is still based on visobert_item
    assert prediction["mode"] == "ensemble"
    assert prediction["final"]["label"] == "negative"
    assert prediction["final"]["needStaffReview"] is True


def test_neutral_informational_does_not_set_needstaffreview():
    """Pure informational questions must have needStaffReview=false."""
    samples = [
        "lịch thi tháng 6 có chưa ạ",
        "lệ phí thi bao nhiêu ạ",
        "hồ sơ gồm những gì ạ",
        "Còn slot kh ạ",
    ]
    for text in samples:
        final = prediction_for(text, phobert_label="negative", phobert_confidence=0.9)["final"]
        assert final["needStaffReview"] is False, (
            f"needStaffReview should be False for informational: {text!r}"
        )


def test_weak_words_alone_do_not_set_needstaffreview():
    """Single weak tokens 'không', 'chưa', 'kịp', 'hoãn' alone must not trigger needStaffReview."""
    samples = [
        "không",
        "chưa",
        "kịp",
        "hoãn",
    ]
    for text in samples:
        final = prediction_for(text, phobert_label="negative", phobert_confidence=0.9)["final"]
        assert final["needStaffReview"] is False, (
            f"needStaffReview should be False for weak token alone: {text!r}\n"
            f"  reason={final['reason']}"
        )
