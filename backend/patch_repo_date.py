import os
import re

target_file = r"d:\WebChat_Project\TTH_Dashboard-Webchat-CSKH\backend\app\keywords\repository.py"

with open(target_file, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    "join_sql, filter_clauses, filter_params = _build_message_filters(channel=channel, conversation_status=conversation_status, ai_status=ai_status)",
    "join_sql, filter_clauses, filter_params = _build_message_filters(start_date=start_date, end_date=end_date, channel=channel, conversation_status=conversation_status, ai_status=ai_status)"
)

# Also remove word_filter_sql from WHERE clause in batch_count_keyword_occurrences
# Because 15 LIKE conditions per row is still slow if the date range is large (like "Tất cả")
# Wait, for "Tất cả", date range is missing, so it scans the whole table.
# If we remove the WHERE LIKE filter, it evaluates the CASE WHEN for every row.
# That's faster than evaluating LIKE twice.
pattern_kw = re.compile(r"(AND \(\{word_filter_sql\}\)\n\s+\{where_extra\})")
content = pattern_kw.sub(r"{where_extra}", content)

with open(target_file, "w", encoding="utf-8") as f:
    f.write(content)

print("Restored start_date and end_date to _build_message_filters and removed word_filter_sql from WHERE clauses.")
