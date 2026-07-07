import os

target_file = r"d:\WebChat_Project\TTH_Dashboard-Webchat-CSKH\backend\app\keywords\repository.py"

with open(target_file, "r", encoding="utf-8") as f:
    content = f.read()

# Replace a.aiStatus = 'failed' with a.issueFlag = 1
new_content = content.replace("a.aiStatus = 'failed'", "a.issueFlag = 1")

with open(target_file, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Patched a.issueFlag = 1 successfully.")
