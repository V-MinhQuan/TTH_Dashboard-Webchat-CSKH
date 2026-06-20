from __future__ import annotations

import html
import re
import unicodedata
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class IssueRule:
    issue_type: str
    confidence: float
    keywords: tuple[str, ...]


@dataclass(frozen=True)
class IssueClassification:
    issue_flag: bool
    issue_type: Optional[str] = None
    issue_reason: Optional[str] = None
    issue_confidence: Optional[float] = None
    matched_keyword: Optional[str] = None


ISSUE_RULES: tuple[IssueRule, ...] = (
    IssueRule(
        issue_type="AI có nguy cơ tự tạo thông tin",
        confidence=0.65,
        keywords=(
            "suy đoán",
            "phỏng đoán",
            "ước đoán",
            "tự suy luận",
            "không có dữ liệu nhưng",
            "không chắc nhưng",
            "tôi tự suy luận",
            "mình tự suy luận",
        ),
    ),
    IssueRule(
        issue_type="AI không chắc chắn",
        confidence=0.75,
        keywords=(
            "chưa hiểu",
            "chưa rõ",
            "không chắc chắn",
            "chưa có thông tin cụ thể",
            "độ tin cậy",
            "chưa xác nhận",
            "có vẻ như",
            "chắc là",
            "có lẽ",
            "hình như",
            "tôi đoán",
            "mình đoán",
            "không rõ",
            "cần xác nhận",
            "cần kiểm tra lại",
            "có khả năng",
            "dường như",
            "theo tôi hiểu",
            "theo mình hiểu",
            "không hiểu câu hỏi",
            "không hiểu yêu cầu",
            "chưa hiểu ý bạn",
            "vui lòng diễn đạt lại",
            "vui lòng cung cấp thêm thông tin",
            "không xác định được yêu cầu",
        ),
    ),
    IssueRule(
        issue_type="Không tìm thấy dữ liệu",
        confidence=0.85,
        keywords=(
            "không tìm thấy",
            "chưa có",
            "chưa hỗ trợ",
            "không thể",
            "trợ lý ai",
            "không thể tiếp nhận thông tin",
            "không thể xác nhận trực tiếp",
            "không có dữ liệu",
            "chưa có dữ liệu",
            "không có thông tin",
            "không tìm được thông tin",
            "chưa cập nhật",
            "hiện chưa có",
            "không nằm trong dữ liệu",
            "không đủ dữ liệu",
        ),
    ),
    IssueRule(
        issue_type="Câu hỏi ngoài phạm vi",
        confidence=0.70,
        keywords=(
            "ngoài phạm vi",
            "không thuộc phạm vi",
            "không hỗ trợ nội dung này",
            "không thể hỗ trợ vấn đề này",
        ),
    ),
)


def normalize_text(value: object) -> str:
    text = html.unescape(str(value or ""))
    text = re.sub(r"<[^>]+>", " ", text)
    text = unicodedata.normalize("NFC", text).lower()
    return re.sub(r"\s+", " ", text).strip()


def remove_accents(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value)
    without_marks = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    return unicodedata.normalize("NFC", without_marks).replace("đ", "d")


def classify_ai_issue(answer_text: object) -> IssueClassification:
    normalized = normalize_text(answer_text)
    if not normalized:
        return IssueClassification(issue_flag=False)

    plain_text = remove_accents(normalized)

    for rule in ISSUE_RULES:
        for keyword in rule.keywords:
            normalized_keyword = normalize_text(keyword)
            plain_keyword = remove_accents(normalized_keyword)
            if normalized_keyword in normalized or plain_keyword in plain_text:
                return IssueClassification(
                    issue_flag=True,
                    issue_type=rule.issue_type,
                    issue_reason=f"Dựa trên keyword trong câu trả lời AI: {keyword}",
                    issue_confidence=rule.confidence,
                    matched_keyword=keyword,
                )

    return IssueClassification(issue_flag=False)
