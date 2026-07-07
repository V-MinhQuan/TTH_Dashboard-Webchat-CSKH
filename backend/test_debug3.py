import os
import sys
import asyncio

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.keywords.repository import KeywordRepository
from app.core.legacy_db_executor import execute_query

# We will monkey patch execute_query to print the query
import app.keywords.repository
original_execute_query = app.keywords.repository.execute_query

def execute_query_hook(query, params=None):
    print("EXECUTING QUERY:")
    print(query)
    print("PARAMS:", params)
    return original_execute_query(query, params)

app.keywords.repository.execute_query = execute_query_hook

async def test():
    repo = KeywordRepository()
    words = ["toeic", "mos", "tin học"]
    
    import time
    start = time.time()
    stats = repo.batch_count_all_stats(
        words, 
        current_start="2026-06-01", 
        current_end="2026-07-07", 
        previous_start="2026-05-01", 
        previous_end="2026-06-01"
    )
    print(f"Time taken: {time.time() - start:.2f}s")

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    asyncio.run(test())
