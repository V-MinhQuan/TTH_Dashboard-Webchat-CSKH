import os
import re

target_file = r"d:\WebChat_Project\TTH_Dashboard-Webchat-CSKH\backend\app\keywords\service.py"

with open(target_file, "r", encoding="utf-8") as f:
    content = f.read()

# We need to replace the following section in get_group_stats:
#         counts = keyword_repository.batch_count_keywords_and_groups(...)
#         count_map = counts.get("keyword_counts", {})
#         current_totals = counts.get("group_totals", {})
#         previous_totals = keyword_repository.batch_count_groups(...)
#         ai_failed_totals = keyword_repository.batch_count_ai_failed_groups(...)

# with our new call.

new_code = """
        # --- NEW OPTIMIZED LOGIC ---
        all_unique_words = list(dict.fromkeys(w for words in period_words_map.values() for w in words))
        
        if all_unique_words:
            all_stats = keyword_repository.batch_count_all_stats(
                all_unique_words,
                current_start=start_date,
                current_end=end_date,
                previous_start=previous_start,
                previous_end=previous_end,
                channel=channel,
                conversation_status=conversation_status,
                ai_status=ai_status,
            )
        else:
            all_stats = {}

        # Aggregate the results
        count_map = {}
        current_totals = {}
        previous_totals = {}
        ai_failed_totals = {}

        for group_id, words in period_words_map.items():
            if group_id == "khac": continue
            g_cur = 0
            g_prev = 0
            g_failed = 0
            for w in words:
                st = all_stats.get(w, {"cur": 0, "prev": 0, "failed": 0})
                count_map[w] = count_map.get(w, 0) + st.get("cur", 0)
                g_cur += st.get("cur", 0)
                g_prev += st.get("prev", 0)
                g_failed += st.get("failed", 0)
            
            current_totals[group_id] = g_cur
            previous_totals[group_id] = g_prev
            ai_failed_totals[group_id] = g_failed
        # ----------------------------
"""

# Find the block to replace
pattern = re.compile(
    r"counts = keyword_repository\.batch_count_keywords_and_groups\(.*?\)\s*if period_words_map else \{\}\n"
    r".*?ai_failed_totals = keyword_repository\.batch_count_ai_failed_groups\(.*?\)\s*if period_words_map else \{\}",
    re.DOTALL
)

if pattern.search(content):
    content = pattern.sub(new_code.strip(), content)
    with open(target_file, "w", encoding="utf-8") as f:
        f.write(content)
    print("service.py patched successfully.")
else:
    print("Could not find the block to replace in service.py")

