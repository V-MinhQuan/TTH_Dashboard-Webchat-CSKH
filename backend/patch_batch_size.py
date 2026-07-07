import os
import re

target_file = r"d:\WebChat_Project\TTH_Dashboard-Webchat-CSKH\backend\app\keywords\repository.py"

with open(target_file, "r", encoding="utf-8") as f:
    content = f.read()

content = re.sub(r"KEYWORD_COUNT_BATCH_SIZE = \d+", "KEYWORD_COUNT_BATCH_SIZE = 15", content)

with open(target_file, "w", encoding="utf-8") as f:
    f.write(content)

print("Batch size updated to 15")
