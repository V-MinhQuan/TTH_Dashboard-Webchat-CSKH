import json
import logging
import re
import time
import unicodedata
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from pathlib import Path

import httpx

from app.core.config import get_settings
from app.repositories.legacy_conversation_repository import ConversationRepository
from app.services.conversation_cleaner import conversation_cleaner_service
from app.utils.customer_identity import customer_display_name

DASHBOARD_CACHE_TTL_SECONDS = 90
AI_QUESTION_CACHE_TTL_SECONDS = 3600
AI_QUESTION_STALE_CACHE_TTL_SECONDS = 300
AI_QUESTION_FALLBACK_CACHE_TTL_SECONDS = 60
AI_QUESTION_LAST_GOOD_CACHE_TTL_SECONDS = 86400
DEFAULT_KPI_DATE_WINDOW_DAYS = 30
DASHBOARD_QUERY_WORKERS = 9
AI_QUESTION_LAST_GOOD_CACHE_FILE = (
    Path(__file__).resolve().parents[3] / ".cache" / "dashboard_top_questions_last_good.json"
)
_dashboard_cache = {}
logger = logging.getLogger(__name__)

AI_OVERLOAD_MESSAGE = "Hệ thống AI hiện đang quá tải."
AI_FALLBACK_MESSAGE = "AI đang quá tải, đang hiển thị nhóm câu hỏi tạm thời từ database."
GEMINI_QUESTION_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.5-pro",
]
OPENAI_QUESTION_MODELS = [
    "gpt-5",
    "gpt-5-mini",
    "gpt-4.1",
    "gpt-4o-mini",
]
QUESTION_CLUSTER_CHUNK_SIZE = 80
QUESTION_RAW_ROW_LIMIT = 6000
QUESTION_ANALYSIS_ITEM_LIMIT = 1200
AI_CANDIDATE_GROUP_LIMIT = 40
AI_CANDIDATE_MIN_GROUPS = 12
AI_CANDIDATE_PROMPT_CHAR_LIMIT = 6500
TOP_QUESTIONS_DISPLAY_LIMIT = 5
TOP_QUESTIONS_RESPONSE_LIMIT = 50
TOP_QUESTIONS_AI_CANDIDATE_LIMIT = 12
GEMINI_PROVIDER_BUDGET_SECONDS = 2.5
GEMINI_REQUEST_TIMEOUT_SECONDS = 1.0
OPENAI_PROVIDER_BUDGET_SECONDS = 1.0
OPENAI_REQUEST_TIMEOUT_SECONDS = 1.0
LOCAL_GROUP_SIMILARITY_THRESHOLD = 0.72
QUESTION_STOPWORDS = {
    "a",
    "ad",
    "anh",
    "chi",
    "cho",
    "co",
    "cua",
    "da",
    "duoc",
    "em",
    "gi",
    "khong",
    "la",
    "minh",
    "nay",
    "nha",
    "nhe",
    "nhu",
    "the",
    "thi",
    "toi",
    "va",
    "vay",
    "voi",
}
QUESTION_GROUP_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "groups": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "question": {"type": "string"},
                    "itemIds": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["question", "itemIds"],
            },
        },
    },
    "required": ["groups"],
}


def make_cache_key(name: str, start_date=None, end_date=None, filters=None) -> str:
    return f"{name}:{json.dumps({'startDate': start_date, 'endDate': end_date, 'filters': filters or {}}, ensure_ascii=False, sort_keys=True, default=str)}"


def get_cached_value(key: str, ttl_seconds: int = DASHBOARD_CACHE_TTL_SECONDS):
    item = _dashboard_cache.get(key)
    if not item:
        return None

    saved_at, value = item
    if time.time() - saved_at > ttl_seconds:
        _dashboard_cache.pop(key, None)
        return None

    return value


def set_cached_value(key: str, value):
    _dashboard_cache[key] = (time.time(), value)


def _top_question_result_rows(value):
    if not isinstance(value, (list, tuple)) or len(value) < 3:
        return []
    rows = value[0]
    return rows if isinstance(rows, list) else []


def _is_valid_last_good_top_question_result(value) -> bool:
    if not isinstance(value, (list, tuple)) or len(value) < 3:
        return False
    rows, status, _message = value
    return status == "ok" and isinstance(rows, list) and len(rows) > 0


def get_top_question_runtime_cache(key: str):
    item = _dashboard_cache.get(key)
    if not item:
        return None

    saved_at, value = item
    status = value[1] if isinstance(value, (list, tuple)) and len(value) > 1 else None
    if status in {"ok", "stale", "fallback"} and not _top_question_result_rows(value):
        _dashboard_cache.pop(key, None)
        return None

    ttl_seconds = (
        AI_QUESTION_CACHE_TTL_SECONDS
        if status == "ok"
        else AI_QUESTION_FALLBACK_CACHE_TTL_SECONDS
        if status == "fallback"
        else AI_QUESTION_STALE_CACHE_TTL_SECONDS
        if status == "stale"
        else 0
    )
    if ttl_seconds <= 0 or time.time() - saved_at > ttl_seconds:
        _dashboard_cache.pop(key, None)
        return None
    return value


def _read_persistent_last_good_cache():
    try:
        if not AI_QUESTION_LAST_GOOD_CACHE_FILE.exists():
            return {}
        payload = json.loads(AI_QUESTION_LAST_GOOD_CACHE_FILE.read_text(encoding="utf-8"))
        return payload if isinstance(payload, dict) else {}
    except Exception as exc:
        logger.warning("Could not read dashboard AI question cache: %s", exc)
        return {}


def _write_persistent_last_good_cache(payload):
    try:
        AI_QUESTION_LAST_GOOD_CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = AI_QUESTION_LAST_GOOD_CACHE_FILE.with_suffix(".tmp")
        tmp_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        tmp_path.replace(AI_QUESTION_LAST_GOOD_CACHE_FILE)
    except Exception as exc:
        logger.warning("Could not write dashboard AI question cache: %s", exc)


def get_persistent_last_good_value(key: str, ttl_seconds: int = AI_QUESTION_LAST_GOOD_CACHE_TTL_SECONDS):
    payload = _read_persistent_last_good_cache()
    item = payload.get(key)
    if not isinstance(item, dict):
        return None

    saved_at = item.get("saved_at")
    value = item.get("value")
    if not isinstance(saved_at, (int, float)) or value is None:
        return None

    if time.time() - saved_at > ttl_seconds:
        payload.pop(key, None)
        _write_persistent_last_good_cache(payload)
        return None

    if isinstance(value, list) and len(value) == 3:
        value = (value[0], value[1], value[2])
    if not _is_valid_last_good_top_question_result(value):
        payload.pop(key, None)
        _write_persistent_last_good_cache(payload)
        return None
    return value


def set_persistent_last_good_value(key: str, value):
    if not _is_valid_last_good_top_question_result(value):
        return
    payload = _read_persistent_last_good_cache()
    payload[key] = {
        "saved_at": time.time(),
        "value": value,
    }
    _write_persistent_last_good_cache(payload)


def clear_dashboard_cache(preserve_ai_questions: bool = False):
    if not preserve_ai_questions:
        _dashboard_cache.clear()
        return

    for key in list(_dashboard_cache.keys()):
        if not (key.startswith("top_questions_base:") or key.startswith("top_questions_ai:")):
            _dashboard_cache.pop(key, None)


class QuestionGroupingAIError(Exception):
    pass

def _as_number(value):
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0

def trim_trailing_zero_rows(rows, metric_keys):
    trimmed = list(rows or [])
    while trimmed and all(_as_number(trimmed[-1].get(key)) == 0 for key in metric_keys):
        trimmed.pop()
    return trimmed

def format_channel(source: str = '') -> str:
    s = str(source).lower().strip()
    if s in ('facebook', 'fb', 'messenger'):
        return 'Facebook'
    if s in ('zalooa', 'zalo'):
        return 'Zalo OA'
    if s in ('zalobusiness', 'zalobiz'):
        return 'Zalo Business'
    if s in ('chatwidget', 'website'):
        return 'Chat Widget'
    return 'Khác'

def normalize_source_key(source: str = '') -> str:
    s = str(source).lower().strip()
    if s in ('facebook', 'fb', 'messenger'):
        return 'Facebook'
    if s in ('zalooa', 'zalo'):
        return 'ZaloOA'
    if s in ('zalobusiness', 'zalobiz'):
        return 'ZaloBusiness'
    if s in ('chatwidget', 'website', 'web'):
        return 'ChatWidget'
    return 'other'

def channel_to_source_key(channel: str = ''):
    if not channel or channel == 'Tất cả':
        return None
    key = normalize_source_key(channel)
    return None if key == 'other' else key

def format_wait_time(mins: int) -> str:
    if mins <= 0:
        return 'Vừa xong'
    if mins >= 24 * 60:
        return f"{mins // (24 * 60)} ngày {(mins % (24 * 60)) // 60} giờ"
    if mins >= 60:
        return f"{mins // 60} giờ {mins % 60} phút"
    return f"{mins} phút"

def hash_str(s: str) -> int:
    h = 0
    for char in s:
        h = ord(char) + ((h << 5) - h)
        h &= 0xFFFFFFFF
    if h & 0x80000000:
        h = -((~h & 0xFFFFFFFF) + 1)
    return abs(h)

def classify_topic(text: str = '', c_id: str = '') -> str:
    t = str(text).lower()
    if 'toeic' in t:
        return 'TOEIC'
    if 'vstep' in t:
        return 'VSTEP'
    if 'đầu ra' in t or 'chuẩn đầu ra' in t:
        return 'Chuẩn đầu ra'
    if any(k in t for k in ('tin học', 'mos', 'ic3', 'cntt', 'cơ bản', 'nâng cao')):
        return 'Tin học'
    if any(k in t for k in ('điểm', 'tra cứu điểm', 'xem điểm', 'kết quả thi')):
        return 'Tra cứu điểm'
    if any(k in t for k in ('lịch thi', 'ngày thi', 'ca thi', 'giờ thi')):
        return 'Lịch thi'
    return 'Khác'

def excerpt_text(value: str = '', limit: int = 100) -> str:
    text = ' '.join(str(value or '').split())
    if len(text) <= limit:
        return text
    return text[:limit].rstrip() + '...'

def source_topic(value) -> str:
    if not value:
        return 'Chưa xác định'
    if isinstance(value, (list, tuple)):
        return str(value[0]).strip() if value else 'Chưa xác định'
    text = str(value).strip()
    try:
        parsed = json.loads(text)
    except (TypeError, ValueError, json.JSONDecodeError):
        parsed = None
    if isinstance(parsed, list) and parsed:
        return str(parsed[0]).strip() or 'Chưa xác định'
    return text or 'Chưa xác định'

def build_alert_description(alert_type: str, last_cust_text: str = '', last_ai_text: str = '') -> str:
    customer_text = excerpt_text(last_cust_text, 100)
    ai_text = excerpt_text(last_ai_text, 100)

    if alert_type == 'overtime':
        if customer_text:
            return f'Tin nhắn khách cuối: "{customer_text}"'
        return 'Nội dung tin nhắn khách cuối đang trống trong database.'

    if alert_type == 'ai_no_data':
        if customer_text and ai_text:
            return f'Tin nhắn khách: "{customer_text}" — Phản hồi AI: "{ai_text}"'
        if customer_text:
            return f'Tin nhắn khách: "{customer_text}" — phản hồi AI khớp dấu hiệu không tìm thấy dữ liệu.'
        if ai_text:
            return f'Phản hồi AI khớp dấu hiệu không tìm thấy dữ liệu: "{ai_text}"'
        return 'Nội dung tin nhắn khách và phản hồi AI đang trống trong database.'

    if alert_type == 'ai_uncertain':
        if customer_text and ai_text:
            return f'Tin nhắn khách: "{customer_text}" — Phản hồi AI: "{ai_text}"'
        if customer_text:
            return f'Tin nhắn khách: "{customer_text}" — phản hồi AI khớp dấu hiệu không chắc chắn.'
        if ai_text:
            return f'Phản hồi AI khớp dấu hiệu không chắc chắn: "{ai_text}"'
        return 'Nội dung tin nhắn khách và phản hồi AI đang trống trong database.'

    return 'Không có nội dung cảnh báo trong database.'


def strip_vietnamese_marks(value: str = "") -> str:
    normalized = unicodedata.normalize("NFD", str(value or ""))
    without_marks = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    return without_marks.replace("đ", "d").replace("Đ", "D")


def clean_question_text(value: str = "") -> str:
    text = unicodedata.normalize("NFC", str(value or ""))
    text = re.sub(r"https?://\S+|www\.\S+", " ", text, flags=re.IGNORECASE)
    kept_chars = []
    for char in text:
        if char.isalnum() or char.isspace() or char in "?.!,;:/-()[]":
            kept_chars.append(char)
        else:
            kept_chars.append(" ")
    text = "".join(kept_chars)
    text = re.sub(r"\s+", " ", text).strip(" \t\r\n-_:;,.")
    return text


def question_identity_key(value: str = "") -> str:
    text = strip_vietnamese_marks(clean_question_text(value)).lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def is_customer_question(value: str = "") -> bool:
    text = clean_question_text(value)
    if len(text) < 6:
        return False

    normalized = strip_vietnamese_marks(text).lower()
    normalized_plain = re.sub(r"[^a-z0-9\s]", " ", normalized)
    normalized_plain = re.sub(r"\s+", " ", normalized_plain).strip()
    announcement_cues = (
        "nhac lai",
        "thong bao",
        "ngay mai",
        "buoi hoc",
        "e learning",
        "link hoc",
        "lich hoc phu dao",
        "tai khoan e learning",
    )
    if (normalized_plain.startswith("all ") or any(cue in normalized_plain for cue in announcement_cues)) and "?" not in text:
        return False

    if normalized_plain in {"da", "da khong", "khong", "vang", "ok", "okay", "cam on", "cảm ơn"}:
        return False

    meaningful_tokens = [
        token
        for token in re.findall(r"[a-z0-9]+", normalized_plain)
        if len(token) > 1 and token not in QUESTION_STOPWORDS
    ]
    if not meaningful_tokens:
        return False
    if len(meaningful_tokens) == 1 and meaningful_tokens[0] in {"sao", "nao"}:
        return False

    question_cues = (
        "?",
        "bao nhieu",
        "khi nao",
        "luc nao",
        "o dau",
        "dia chi",
        "lam sao",
        "nhu the nao",
        "the nao",
        "co duoc khong",
        "duoc khong",
        "khong a",
        "khong vay",
        "can gi",
        "phai lam gi",
        "dang ky",
        "hoc phi",
        "le phi",
        "lich thi",
        "ket qua",
        "tra cuu",
    )
    return any(cue in normalized for cue in question_cues)


def detect_question_course(normalized_text: str = "") -> str:
    if "toeic" in normalized_text:
        return "TOEIC"
    if "vstep" in normalized_text:
        return "VSTEP"
    if any(token in normalized_text for token in ("tin hoc", "cntt", "mos", "ic3")):
        return "Tin học"
    return ""


def with_course(base: str, course: str = "") -> str:
    return base.format(course=f" {course}" if course else "")


def clean_local_representative_question(value: str = "") -> str:
    text = clean_question_text(value)
    text = re.sub(
        r"^(dạ|da|ad|admin|cho em hỏi là|cho em hỏi|em hỏi|mình hỏi|cho mình hỏi|anh chị cho em hỏi)\s+",
        "",
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(r"\s+(ạ|a|nha|nhé|nhe|vậy ạ|vay a)\s*$", "", text, flags=re.IGNORECASE)
    text = text.strip(" \t\r\n-_:;,.?")
    if not text:
        return ""
    text = text[:1].upper() + text[1:]
    return f"{text}?"


def build_local_representative_question(representative: str, related_questions) -> str:
    examples = [representative, *(item.get("question") or "" for item in related_questions[:5])]
    corpus = " ".join(clean_question_text(item) for item in examples)
    normalized = strip_vietnamese_marks(corpus).lower()
    course = detect_question_course(normalized)

    if any(token in normalized for token in ("hoc phi", "le phi", "chi phi", "gia khoa hoc")):
        return with_course("Học phí và chi phí khóa học{course} là bao nhiêu?", course)
    if any(token in normalized for token in ("lich thi", "ngay thi", "ca thi", "gio thi")):
        return with_course("Lịch thi{course} là khi nào?", course)
    if any(token in normalized for token in ("chung chi", "chung nhan", "bang")):
        return with_course("Khi nào có chứng chỉ{course}?", course)
    if "phieu diem" in normalized:
        return with_course("Làm sao nhận phiếu điểm{course}?", course)
    if any(token in normalized for token in ("tra cuu diem", "xem diem", "ket qua thi")):
        return with_course("Cách tra cứu điểm và kết quả thi{course} như thế nào?", course)
    if any(token in normalized for token in ("dang ky", "ghi danh")):
        return with_course("Cách đăng ký khóa học{course} như thế nào?", course)
    if any(token in normalized for token in ("dia chi", "o dau", "trung tam")):
        return "Trung tâm ở đâu?"

    return clean_local_representative_question(representative)


def merge_top_question_rows(rows):
    merged = {}
    for row in rows:
        key = question_identity_key(row.get("question"))
        if not key:
            continue

        existing = merged.get(key)
        if not existing:
            merged[key] = {
                **row,
                "relatedQuestions": list(row.get("relatedQuestions") or []),
            }
            continue

        existing["count"] += row.get("count") or 0
        existing["aiGenerated"] = bool(existing.get("aiGenerated") and row.get("aiGenerated"))
        if not existing.get("channel") and row.get("channel"):
            existing["channel"] = row.get("channel")
        if not existing.get("raw_source") and row.get("raw_source"):
            existing["raw_source"] = row.get("raw_source")

        related_counts = Counter()
        for related in existing.get("relatedQuestions") or []:
            related_counts[related.get("question")] += related.get("count") or 0
        for related in row.get("relatedQuestions") or []:
            related_counts[related.get("question")] += related.get("count") or 0
        existing["relatedQuestions"] = [
            {"question": question, "count": count}
            for question, count in related_counts.most_common()
            if question
        ]
        existing["sourceQuestionCount"] = len(existing["relatedQuestions"])

    return sorted(merged.values(), key=lambda row: (-row["count"], row["question"]))


def prepare_question_items(raw_rows):
    by_key = {}

    for row in raw_rows or []:
        question = clean_question_text(row.get("question"))
        if not is_customer_question(question):
            continue

        key = question_identity_key(question)
        if len(key) < 5:
            continue

        count = row.get("count") or 1
        try:
            count = max(int(count), 1)
        except (TypeError, ValueError):
            count = 1

        item = by_key.setdefault(
            key,
            {
                "id": "",
                "question": question,
                "count": 0,
                "sourceCounts": Counter(),
                "variantCounts": Counter(),
            },
        )
        item["count"] += count
        item["variantCounts"][question] += count
        item["sourceCounts"][normalize_source_key(row.get("source"))] += count

        if len(question) < len(item["question"]):
            item["question"] = question

    items = sorted(by_key.values(), key=lambda item: (-item["count"], item["question"]))
    for index, item in enumerate(items, start=1):
        item["id"] = f"q{index}"
        item["variants"] = [
            {"question": question, "count": count}
            for question, count in item["variantCounts"].most_common()
        ]
    return items


def question_tokens(value: str = ""):
    normalized = strip_vietnamese_marks(clean_question_text(value)).lower()
    tokens = re.findall(r"[a-z0-9]+", normalized)
    return {
        token
        for token in tokens
        if len(token) > 1 and token not in QUESTION_STOPWORDS
    }


def token_overlap_score(left, right) -> float:
    if not left or not right:
        return 0.0
    return len(left & right) / max(1, min(len(left), len(right)))


def build_local_question_groups(items):
    groups = []
    token_index = defaultdict(set)

    for item in items:
        tokens = question_tokens(item["question"])
        candidate_indexes = set()
        for token in tokens:
            candidate_indexes.update(token_index.get(token, set()))

        best_index = None
        best_score = 0.0
        for index in candidate_indexes:
            score = token_overlap_score(tokens, groups[index]["tokens"])
            if score > best_score:
                best_score = score
                best_index = index

        if best_index is None or best_score < LOCAL_GROUP_SIMILARITY_THRESHOLD:
            group = {
                "id": f"g{len(groups) + 1}",
                "question": item["question"],
                "count": item["count"],
                "itemIds": [item["id"]],
                "tokens": set(tokens),
                "variantCounts": Counter(),
                "bestCount": item["count"],
            }
            for variant in item.get("variants") or []:
                group["variantCounts"][variant["question"]] += variant["count"]
            groups.append(group)
            group_index = len(groups) - 1
            for token in tokens:
                token_index[token].add(group_index)
            continue

        group = groups[best_index]
        group["count"] += item["count"]
        group["itemIds"].append(item["id"])
        for variant in item.get("variants") or []:
            group["variantCounts"][variant["question"]] += variant["count"]

    groups = sorted(groups, key=lambda group: (-group["count"], group["question"]))
    for index, group in enumerate(groups, start=1):
        group["id"] = f"g{index}"
        group["examples"] = [
            question
            for question, _ in group["variantCounts"].most_common(4)
        ]
    return groups


def build_question_group_prompt(items):
    payload = [
        {
            "id": item["id"],
            "question": item["question"],
            "count": item["count"],
        }
        for item in items
    ]
    return (
        "Bạn là hệ thống phân tích câu hỏi khách hàng cho dashboard CSKH.\n"
        "Nhiệm vụ: nhóm các câu hỏi có cùng ý nghĩa hoặc liên quan chặt chẽ, "
        "rồi sinh một câu hỏi tổng quát đại diện bằng tiếng Việt tự nhiên.\n"
        "Quy tắc:\n"
        "- Không bịa thêm câu hỏi không có trong danh sách.\n"
        "- Mỗi id chỉ xuất hiện trong tối đa một nhóm.\n"
        "- Giữ ý nghĩa thực tế của dữ liệu, không hard-code chủ đề.\n"
        "- Câu hỏi đại diện phải bao quát toàn bộ itemIds trong nhóm, không chỉ lặp lại một câu hỏi con.\n"
        "- Loại khỏi nhóm các câu giống thông báo, nhắc lịch, broadcast, hoặc nội dung không phải câu hỏi khách hàng.\n"
        "- Ưu tiên gom theo ý định khách hỏi: học phí/chi phí, lịch thi, chứng chỉ, đăng ký, phiếu điểm, địa điểm.\n"
        "- Nếu câu hỏi con khác cách diễn đạt nhưng cùng ý định, hãy gom lại và đặt câu hỏi chung ngắn gọn.\n"
        "- Trả về JSON thuần theo dạng {\"groups\":[{\"question\":\"...\",\"itemIds\":[\"q1\"]}]}.\n"
        "- Không trả markdown, không giải thích.\n\n"
        f"Dữ liệu câu hỏi đã được làm sạch và đếm số lần xuất hiện:\n{json.dumps(payload, ensure_ascii=False)}"
    )


def build_candidate_group_prompt(candidate_groups):
    payload = [
        {
            "id": group["id"],
            "question": group["question"],
            "count": group["count"],
            "examples": group.get("examples", [])[:4],
        }
        for group in candidate_groups
    ]
    return (
        "Bạn là hệ thống phân tích câu hỏi khách hàng cho dashboard CSKH.\n"
        "Dưới đây là các cụm ứng viên đã được gom sơ bộ từ toàn bộ database. "
        "Hãy gộp các cụm có cùng ý nghĩa hoặc liên quan chặt chẽ, rồi sinh một câu hỏi tổng quát đại diện.\n"
        "Quy tắc:\n"
        "- Chỉ dùng id có trong danh sách, không bịa dữ liệu ngoài database.\n"
        "- Mỗi id chỉ xuất hiện trong tối đa một nhóm.\n"
        "- Ưu tiên các nhóm có count cao để Dashboard có đủ dữ liệu nổi bật cho hiển thị và tìm kiếm.\n"
        "- Câu hỏi đại diện phải bao quát toàn bộ cụm ứng viên được gom, không chọn nguyên văn một ví dụ quá hẹp.\n"
        "- Không đưa thông báo/broadcast/nhắc lịch vào câu hỏi nổi bật nếu chúng không phải câu hỏi khách hàng.\n"
        "- Câu hỏi đầu ra phải ngắn, tự nhiên, có dấu hỏi, phù hợp để đưa vào FAQ.\n"
        "- Trả về JSON thuần theo dạng {\"groups\":[{\"question\":\"...\",\"itemIds\":[\"g1\"]}]}.\n"
        "- Không trả markdown, không giải thích.\n\n"
        f"Các cụm ứng viên:\n{json.dumps(payload, ensure_ascii=False)}"
    )


def select_ai_candidate_groups(local_groups):
    max_count = min(AI_CANDIDATE_GROUP_LIMIT, len(local_groups))
    if max_count <= 0:
        return []

    selected_count = max_count
    while selected_count > AI_CANDIDATE_MIN_GROUPS:
        prompt = build_candidate_group_prompt(local_groups[:selected_count])
        if len(prompt) <= AI_CANDIDATE_PROMPT_CHAR_LIMIT:
            break
        selected_count -= 4
    return local_groups[:selected_count]


def select_ai_display_candidate_groups(local_groups):
    max_count = min(TOP_QUESTIONS_AI_CANDIDATE_LIMIT, len(local_groups))
    if max_count <= 0:
        return []

    selected_count = max_count
    while selected_count > TOP_QUESTIONS_DISPLAY_LIMIT:
        prompt = build_candidate_group_prompt(local_groups[:selected_count])
        if len(prompt) <= AI_CANDIDATE_PROMPT_CHAR_LIMIT:
            break
        selected_count -= 2
    return local_groups[:selected_count]


def extract_json_payload(text: str):
    raw = str(text or "").strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?", "", raw, flags=re.IGNORECASE).strip()
        raw = re.sub(r"```$", "", raw).strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}")
        if start >= 0 and end > start:
            return json.loads(raw[start:end + 1])
        raise


def parse_ai_question_groups(text: str, allowed_ids):
    payload = extract_json_payload(text)
    allowed = set(allowed_ids)
    used = set()
    groups = []

    for group in payload.get("groups") or []:
        representative = clean_question_text(group.get("question"))
        item_ids = []
        for item_id in group.get("itemIds") or []:
            item_id = str(item_id)
            if item_id in allowed and item_id not in used:
                item_ids.append(item_id)
                used.add(item_id)
        if representative and item_ids:
            groups.append({"question": representative, "itemIds": item_ids})

    for missing_id in allowed - used:
        groups.append({"question": "", "itemIds": [missing_id]})

    if not groups:
        raise QuestionGroupingAIError("AI returned no usable question groups.")
    return groups


def clean_provider_key(value: str = "") -> str:
    return str(value or "").strip().strip('"').strip("'")


def extract_gemini_text(payload):
    parts = (
        ((payload.get("candidates") or [{}])[0].get("content") or {}).get("parts")
        or []
    )
    return "\n".join(str(part.get("text") or "") for part in parts if part.get("text")).strip()


def extract_openai_text(payload):
    if payload.get("output_text"):
        return str(payload["output_text"]).strip()

    chunks = []
    for output_item in payload.get("output") or []:
        for content in output_item.get("content") or []:
            if content.get("type") in {"output_text", "text"} and content.get("text"):
                chunks.append(str(content["text"]))
    return "\n".join(chunks).strip()


def request_gemini_question_groups(prompt: str, timeout_seconds: float) -> str:
    settings = get_settings()
    api_keys = settings.gemini_api_key_list
    if not api_keys:
        raise QuestionGroupingAIError("Gemini API key is not configured.")

    last_error = None
    deadline = time.time() + min(timeout_seconds, GEMINI_PROVIDER_BUDGET_SECONDS)
    with httpx.Client() as client:
        for model in GEMINI_QUESTION_MODELS:
            for api_key in api_keys:
                remaining = deadline - time.time()
                if remaining <= 0:
                    raise QuestionGroupingAIError(
                        str(last_error) if last_error else "Gemini provider budget exceeded."
                    )
                request_timeout = min(remaining, GEMINI_REQUEST_TIMEOUT_SECONDS)
                try:
                    response = client.post(
                        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                        headers={
                            "Content-Type": "application/json",
                            "x-goog-api-key": api_key,
                        },
                        json={
                            "contents": [{"parts": [{"text": prompt}]}],
                            "generationConfig": {
                                "temperature": 0.1,
                                "responseMimeType": "application/json",
                            },
                        },
                        timeout=request_timeout,
                    )
                    response.raise_for_status()
                    text = extract_gemini_text(response.json())
                    if text:
                        logger.info("Dashboard question grouping used Gemini model %s.", model)
                        return text
                    raise QuestionGroupingAIError("Gemini returned an empty response.")
                except Exception as exc:
                    last_error = exc
                    logger.warning("Gemini question grouping failed on %s: %s", model, exc)

    raise QuestionGroupingAIError(str(last_error) if last_error else "Gemini failed.")


def request_openai_question_groups(prompt: str, timeout_seconds: float) -> str:
    settings = get_settings()
    api_keys = [clean_provider_key(key) for key in settings.openai_api_key_list]
    api_keys = [key for key in api_keys if key]
    if not api_keys:
        raise QuestionGroupingAIError("OpenAI API key is not configured.")

    last_error = None
    deadline = time.time() + min(timeout_seconds, OPENAI_PROVIDER_BUDGET_SECONDS)
    with httpx.Client() as client:
        for model in OPENAI_QUESTION_MODELS:
            for api_key in api_keys:
                remaining = deadline - time.time()
                if remaining <= 0:
                    raise QuestionGroupingAIError(
                        str(last_error) if last_error else "OpenAI provider budget exceeded."
                    )
                request_timeout = min(remaining, OPENAI_REQUEST_TIMEOUT_SECONDS)
                try:
                    response = client.post(
                        "https://api.openai.com/v1/responses",
                        headers={
                            "Authorization": f"Bearer {api_key}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": model,
                            "store": False,
                            "input": [
                                {
                                    "role": "developer",
                                    "content": "Bạn chỉ trả về JSON hợp lệ theo schema đã yêu cầu.",
                                },
                                {"role": "user", "content": prompt},
                            ],
                            "text": {
                                "format": {
                                    "type": "json_schema",
                                    "name": "dashboard_question_groups",
                                    "schema": QUESTION_GROUP_SCHEMA,
                                    "strict": True,
                                }
                            },
                        },
                        timeout=request_timeout,
                    )
                    response.raise_for_status()
                    text = extract_openai_text(response.json())
                    if text:
                        logger.info("Dashboard question grouping used OpenAI model %s.", model)
                        return text
                    raise QuestionGroupingAIError("OpenAI returned an empty response.")
                except Exception as exc:
                    last_error = exc
                    logger.warning("OpenAI question grouping failed on %s: %s", model, exc)

    raise QuestionGroupingAIError(str(last_error) if last_error else "OpenAI failed.")


def request_ai_question_groups(prompt: str) -> str:
    timeout_seconds = get_settings().ai_question_timeout_seconds
    errors = []
    for provider_request in (request_gemini_question_groups, request_openai_question_groups):
        try:
            return provider_request(prompt, timeout_seconds)
        except Exception as exc:
            errors.append(str(exc))
    raise QuestionGroupingAIError("; ".join(errors) or "All AI providers failed.")


def cluster_question_items_once(items):
    prompt = build_question_group_prompt(items)
    text = request_ai_question_groups(prompt)
    return parse_ai_question_groups(text, [item["id"] for item in items])


def cluster_candidate_groups_once(candidate_groups):
    prompt = build_candidate_group_prompt(candidate_groups)
    text = request_ai_question_groups(prompt)
    return parse_ai_question_groups(text, [group["id"] for group in candidate_groups])


def cluster_question_items(items):
    if not items:
        return []

    if len(items) <= QUESTION_CLUSTER_CHUNK_SIZE:
        return cluster_question_items_once(items)

    local_groups = build_local_question_groups(items)
    candidate_groups = select_ai_candidate_groups(local_groups)
    if not candidate_groups:
        return []

    merged_groups = cluster_candidate_groups_once(candidate_groups)
    flattened_groups = []
    candidate_by_id = {group["id"]: group for group in candidate_groups}
    merged_candidate_ids = set()

    for merged in merged_groups:
        item_ids = []
        for group_id in merged.get("itemIds") or []:
            candidate = candidate_by_id.get(group_id)
            if not candidate:
                continue
            merged_candidate_ids.add(group_id)
            item_ids.extend(candidate.get("itemIds") or [])
        if item_ids:
            flattened_groups.append({"question": merged["question"], "itemIds": item_ids})

    for group in local_groups:
        if group["id"] in merged_candidate_ids:
            continue
        flattened_groups.append({"question": group["question"], "itemIds": group["itemIds"]})

    return flattened_groups


def build_top_question_rows_from_groups(
    items,
    groups,
    ai_generated=True,
    limit=TOP_QUESTIONS_RESPONSE_LIMIT,
):
    item_by_id = {item["id"]: item for item in items}
    rows = []
    for group in groups:
        related_counts = Counter()
        source_counts = Counter()
        total_count = 0
        representative = clean_question_text(group.get("question"))

        for item_id in group.get("itemIds") or []:
            item = item_by_id.get(item_id)
            if not item:
                continue
            total_count += item["count"]
            source_counts.update(item["sourceCounts"])
            for variant in item.get("variants") or []:
                related_counts[variant["question"]] += variant["count"]
            if not representative:
                representative = item["question"]

        if not representative or total_count <= 0:
            continue

        related_questions = [
            {"question": question, "count": count}
            for question, count in related_counts.most_common()
        ]
        if not ai_generated:
            representative = build_local_representative_question(representative, related_questions)
            if not representative:
                continue

        dominant_source = (source_counts.most_common(1)[0][0] if source_counts else "")
        rows.append({
            "question": representative,
            "topic": classify_topic(" ".join([representative, *(q["question"] for q in related_questions[:5])]), representative),
            "count": total_count,
            "channel": format_channel(dominant_source),
            "trend": -15 + (hash_str(representative) % 45),
            "raw_source": dominant_source,
            "relatedQuestions": related_questions,
            "sourceQuestionCount": len(related_questions),
            "aiGenerated": ai_generated,
        })

    return merge_top_question_rows(rows)[:limit]


def build_fallback_top_question_rows(items, limit=TOP_QUESTIONS_RESPONSE_LIMIT):
    local_groups = build_local_question_groups(items)
    return build_top_question_rows_from_groups(items, local_groups, ai_generated=False, limit=limit)


def build_ai_display_top_question_rows(items):
    local_groups = build_local_question_groups(items)
    candidate_groups = select_ai_display_candidate_groups(local_groups)
    if not candidate_groups:
        return []

    merged_groups = cluster_candidate_groups_once(candidate_groups)
    candidate_by_id = {group["id"]: group for group in candidate_groups}
    flattened_groups = []

    for merged in merged_groups:
        item_ids = []
        for group_id in merged.get("itemIds") or []:
            candidate = candidate_by_id.get(group_id)
            if not candidate:
                continue
            item_ids.extend(candidate.get("itemIds") or [])
        if item_ids:
            flattened_groups.append({"question": merged["question"], "itemIds": item_ids})

    return build_top_question_rows_from_groups(
        items,
        flattened_groups,
        ai_generated=True,
        limit=TOP_QUESTIONS_DISPLAY_LIMIT,
    )


def related_question_identity_keys(row):
    keys = set()
    for related in row.get("relatedQuestions") or []:
        key = question_identity_key(related.get("question"))
        if key:
            keys.add(key)
    return keys


def combine_ai_display_and_local_search_rows(display_rows, local_rows):
    combined = []
    seen_questions = set()
    ai_related_questions = set()

    for row in display_rows or []:
        key = question_identity_key(row.get("question"))
        if not key or key in seen_questions:
            continue
        combined.append(row)
        seen_questions.add(key)
        ai_related_questions.update(related_question_identity_keys(row))

    for row in local_rows or []:
        key = question_identity_key(row.get("question"))
        related_keys = related_question_identity_keys(row)
        if not key or key in seen_questions:
            continue
        if related_keys and related_keys & ai_related_questions:
            continue
        combined.append(row)
        seen_questions.add(key)
        if len(combined) >= TOP_QUESTIONS_RESPONSE_LIMIT:
            break

    return combined[:TOP_QUESTIONS_RESPONSE_LIMIT]


def build_top_question_rows(raw_rows):
    raw_rows = list(raw_rows or [])
    if len(raw_rows) > QUESTION_RAW_ROW_LIMIT:
        logger.info(
            "Dashboard question grouping limited to top %s/%s raw question rows for fast load.",
            QUESTION_RAW_ROW_LIMIT,
            len(raw_rows),
        )
        raw_rows = raw_rows[:QUESTION_RAW_ROW_LIMIT]
    items = prepare_question_items(raw_rows)
    if not items:
        return [], "ok", ""
    if len(items) > QUESTION_ANALYSIS_ITEM_LIMIT:
        logger.info(
            "Dashboard question grouping limited to top %s/%s preprocessed question items for fast load.",
            QUESTION_ANALYSIS_ITEM_LIMIT,
            len(items),
        )
        items = items[:QUESTION_ANALYSIS_ITEM_LIMIT]

    local_rows = build_fallback_top_question_rows(items)

    try:
        ai_display_rows = build_ai_display_top_question_rows(items)
    except Exception as exc:
        logger.exception("Dashboard AI question grouping failed: %s", exc)
        if local_rows:
            logger.info(
                "Dashboard question grouping used database fallback with %s rows while AI is unavailable.",
                len(local_rows),
            )
            return local_rows, "fallback", AI_FALLBACK_MESSAGE
        return [], "ai_overloaded", AI_OVERLOAD_MESSAGE

    if ai_display_rows:
        return combine_ai_display_and_local_search_rows(ai_display_rows, local_rows), "ok", ""

    if local_rows:
        logger.info(
            "Dashboard question grouping used database fallback because AI returned no display rows."
        )
        return local_rows, "fallback", AI_FALLBACK_MESSAGE
    return [], "ai_overloaded", AI_OVERLOAD_MESSAGE

class DashboardService:
    def __init__(self):
        self.repository = ConversationRepository()

    def _cached_repo_call(self, cache_name, start_date, end_date, fn):
        cache_key = make_cache_key(cache_name, start_date, end_date, {})
        cached = get_cached_value(cache_key)
        if cached is not None:
            return cached
        result = fn()
        set_cached_value(cache_key, result)
        return result

    def _normalize_kpi_date_range(self, start_date=None, end_date=None):
        if start_date or end_date:
            return start_date, end_date

        today = datetime.now().date()
        start = today - timedelta(days=DEFAULT_KPI_DATE_WINDOW_DAYS)
        return start.strftime('%Y-%m-%d'), today.strftime('%Y-%m-%d')

    def _get_cached_top_question_rows(self, start_date=None, end_date=None, channel=None, force_refresh=False):
        top_questions_cache_key = make_cache_key(
            f'top_questions_ai:{channel or "all"}',
            start_date,
            end_date,
            {},
        )
        last_good_cache_key = make_cache_key(
            f'top_questions_ai_last_good:{channel or "all"}',
            start_date,
            end_date,
            {},
        )
        if not force_refresh:
            cached_top_questions = get_top_question_runtime_cache(top_questions_cache_key)
            if cached_top_questions is not None:
                return cached_top_questions

        raw_top_questions = self._cached_repo_call(
            f'top_questions_base:{channel or "all"}',
            start_date,
            end_date,
            lambda: self.repository.get_top_questions_data(start_date, end_date, channel),
        )
        top_questions = build_top_question_rows(raw_top_questions)
        if top_questions[1] == "ok" and _top_question_result_rows(top_questions):
            set_cached_value(top_questions_cache_key, top_questions)
            set_cached_value(last_good_cache_key, top_questions)
            set_persistent_last_good_value(last_good_cache_key, top_questions)
            return top_questions

        if top_questions[1] == "fallback" and _top_question_result_rows(top_questions):
            set_cached_value(top_questions_cache_key, top_questions)
            return top_questions

        last_good_top_questions = get_cached_value(
            last_good_cache_key,
            AI_QUESTION_LAST_GOOD_CACHE_TTL_SECONDS,
        ) or get_persistent_last_good_value(last_good_cache_key)
        if last_good_top_questions is not None:
            rows, _status, _message = last_good_top_questions
            stale_result = (
                rows,
                "stale",
                "Đang hiển thị kết quả AI gần nhất do hệ thống AI hiện đang quá tải.",
            )
            set_cached_value(top_questions_cache_key, stale_result)
            set_cached_value(last_good_cache_key, last_good_top_questions)
            return stale_result

        return top_questions

    def _get_fast_kpis(self, start_date=None, end_date=None, filters=None, force_refresh=False):
        if filters is None:
            filters = {}

        channel = filters.get('channel')
        topic = filters.get('topic')
        conversation_status = filters.get('conversationStatus')
        ai_status = filters.get('aiStatus')
        source_filter = channel_to_source_key(channel)

        query_tasks = {
            'summary': lambda: self.repository.get_conversation_summary(start_date, end_date, channel, conversation_status, topic, ai_status),
            'message_counts': lambda: self.repository.get_message_counts_filtered(start_date, end_date, channel, conversation_status, topic, ai_status),
            'trends': lambda: self._cached_repo_call('trends_base', start_date, end_date, lambda: self.repository.get_trends(start_date, end_date)),
            'urgent_alerts': lambda: self._cached_repo_call('urgent_alerts_base', start_date, end_date, lambda: self.repository.get_urgent_alerts_data(start_date, end_date)),
            'overtime_alerts': lambda: self._cached_repo_call('urgent_overtime_all_fast', None, None, lambda: self.repository.get_overtime_alerts_data(None, None)),
            'top_questions': lambda: self._get_cached_top_question_rows(start_date, end_date, channel, force_refresh),
            'priority_conversations': lambda: self.repository.get_priority_conversations_data(start_date, end_date, channel, conversation_status, topic, ai_status),
            'daily_conversations': lambda: self.repository.get_daily_conversation_summary(start_date, end_date, channel, conversation_status, topic, ai_status),
            'ai_daily_stats': lambda: self.repository.get_ai_daily_stats(start_date, end_date, channel, conversation_status, topic, ai_status),
        }

        with ThreadPoolExecutor(max_workers=DASHBOARD_QUERY_WORKERS) as executor:
            futures = {name: executor.submit(fn) for name, fn in query_tasks.items()}
            query_results = {name: future.result() for name, future in futures.items()}

        summary = query_results.get('summary') or {}
        raw_message_counts = query_results.get('message_counts') or []
        trends = query_results.get('trends') or {}
        raw_urgent_alerts = query_results.get('urgent_alerts') or []
        raw_overtime_alerts = query_results.get('overtime_alerts') or []
        raw_priority_conversations = query_results.get('priority_conversations') or []
        daily_conversations = query_results.get('daily_conversations') or []
        ai_daily_stats = query_results.get('ai_daily_stats') or []
        ai_failures = sum(row.get('ai_fail') or 0 for row in ai_daily_stats)

        alert_keys = {(row.get('id'), normalize_source_key(row.get('source'))) for row in raw_urgent_alerts}
        for row in raw_overtime_alerts:
            key = (row.get('id'), normalize_source_key(row.get('source')))
            if row.get('alert_type') == 'overtime' and key not in alert_keys:
                raw_urgent_alerts.append(row)
                alert_keys.add(key)

        message_summary = {
            "ZaloOA": 0,
            "ZaloBusiness": 0,
            "Facebook": 0,
            "ChatWidget": 0,
            "other": 0
        }

        overall_min_date = None
        overall_max_date = None

        for item in raw_message_counts:
            source = normalize_source_key(item.get('source'))
            if source_filter and source != source_filter:
                continue

            if source in message_summary:
                message_summary[source] += item.get('count', 0)
            else:
                message_summary['other'] += item.get('count', 0)

            min_d_raw = item.get('min_date')
            if min_d_raw:
                try:
                    d = min_d_raw if isinstance(min_d_raw, datetime) else datetime.fromisoformat(str(min_d_raw).replace('Z', '+00:00'))
                    if not overall_min_date or d < overall_min_date:
                        overall_min_date = d
                except Exception:
                    pass

            max_d_raw = item.get('max_date')
            if max_d_raw:
                try:
                    d = max_d_raw if isinstance(max_d_raw, datetime) else datetime.fromisoformat(str(max_d_raw).replace('Z', '+00:00'))
                    if not overall_max_date or d > overall_max_date:
                        overall_max_date = d
                except Exception:
                    pass

        total_messages = sum(message_summary.values())
        if not overall_min_date and start_date:
            try:
                overall_min_date = datetime.strptime(start_date, '%Y-%m-%d')
            except Exception:
                pass
        if not overall_max_date and end_date:
            try:
                overall_max_date = datetime.strptime(end_date, '%Y-%m-%d')
            except Exception:
                pass

        def format_date(dt):
            if not dt:
                return ''
            return dt.strftime('%d/%m/%Y')

        date_range = {
            "startDate": format_date(overall_min_date),
            "endDate": format_date(overall_max_date)
        }

        total_conversations = summary.get('totalConversations') or 0
        source_summary = summary.get('sourceSummary') or {
            "ZaloOA": 0,
            "ZaloBusiness": 0,
            "Facebook": 0,
            "ChatWidget": 0
        }

        filtered_ai_failures = ai_failures

        urgent_alerts = []
        for row in raw_urgent_alerts:
            last_cust_text = row.get('last_cust_text') or ''
            last_ai_text = row.get('last_ai_text') or ''
            alert_type = row.get('alert_type') or 'none'
            wait_mins = row.get('wait_mins') or 0

            if alert_type == 'none':
                continue

            alert_topic = source_topic(row.get('detected_topics'))
            alert_channel = format_channel(row.get('source'))
            customer = customer_display_name(row.get('customer_name'), row.get('customer_id'))

            if alert_type == 'overtime':
                urgent_alerts.append({
                    "id": row.get('id'),
                    "conversationId": row.get('conversation_id') or row.get('id'),
                    "type": "overtime",
                    "priority": "Ưu tiên cao",
                    "title": "Hội thoại chờ quá 10 giờ",
                    "customer": customer,
                    "channel": alert_channel,
                    "topic": alert_topic,
                    "waitTime": format_wait_time(wait_mins),
                    "desc": build_alert_description(alert_type, last_cust_text, last_ai_text),
                    "raw_source": normalize_source_key(row.get('source')),
                    "raw_status": 'pending',
                    "raw_ai_status": 'Chưa có phản hồi'
                })
            elif alert_type == 'ai_no_data':
                urgent_alerts.append({
                    "id": row.get('id'),
                    "conversationId": row.get('conversation_id'),
                    "type": "ai_no_data",
                    "priority": "Ưu tiên cao",
                    "title": "AI không tìm thấy dữ liệu",
                    "customer": customer,
                    "channel": alert_channel,
                    "topic": alert_topic,
                    "waitTime": format_wait_time(wait_mins),
                    "desc": build_alert_description(alert_type, last_cust_text, last_ai_text),
                    "raw_source": normalize_source_key(row.get('source')),
                    "raw_status": 'open',
                    "raw_ai_status": 'Không tìm thấy dữ liệu'
                })
            elif alert_type == 'ai_uncertain':
                urgent_alerts.append({
                    "id": row.get('id'),
                    "conversationId": row.get('conversation_id'),
                    "type": "ai_uncertain",
                    "priority": "Ưu tiên cao",
                    "title": "AI không chắc chắn",
                    "customer": customer,
                    "channel": alert_channel,
                    "topic": alert_topic,
                    "waitTime": format_wait_time(wait_mins),
                    "desc": build_alert_description(alert_type, last_cust_text, last_ai_text),
                    "raw_source": normalize_source_key(row.get('source')),
                    "raw_status": 'open',
                    "raw_ai_status": 'AI trả lời không chắc chắn'
                })

        if source_filter:
            urgent_alerts = [a for a in urgent_alerts if a['raw_source'] == source_filter]

        if conversation_status and conversation_status != 'Tất cả':
            status_filter = {
                'Chờ xử lý': 'pending',
                'Đang xử lý': 'open',
                'Hoàn thành': 'closed',
            }.get(conversation_status)
            if status_filter:
                urgent_alerts = [a for a in urgent_alerts if a['raw_status'] == status_filter]

        top_questions_mapped, top_questions_status, top_questions_message = (
            query_results.get('top_questions') or ([], "ok", "")
        )
        if topic and topic != 'Tất cả':
            top_questions_mapped = [q for q in top_questions_mapped if q['topic'] == topic]

        priority_conversations_mapped = []
        for row in raw_priority_conversations:
            wait_mins = row.get('wait_mins') or 0
            is_overtime = wait_mins > 600
            priority = 'Ưu tiên thấp'
            if wait_mins > 600:
                priority = 'Ưu tiên cao'
            elif wait_mins > 120:
                priority = 'Ưu tiên trung bình'

            status_text = 'Đang xử lý' if row.get('status') == 'open' else 'Chờ xử lý'
            customer = customer_display_name(
                row.get('customer_name'),
                row.get('customer_id'),
                row.get('phone_number'),
            )
            priority_conversations_mapped.append({
                "id": f"HT-{row.get('id')}",
                "conversationId": row.get('id'),
                "customerId": row.get('customer_id'),
                "source": normalize_source_key(row.get('source')),
                "customerName": row.get('customer_name'),
                "phoneNumber": row.get('phone_number'),
                "customerDisplayName": customer,
                "customer": customer,
                "channel": format_channel(row.get('source')),
                "topic": 'Khác',
                "wait": format_wait_time(wait_mins),
                "status": status_text,
                "priority": priority,
                "isOvertime": is_overtime
            })

        start_d = None
        end_d = None
        if start_date:
            try:
                start_d = datetime.strptime(start_date, '%Y-%m-%d')
            except Exception:
                pass
        if end_date:
            try:
                end_d = datetime.strptime(end_date, '%Y-%m-%d')
            except Exception:
                pass
        if not start_d:
            start_d = datetime.now()
        if not end_d:
            end_d = datetime.now()

        daily_map = {}
        current_date = start_d
        days_count = 0
        while current_date <= end_d and days_count < 366:
            date_str = current_date.strftime('%Y-%m-%d')
            daily_map[date_str] = {
                "date": f"{current_date.day}/{current_date.month}",
                "total": 0,
                "processed": 0,
                "unprocessed": 0,
                "ai_ok": 0,
                "ai_fail": 0
            }
            current_date += timedelta(days=1)
            days_count += 1

        for row in daily_conversations:
            date_str = row.get('date_str')
            if date_str not in daily_map:
                continue
            daily_map[date_str]['total'] = row.get('total') or 0
            daily_map[date_str]['processed'] = row.get('processed') or 0
            daily_map[date_str]['unprocessed'] = row.get('unprocessed') or 0

        for row in ai_daily_stats:
            date_str = row.get('date_str')
            if date_str not in daily_map:
                continue
            daily_map[date_str]['ai_ok'] = row.get('ai_ok') or 0
            daily_map[date_str]['ai_fail'] = row.get('ai_fail') or 0

        daily_trends = trim_trailing_zero_rows(
            [daily_map[k] for k in sorted(daily_map.keys())],
            ("total", "processed", "unprocessed", "ai_ok", "ai_fail"),
        )

        return {
            "totalConversations": total_conversations,
            "totalMessages": total_messages,
            "newCustomers": summary.get('newCustomers') or 0,
            "aiFailures": filtered_ai_failures,
            "statusSummary": summary.get('statusSummary') or {
                "new": 0,
                "open": 0,
                "pending": 0,
                "closed": 0,
                "unknown": 0
            },
            "sourceSummary": source_summary,
            "messageSummary": message_summary,
            "dateRange": date_range,
            "trends": trends,
            "averageResponseTimeMinutes": summary.get('averageResponseTimeMinutes') or 0,
            "urgentAlerts": urgent_alerts,
            "topQuestions": top_questions_mapped[:TOP_QUESTIONS_RESPONSE_LIMIT],
            "topQuestionsStatus": top_questions_status,
            "topQuestionsMessage": top_questions_message,
            "priorityConversations": priority_conversations_mapped[:10],
            "dailyTrends": daily_trends,
        }

    def get_kpis(self, start_date=None, end_date=None, filters=None):
        if filters is None:
            filters = {}
        filters = dict(filters)
        force_refresh = bool(filters.pop('forceRefresh', False))

        original_start_date = start_date
        original_end_date = end_date
        start_date, end_date = self._normalize_kpi_date_range(start_date, end_date)
        if not original_start_date and not original_end_date:
            logger.info(
                "Dashboard KPI request used default date window",
                extra={"start_date": start_date, "end_date": end_date},
            )

        cache_key = make_cache_key('kpis', start_date, end_date, filters)
        if not force_refresh:
            cached = get_cached_value(cache_key)
            if cached is not None:
                return cached

        channel = filters.get('channel')
        topic = filters.get('topic')
        conversation_status = filters.get('conversationStatus')
        ai_status = filters.get('aiStatus')

        result = self._get_fast_kpis(start_date, end_date, filters, force_refresh)
        set_cached_value(cache_key, result)
        return result
    def get_channel_analytics(self, start_date=None, end_date=None, filters=None):
        if filters is None:
            filters = {}

        cache_key = make_cache_key('channels', start_date, end_date, filters)
        cached = get_cached_value(cache_key)
        if cached is not None:
            return cached

        channel = filters.get('channel')
        topic = filters.get('topic')
        conversation_status = filters.get('conversationStatus')
        ai_status = filters.get('aiStatus')
        selected_source = channel_to_source_key(channel)

        with ThreadPoolExecutor(max_workers=4 if not selected_source else 3) as executor:
            source_totals_future = None
            if not selected_source:
                source_totals_future = executor.submit(
                    self.repository.get_conversation_summary,
                    start_date,
                    end_date,
                    channel,
                    conversation_status,
                    topic,
                    ai_status,
                )
            conversation_stats_future = executor.submit(
                self.repository.get_channel_conversation_stats,
                start_date,
                end_date,
                channel,
                conversation_status,
                topic,
                ai_status,
            )
            ai_summary_future = executor.submit(
                self.repository.get_channel_ai_summary,
                start_date,
                end_date,
                channel,
                conversation_status,
                topic,
                ai_status,
            )
            topic_stats_future = executor.submit(
                self.repository.get_channel_topic_stats,
                start_date,
                end_date,
                channel,
                conversation_status,
                topic,
                ai_status,
            )
            conversation_stats = conversation_stats_future.result() or []
            ai_summary = ai_summary_future.result() or []
            topic_stats = topic_stats_future.result() or []
            source_totals = source_totals_future.result() if source_totals_future else {}

        all_channel_defs = [
            ('Zalo Business', 'ZaloBusiness'),
            ('Facebook', 'Facebook'),
            ('Zalo OA', 'ZaloOA'),
            ('Chat Widget', 'ChatWidget'),
        ]
        visible_channel_defs = [item for item in all_channel_defs if not selected_source or item[1] == selected_source]
        channels_map = {
            channel_name: {
                'channel': channel_name, 'source': source, 'total': 0, 'unresolved': 0,
                'ai_ok': 0, 'ai_fail': 0, 'avg_time': 0, 'satisfaction': 100,
                'negative': 0, '_response_total': 0, '_response_count': 0
            }
            for channel_name, source in visible_channel_defs
        }

        from collections import defaultdict
        trend_map = defaultdict(lambda: {'date': ''})
        status_map = {
            channel_name: {'channel': channel_name, 'Chờ xử lý': 0, 'Đang xử lý': 0, 'Hoàn thành': 0}
            for channel_name, _source in visible_channel_defs
        }
        heatmap_map = defaultdict(lambda: 0)

        for row in conversation_stats:
            source_key = normalize_source_key(row.get('source'))
            c_name = format_channel(source_key)
            if c_name not in channels_map:
                continue

            total = row.get('total') or 0
            status = row.get('status')
            channels_map[c_name]['total'] += total
            if status in ('pending', 'open'):
                channels_map[c_name]['unresolved'] += total
            
            # Record average response time properly
            avg_response = row.get('avg_response_minutes')
            if avg_response is not None:
                channels_map[c_name]['_response_total'] += float(avg_response) * total
                channels_map[c_name]['_response_count'] += total
                
            date_str = row.get('date_str') or 'unknown'
            if not trend_map[date_str]['date']:
                trend_map[date_str]['date'] = date_str
            if c_name not in trend_map[date_str]:
                trend_map[date_str][c_name] = 0
            trend_map[date_str][c_name] += total

            if status == 'pending':
                status_map[c_name]['Chờ xử lý'] += total
            elif status == 'open':
                status_map[c_name]['Đang xử lý'] += total
            else:
                status_map[c_name]['Hoàn thành'] += total

        source_summary = source_totals.get('sourceSummary', {})
        unresolved_summary = source_totals.get('unresolvedSummary', {})
        for c_name in channels_map:
            source_key_for_map = {
                'Zalo OA': 'ZaloOA',
                'Zalo Business': 'ZaloBusiness',
                'Facebook': 'Facebook',
                'Chat Widget': 'ChatWidget'
            }.get(c_name)
            
            if source_key_for_map and not selected_source:
                # Use accurate de-duplicated totals from conversation summary.
                channels_map[c_name]['total'] = source_summary.get(source_key_for_map) or 0
                channels_map[c_name]['unresolved'] = unresolved_summary.get(source_key_for_map) or 0
                
                # Assign status map accurately based on the unresolved amount
                status_map[c_name]['Chờ xử lý'] = channels_map[c_name]['unresolved']
                status_map[c_name]['Hoàn thành'] = channels_map[c_name]['total'] - channels_map[c_name]['unresolved']

        for row in ai_summary:
            c_name = format_channel(row.get('source'))
            if c_name in channels_map:
                channels_map[c_name]['ai_ok'] += row.get('ai_ok') or 0
                channels_map[c_name]['ai_fail'] += row.get('ai_fail') or 0

        for row in topic_stats:
            source_key = normalize_source_key(row.get('source'))
            c_name = format_channel(source_key)
            if c_name not in channels_map:
                continue
            heatmap_map[(c_name, source_key, row.get('topic') or 'Khác')] += row.get('value') or 0

        for data in channels_map.values():
            if data['_response_count']:
                data['avg_time'] = round(data['_response_total'] / data['_response_count'], 1)
            del data['_response_total']
            del data['_response_count']

        trend_list = list(trend_map.values())
        status_list = list(status_map.values())
        heatmap_list = [{'channel': k[0], 'source': k[1], 'topic': k[2], 'value': v} for k, v in heatmap_map.items()]

        all_topics = list(set([k[2] for k in heatmap_map.keys()]))
        all_channels = list(channels_map.keys())

        result = {
            "channels": list(channels_map.values()),
            "trend": sorted(trend_list, key=lambda x: x['date']),
            "statusByChannel": status_list,
            "heatmap": heatmap_list,
            "topics": all_topics,
            "channelsList": all_channels,
            "dateRange": {
                "startDate": start_date or '',
                "endDate": end_date or '',
                "granularity": "day"
            }
        }
        set_cached_value(cache_key, result)
        return result

    def close_conversation(self, customer_id, source, user_name='Staff_Dashboard'):
        result = self.repository.close_conversation(customer_id, source, user_name)
        clear_dashboard_cache()
        return result

dashboard_service = DashboardService()
