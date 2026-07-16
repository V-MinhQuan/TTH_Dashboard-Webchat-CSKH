"""Lightweight customer issue detection without local ML dependencies."""

from __future__ import annotations

import html
import re
import unicodedata
from typing import Any


_ISSUE_CATEGORIES: tuple[tuple[str, tuple[str, ...]], ...] = (
    (
        "missing_email_or_notification",
        (
            "chua thay mail",
            "chua nhan mail",
            "chua nhan duoc mail",
            "chua nhan email",
            "chua nhan duoc email",
            "doi mail",
            "cho mail",
            "chua co thong bao",
            "khong thay thong bao",
            "chua nhan duoc thong tin",
            "mail thanh toan",
            "mail xac nhan",
        ),
    ),
    (
        "payment_or_qr_issue",
        (
            "khong thay ma qr",
            "khong co ma qr",
            "chua thay ma qr",
            "chua co ma qr",
            "khong thay ma",
            "ma chuyen khoan",
            "chuyen khoan roi",
            "thanh toan roi",
            "chua xac nhan thanh toan",
            "sai noi dung chuyen khoan",
        ),
    ),
    (
        "registration_issue",
        (
            "khong dang ky duoc",
            "khong dang ki duoc",
            "khong bam dang ky duoc",
            "khong bam dang ki duoc",
            "khong thay form",
            "form khong hien",
            "khong hien form",
            "dang ky roi nhung chua",
            "dang ki roi nhung chua",
            "dang ky thanh cong nhung chua",
            "dang ki thanh cong nhung chua",
            "khong gui duoc form",
            "khong nop duoc form",
        ),
    ),
    (
        "file_extract_or_document_issue",
        (
            "khong mo duoc file",
            "khong tai duoc file",
            "file loi",
            "loi file",
            "extract",
            "giai nen",
            "khong giai nen duoc",
            "giai nen bao loi",
            "file yeu cau mat khau",
            "file bat nhap mat khau",
            "mat khau file",
            "tai lieu khong mo duoc",
        ),
    ),
    (
        "deadline_or_urgency_issue",
        (
            "khong kip",
            "so khong kip",
            "so tre",
            "tre han",
            "qua han",
            "het han",
            "can gap",
            "gap a",
            "kip nop bang",
            "khong kip nop bang",
            "khong kip tot nghiep",
        ),
    ),
    (
        "exam_result_or_retake_issue",
        (
            "rot",
            "thi rot",
            "bi rot",
            "rot excel",
            "rot thuc hanh",
            "rot ly thuyet",
            "thi lai",
            "dang ky thi lai",
            "dang ki thi lai",
            "khong dat",
        ),
    ),
    (
        "access_or_login_issue",
        (
            "khong dang nhap duoc",
            "khong truy cap duoc",
            "khong vao duoc",
            "tai khoan loi",
            "khong hop le",
            "bao khong hop le",
            "loi dang nhap",
            "ko hop le",
            "k hop le",
            "dang nhap loi",
            "kh vao duoc",
            "kh vao",
            "kh duoc",
            "kh dang nhap",
        ),
    ),
    (
        "contact_failure",
        (
            "goi khong ai nghe",
            "khong ai nghe may",
            "khong nghe may",
            "khong goi duoc",
            "khong lien he duoc",
            "nhan khong ai tra loi",
            "khong phan hoi",
            "tra loi dum",
            "tra loi giup",
        ),
    ),
    (
        "typo_slang_abbreviation",
        (
            "k thay",
            "ko thay",
            "k nhan",
            "ko nhan",
            "chx nhan",
            "chua nhan dc",
            "k mo duoc",
            "ko mo duoc",
            "k mo dc",
            "ko mo dc",
            "k vao duoc",
            "ko vao duoc",
            "hong thay",
            "chx",
            "nhan dc",
            "kh vao duoc",
            "kh duoc",
        ),
    ),
)

_INFO_WHITELIST: tuple[str, ...] = (
    "lich thi co chua a",
    "lich thi co chua",
    "ho so thi gom nhung gi a",
    "ho so thi gom nhung gi",
    "le phi thi bao nhieu a",
    "le phi thi bao nhieu",
    "co can cong chung khong a",
    "co can cong chung khong",
    "da",
    "vang a",
    "ok",
    "da em cam on chi",
)


def _strip_accents(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value)
    without_marks = "".join(
        character
        for character in decomposed
        if unicodedata.category(character) != "Mn"
    )
    return without_marks.replace("đ", "d").replace("Đ", "D")


def _normalize_for_issue(value: Any) -> str:
    if value is None:
        return ""
    text = html.unescape(str(value))
    text = re.sub(r"<[^>]+>", " ", text)
    text = _strip_accents(text.lower())
    text = re.sub(r"[\W_]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


_NORMALIZED_INFO_WHITELIST = frozenset(
    _normalize_for_issue(value) for value in _INFO_WHITELIST
)


def detect_customer_issue(text: object) -> dict[str, object]:
    """Return the legacy independent issue-detection response for one text."""
    normalized = _normalize_for_issue(text)

    if normalized in _NORMALIZED_INFO_WHITELIST:
        return {
            "issueFlag": False,
            "issueType": "none",
            "issueConfidence": 0.0,
            "issueReason": "matches whitelist: informational question or short greeting",
        }

    padded_text = f" {normalized} "
    for category, patterns in _ISSUE_CATEGORIES:
        for pattern in patterns:
            normalized_pattern = _normalize_for_issue(pattern)
            if f" {normalized_pattern} " in padded_text:
                return {
                    "issueFlag": True,
                    "issueType": category,
                    "issueConfidence": 0.9,
                    "issueReason": f"matched pattern: {pattern}",
                }

    return {
        "issueFlag": False,
        "issueType": "none",
        "issueConfidence": 0.0,
        "issueReason": "no issue pattern matched",
    }
