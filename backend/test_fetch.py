import os
import sys
import time

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.core.legacy_db_executor import execute_query

def test():
    query = """
        SELECT TOP 50000 m.TextContent
        FROM WebChat_MessageLogs m
        WHERE m.TextContent IS NOT NULL
    """
    
    start = time.time()
    try:
        rows = execute_query(query, ())
        print(f"Fetched {len(rows)} rows in {time.time() - start:.2f}s")
    except Exception as e:
        print(f"Failed: {e}")

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    test()
