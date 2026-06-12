import os
import json
from datetime import datetime, time
from app.core.legacy_db_executor import execute_query

# File JSON stored in data/crm_keywords.json relative to backend root
JSON_FILE_PATH = os.path.join(os.path.dirname(__file__), "../data/crm_keywords.json")


def _parse_filter_datetime(value, is_end=False):
    if not value:
        return None

    raw_value = str(value)
    if "T" in raw_value:
        dt = datetime.fromisoformat(raw_value.replace("Z", "+00:00"))
        if dt.tzinfo is not None:
            dt = dt.astimezone().replace(tzinfo=None)
        return dt

    dt = datetime.strptime(raw_value[:10], "%Y-%m-%d")
    if is_end:
        return datetime.combine(dt.date(), time(23, 59, 59, 999000))
    return dt


def _ai_no_data_condition(alias="ai"):
    return f"""(
        {alias}.TextContent LIKE N'%không tìm thấy%'
        OR {alias}.TextContent LIKE N'%chưa có%'
        OR {alias}.TextContent LIKE N'%chưa hỗ trợ%'
        OR {alias}.TextContent LIKE N'%không thể%'
        OR {alias}.TextContent LIKE N'%Trợ lý AI%'
        OR {alias}.TextContent LIKE N'%Không thể tiếp nhận thông tin%'
        OR {alias}.TextContent LIKE N'%Không thể xác nhận trực tiếp%'
    )"""


def _ai_uncertain_condition(alias="ai"):
    return f"""(
        {alias}.TextContent LIKE N'%chưa hiểu%'
        OR {alias}.TextContent LIKE N'%chưa rõ%'
        OR {alias}.TextContent LIKE N'%không chắc chắn%'
        OR {alias}.TextContent LIKE N'%chưa có thông tin cụ thể%'
        OR {alias}.TextContent LIKE N'%độ tin cậy%'
        OR {alias}.TextContent LIKE N'%chưa xác nhận%'
    )"""


def _ai_failure_condition(alias="ai"):
    return f"({_ai_no_data_condition(alias)} OR {_ai_uncertain_condition(alias)})"


def _build_message_filters(
    start_date=None,
    end_date=None,
    channel=None,
    conversation_status=None,
    ai_status=None,
):
    """Build SQL joins, WHERE fragments and params for WebChat_MessageLogs alias m."""
    joins = []
    clauses = []
    params = []

    if start_date:
        clauses.append("m.SentAt >= ?")
        params.append(_parse_filter_datetime(start_date))

    if end_date:
        clauses.append("m.SentAt <= ?")
        params.append(_parse_filter_datetime(end_date, is_end=True))

    if channel:
        clauses.append("m.Source = ?")
        params.append(channel)

    needs_conversation = conversation_status and conversation_status != "Tất cả"
    needs_ai_status = ai_status and ai_status != "Tất cả"

    if needs_conversation:
        joins.append("""
            LEFT JOIN WebChat_Conversations c
              ON c.CustomerId = CASE WHEN m.FromHost = 1 THEN m.ReceiverId ELSE m.SenderId END
             AND c.Source = m.Source
            LEFT JOIN WebChat_ConversationStatus s
              ON c.CustomerId = s.CustomerId
             AND c.Source = s.Source
        """)

        closed_sql = "(s.NoResponseNeeded = 1 AND (s.MarkedAt IS NULL OR c.LastCustomerMessageAt <= s.MarkedAt))"
        active_sql = "(s.NoResponseNeeded IS NULL OR s.NoResponseNeeded = 0 OR c.LastCustomerMessageAt > s.MarkedAt)"

        if conversation_status == "Chờ xử lý":
            clauses.append(f"c.CustomerId IS NOT NULL AND {active_sql} AND (c.LastHostMessageAt IS NULL OR c.LastCustomerMessageAt > c.LastHostMessageAt)")
        elif conversation_status == "Đang xử lý":
            clauses.append(f"c.CustomerId IS NOT NULL AND {active_sql} AND c.LastHostMessageAt IS NOT NULL AND c.LastCustomerMessageAt <= c.LastHostMessageAt")
        elif conversation_status == "Hoàn thành":
            clauses.append(f"c.CustomerId IS NOT NULL AND {closed_sql}")

    if needs_ai_status:
        failure_sql = _ai_failure_condition("m")
        no_data_sql = _ai_no_data_condition("m")
        uncertain_sql = _ai_uncertain_condition("m")
        ai_message_sql = "m.FromHost = 1 AND m.HostDisplayName = 'AI Assistant'"

        if ai_status == "AI trả lời thành công":
            clauses.append(f"{ai_message_sql} AND NOT {failure_sql}")
        elif ai_status == "AI trả lời thất bại":
            clauses.append(f"{ai_message_sql} AND {failure_sql}")
        elif ai_status == "Không tìm thấy dữ liệu":
            clauses.append(f"{ai_message_sql} AND {no_data_sql}")
        elif ai_status in ("AI không chắc chắn", "AI trả lời không chắc chắn"):
            clauses.append(f"{ai_message_sql} AND {uncertain_sql}")

    return "\n".join(joins), clauses, params


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
            conversation_status=filters.get("conversationStatus"),
            ai_status=filters.get("aiStatus"),
        )
        return result.get(word, 0)

    # ─── Batch count: 1 query cho nhiều từ khóa ─────────────────────────────
    def batch_count_keyword_occurrences(
        self,
        words: list,
        start_date=None,
        end_date=None,
        channel=None,
        conversation_status=None,
        ai_status=None,
    ) -> dict:
        """
        Trả về dict {word: count} cho tất cả words trong 1 SQL query duy nhất.
        Dùng CASE WHEN để đếm từng từ song song.
        """
        if not words:
            return {}

        join_sql, filter_clauses, filter_params = _build_message_filters(
            start_date=start_date,
            end_date=end_date,
            channel=channel,
            conversation_status=conversation_status,
            ai_status=ai_status,
        )

        select_parts = []
        like_params = []
        for i, w in enumerate(words):
            select_parts.append(f"SUM(CASE WHEN m.TextContent LIKE ? THEN 1 ELSE 0 END) AS col_{i}")
            like_params.append(f"%{w}%")

        word_filter_sql = " OR ".join(["m.TextContent LIKE ?" for _ in words])
        word_filter_params = [f"%{w}%" for w in words]

        where_sql = ""
        if filter_clauses:
            where_sql = " AND " + " AND ".join(f"({clause})" for clause in filter_clauses)

        query = f"""
            SELECT {', '.join(select_parts)}
            FROM WebChat_MessageLogs m
            {join_sql}
            WHERE m.TextContent IS NOT NULL AND m.TextContent != ''
              AND ({word_filter_sql})
            {where_sql}
        """

        params = tuple(like_params + word_filter_params + filter_params)

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
        self,
        words: list,
        start_date: str = None,
        end_date: str = None,
        channel: str = None,
        conversation_status: str = None,
        ai_status: str = None,
    ) -> int:
        if not words:
            return 0
        try:
            conditions = ["m.TextContent LIKE ?" for _ in words]
            params = [f"%{w}%" for w in words]

            or_cond = " OR ".join(conditions)
            join_sql, filter_clauses, filter_params = _build_message_filters(
                start_date=start_date,
                end_date=end_date,
                channel=channel,
                conversation_status=conversation_status,
                ai_status=ai_status,
            )
            where_extra = (" AND " + " AND ".join(f"({clause})" for clause in filter_clauses)) if filter_clauses else ""

            query = f"""
                SELECT COUNT(*) AS cnt
                FROM WebChat_MessageLogs m
                {join_sql}
                WHERE ({or_cond})
                  AND m.TextContent IS NOT NULL AND m.TextContent != ''
                {where_extra}
            """
            res = execute_query(query, tuple(params + filter_params))
            return res[0]["cnt"] if res else 0
        except Exception as e:
            print("Lỗi khi count_words_in_period:", e)
            return 0

    def batch_count_group_periods(
        self,
        group_words_map: dict,
        current_start: str,
        current_end: str,
        previous_start: str,
        previous_end: str,
        channel: str = None,
        conversation_status: str = None,
        ai_status: str = None,
    ) -> dict:
        if not group_words_map:
            return {}

        join_sql, filter_clauses, filter_params = _build_message_filters(
            channel=channel,
            conversation_status=conversation_status,
            ai_status=ai_status,
        )
        filter_clauses.extend(["m.SentAt >= ?", "m.SentAt <= ?"])
        filter_params.extend([
            _parse_filter_datetime(previous_start),
            _parse_filter_datetime(current_end),
        ])

        select_parts = []
        select_params = []

        for group_id, words in group_words_map.items():
            if not words:
                continue

            group_or = " OR ".join(["m.TextContent LIKE ?" for _ in words])

            select_parts.append(
                f"SUM(CASE WHEN ({group_or}) AND m.SentAt >= ? AND m.SentAt <= ? THEN 1 ELSE 0 END) AS cur_{group_id}"
            )
            select_params.extend([f"%{word}%" for word in words])
            select_params.extend([
                _parse_filter_datetime(current_start),
                _parse_filter_datetime(current_end),
            ])

            select_parts.append(
                f"SUM(CASE WHEN ({group_or}) AND m.SentAt >= ? AND m.SentAt <= ? THEN 1 ELSE 0 END) AS prev_{group_id}"
            )
            select_params.extend([f"%{word}%" for word in words])
            select_params.extend([
                _parse_filter_datetime(previous_start),
                _parse_filter_datetime(previous_end),
            ])

        if not select_parts:
            return {}

        where_extra = " AND " + " AND ".join(f"({clause})" for clause in filter_clauses)
        query = f"""
            SELECT {', '.join(select_parts)}
            FROM WebChat_MessageLogs m
            {join_sql}
            WHERE m.TextContent IS NOT NULL AND m.TextContent != ''
            {where_extra}
        """

        try:
            rows = execute_query(query, tuple(select_params + filter_params))
            row = rows[0] if rows else {}
            return {
                group_id: {
                    "cur": row.get(f"cur_{group_id}") or 0,
                    "prev": row.get(f"prev_{group_id}") or 0,
                }
                for group_id in group_words_map
            }
        except Exception as e:
            print("Lỗi batch_count_group_periods:", e)
            return {group_id: {"cur": 0, "prev": 0} for group_id in group_words_map}

    def batch_count_groups(
        self,
        group_words_map: dict,
        start_date: str = None,
        end_date: str = None,
        channel: str = None,
        conversation_status: str = None,
        ai_status: str = None,
    ) -> dict:
        if not group_words_map:
            return {}

        join_sql, filter_clauses, filter_params = _build_message_filters(
            start_date=start_date,
            end_date=end_date,
            channel=channel,
            conversation_status=conversation_status,
            ai_status=ai_status,
        )

        select_parts = []
        select_params = []
        all_words = []
        for group_id, words in group_words_map.items():
            if not words:
                continue
            all_words.extend(words)
            group_or = " OR ".join(["m.TextContent LIKE ?" for _ in words])
            select_parts.append(f"SUM(CASE WHEN ({group_or}) THEN 1 ELSE 0 END) AS [{group_id}]")
            select_params.extend([f"%{word}%" for word in words])

        if not select_parts:
            return {}

        unique_words = list(dict.fromkeys(all_words))
        word_filter_sql = " OR ".join(["m.TextContent LIKE ?" for _ in unique_words])
        word_filter_params = [f"%{word}%" for word in unique_words]
        where_extra = (" AND " + " AND ".join(f"({clause})" for clause in filter_clauses)) if filter_clauses else ""
        query = f"""
            SELECT {', '.join(select_parts)}
            FROM WebChat_MessageLogs m
            {join_sql}
            WHERE m.TextContent IS NOT NULL AND m.TextContent != ''
              AND ({word_filter_sql})
            {where_extra}
        """

        try:
            rows = execute_query(query, tuple(select_params + word_filter_params + filter_params))
            row = rows[0] if rows else {}
            return {group_id: row.get(group_id) or 0 for group_id in group_words_map}
        except Exception as e:
            print("Lỗi batch_count_groups:", e)
            return {group_id: 0 for group_id in group_words_map}

    def get_monthly_counts_for_words(
        self,
        words: list,
        months: int = 8,
        channel: str = None,
        start_date: str = None,
        end_date: str = None,
        conversation_status: str = None,
        ai_status: str = None,
        granularity: str = "month",
    ) -> list:
        if not words:
            return []
        try:
            if granularity not in ("day", "week", "month"):
                granularity = "month"

            conditions = ["m.TextContent LIKE ?" for _ in words]
            params = [f"%{w}%" for w in words]

            or_cond = " OR ".join(conditions)
            join_sql, filter_clauses, filter_params = _build_message_filters(
                start_date=start_date,
                end_date=end_date,
                channel=channel,
                conversation_status=conversation_status,
                ai_status=ai_status,
            )

            if not start_date and not end_date:
                filter_clauses.append("m.SentAt >= DATEADD(MONTH, ?, GETDATE())")
                filter_params.append(-months)

            where_extra = (" AND " + " AND ".join(f"({clause})" for clause in filter_clauses)) if filter_clauses else ""

            if granularity == "day":
                query = f"""
                    SELECT
                      CONVERT(VARCHAR(10), m.SentAt, 120) AS bucket_key,
                      COUNT(*) AS cnt
                    FROM WebChat_MessageLogs m
                    {join_sql}
                    WHERE ({or_cond})
                      AND m.TextContent IS NOT NULL AND m.TextContent != ''
                    {where_extra}
                    GROUP BY CONVERT(VARCHAR(10), m.SentAt, 120)
                    ORDER BY bucket_key
                """
            elif granularity == "week":
                query = f"""
                    SELECT
                      CONCAT(YEAR(m.SentAt), '-W', RIGHT('0' + CAST(DATEPART(ISO_WEEK, m.SentAt) AS VARCHAR(2)), 2)) AS bucket_key,
                      MIN(CONVERT(VARCHAR(10), m.SentAt, 120)) AS bucket_start,
                      COUNT(*) AS cnt
                    FROM WebChat_MessageLogs m
                    {join_sql}
                    WHERE ({or_cond})
                      AND m.TextContent IS NOT NULL AND m.TextContent != ''
                    {where_extra}
                    GROUP BY YEAR(m.SentAt), DATEPART(ISO_WEEK, m.SentAt)
                    ORDER BY MIN(m.SentAt)
                """
            else:
                query = f"""
                    SELECT
                      CONCAT(YEAR(m.SentAt), '-', RIGHT('0' + CAST(MONTH(m.SentAt) AS VARCHAR(2)), 2)) AS bucket_key,
                      YEAR(m.SentAt) AS yr,
                      MONTH(m.SentAt) AS mo,
                      COUNT(*) AS cnt
                    FROM WebChat_MessageLogs m
                    {join_sql}
                    WHERE ({or_cond})
                      AND m.TextContent IS NOT NULL AND m.TextContent != ''
                    {where_extra}
                    GROUP BY YEAR(m.SentAt), MONTH(m.SentAt)
                    ORDER BY yr, mo
                """
            return execute_query(query, tuple(params + filter_params))
        except Exception as e:
            print("Lỗi khi get_monthly_counts_for_words:", e)
            return []

    def get_trend_counts_for_groups(
        self,
        group_words_map: dict,
        months: int = 8,
        channel: str = None,
        start_date: str = None,
        end_date: str = None,
        conversation_status: str = None,
        ai_status: str = None,
        granularity: str = "month",
    ) -> list:
        if not group_words_map:
            return []

        try:
            if granularity not in ("day", "week", "month"):
                granularity = "month"

            join_sql, filter_clauses, filter_params = _build_message_filters(
                start_date=start_date,
                end_date=end_date,
                channel=channel,
                conversation_status=conversation_status,
                ai_status=ai_status,
            )

            if not start_date and not end_date:
                filter_clauses.append("m.SentAt >= DATEADD(MONTH, ?, GETDATE())")
                filter_params.append(-months)

            select_parts = []
            select_params = []
            all_words = []
            for group_id, words in group_words_map.items():
                if not words:
                    continue
                all_words.extend(words)
                group_or = " OR ".join(["m.TextContent LIKE ?" for _ in words])
                select_parts.append(f"SUM(CASE WHEN ({group_or}) THEN 1 ELSE 0 END) AS [{group_id}]")
                select_params.extend([f"%{word}%" for word in words])

            if not select_parts:
                return []

            unique_words = list(dict.fromkeys(all_words))
            word_filter_sql = " OR ".join(["m.TextContent LIKE ?" for _ in unique_words])
            word_filter_params = [f"%{word}%" for word in unique_words]
            where_extra = (" AND " + " AND ".join(f"({clause})" for clause in filter_clauses)) if filter_clauses else ""

            if granularity == "day":
                query = f"""
                    SELECT
                      CONVERT(VARCHAR(10), m.SentAt, 120) AS bucket_key,
                      {', '.join(select_parts)}
                    FROM WebChat_MessageLogs m
                    {join_sql}
                    WHERE m.TextContent IS NOT NULL AND m.TextContent != ''
                      AND ({word_filter_sql})
                    {where_extra}
                    GROUP BY CONVERT(VARCHAR(10), m.SentAt, 120)
                    ORDER BY bucket_key
                """
            elif granularity == "week":
                query = f"""
                    SELECT
                      CONCAT(YEAR(m.SentAt), '-W', RIGHT('0' + CAST(DATEPART(ISO_WEEK, m.SentAt) AS VARCHAR(2)), 2)) AS bucket_key,
                      MIN(CONVERT(VARCHAR(10), m.SentAt, 120)) AS bucket_start,
                      {', '.join(select_parts)}
                    FROM WebChat_MessageLogs m
                    {join_sql}
                    WHERE m.TextContent IS NOT NULL AND m.TextContent != ''
                      AND ({word_filter_sql})
                    {where_extra}
                    GROUP BY YEAR(m.SentAt), DATEPART(ISO_WEEK, m.SentAt)
                    ORDER BY MIN(m.SentAt)
                """
            else:
                query = f"""
                    SELECT
                      CONCAT(YEAR(m.SentAt), '-', RIGHT('0' + CAST(MONTH(m.SentAt) AS VARCHAR(2)), 2)) AS bucket_key,
                      YEAR(m.SentAt) AS yr,
                      MONTH(m.SentAt) AS mo,
                      {', '.join(select_parts)}
                    FROM WebChat_MessageLogs m
                    {join_sql}
                    WHERE m.TextContent IS NOT NULL AND m.TextContent != ''
                      AND ({word_filter_sql})
                    {where_extra}
                    GROUP BY YEAR(m.SentAt), MONTH(m.SentAt)
                    ORDER BY yr, mo
                """

            return execute_query(query, tuple(select_params + word_filter_params + filter_params))
        except Exception as e:
            print("Lỗi khi get_trend_counts_for_groups:", e)
            return []

    # ─── Batch co-occurrence: 1 query cho nhiều (group_words × cross_word) ──
    def batch_count_cooccurrence(
        self,
        group_words_map: dict,
        cross_words: list,
        start_date=None,
        end_date=None,
        channel=None,
        conversation_status=None,
        ai_status=None,
    ) -> dict:
        """
        group_words_map: {group_id: [word1, word2, ...]}
        cross_words:     [cross_word1, cross_word2, ...]
        Trả về dict {(group_id, cross_word): count}
        Thực hiện 1 query duy nhất thay vì len(group_ids) × len(cross_words) queries.
        """
        if not group_words_map or not cross_words:
            return {}

        join_sql, filter_clauses, filter_params = _build_message_filters(
            start_date=start_date,
            end_date=end_date,
            channel=channel,
            conversation_status=conversation_status,
            ai_status=ai_status,
        )
        where_extra = (" AND " + " AND ".join(f"({clause})" for clause in filter_clauses)) if filter_clauses else ""

        select_parts = []
        select_params = []
        col_map = {}
        col_idx = 0

        for group_id, group_words in group_words_map.items():
            if not group_words:
                continue
            group_or = " OR ".join(["m.TextContent LIKE ?" for _ in group_words])
            for cw in cross_words:
                col_name = f"col_{col_idx}"
                col_map[col_name] = (group_id, cw)
                select_parts.append(
                    f"SUM(CASE WHEN m.TextContent LIKE ? AND ({group_or}) THEN 1 ELSE 0 END) AS {col_name}"
                )
                select_params.append(f"%{cw}%")
                for gw in group_words:
                    select_params.append(f"%{gw}%")
                col_idx += 1

        if not select_parts:
            return {}

        query = f"""
            SELECT {', '.join(select_parts)}
            FROM WebChat_MessageLogs m
            {join_sql}
            WHERE m.TextContent IS NOT NULL AND m.TextContent != ''
            {where_extra}
        """

        try:
            rows = execute_query(query, tuple(select_params + filter_params))
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
            conversation_status=filters.get("conversationStatus"),
            ai_status=filters.get("aiStatus"),
        )
        return res.get(("_single", cross_word), 0)


keyword_repository = KeywordRepository()
