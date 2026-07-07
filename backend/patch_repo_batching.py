import os
import re

target_file = r"d:\WebChat_Project\TTH_Dashboard-Webchat-CSKH\backend\app\keywords\repository.py"

with open(target_file, "r", encoding="utf-8") as f:
    content = f.read()

new_method = """
    def batch_count_all_stats(
        self,
        words: list[str],
        current_start: str,
        current_end: str,
        previous_start: str,
        previous_end: str,
        channel: str = None,
        conversation_status: str = None,
        ai_status: str = None,
    ) -> dict:
        if not words:
            return {}

        # Batch the words to avoid SQL Server timeout with too many LIKEs + JOINs
        if len(words) > KEYWORD_COUNT_BATCH_SIZE:
            merged = {}
            for start in range(0, len(words), KEYWORD_COUNT_BATCH_SIZE):
                chunk = words[start:start + KEYWORD_COUNT_BATCH_SIZE]
                chunk_result = self.batch_count_all_stats(
                    chunk,
                    current_start=current_start,
                    current_end=current_end,
                    previous_start=previous_start,
                    previous_end=previous_end,
                    channel=channel,
                    conversation_status=conversation_status,
                    ai_status=ai_status,
                )
                merged.update(chunk_result)
            return merged

        join_sql, filter_clauses, filter_params = _build_message_filters(
            channel=channel,
            conversation_status=conversation_status,
            ai_status=ai_status,
        )

        if "WebChat_MessageAnalytics a" not in join_sql:
            join_sql += " LEFT JOIN dbo.WebChat_MessageAnalytics a ON m.id_webchat_messageLogs = a.messageId"
            
        word_checks = []
        for i, word in enumerate(words):
            word_checks.append(f"CASE WHEN m.TextContent LIKE ? THEN 1 ELSE 0 END AS w_{i}")
        
        word_filter_sql = " OR ".join(["m.TextContent LIKE ?" for _ in words])
        word_filter_params = [f"%{word}%" for word in words]
        
        cur_s = _parse_filter_datetime(current_start)
        cur_e = _parse_filter_datetime(current_end, is_end=True)
        prev_s = _parse_filter_datetime(previous_start)
        prev_e = _parse_filter_datetime(previous_end, is_end=True)
        
        inner_query = f\"\"\"
            SELECT 
                {', '.join(word_checks)},
                CASE WHEN m.SentAt >= ? AND m.SentAt <= ? THEN 1 ELSE 0 END AS is_cur,
                CASE WHEN m.SentAt >= ? AND m.SentAt <= ? THEN 1 ELSE 0 END AS is_prev,
                CASE WHEN a.issueFlag = 1 THEN 1 ELSE 0 END AS is_failed
            FROM WebChat_MessageLogs m
            {join_sql}
            WHERE m.TextContent IS NOT NULL AND m.TextContent != ''
              AND ({word_filter_sql})
              AND (
                  (m.SentAt >= ? AND m.SentAt <= ?) OR 
                  (m.SentAt >= ? AND m.SentAt <= ?)
              )
              {' AND ' + ' AND '.join(filter_clauses) if filter_clauses else ''}
        \"\"\"
        
        select_parts = []
        for i in range(len(words)):
            select_parts.append(f"SUM(CASE WHEN w_{i}=1 AND is_cur=1 THEN 1 ELSE 0 END) AS cur_{i}")
            select_parts.append(f"SUM(CASE WHEN w_{i}=1 AND is_prev=1 THEN 1 ELSE 0 END) AS prev_{i}")
            select_parts.append(f"SUM(CASE WHEN w_{i}=1 AND is_cur=1 AND is_failed=1 THEN 1 ELSE 0 END) AS failed_{i}")
            
        outer_query = f\"\"\"
            SELECT {', '.join(select_parts)}
            FROM ({inner_query}) t
        \"\"\"
        
        params = []
        params.extend(word_filter_params)
        params.extend([cur_s, cur_e])
        params.extend([prev_s, prev_e])
        params.extend(word_filter_params)
        params.extend([cur_s, cur_e, prev_s, prev_e])
        params.extend(filter_params)

        try:
            from app.core.legacy_db_executor import execute_query
            rows = execute_query(outer_query, tuple(params))
            row = rows[0] if rows else {}
            
            result = {}
            for i, word in enumerate(words):
                result[word] = {
                    "cur": row.get(f"cur_{i}") or 0,
                    "prev": row.get(f"prev_{i}") or 0,
                    "failed": row.get(f"failed_{i}") or 0,
                }
            return result
        except Exception as e:
            print("Lỗi batch_count_all_stats:", e)
            return {word: {"cur": 0, "prev": 0, "failed": 0} for word in words}
"""

pattern = re.compile(r"    def batch_count_all_stats\(.*?except Exception as e:.*?return \{word: \{\"cur\": 0, \"prev\": 0, \"failed\": 0\} for word in words\}\n", re.DOTALL)
if pattern.search(content):
    content = pattern.sub(new_method + "\n", content)
    with open(target_file, "w", encoding="utf-8") as f:
        f.write(content)
    print("Method patched with batching successfully.")
else:
    print("Could not find the method to replace.")
