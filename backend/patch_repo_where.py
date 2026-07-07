import os
import re

target_file = r"d:\WebChat_Project\TTH_Dashboard-Webchat-CSKH\backend\app\keywords\repository.py"

with open(target_file, "r", encoding="utf-8") as f:
    content = f.read()

# Fix batch_count_groups: remove AND ({word_filter_sql})
# Old code:
#         query = f\"\"\"
#             SELECT {', '.join(select_parts)}
#             FROM WebChat_MessageLogs m
#             {join_sql}
#             WHERE m.TextContent IS NOT NULL AND m.TextContent != ''
#               AND ({word_filter_sql})
#               {where_extra}
#         \"\"\"
#         
#         params = []
#         params.extend(word_filter_params)
#         params.extend(select_params)
#         params.extend(filter_params)

pattern_groups = re.compile(r"(AND \(\{word_filter_sql\}\)\n\s+\{where_extra\})")
content = pattern_groups.sub(r"{where_extra}", content)

pattern_params1 = re.compile(r"params\.extend\(word_filter_params\)\n\s+params\.extend\(select_params\)")
content = pattern_params1.sub(r"params.extend(select_params)", content)

# Do the same for batch_count_ai_failed_groups
pattern_params2 = re.compile(r"params\.extend\(word_filter_params\)\n\s+params\.extend\(select_params\)")
content = pattern_params2.sub(r"params.extend(select_params)", content)

with open(target_file, "w", encoding="utf-8") as f:
    f.write(content)

print("Removed word_filter_sql from WHERE clauses.")
