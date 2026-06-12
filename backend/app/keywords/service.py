import unicodedata
import json
import time
from datetime import datetime, timedelta
from app.keywords.repository import keyword_repository

GROUP_META = {
    "toeic":      {"name": "TOEIC",                    "color": "#003865"},
    "vstep":      {"name": "VSTEP",                    "color": "#1565C0"},
    "tinhoc":     {"name": "Tin học / MOS / IC3",       "color": "#42A5F5"},
    "chuandaura": {"name": "Chuẩn đầu ra / Chứng chỉ", "color": "#0288D1"},
}

ORDERED_GROUP_IDS = ["toeic", "vstep", "tinhoc", "chuandaura"]
KEYWORD_CACHE_TTL_SECONDS = 180
_keyword_cache = {}


def make_cache_key(name: str, payload: dict) -> str:
    return f"{name}:{json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str)}"


def get_cached_value(key: str):
    item = _keyword_cache.get(key)
    if not item:
        return None

    saved_at, value = item
    if time.time() - saved_at > KEYWORD_CACHE_TTL_SECONDS:
        _keyword_cache.pop(key, None)
        return None

    return value


def set_cached_value(key: str, value):
    _keyword_cache[key] = (time.time(), value)


def clear_keyword_cache():
    _keyword_cache.clear()


def normalize_keyword_filter(value: str = "") -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFD", str(value))
    without_diacritics = "".join(c for c in normalized if unicodedata.category(c) != "Mn")
    return " ".join(without_diacritics.lower().strip().split())


def matches_topic_filter(topic: str, word: str) -> bool:
    normalized_topic = normalize_keyword_filter(topic)
    if not normalized_topic or normalized_topic == "tat ca":
        return True
    normalized_word = normalize_keyword_filter(word)
    if not normalized_word:
        return False
    return (
        normalized_word == normalized_topic or
        normalized_word.startswith(f"{normalized_topic} ") or
        normalized_word.endswith(f" {normalized_topic}") or
        f" {normalized_topic} " in normalized_word
    )


def matches_group_topic(topic: str, group: dict) -> bool:
    normalized_topic = normalize_keyword_filter(topic)
    if not normalized_topic or normalized_topic == "tat ca":
        return True

    group_name = GROUP_META.get(group.get("id"), {}).get("name", "")
    normalized_group_name = normalize_keyword_filter(group_name)
    topic_tokens = [t for t in normalized_topic.split() if t]
    name_token_coverage = sum(1 for token in topic_tokens if token in normalized_group_name)

    if (normalized_group_name == normalized_topic or
        normalized_topic in normalized_group_name or
        (len(topic_tokens) >= 2 and name_token_coverage >= 2)):
        return True

    return any(matches_topic_filter(topic, kw.get("word", "")) for kw in group.get("keywords", []))


def parse_trend_date(value: str = None):
    if not value:
        return None
    raw_value = str(value)
    if "T" in raw_value:
        parsed = datetime.fromisoformat(raw_value.replace("Z", "+00:00"))
        if parsed.tzinfo is not None:
            parsed = parsed.astimezone().replace(tzinfo=None)
        return parsed
    return datetime.strptime(raw_value[:10], "%Y-%m-%d")


def format_trend_label(bucket_key: str, granularity: str) -> str:
    if granularity == "day":
        parsed = datetime.strptime(bucket_key[:10], "%Y-%m-%d")
        return parsed.strftime("%d/%m")
    if granularity == "week":
        year, week = bucket_key.split("-W")
        return f"T{int(week)}/{year[-2:]}"

    year, month = bucket_key.split("-")
    return f"T{int(month)}/{year[-2:]}"


def seed_trend_buckets(start_date: str, end_date: str, granularity: str) -> dict:
    start = parse_trend_date(start_date)
    end = parse_trend_date(end_date)
    if not start or not end or start > end:
        return {}

    buckets = {}
    if granularity == "day":
        cursor = start.replace(hour=0, minute=0, second=0, microsecond=0)
        end_day = end.replace(hour=0, minute=0, second=0, microsecond=0)
        while cursor <= end_day:
            key = cursor.strftime("%Y-%m-%d")
            buckets[key] = {"date": format_trend_label(key, granularity)}
            cursor += timedelta(days=1)
    elif granularity == "week":
        cursor = (start - timedelta(days=start.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        while cursor <= end:
            iso = cursor.isocalendar()
            key = f"{iso.year}-W{str(iso.week).zfill(2)}"
            buckets[key] = {"date": format_trend_label(key, granularity)}
            cursor += timedelta(days=7)
    elif granularity == "month":
        cursor = datetime(start.year, start.month, 1)
        end_month = datetime(end.year, end.month, 1)
        while cursor <= end_month:
            key = f"{cursor.year}-{str(cursor.month).zfill(2)}"
            buckets[key] = {"date": format_trend_label(key, granularity)}
            if cursor.month == 12:
                cursor = datetime(cursor.year + 1, 1, 1)
            else:
                cursor = datetime(cursor.year, cursor.month + 1, 1)

    return buckets


def get_previous_period(start_date: str = None, end_date: str = None):
    if start_date and end_date:
        current_start = parse_trend_date(start_date)
        current_end = parse_trend_date(end_date)
        if current_start and current_end and current_start <= current_end:
            days = max((current_end.date() - current_start.date()).days + 1, 1)
            previous_end = current_start - timedelta(days=1)
            previous_start = previous_end - timedelta(days=days - 1)
            return previous_start.strftime("%Y-%m-%d"), previous_end.strftime("%Y-%m-%d")

    now = datetime.now()
    d30 = now - timedelta(days=30)
    d60 = now - timedelta(days=60)
    return d60.strftime("%Y-%m-%d"), d30.strftime("%Y-%m-%d")


class KeywordService:
    async def get_keywords(self, filters: dict) -> dict:
        page = filters.get("page", 1)
        page_size = filters.get("pageSize", 10)
        search = filters.get("search")
        status = filters.get("status")
        group_id = filters.get("groupId")
        start_date = filters.get("startDate")
        end_date = filters.get("endDate")
        channel = filters.get("channel")
        conversation_status = filters.get("conversationStatus")
        ai_status = filters.get("aiStatus")

        lst = keyword_repository.get_all()

        if search:
            s = search.lower()
            lst = [k for k in lst if s in k.get("word", "").lower() or s in k.get("groupId", "").lower()]
        if status:
            lst = [k for k in lst if k.get("status") == status]
        if group_id:
            lst = [k for k in lst if k.get("groupId") == group_id]

        total = len(lst)
        start_idx = (page - 1) * page_size
        end_idx = page * page_size
        paginated_list = lst[start_idx:end_idx]

        # Batch query: 1 query thay vì N queries
        words = [k["word"] for k in paginated_list]
        count_map = keyword_repository.batch_count_keyword_occurrences(
            words,
            start_date=start_date,
            end_date=end_date,
            channel=channel,
            conversation_status=conversation_status,
            ai_status=ai_status,
        ) if words else {}

        keywords_with_count = [
            {**k, "count": count_map.get(k["word"], 0)}
            for k in paginated_list
        ]

        return {
            "keywords": keywords_with_count,
            "total": total,
            "page": page,
            "pageSize": page_size
        }

    async def get_keyword_by_id(self, keyword_id: int) -> dict:
        lst = keyword_repository.get_all()
        keyword = next((k for k in lst if str(k.get("id")) == str(keyword_id)), None)
        if not keyword:
            raise Exception(f"Không tìm thấy CRM Keyword có ID là {keyword_id}")

        count = keyword_repository.count_keyword_occurrences(keyword["word"])
        return {**keyword, "count": count}

    async def create_keyword(self, word: str, group_id: str, status: str = "active") -> dict:
        if not word or not isinstance(word, str) or not word.strip():
            raise Exception("Từ khóa (word) là bắt buộc và phải là chuỗi ký tự.")
        if not group_id or group_id not in ORDERED_GROUP_IDS:
            raise Exception(f"groupId không hợp lệ. Phải là một trong: {', '.join(ORDERED_GROUP_IDS)}.")

        trimmed_word = word.strip()
        lst = keyword_repository.get_all()

        if any(k.get("groupId") == group_id and k.get("word", "").lower() == trimmed_word.lower() for k in lst):
            raise Exception(f"Từ khóa \"{trimmed_word}\" đã tồn tại trong nhóm \"{group_id}\".")

        max_id = max((k.get("id", 0) for k in lst), default=0)
        now_str = datetime.utcnow().isoformat() + "Z"
        new_keyword = {
            "id": max_id + 1,
            "word": trimmed_word,
            "groupId": group_id,
            "status": "inactive" if status == "inactive" else "active",
            "createdAt": now_str,
            "updatedAt": now_str
        }

        lst.append(new_keyword)
        keyword_repository.save_all(lst)
        clear_keyword_cache()
        count = keyword_repository.count_keyword_occurrences(new_keyword["word"])
        return {**new_keyword, "count": count}

    async def update_keyword(self, keyword_id: int, word: str = None, group_id: str = None, status: str = None) -> dict:
        lst = keyword_repository.get_all()
        index = next((i for i, k in enumerate(lst) if str(k.get("id")) == str(keyword_id)), -1)
        if index == -1:
            raise Exception(f"Không tìm thấy CRM Keyword có ID là {keyword_id} để cập nhật.")

        current = lst[index]
        updated_word = current.get("word")
        updated_group_id = current.get("groupId")

        if word is not None:
            if not isinstance(word, str) or not word.strip():
                raise Exception("Từ khóa (word) phải là chuỗi ký tự hợp lệ.")
            updated_word = word.strip()

        if group_id is not None:
            if group_id not in ORDERED_GROUP_IDS:
                raise Exception("groupId không hợp lệ.")
            updated_group_id = group_id

        if word is not None or group_id is not None:
            if any(
                str(k.get("id")) != str(keyword_id) and
                k.get("groupId") == updated_group_id and
                k.get("word", "").lower() == updated_word.lower()
                for k in lst
            ):
                raise Exception(f"Từ khóa \"{updated_word}\" đã tồn tại trong nhóm \"{updated_group_id}\".")

        now_str = datetime.utcnow().isoformat() + "Z"
        lst[index] = {
            **current,
            "word": updated_word,
            "groupId": updated_group_id,
            "status": status if status is not None else current.get("status"),
            "updatedAt": now_str
        }
        keyword_repository.save_all(lst)
        clear_keyword_cache()

        count = keyword_repository.count_keyword_occurrences(lst[index]["word"])
        return {**lst[index], "count": count}

    async def delete_keyword(self, keyword_id: int) -> bool:
        lst = keyword_repository.get_all()
        index = next((i for i, k in enumerate(lst) if str(k.get("id")) == str(keyword_id)), -1)
        if index == -1:
            raise Exception(f"Không tìm thấy CRM Keyword có ID là {keyword_id} để xóa.")

        lst.pop(index)
        keyword_repository.save_all(lst)
        clear_keyword_cache()
        return True

    async def get_group_stats(self, filters: dict) -> list:
        cache_key = make_cache_key("group_stats", filters)
        cached = get_cached_value(cache_key)
        if cached is not None:
            return cached

        start_date = filters.get("startDate")
        end_date = filters.get("endDate")
        channel = filters.get("channel")
        topic = filters.get("topic")
        conversation_status = filters.get("conversationStatus")
        ai_status = filters.get("aiStatus")
        top_n = filters.get("topN", 5)

        all_keywords = keyword_repository.get_all()
        group_map = {}
        for kw in all_keywords:
            gid = kw.get("groupId")
            if gid not in group_map:
                group_map[gid] = []
            group_map[gid].append(kw)

        # Gộp tất cả từ khóa active thành 1 batch query
        active_words = list(dict.fromkeys(
            kw["word"]
            for kws in group_map.values()
            for kw in kws
            if kw.get("status") == "active"
        ))
        count_map = keyword_repository.batch_count_keyword_occurrences(
            active_words,
            start_date=start_date,
            end_date=end_date,
            channel=channel,
            conversation_status=conversation_status,
            ai_status=ai_status,
        ) if active_words else {}

        previous_start, previous_end = get_previous_period(start_date, end_date)
        period_words_map = {}
        for group_id in ORDERED_GROUP_IDS:
            group_keywords = [k for k in group_map.get(group_id, []) if k.get("status") == "active"]
            group_words = [kw["word"] for kw in group_keywords]
            if topic:
                group_only_match = matches_group_topic(topic, {"id": group_id, "keywords": []})
                if not group_only_match:
                    group_words = [word for word in group_words if matches_topic_filter(topic, word)]
            if group_words:
                period_words_map[group_id] = group_words

        previous_totals = keyword_repository.batch_count_groups(
            period_words_map,
            previous_start,
            previous_end,
            channel=channel,
            conversation_status=conversation_status,
            ai_status=ai_status,
        ) if period_words_map else {}

        results = []
        for group_id in ORDERED_GROUP_IDS:
            meta = GROUP_META[group_id]
            keywords = [k for k in group_map.get(group_id, []) if k.get("status") == "active"]

            keywords_with_count = [
                {**kw, "count": count_map.get(kw["word"], 0)}
                for kw in keywords
            ]

            if topic:
                group_only_match = matches_group_topic(topic, {"id": group_id, "keywords": []})
                if group_only_match:
                    filtered_keywords = keywords_with_count
                else:
                    filtered_keywords = [kw for kw in keywords_with_count if matches_topic_filter(topic, kw["word"])]
            else:
                filtered_keywords = keywords_with_count

            sorted_keywords = sorted(filtered_keywords, key=lambda x: x["count"], reverse=True)
            top_keywords = sorted_keywords[:top_n]
            total_questions = sum(kw["count"] for kw in filtered_keywords)
            previous_total = previous_totals.get(group_id, 0)

            change_rate = 0
            if previous_total > 0:
                change_rate = round(((total_questions - previous_total) / previous_total) * 100)
            elif total_questions > 0:
                change_rate = 100

            results.append({
                "id": group_id,
                "name": meta["name"],
                "color": meta["color"],
                "totalQuestions": total_questions,
                "changeRate": change_rate,
                "keywords": top_keywords,
                "totalKeywords": len(sorted_keywords)
            })

        result = [g for g in results if matches_group_topic(topic, g)]
        set_cached_value(cache_key, result)
        return result

    async def get_trend_data(
        self,
        months: int = 8,
        channel: str = None,
        start_date: str = None,
        end_date: str = None,
        topic: str = None,
        conversation_status: str = None,
        ai_status: str = None,
        granularity: str = "month",
    ) -> list:
        cache_key = make_cache_key("trend_data", {
            "months": months,
            "channel": channel,
            "startDate": start_date,
            "endDate": end_date,
            "topic": topic,
            "conversationStatus": conversation_status,
            "aiStatus": ai_status,
            "granularity": granularity,
        })
        cached = get_cached_value(cache_key)
        if cached is not None:
            return cached

        if granularity not in ("day", "week", "month"):
            granularity = "month"

        all_keywords = keyword_repository.get_all()
        group_map = {}
        for kw in all_keywords:
            if kw.get("status") != "active":
                continue
            gid = kw.get("groupId")
            if gid not in group_map:
                group_map[gid] = []
            group_map[gid].append(kw["word"])

        trend_by_key = seed_trend_buckets(start_date, end_date, granularity)
        trend_words_map = {}
        for group_id in ORDERED_GROUP_IDS:
            words = group_map.get(group_id, [])
            if not words:
                continue

            if topic:
                group_only_match = matches_group_topic(topic, {"id": group_id, "keywords": []})
                if not group_only_match:
                    words = [word for word in words if matches_topic_filter(topic, word)]
                if not words:
                    continue

            trend_words_map[group_id] = words

        rows = keyword_repository.get_trend_counts_for_groups(
            trend_words_map,
            months,
            channel,
            start_date=start_date,
            end_date=end_date,
            conversation_status=conversation_status,
            ai_status=ai_status,
            granularity=granularity,
        )
        for row in rows:
            key = row.get("bucket_key")
            if not key:
                key = f"{row['yr']}-{str(row['mo']).zfill(2)}"
            if key not in trend_by_key:
                trend_by_key[key] = {"date": format_trend_label(key, granularity)}
            for group_id in ORDERED_GROUP_IDS:
                if group_id in trend_words_map:
                    trend_by_key[key][group_id] = row.get(group_id, 0) or 0

        sorted_keys = sorted(trend_by_key.keys())
        trends = []
        for key in sorted_keys:
            row = trend_by_key[key]
            entry = {"date": row.get("date") or format_trend_label(key, granularity)}
            for gid in ORDERED_GROUP_IDS:
                entry[GROUP_META[gid]["name"]] = row.get(gid, 0)
            trends.append(entry)

        set_cached_value(cache_key, trends)
        return trends

    async def get_heatmap_data(
        self,
        start_date: str = None,
        end_date: str = None,
        channel: str = None,
        topic: str = None,
        conversation_status: str = None,
        ai_status: str = None,
    ) -> dict:
        cache_key = make_cache_key("heatmap_data", {
            "startDate": start_date,
            "endDate": end_date,
            "channel": channel,
            "topic": topic,
            "conversationStatus": conversation_status,
            "aiStatus": ai_status,
        })
        cached = get_cached_value(cache_key)
        if cached is not None:
            return cached

        all_keywords = keyword_repository.get_all()
        group_map = {}
        for kw in all_keywords:
            if kw.get("status") != "active":
                continue
            gid = kw.get("groupId")
            if gid not in group_map:
                group_map[gid] = []
            group_map[gid].append(kw["word"])

        CROSS_KEYWORDS = [
            {"key": "lệ_phí",    "word": "lệ phí",    "label": "Lệ phí"},
            {"key": "lịch_thi",  "word": "lịch thi",  "label": "Lịch thi"},
            {"key": "đăng_ký",   "word": "đăng ký",   "label": "Đăng ký"},
            {"key": "kết_quả",   "word": "kết quả",   "label": "Kết quả"},
            {"key": "chứng_chỉ", "word": "chứng chỉ", "label": "Chứng chỉ"},
        ]

        cross_words = [ck["word"] for ck in CROSS_KEYWORDS]

        group_words_map = {}
        for gid in ORDERED_GROUP_IDS:
            words = group_map.get(gid, [])
            if topic:
                group_only_match = matches_group_topic(topic, {"id": gid, "keywords": []})
                if not group_only_match:
                    words = [word for word in words if matches_topic_filter(topic, word)]
            group_words_map[gid] = words

        batch_result = keyword_repository.batch_count_cooccurrence(
            group_words_map, cross_words,
            start_date=start_date,
            end_date=end_date,
            channel=channel,
            conversation_status=conversation_status,
            ai_status=ai_status,
        )

        raw_matrix = []
        for group_id in ORDERED_GROUP_IDS:
            group_words = group_words_map.get(group_id, [])
            if topic and not matches_group_topic(topic, {
                "id": group_id,
                "keywords": [{"word": word} for word in group_words],
            }):
                continue

            meta = GROUP_META[group_id]
            row = {"groupId": group_id, "topic": meta["name"]}
            for ck in CROSS_KEYWORDS:
                row[ck["key"]] = batch_result.get((group_id, ck["word"]), 0)
            raw_matrix.append(row)

        all_values = [row[ck["key"]] for row in raw_matrix for ck in CROSS_KEYWORDS]
        max_val = max(all_values) if all_values else 1
        if max_val < 1:
            max_val = 1

        normalized_matrix = []
        for row in raw_matrix:
            out = {"groupId": row["groupId"], "topic": row["topic"]}
            for ck in CROSS_KEYWORDS:
                raw = row[ck["key"]]
                val = 1 if raw == 0 else min(5, max(1, int(round((raw / max_val) * 5))))
                out[ck["key"]] = val
                out[f"{ck['key']}_raw"] = raw
            normalized_matrix.append(out)

        result = {
            "data": normalized_matrix,
            "columns": CROSS_KEYWORDS,
            "maxRaw": max_val
        }
        set_cached_value(cache_key, result)
        return result


keyword_service = KeywordService()
