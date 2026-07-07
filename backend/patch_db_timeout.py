import re

target_file = r"d:\WebChat_Project\TTH_Dashboard-Webchat-CSKH\backend\app\core\legacy_db.py"

with open(target_file, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("timeout=30,", "timeout=120,")
content = content.replace("login_timeout=10", "login_timeout=30")

with open(target_file, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated pymssql timeout to 120s")
