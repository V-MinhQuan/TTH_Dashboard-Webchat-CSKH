import unicodedata
from datetime import datetime, timedelta
from keywords.repository import keyword_repository

GROUP_META = {
    "toeic":      {"name": "TOEIC",                    "color": "#003865"},
    "vstep":      {"name": "VSTEP",                    "color": "#1565C0"},
    "tinhoc":     {"name": "Tin học / MOS / IC3",       "color": "#42A5F5"},
    "chuandaura": {"name": "Chuẩn đầu ra / Chứng chỉ", "color": "#0288D1"},
}

ORDERED_GROUP_IDS = ["toeic", "vstep", "tinhoc", "chuandaura"]


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
            words, start_date=start_date, end_date=end_date, channel=channel
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

        count = keyword_repository.count_keyword_occurrences(lst[index]["word"])
        return {**lst[index], "count": count}

    async def delete_keyword(self, keyword_id: int) -> bool:
        lst = keyword_repository.get_all()
        index = next((i for i, k in enumerate(lst) if str(k.get("id")) == str(keyword_id)), -1)
        if index == -1:
            raise Exception(f"Không tìm thấy CRM Keyword có ID là {keyword_id} để xóa.")

        lst.pop(index)
        keyword_repository.save_all(lst)
        return True

    async def get_group_stats(self, filters: dict) -> list:
        start_date = filters.get("startDate")
        end_date = filters.get("endDate")
        channel = filters.get("channel")
        topic = filters.get("topic")
        top_n = filters.get("topN", 5)

        all_keywords = keyword_repository.get_all()
        group_map = {}
        for kw in all_keywords:
            gid = kw.get("groupId")
            if gid not in group_map:
                group_map[gid] = []
            group_map[gid].append(kw)

        # Gộp tất cả từ khóa active thành 1 batch query
        active_words = [
            kw["word"]
            for kws in group_map.values()
            for kw in kws
            if kw.get("status") == "active"
        ]
        count_map = keyword_repository.batch_count_keyword_occurrences(
            active_words, start_date=start_date, end_date=end_date, channel=channel
        ) if active_words else {}

        now = datetime.now()
        d30 = now - timedelta(days=30)
        d60 = now - timedelta(days=60)

        results = []
        for group_id in ORDERED_GROUP_IDS:
            meta = GROUP_META[group_id]
            keywords = [k for k in group_map.get(group_id, []) if k.get("status") == "active"]
            words = [k["word"] for k in keywords]

            keywords_with_count = [
                {**kw, "count": count_map.get(kw["word"], 0)}
                for kw in keywords
            ]

            if topic:
                filtered_keywords = [kw for kw in keywords_with_count if matches_topic_filter(topic, kw["word"])]
            else:
                filtered_keywords = keywords_with_count

            sorted_keywords = sorted(filtered_keywords, key=lambda x: x["count"], reverse=True)
            top_keywords = sorted_keywords[:top_n]
            total_questions = sum(kw["count"] for kw in filtered_keywords)

            change_rate = 0
            if words:
                cur = keyword_repository.count_words_in_period(words, d30.isoformat(), now.isoformat(), channel)
                prev = keyword_repository.count_words_in_period(words, d60.isoformat(), d30.isoformat(), channel)
                if prev > 0:
                    change_rate = round(((cur - prev) / prev) * 100)
                elif cur > 0:
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

        return [g for g in results if matches_group_topic(topic, g)]

    async def get_trend_data(self, months: int = 8, channel: str = None) -> list:
        all_keywords = keyword_repository.get_all()
        group_map = {}
        for kw in all_keywords:
            if kw.get("status") != "active":
                continue
            gid = kw.get("groupId")
            if gid not in group_map:
                group_map[gid] = []
            group_map[gid].append(kw["word"])

        trend_by_key = {}
        for group_id in ORDERED_GROUP_IDS:
            words = group_map.get(group_id, [])
            if not words:
                continue
            rows = keyword_repository.get_monthly_counts_for_words(words, months, channel)
            for row in rows:
                key = f"{row['yr']}-{str(row['mo']).zfill(2)}"
                if key not in trend_by_key:
                    trend_by_key[key] = {"yr": row["yr"], "mo": row["mo"]}
                trend_by_key[key][group_id] = row["cnt"]

        sorted_keys = sorted(trend_by_key.keys())
        trends = []
        for key in sorted_keys:
            row = trend_by_key[key]
            yr_str = str(row["yr"])[2:]
            entry = {"date": f"T{row['mo']}/{yr_str}"}
            for gid in ORDERED_GROUP_IDS:
                entry[GROUP_META[gid]["name"]] = row.get(gid, 0)
            trends.append(entry)

        return trends

    async def get_heatmap_data(self, start_date: str = None, end_date: str = None, channel: str = None) -> dict:
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

        # 1 query thay vì 4 × 5 = 20 queries
        group_words_map = {gid: group_map.get(gid, []) for gid in ORDERED_GROUP_IDS}
        batch_result = keyword_repository.batch_count_cooccurrence(
            group_words_map, cross_words,
            start_date=start_date, end_date=end_date, channel=channel
        )

        raw_matrix = []
        for group_id in ORDERED_GROUP_IDS:
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

        return {
            "data": normalized_matrix,
            "columns": CROSS_KEYWORDS,
            "maxRaw": max_val
        }


keyword_service = KeywordService()
