import os
import re

target_file = r"d:\WebChat_Project\TTH_Dashboard-Webchat-CSKH\backend\app\keywords\repository.py"

with open(target_file, "r", encoding="utf-8") as f:
    content = f.read()

# Fix params tuple in batch_count_groups and batch_count_ai_failed_groups
content = content.replace(
    "params = tuple(select_params + word_filter_params + filter_params)",
    "params = tuple(select_params + filter_params)"
)

# And if I changed it to extend somewhere:
content = content.replace(
    "params.extend(word_filter_params)",
    ""
)

with open(target_file, "w", encoding="utf-8") as f:
    f.write(content)

print("Removed word_filter_params from params")
