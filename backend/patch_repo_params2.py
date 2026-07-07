import os
import re

target_file = r"d:\WebChat_Project\TTH_Dashboard-Webchat-CSKH\backend\app\keywords\repository.py"

with open(target_file, "r", encoding="utf-8") as f:
    content = f.read()

# Fix parameter order bug in batch_count_ai_failed_groups
# Old: tuple(select_params + match_params + filter_params)
# New: tuple(select_params + filter_params + match_params)
content = content.replace(
    "tuple(select_params + match_params + filter_params)",
    "tuple(select_params + filter_params + match_params)"
)

# And wait! What about batch_count_groups?
# I already fixed batch_count_groups by removing word_filter_params.
# So batch_count_groups is: tuple(select_params + filter_params) which is correct because the query is: SELECT (select) FROM WHERE (filter).
# Let's also completely remove word_filter_sql from batch_count_ai_failed_groups?
# Actually, batch_count_ai_failed_groups uses match_sql.
# If I leave match_sql there, it will do string matching, which is slow but maybe okay since ai_failed query has JOINs and filters so the row count is smaller.
# Let's just fix the parameter order first.

with open(target_file, "w", encoding="utf-8") as f:
    f.write(content)

print("Fixed match_params order in batch_count_ai_failed_groups")
