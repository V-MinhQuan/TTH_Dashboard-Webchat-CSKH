import os

target_file = r"d:\WebChat_Project\TTH_Dashboard-Webchat-CSKH\backend\app\keywords\repository.py"

with open(target_file, "r", encoding="utf-8") as f:
    lines = f.readlines()

new_lines = []
in_all_stats = False

for i, line in enumerate(lines):
    if "def batch_count_all_stats" in line:
        in_all_stats = True
        
    if in_all_stats and "word_checks = []" in line:
        # We inject our fix before this
        new_lines.append('        if "WebChat_MessageAnalytics a" not in join_sql:\n')
        new_lines.append('            join_sql += " LEFT JOIN dbo.WebChat_MessageAnalytics a ON m.id_webchat_messageLogs = a.messageId"\n')
        in_all_stats = False
        
    new_lines.append(line)

with open(target_file, "w", encoding="utf-8") as f:
    f.writelines(new_lines)

print("Patch applied to batch_count_all_stats correctly.")
