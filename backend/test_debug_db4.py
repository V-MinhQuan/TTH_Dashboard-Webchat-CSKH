import os
import sys
import asyncio
import time

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.core.legacy_db_executor import execute_query

def debug_query():
    print("Testing DB with 80 CASE WHENs...")
    
    words = [f"word_{i}" for i in range(80)]
    # We will simulate 80 words (just use arbitrary strings)
    
    word_checks = []
    for i, word in enumerate(words):
        word_checks.append(f"SUM(CASE WHEN m.TextContent LIKE '%{word}%' THEN 1 ELSE 0 END) as w_{i}")
        
    start = time.time()
    query = f"""
        SELECT 
            {', '.join(word_checks)}
        FROM WebChat_MessageLogs m
        WHERE (m.SentAt >= '2026-06-01' AND m.SentAt <= '2026-07-07')
    """
    rows = execute_query(query)
    print(f"Time taken for 80 LIKEs: {time.time() - start:.2f}s")

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    debug_query()
