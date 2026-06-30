from __future__ import annotations

import unicodedata
import re
from typing import Any


TOPIC_GROUPS = [
    {
        "id": "sat_hach_cntt",
        "name": "Sát hạch CNTT (Sát hạch Công nghệ thông tin)",
        "short_name": "Sát hạch CNTT",
        "color": "#003865",
        "scope_terms": [
            "Sát hạch CNTT",
            "Sát hạch Công nghệ thông tin",
            "CNTT",
            "Công nghệ thông tin",
            "CNTT Cơ bản",
            "CNTT Nâng cao",
            "Tin cơ bản",
            "Tin nâng cao",
            "THCB",
            "THNC",
            "IC3",
            "thi CNTT",
            "chứng chỉ CNTT",
        ],
    },
    {
        "id": "toeic",
        "name": "TOEIC",
        "short_name": "TOEIC",
        "color": "#ED5206",
        "scope_terms": ["TOEIC", "thi TOEIC", "lịch thi TOEIC", "đăng ký TOEIC", "lệ phí TOEIC", "điểm thi TOEIC", "chứng chỉ TOEIC"],
    },
    {
        "id": "mos",
        "name": "MOS",
        "short_name": "MOS",
        "color": "#1565C0",
        "scope_terms": ["MOS", "Microsoft Office Specialist", "thi MOS", "lịch thi MOS", "chứng chỉ MOS", "điểm thi MOS"],
    },
    {
        "id": "hoc_tieng_anh",
        "name": "Học Tiếng Anh",
        "short_name": "Học Tiếng Anh",
        "color": "#F36C2E",
        "scope_terms": ["Học Tiếng Anh", "Tiếng Anh", "Anh văn", "Ngoại ngữ", "khóa tiếng Anh", "lớp tiếng Anh", "VSTEP", "B1", "B2", "ôn tiếng Anh", "chuẩn đầu ra ngoại ngữ"],
    },
    {
        "id": "hoc_tin_hoc",
        "name": "Học Tin học",
        "short_name": "Học Tin học",
        "color": "#0288D1",
        "scope_terms": ["Học Tin học", "khóa tin học", "lớp tin học", "tin học văn phòng", "học Word", "học Excel", "học PowerPoint", "ôn tin học", "quên mật khẩu khóa học"],
    },
]

ORDERED_TOPIC_GROUP_IDS = [group["id"] for group in TOPIC_GROUPS]
TOPIC_GROUP_BY_ID = {group["id"]: group for group in TOPIC_GROUPS}
TOPIC_NAME_BY_ID = {group["id"]: group["name"] for group in TOPIC_GROUPS}

TOPIC_LEGACY_ALIASES = {
    "sat_hach_cntt": ["Sát hạch CNTT", "CNTT", "IC3", "THCB", "THNC"],
    "toeic": ["TOEIC"],
    "mos": ["MOS", "Tin học / MOS / IC3"],
    "hoc_tieng_anh": ["VSTEP", "Chuẩn đầu ra", "Chuẩn đầu ra / Chứng chỉ", "Chuẩn đầu ra ngoại ngữ", "Ngoại ngữ"],
    "hoc_tin_hoc": ["Tin học", "Học Tin học", "Tin học văn phòng"],
}


def normalize_topic_text(value: Any = "") -> str:
    normalized = unicodedata.normalize("NFD", str(value or ""))
    without_diacritics = "".join(c for c in normalized if unicodedata.category(c) != "Mn")
    without_diacritics = without_diacritics.replace("đ", "d").replace("Đ", "D")
    return " ".join(without_diacritics.lower().split())


def canonical_topic_id(*values: Any) -> str | None:
    raw_text = " ".join(str(value or "") for value in values).strip()
    if raw_text in TOPIC_GROUP_BY_ID:
        return raw_text

    text = normalize_topic_text(raw_text)
    if text in TOPIC_GROUP_BY_ID:
        return text
    if not text or text == "tat ca":
        return None

    legacy_exact = {
        "tin hoc": "hoc_tin_hoc",
        "tin hoc / mos / ic3": "mos",
        "chuan dau ra": "hoc_tieng_anh",
        "chuan dau ra / chung chi": "hoc_tieng_anh",
        "chuan dau ra ngoai ngu": "hoc_tieng_anh",
    }
    if text in legacy_exact:
        return legacy_exact[text]

    if _has_code_token(text, "vstep") or _has_code_token(text, "b1") or _has_code_token(text, "b2"):
        return "hoc_tieng_anh"
    if _has_code_token(text, "toeic"):
        return "toeic"
    if _has_code_token(text, "mos") or "microsoft office specialist" in text:
        return "mos"
    if any(token in text for token in (
        "sat hach",
        "cntt",
        "cong nghe thong tin",
        "ic3",
        "thcb",
        "thnc",
        "tin co ban",
        "tin nang cao",
    )):
        return "sat_hach_cntt"
    if any(token in text for token in (
        "hoc tieng anh",
        "tieng anh",
        "anh van",
        "ngoai ngu",
        "chuan dau ra",
        "dau ra",
        "xet tot nghiep",
    )):
        return "hoc_tieng_anh"
    if any(token in text for token in (
        "hoc tin hoc",
        "khoa tin hoc",
        "lop tin hoc",
        "tin hoc van phong",
        "hoc word",
        "hoc excel",
        "hoc powerpoint",
        "on tin hoc",
    )):
        return "hoc_tin_hoc"
    return None


def _has_code_token(text: str, code: str) -> bool:
    return re.search(rf"(?<![a-z0-9_]){re.escape(code)}(?![a-z0-9_])", text) is not None


def canonical_topic_label(*values: Any, default: str = "Khác") -> str:
    topic_id = canonical_topic_id(*values)
    return TOPIC_NAME_BY_ID.get(topic_id, default) if topic_id else default


def topic_filter_aliases(value: Any) -> list[str]:
    topic_id = canonical_topic_id(value)
    if not topic_id:
        text = str(value or "").strip()
        return [text] if text else []

    group = TOPIC_GROUP_BY_ID[topic_id]
    aliases = [
        group["name"],
        group["short_name"],
        *group.get("scope_terms", []),
        *TOPIC_LEGACY_ALIASES.get(topic_id, []),
    ]
    seen: set[str] = set()
    result: list[str] = []
    for alias in aliases:
        normalized = normalize_topic_text(alias)
        if not alias or normalized in seen:
            continue
        seen.add(normalized)
        result.append(alias)
    return result
