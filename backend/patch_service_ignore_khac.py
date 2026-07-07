import os
import re

target_file = r"d:\WebChat_Project\TTH_Dashboard-Webchat-CSKH\backend\app\keywords\service.py"

with open(target_file, "r", encoding="utf-8") as f:
    content = f.read()

# Remove 'khac' from ORDERED_GROUP_IDS
content = content.replace("ORDERED_GROUP_IDS = ORDERED_TOPIC_GROUP_IDS", "ORDERED_GROUP_IDS = [gid for gid in ORDERED_TOPIC_GROUP_IDS if gid != 'khac']")

# Prevent querying 'khac' group by skipping it when building period_words_map
pattern = re.compile(r"(for group_id in ORDERED_GROUP_IDS:\n\s+words = group_map\.get\(group_id, \[\]\))")
if pattern.search(content):
    content = pattern.sub(r"\1\n            if group_id == 'khac': continue", content)

with open(target_file, "w", encoding="utf-8") as f:
    f.write(content)
print("service.py restored and 'khac' group ignored.")
