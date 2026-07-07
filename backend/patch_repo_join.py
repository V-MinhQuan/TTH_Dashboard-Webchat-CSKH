import os
import re

target_file = r"d:\WebChat_Project\TTH_Dashboard-Webchat-CSKH\backend\app\keywords\repository.py"

with open(target_file, "r", encoding="utf-8") as f:
    content = f.read()

# We need to add the join condition check
fix_code = """
        join_sql, filter_clauses, filter_params = _build_message_filters(
            channel=channel,
            conversation_status=conversation_status,
            ai_status=ai_status,
        )
        if "WebChat_MessageAnalytics a" not in join_sql:
            join_sql += " LEFT JOIN dbo.WebChat_MessageAnalytics a ON m.id_webchat_messageLogs = a.messageId"
"""

# Replace the specific part
pattern = re.compile(
    r"join_sql, filter_clauses, filter_params = _build_message_filters\(.*?\)",
    re.DOTALL
)

if pattern.search(content):
    content = pattern.sub(fix_code.strip(), content, count=1)
    with open(target_file, "w", encoding="utf-8") as f:
        f.write(content)
    print("repository.py patched with join fix successfully.")
else:
    print("Could not find the block to replace in repository.py")
