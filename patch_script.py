import re
import sys

def patch_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Patch batch_count_groups
    def replace_batch_count_groups(m):
        return """    def batch_count_groups(
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
        has_khac = "khac" in group_words_map

        for group_id, words in group_words_map.items():
            if not words or group_id == "khac":
                continue
            all_words.extend(words)
            group_or = " OR ".join(["m.TextContent LIKE ?" for _ in words])
            select_parts.append(f"SUM(CASE WHEN ({group_or}) THEN 1 ELSE 0 END) AS [{group_id}]")
            select_params.extend([f"%{word}%" for word in words])

        unique_words = list(dict.fromkeys(all_words))
        word_filter_sql = " OR ".join(["m.TextContent LIKE ?" for _ in unique_words])
        word_filter_params = [f"%{word}%" for word in unique_words]
        where_extra = (" AND " + " AND ".join(f"({clause})" for clause in filter_clauses)) if filter_clauses else ""

        total_messages = 0
        if has_khac:
            total_query = f\"\"\"
                SELECT COUNT(*)
                FROM WebChat_MessageLogs m
                {join_sql}
                WHERE m.TextContent IS NOT NULL AND m.TextContent != ''
                {where_extra}
            \"\"\"
            try:
                total_rows = execute_query(total_query, tuple(filter_params))
                if total_rows and isinstance(total_rows[0], dict):
                    total_messages = list(total_rows[0].values())[0]
            except Exception as e:
                print("Lỗi count total groups:", e)

        if not select_parts or not word_filter_sql:
            result = {group_id: 0 for group_id in group_words_map if group_id != "khac"}
            if has_khac:
                result["khac"] = total_messages
            return result

        select_parts.append("COUNT(*) AS [matched_total]")
        query = f\"\"\"
            SELECT {', '.join(select_parts)}
            FROM WebChat_MessageLogs m
            {join_sql}
            WHERE m.TextContent IS NOT NULL AND m.TextContent != ''
              AND ({word_filter_sql})
            {where_extra}
        \"\"\"
        params = tuple(select_params + word_filter_params + filter_params)

        try:
            rows = execute_query(query, params)
            row = rows[0] if rows else {}
            result = {group_id: row.get(group_id) or 0 for group_id in group_words_map if group_id != "khac"}
            if has_khac:
                matched_total = row.get("matched_total") or 0
                result["khac"] = max(0, total_messages - matched_total)
            return result
        except Exception as e:
            print("Lỗi batch_count_groups:", e)
            return {group_id: 0 for group_id in group_words_map}"""

    # 2. Patch batch_count_ai_failed_groups
    def replace_batch_count_ai_failed(m):
        return """    def batch_count_ai_failed_groups(
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

        if ai_status == "AI trả lời thành công":
            return {group_id: 0 for group_id in group_words_map}

        select_parts = []
        select_params = []
        all_words = []
        has_khac = "khac" in group_words_map

        for group_id, words in group_words_map.items():
            if not words or group_id == "khac":
                continue
            all_words.extend(words)
            match_sql, match_params = _analytics_keyword_match(words)
            select_parts.append(f"SUM(CASE WHEN {match_sql} THEN 1 ELSE 0 END) AS [{group_id}]")
            select_params.extend(match_params)

        unique_words = list(dict.fromkeys(all_words))

        clauses = ["a.issueFlag = 1"]
        filter_params = []

        if start_date:
            clauses.append("a.messageAt >= ?")
            filter_params.append(_parse_filter_datetime(start_date))

        if end_date:
            clauses.append("a.messageAt <= ?")
            filter_params.append(_parse_filter_datetime(end_date, is_end=True))

        if channel:
            source_values = _source_match_values(channel)
            placeholders = ", ".join(["?"] * len(source_values))
            clauses.append(f"{_normalized_source_expr('a.source')} IN ({placeholders})")
            filter_params.extend(source_values)

        if conversation_status and conversation_status != "Tất cả":
            closed_sql = "(s.NoResponseNeeded = 1 AND (s.MarkedAt IS NULL OR c.LastCustomerMessageAt <= s.MarkedAt))"
            reopened_sql = "(s.NoResponseNeeded = 1 AND s.MarkedAt IS NOT NULL AND c.LastCustomerMessageAt > s.MarkedAt)"

            if conversation_status == "Chờ xử lý":
                clauses.append(f"c.CustomerId IS NOT NULL AND ({reopened_sql} OR c.LastHostMessageAt IS NULL)")
            elif conversation_status in ("Đang xử lý", "Đang tư vấn", "Đang tư vấn / Chờ phản hồi"):
                clauses.append(f"c.CustomerId IS NOT NULL AND NOT ({closed_sql}) AND NOT ({reopened_sql}) AND c.LastHostMessageAt IS NOT NULL")
            elif conversation_status == "Hoàn thành":
                clauses.append(f"c.CustomerId IS NOT NULL AND {closed_sql}")

        if ai_status and ai_status != "Tất cả":
            if ai_status == "Không tìm thấy dữ liệu":
                clauses.append("a.issueType = N'Không tìm thấy dữ liệu'")
            elif ai_status in ("AI không chắc chắn", "AI trả lời không chắc chắn"):
                clauses.append("a.issueType IN (N'AI không chắc chắn', N'AI có nguy cơ tự tạo thông tin')")

        where_sql = " AND ".join(f"({clause})" for clause in clauses)
        
        base_from_join = \"\"\"
            FROM dbo.WebChat_MessageAnalytics a
            LEFT JOIN dbo.WebChat_MessageLogs m
              ON m.id_webchat_messageLogs = a.messageId
            LEFT JOIN dbo.WebChat_Conversations c
              ON c.Id = a.conversationId
            LEFT JOIN dbo.WebChat_ConversationStatus s
              ON c.CustomerId = s.CustomerId
             AND c.Source = s.Source
            OUTER APPLY (
                SELECT TOP 1 cmsg.TextContent
                FROM dbo.WebChat_MessageLogs cmsg
                WHERE cmsg.Source = c.Source
                  AND cmsg.SenderId = c.CustomerId
                  AND cmsg.FromHost = 0
                  AND cmsg.SentAt <= a.messageAt
                ORDER BY cmsg.SentAt DESC
            ) cmsg
        \"\"\"

        total_messages = 0
        if has_khac:
            total_query = f\"\"\"
                SELECT COUNT(*)
                {base_from_join}
                WHERE {where_sql}
            \"\"\"
            try:
                total_rows = execute_query(total_query, tuple(filter_params))
                if total_rows and isinstance(total_rows[0], dict):
                    total_messages = list(total_rows[0].values())[0]
            except Exception as e:
                print("Lỗi count total ai failed:", e)

        if not select_parts or not unique_words:
            result = {group_id: 0 for group_id in group_words_map if group_id != "khac"}
            if has_khac:
                result["khac"] = total_messages
            return result

        match_sql, match_params = _analytics_keyword_match(unique_words)
        select_parts.append("COUNT(*) AS [matched_total]")
        
        query = f\"\"\"
            SELECT {', '.join(select_parts)}
            {base_from_join}
            WHERE {where_sql} AND ({match_sql})
        \"\"\"

        try:
            rows = execute_query(query, tuple(select_params + match_params + filter_params))
            row = rows[0] if rows else {}
            result = {group_id: row.get(group_id) or 0 for group_id in group_words_map if group_id != "khac"}
            if has_khac:
                matched_total = row.get("matched_total") or 0
                result["khac"] = max(0, total_messages - matched_total)
            return result
        except Exception as e:
            print("Lỗi batch_count_ai_failed_groups:", e)
            return {group_id: 0 for group_id in group_words_map}"""

    pattern1 = re.compile(r'    def batch_count_groups\((.*?)(?=\n    def batch_count_keywords_and_groups)', re.DOTALL)
    content = pattern1.sub(replace_batch_count_groups, content)
    
    pattern2 = re.compile(r'    def batch_count_ai_failed_groups\((.*?)(?=\n    def get_monthly_counts_for_words)', re.DOTALL)
    content = pattern2.sub(replace_batch_count_ai_failed, content)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
        print("Patched successfully!")

if __name__ == "__main__":
    patch_file("backend/app/keywords/repository.py")
