import os
import sys
import time

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.keywords.repository import KeywordRepository

def test():
    repo = KeywordRepository()
    all_keywords = repo.get_all()
    group_map = {}
    for kw in all_keywords:
        gid = kw.get("groupId")
        if gid not in group_map:
            group_map[gid] = []
        if kw.get("status") == "active":
            group_map[gid].append(kw["word"])

    start_date = "2024-05-01"
    end_date = "2024-06-01"

    print("Testing batch_count_keyword_occurrences...")
    start = time.time()
    try:
        words = list(dict.fromkeys(w for v in group_map.values() for w in v if w))
        repo.batch_count_keyword_occurrences(words, start_date=start_date, end_date=end_date)
        print(f"batch_count_keyword_occurrences took {time.time() - start:.2f}s")
    except Exception as e:
        print(f"Failed: {e}")

    print("Testing batch_count_groups...")
    start = time.time()
    try:
        group_counts = repo.batch_count_groups(group_map, start_date=start_date, end_date=end_date)
        print(f"batch_count_groups took {time.time() - start:.2f}s")
    except Exception as e:
        print(f"failed: {e}")
        
    print("Testing batch_count_ai_failed_groups...")
    start = time.time()
    try:
        ai_failed_counts = repo.batch_count_ai_failed_groups(group_map, start_date=start_date, end_date=end_date)
        print(f"batch_count_ai_failed_groups took {time.time() - start:.2f}s")
    except Exception as e:
        print(f"failed: {e}")

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    test()
