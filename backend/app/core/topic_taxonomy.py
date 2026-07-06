from __future__ import annotations

import unicodedata
import re
from typing import Any


TOPIC_GROUPS = [
    {
        "id": "toeic",
        "name": "TOEIC",
        "short_name": "TOEIC",
        "color": "#ED5206",
        "scope_terms": [
            "TOEIC",
            "thi TOEIC",
            "đăng ký TOEIC",
            "đăng ký thi TOEIC",
            "lịch thi TOEIC",
            "ngày thi TOEIC",
            "ca thi TOEIC",
            "lệ phí TOEIC",
            "phí thi TOEIC",
            "điểm TOEIC",
            "điểm thi TOEIC",
            "kết quả TOEIC",
            "xem điểm TOEIC",
            "chứng chỉ TOEIC",
            "nhận chứng chỉ TOEIC",
            "cấp chứng chỉ TOEIC",
        ],
    },
    {
        "id": "mos",
        "name": "MOS",
        "short_name": "MOS",
        "color": "#1565C0",
        "scope_terms": [
            "MOS",
            "Microsoft Office Specialist",
            "thi MOS",
            "đăng ký MOS",
            "đăng ký thi MOS",
            "lịch thi MOS",
            "ngày thi MOS",
            "ca thi MOS",
            "lệ phí MOS",
            "phí thi MOS",
            "điểm MOS",
            "điểm thi MOS",
            "kết quả MOS",
            "xem điểm MOS",
            "chứng chỉ MOS",
            "nhận chứng chỉ MOS",
            "cấp chứng chỉ MOS",
        ],
    }, 
     { "id": "sat_hach_cntt", "name": "Sát hạch CNTT", "short_name": "Sát hạch CNTT", "color": "#003865", "scope_terms": [ "Sát hạch CNTT", "Sát hạch Công nghệ thông tin", "thi CNTT", "thi Công nghệ thông tin", "đăng ký thi CNTT", "đăng ký sát hạch CNTT", "lịch thi CNTT", "ngày thi CNTT", "ca thi CNTT", "lệ phí thi CNTT", "phí thi CNTT", "điểm thi CNTT", "kết quả thi CNTT", "xem điểm CNTT", "chứng chỉ CNTT", "nhận chứng chỉ CNTT", "cấp chứng chỉ CNTT", "CNTT cơ bản", "CNTT nâng cao", "Tin học cơ bản", "Tin học nâng cao", "Tin cơ bản", "Tin nâng cao", "THCB", "THNC", "IC3" ] },
    {
        "id": "hoc_tieng_anh",
        "name": "Học Tiếng Anh",
        "short_name": "Học Tiếng Anh",
        "color": "#F36C2E",
        "scope_terms": [
            "Học Tiếng Anh",
            "Tiếng Anh",
            "Anh văn",
            "Ngoại ngữ",
            "khóa tiếng Anh",
            "lớp tiếng Anh",
            "khóa Anh văn",
            "lớp Anh văn",
            "học tiếng Anh",
            "đăng ký khóa tiếng Anh",
            "đăng ký lớp tiếng Anh",
            "ôn tiếng Anh",
            "luyện tiếng Anh",
            "tiếng Anh giao tiếp",
            "học giao tiếp tiếng Anh",
            "luyện nghe",
            "luyện nói",
            "luyện đọc",
            "luyện viết",
            "VSTEP",
            "B1",
            "B2",
            "chuẩn đầu ra ngoại ngữ",
            "học phí tiếng Anh",
        ],
    },
    {
        "id": "hoc_tin_hoc",
        "name": "Học Tin học",
        "short_name": "Học Tin học",
        "color": "#0288D1",
        "scope_terms": [
            "Học Tin học",
            "khóa tin học",
            "lớp tin học",
            "học tin học",
            "đăng ký khóa tin học",
            "đăng ký lớp tin học",
            "tin học văn phòng",
            "Microsoft Office",
            "Word",
            "Excel",
            "PowerPoint",
            "học Word",
            "học Excel",
            "học PowerPoint",
            "ôn tin học",
            "học phí tin học",
            "đăng nhập khóa học",
            "quên mật khẩu khóa học",
        ],
    },
    {
        "id": "khac",
        "name": "Khác",
        "short_name": "Khác",
        "color": "#64748B",
        "scope_terms": ["Khác"],
    },
]

ORDERED_TOPIC_GROUP_IDS = [group["id"] for group in TOPIC_GROUPS]
TOPIC_GROUP_BY_ID = {group["id"]: group for group in TOPIC_GROUPS}
TOPIC_NAME_BY_ID = {group["id"]: group["name"] for group in TOPIC_GROUPS}

TOPIC_LEGACY_ALIASES = {
    "sat_hach_cntt": [
        "Sát hạch CNTT",
        "Sát hạch CNTT (Sát hạch Công nghệ thông tin)",
        "CNTT",
        "IC3",
        "THCB",
        "THNC",
    ],
    "toeic": ["TOEIC"],
    "mos": ["MOS", "Tin học / MOS / IC3"],
    "hoc_tieng_anh": ["VSTEP", "Chuẩn đầu ra", "Chuẩn đầu ra / Chứng chỉ", "Chuẩn đầu ra ngoại ngữ", "Ngoại ngữ"],
    "hoc_tin_hoc": ["Tin học", "Học Tin học", "Tin học văn phòng"],
    "khac": ["Khác"],
}


def normalize_topic_text(value: Any = "") -> str:
    normalized = unicodedata.normalize("NFD", str(value or ""))
    without_diacritics = "".join(c for c in normalized if unicodedata.category(c) != "Mn")
    without_diacritics = without_diacritics.replace("đ", "d").replace("Đ", "D")
    return " ".join(without_diacritics.lower().split())


def canonical_topic_id(*values: Any, default_to_other: bool = False) -> str | None:
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
        "other": "khac",
        "unknown": "khac",
        "none": "khac",
    }
    if text in legacy_exact:
        return legacy_exact[text]

    if _matches_scope_terms(text, "toeic"):
        return "toeic"
    if _matches_scope_terms(text, "mos"):
        return "mos"
    if _matches_scope_terms(text, "sat_hach_cntt"):
        return "sat_hach_cntt"
    if _matches_scope_terms(text, "hoc_tieng_anh"):
        return "hoc_tieng_anh"
    if _matches_scope_terms(text, "hoc_tin_hoc"):
        return "hoc_tin_hoc"
    if default_to_other:
        return "khac"
    return None


def canonical_topic_ids(*values: Any) -> list[str]:
    raw_text = " ".join(str(value or "") for value in values).strip()
    text = normalize_topic_text(raw_text)
    if not text or text == "tat ca":
        return []

    if raw_text in TOPIC_GROUP_BY_ID:
        return [raw_text]
    if text in TOPIC_GROUP_BY_ID:
        return [text]

    result: list[str] = []

    def add(topic_id: str) -> None:
        if topic_id not in result:
            result.append(topic_id)

    for topic_id in ("toeic", "mos", "sat_hach_cntt", "hoc_tieng_anh", "hoc_tin_hoc"):
        if _matches_scope_terms(text, topic_id):
            add(topic_id)

    if not result:
        add(canonical_topic_id(raw_text, default_to_other=True) or "khac")

    return [topic_id for topic_id in ORDERED_TOPIC_GROUP_IDS if topic_id in result]


def _has_code_token(text: str, code: str) -> bool:
    return re.search(rf"(?<![a-z0-9_]){re.escape(code)}(?![a-z0-9_])", text) is not None


def _matches_scope_terms(text: str, topic_id: str) -> bool:
    group = TOPIC_GROUP_BY_ID.get(topic_id)
    if not group:
        return False
    for term in group.get("scope_terms", []):
        normalized = normalize_topic_text(term)
        if not normalized or normalized == "khac":
            continue
        if normalized.isalnum() and len(normalized) <= 10:
            if _has_code_token(text, normalized):
                return True
        elif normalized in text:
            return True
    return False


def canonical_topic_label(*values: Any, default: str = "Khác") -> str:
    topic_id = canonical_topic_id(*values)
    return TOPIC_NAME_BY_ID.get(topic_id, default) if topic_id else default


def canonical_topic_labels(*values: Any) -> list[str]:
    return [TOPIC_NAME_BY_ID[topic_id] for topic_id in canonical_topic_ids(*values)]


def get_matched_topic_keywords(text: str, topic_id: str) -> list[str]:
    group = TOPIC_GROUP_BY_ID.get(topic_id)
    if not group:
        return []
    
    matched = []
    text_norm = normalize_topic_text(text)
    
    for term in group.get("scope_terms", []):
        normalized = normalize_topic_text(term)
        if not normalized or normalized == "khac":
            continue
        if normalized.isalnum() and len(normalized) <= 10:
            if _has_code_token(text_norm, normalized):
                matched.append(term)
        elif normalized in text_norm:
            matched.append(term)
    return matched

def extract_all_keywords(customer_text: str, bot_text: str) -> list[str]:
    topic_ids = canonical_topic_ids(customer_text, bot_text)
    matched_keywords = []
    for t in topic_ids:
        kws = get_matched_topic_keywords(customer_text or "", t)
        kws.extend(get_matched_topic_keywords(bot_text or "", t))
        matched_keywords.extend(kws)
    
    # Remove duplicates
    return list(dict.fromkeys(matched_keywords))


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

