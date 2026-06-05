import os
import json
from datetime import datetime, time
from db import execute_query

# File JSON stored in data/crm_keywords.json relative to backend root
JSON_FILE_PATH = os.path.join(os.path.dirname(__file__), "../data/crm_keywords.json")


def _build_date_filter(start_date=None, end_date=None, channel=None):
    """Helper to build common date/channel filter SQL fragment + params."""
    clauses = []
    params = []

    if start_date:
        if "T" in start_date:
            dt_start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        else:
            dt_start = datetime.strptime(start_date[:10], "%Y-%m-%d")
        clauses.append("SentAt >= ?")
        params.append(dt_start)

    if end_date:
        if "T" in end_date:
            dt_end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        else:
            dt_end = datetime.strptime(end_date[:10], "%Y-%m-%d")
        dt_end = datetime.combine(dt_end.date(), time(23, 59, 59, 999000))
        clauses.append("SentAt <= ?")
        params.append(dt_end)

    if channel:
        clauses.append("Source = ?")
        params.append(channel)

    return clauses, params


class KeywordRepository:
    def get_all(self) -> list:
        try:
            if not os.path.exists(JSON_FILE_PATH):
                return []
            with open(JSON_FILE_PATH, "r", encoding="utf-8") as f:
                content = f.read().strip()
                return json.loads(content) if content else []
        except Exception as e:
            print("Lỗi khi đọc file crm_keywords.json:", e)
            return []

    def save_all(self, keywords: list) -> None:
        try:
            dir_name = os.path.dirname(JSON_FILE_PATH)
            if not os.path.exists(dir_name):
                os.makedirs(dir_name, exist_ok=True)
            with open(JSON_FILE_PATH, "w", encoding="utf-8") as f:
                json.dump(keywords, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print("Lỗi khi ghi file crm_keywords.json:", e)
            raise e

    # ─── Single keyword count (dùng khi chỉ cần 1 từ) ──────────────────────
    def count_keyword_occurrences(self, word: str, filters: dict = None) -> int:
        if not filters:
            filters = {}
        result = self.batch_count_keyword_occurrences(
            [word],
            start_date=filters.get("startDate"),
            end_date=filters.get("endDate"),
            channel=filters.get("channel"),
        )
        return result.get(word, 0)

    # ─── Batch count: 1 query cho nhiều từ khóa ─────────────────────────────
    def batch_count_keyword_occurrences(
        self, words: list, start_date=None, end_date=None, channel=None
    ) -> dict:
        """
        Trả về dict {word: count} cho tất cả words trong 1 SQL query duy nhất.
        Dùng CASE WHEN để đếm từng từ song song.
        """
        if not words:
            return {}

        date_clauses, date_params = _build_date_filter(start_date, end_date, channel)

        select_parts = []
        like_params = []
        for i, w in enumerate(words):
            select_parts.append(f"SUM(CASE WHEN TextContent LIKE ? THEN 1 ELSE 0 END) AS col_{i}")
            like_params.append(f"%{w}%")

        where_sql = ""
        if date_clauses:
            where_sql = " AND " + " AND ".join(date_clauses)

        query = f"""
            SELECT {', '.join(select_parts)}
            FROM WebChat_MessageLogs
            WHERE TextContent IS NOT NULL AND TextContent != ''
            {where_sql}
        """

        params = tuple(like_params + date_params)

        try:
            rows = execute_query(query, params)
            if not rows:
                return {w: 0 for w in words}
            row = rows[0]
            return {w: (row.get(f"col_{i}") or 0) for i, w in enumerate(words)}
        except Exception as e:
            print("Lỗi batch_count_keyword_occurrences:", e)
            return {w: 0 for w in words}

    # ─── Đếm tổng số lần xuất hiện của một nhóm từ trong khoảng thời gian ──
    def count_words_in_period(
        self, words: list, start_date: str = None, end_date: str = None, channel: str = None
    ) -> int:
        if not words:
            return 0
        try:
            conditions = ["TextContent LIKE ?" for _ in words]
            params = [f"%{w}%" for w in words]

            or_cond = " OR ".join(conditions)
            date_clauses, date_params = _build_date_filter(start_date, end_date, channel)
            where_extra = (" AND " + " AND ".join(date_clauses)) if date_clauses else ""

            query = f"""
                SELECT COUNT(*) AS cnt
                FROM WebChat_MessageLogs
                WHERE ({or_cond})
                {where_extra}
            """
            res = execute_query(query, tuple(params + date_params))
            return res[0]["cnt"] if res else 0
        except Exception as e:
            print("Lỗi khi count_words_in_period:", e)
            return 0

    def get_monthly_counts_for_words(self, words: list, months: int = 8, channel: str = None) -> list:
        if not words:
            return []
        try:
            conditions = ["TextContent LIKE ?" for _ in words]
            params = [f"%{w}%" for w in words]

            or_cond = " OR ".join(conditions)
            params.append(-months)

            channel_clause = " AND Source = ?" if channel else ""
            if channel:
                params.append(channel)

            query = f"""
                SELECT
                  YEAR(SentAt) AS yr,
                  MONTH(SentAt) AS mo,
                  COUNT(*) AS cnt
                FROM WebChat_MessageLogs
                WHERE ({or_cond})
                  AND SentAt >= DATEADD(MONTH, ?, GETDATE())
                  AND TextContent IS NOT NULL AND TextContent != ''
                {channel_clause}
                GROUP BY YEAR(SentAt), MONTH(SentAt)
                ORDER BY yr, mo
            """
            return execute_query(query, tuple(params))
        except Exception as e:
            print("Lỗi khi get_monthly_counts_for_words:", e)
            return []

    # ─── Batch co-occurrence: 1 query cho nhiều (group_words × cross_word) ──
    def batch_count_cooccurrence(
        self,
        group_words_map: dict,
        cross_words: list,
        start_date=None,
        end_date=None,
        channel=None,
    ) -> dict:
        """
        group_words_map: {group_id: [word1, word2, ...]}
        cross_words:     [cross_word1, cross_word2, ...]
        Trả về dict {(group_id, cross_word): count}
        Thực hiện 1 query duy nhất thay vì len(group_ids) × len(cross_words) queries.
        """
        if not group_words_map or not cross_words:
            return {}

        date_clauses, date_params = _build_date_filter(start_date, end_date, channel)
        where_extra = (" AND " + " AND ".join(date_clauses)) if date_clauses else ""

        select_parts = []
        all_params = list(date_params)

        col_map = {}
        col_idx = 0

        for group_id, group_words in group_words_map.items():
            if not group_words:
                continue
            group_or = " OR ".join(["TextContent LIKE ?" for _ in group_words])
            for cw in cross_words:
                col_name = f"col_{col_idx}"
                col_map[col_name] = (group_id, cw)
                select_parts.append(
                    f"SUM(CASE WHEN TextContent LIKE ? AND ({group_or}) THEN 1 ELSE 0 END) AS {col_name}"
                )
                all_params.append(f"%{cw}%")
                for gw in group_words:
                    all_params.append(f"%{gw}%")
                col_idx += 1

        if not select_parts:
            return {}

        query = f"""
            SELECT {', '.join(select_parts)}
            FROM WebChat_MessageLogs
            WHERE TextContent IS NOT NULL AND TextContent != ''
            {where_extra}
        """

        try:
            rows = execute_query(query, tuple(all_params))
            result = {}
            if rows:
                row = rows[0]
                for col_name, (group_id, cw) in col_map.items():
                    result[(group_id, cw)] = row.get(col_name) or 0
            return result
        except Exception as e:
            print("Lỗi batch_count_cooccurrence:", e)
            return {}

    # ─── Giữ lại để tương thích ngược ──────────────────────────────────────
    def count_cooccurrence(self, group_words: list, cross_word: str, filters: dict = None) -> int:
        if not group_words:
            return 0
        if not filters:
            filters = {}
        res = self.batch_count_cooccurrence(
            {"_single": group_words},
            [cross_word],
            start_date=filters.get("startDate"),
            end_date=filters.get("endDate"),
            channel=filters.get("channel"),
        )
        return res.get(("_single", cross_word), 0)


keyword_repository = KeywordRepository()
