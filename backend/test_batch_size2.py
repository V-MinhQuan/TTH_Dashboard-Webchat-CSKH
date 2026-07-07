import os
import sys
import time

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.core.legacy_db_executor import execute_query
from app.keywords.repository import KeywordRepository

def test():
    repo = KeywordRepository()
    all_keywords = repo.get_all()
    words = list(dict.fromkeys(kw["word"] for kw in all_keywords if kw.get("status") == "active" and kw.get("word")))[:80]
    
    print(f"Testing {len(words)} words...")
    
    where_extra = " AND m.SentAt >= '2024-01-01' AND m.SentAt <= '2024-03-01' "
    
    # 1 batch of 80
    print("Testing batch size 80...")
    start = time.time()
    try:
        select_parts = [f"SUM(CASE WHEN m.TextContent LIKE ? THEN 1 ELSE 0 END) AS col_{i}" for i in range(len(words))]
        like_params = [f"%{w}%" for w in words]
        word_filter_sql = " OR ".join(["m.TextContent LIKE ?" for _ in words])
        word_filter_params = [f"%{w}%" for w in words]
        
        query = f"""
            SELECT {', '.join(select_parts)}
            FROM WebChat_MessageLogs m
            WHERE m.TextContent IS NOT NULL AND m.TextContent != ''
              AND ({word_filter_sql})
            {where_extra}
        """
        execute_query(query, tuple(like_params + word_filter_params))
        print(f"Batch 80 took {time.time() - start:.2f}s")
    except Exception as e:
        print(f"Batch 80 failed: {e}")

    # 4 batches of 20
    print("Testing batch size 20...")
    start = time.time()
    try:
        for b in range(0, len(words), 20):
            chunk = words[b:b+20]
            select_parts = [f"SUM(CASE WHEN m.TextContent LIKE ? THEN 1 ELSE 0 END) AS col_{i}" for i in range(len(chunk))]
            like_params = [f"%{w}%" for w in chunk]
            word_filter_sql = " OR ".join(["m.TextContent LIKE ?" for _ in chunk])
            word_filter_params = [f"%{w}%" for w in chunk]
            
            query = f"""
                SELECT {', '.join(select_parts)}
                FROM WebChat_MessageLogs m
                WHERE m.TextContent IS NOT NULL AND m.TextContent != ''
                  AND ({word_filter_sql})
                {where_extra}
            """
            execute_query(query, tuple(like_params + word_filter_params))
        print(f"Batch 20 took {time.time() - start:.2f}s")
    except Exception as e:
        print(f"Batch 20 failed: {e}")

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    test()
