import os
import re

target_file = r"d:\WebChat_Project\TTH_Dashboard-Webchat-CSKH\backend\app\keywords\repository.py"

with open(target_file, "r", encoding="utf-8") as f:
    content = f.read()

# Fix batch_count_keyword_occurrences
pattern_kw = re.compile(
    r"(join_sql, filter_clauses, filter_params = _build_message_filters\([^)]+\)\n\s+if \"WebChat_MessageAnalytics a\" not in join_sql:\n\s+join_sql \+= \" LEFT JOIN dbo\.WebChat_MessageAnalytics a ON m\.id_webchat_messageLogs = a\.messageId\")"
)

if pattern_kw.search(content):
    content = pattern_kw.sub(
        r"join_sql, filter_clauses, filter_params = _build_message_filters(channel=channel, conversation_status=conversation_status, ai_status=ai_status)\n        if ai_status and 'WebChat_MessageAnalytics a' not in join_sql:\n            join_sql += ' LEFT JOIN dbo.WebChat_MessageAnalytics a ON m.id_webchat_messageLogs = a.messageId'",
        content
    )
    print("Patched batch_count_keyword_occurrences")

# Fix batch_count_groups (it might also have unconditional join, but let's check what it uses)
# In batch_count_groups, I saw:
#         join_sql, filter_clauses, filter_params = _build_message_filters(
#             start_date=start_date,
#             end_date=end_date,
#             channel=channel,
#             conversation_status=conversation_status,
#             ai_status=ai_status,
#         )
# AND then IT DID NOT ADD THE JOIN UNCONDITIONALLY! It only used join_sql!

with open(target_file, "w", encoding="utf-8") as f:
    f.write(content)
print("Done patching repository.py")
