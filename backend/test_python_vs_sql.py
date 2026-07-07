import os
import sys
import time

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.core.legacy_db_executor import execute_query
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
            
    words = list(dict.fromkeys(w for v in group_map.values() for w in v if w))
    
    start_date = "2024-05-01"
    end_date = "2024-06-01"
    where_extra = " AND m.SentAt >= '2024-05-01' AND m.SentAt <= '2024-06-01' "

    print("Testing Python Evaluation method...")
    start = time.time()
    try:
        query = f"""
            SELECT m.TextContent
            FROM WebChat_MessageLogs m
            WHERE m.TextContent IS NOT NULL AND m.TextContent != ''
            {where_extra}
        """
        rows = execute_query(query, ())
        fetch_time = time.time()
        print(f"Fetched {len(rows)} rows in {fetch_time - start:.2f}s")
        
        # Python evaluation
        results = [0] * len(words)
        for row in rows:
            text = row["TextContent"].lower()
            for i, w in enumerate(words):
                if w.lower() in text:
                    results[i] += 1
        
        eval_time = time.time()
        print(f"Python eval took {eval_time - fetch_time:.2f}s")
        print(f"Total Python took {eval_time - start:.2f}s")
    except Exception as e:
        print(f"Python eval failed: {e}")

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    test()
