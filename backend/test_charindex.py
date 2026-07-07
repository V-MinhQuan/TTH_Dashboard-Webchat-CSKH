import os
import sys
import time
from dotenv import load_dotenv
load_dotenv()

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.keywords.repository import KeywordRepository
from app.core.legacy_db_executor import execute_query

def test():
    repo = KeywordRepository()
    all_keywords = repo.get_all()
    words = [kw["word"] for kw in all_keywords if kw.get("status") == "active"]
    words = list(dict.fromkeys(word for word in words if word))[:80] # taking 80 words

    print(f"Testing {len(words)} words...")

    # Test LIKE
    select_parts = [f"SUM(CASE WHEN m.TextContent LIKE ? THEN 1 ELSE 0 END) AS col_{i}" for i in range(len(words))]
    where_parts = " OR ".join([f"m.TextContent LIKE ?" for _ in words])
    
    query_like = f"""
        SELECT {', '.join(select_parts)}
        FROM WebChat_MessageLogs m
        WHERE m.TextContent IS NOT NULL AND m.TextContent != ''
          AND ({where_parts})
    """
    params_like = [f"%{w}%" for w in words] * 2

    print("Testing LIKE...")
    start = time.time()
    try:
        execute_query(query_like, tuple(params_like))
        print(f"LIKE took {time.time() - start:.2f}s")
    except Exception as e:
        print(f"LIKE failed: {e}")

    # Test CHARINDEX
    select_parts_char = [f"SUM(CASE WHEN CHARINDEX(?, m.TextContent) > 0 THEN 1 ELSE 0 END) AS col_{i}" for i in range(len(words))]
    where_parts_char = " OR ".join([f"CHARINDEX(?, m.TextContent) > 0" for _ in words])
    
    query_char = f"""
        SELECT {', '.join(select_parts_char)}
        FROM WebChat_MessageLogs m
        WHERE m.TextContent IS NOT NULL AND m.TextContent != ''
          AND ({where_parts_char})
    """
    params_char = [w for w in words] * 2

    print("Testing CHARINDEX...")
    start = time.time()
    try:
        execute_query(query_char, tuple(params_char))
        print(f"CHARINDEX took {time.time() - start:.2f}s")
    except Exception as e:
        print(f"CHARINDEX failed: {e}")

if __name__ == "__main__":
    test()
