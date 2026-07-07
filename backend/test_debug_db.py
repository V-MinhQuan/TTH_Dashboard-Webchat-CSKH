import os
import sys
import asyncio

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.core.legacy_db_executor import execute_query

def debug_query():
    # Let's count total messages containing 'toeic'
    query1 = "SELECT COUNT(*) as cnt FROM WebChat_MessageLogs WHERE TextContent LIKE '%toeic%'"
    rows = execute_query(query1)
    print(f"Total messages with 'toeic': {rows[0]['cnt']}")
    
    # What about between 2024-03-01 and 2024-06-01?
    query2 = "SELECT COUNT(*) as cnt FROM WebChat_MessageLogs WHERE TextContent LIKE '%toeic%' AND SentAt >= '2024-03-01' AND SentAt <= '2024-06-01'"
    rows = execute_query(query2)
    print(f"Total messages with 'toeic' in date range: {rows[0]['cnt']}")
    
    # What about the new query structure?
    query3 = """
        SELECT SUM(CASE WHEN TextContent LIKE '%toeic%' THEN 1 ELSE 0 END) as sum_toeic
        FROM WebChat_MessageLogs
    """
    rows = execute_query(query3)
    print(f"Sum 'toeic': {rows[0]['sum_toeic']}")
    
    query4 = """
        SELECT TOP 5 SentAt, TextContent 
        FROM WebChat_MessageLogs 
        WHERE TextContent LIKE '%toeic%'
        ORDER BY SentAt DESC
    """
    rows = execute_query(query4)
    print("Latest 5 messages with 'toeic':")
    for r in rows:
        print(f" - {r['SentAt']}: {r['TextContent'][:50]}")

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    debug_query()
