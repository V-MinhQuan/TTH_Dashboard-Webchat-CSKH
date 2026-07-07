import os
import sys
import time
from dotenv import load_dotenv
load_dotenv()

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.keywords.repository import KeywordRepository
from app.core.legacy_db_executor import execute_query

def test_batch_size(size):
    repo = KeywordRepository()
    all_keywords = repo.get_all()
    unique_words = list(dict.fromkeys(kw["word"] for kw in all_keywords if kw.get("status") == "active" and kw.get("word")))
    
    print(f"Testing batch size {size} with {len(unique_words)} words...")
    start = time.time()
    
    merged = {}
    try:
        for start_idx in range(0, len(unique_words), size):
            chunk = unique_words[start_idx:start_idx + size]
            
            # Simulated batch_count_keyword_occurrences
            select_parts = [f"SUM(CASE WHEN m.TextContent LIKE ? THEN 1 ELSE 0 END) AS col_{i}" for i in range(len(chunk))]
            like_params = [f"%{w}%" for w in chunk]
            word_filter_sql = " OR ".join(["m.TextContent LIKE ?" for _ in chunk])
            word_filter_params = [f"%{w}%" for w in chunk]
            
            query = f"""
                SELECT {', '.join(select_parts)}
                FROM WebChat_MessageLogs m
                WHERE m.TextContent IS NOT NULL AND m.TextContent != ''
                  AND ({word_filter_sql})
            """
            
            rows = execute_query(query, tuple(like_params + word_filter_params))
            if rows:
                for i, w in enumerate(chunk):
                    merged[w] = rows[0].get(f"col_{i}") or 0
                    
        print(f"Batch size {size} took {time.time() - start:.2f}s")
    except Exception as e:
        print(f"Batch size {size} failed: {e}")

if __name__ == "__main__":
    test_batch_size(20)
    test_batch_size(40)
    test_batch_size(80)
