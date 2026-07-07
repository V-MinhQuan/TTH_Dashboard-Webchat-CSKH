import re

target_file = r"d:\WebChat_Project\TTH_Dashboard-Webchat-CSKH\backend\app\keywords\repository.py"

with open(target_file, "r", encoding="utf-8") as f:
    content = f.read()

# Fix get_trend_counts_for_groups
content = content.replace(
    "return execute_query(query, tuple(select_params + word_filter_params + filter_params))",
    "return execute_query(query, tuple(select_params + filter_params))"
)

with open(target_file, "w", encoding="utf-8") as f:
    f.write(content)

print("Fixed get_trend_counts_for_groups")
