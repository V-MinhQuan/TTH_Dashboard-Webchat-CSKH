import os
import sys
import asyncio
import time

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.core.legacy_db_executor import execute_query

def debug_query():
    print("Testing DB without join...")
    start = time.time()
    query1 = """
        SELECT COUNT(*) as cnt 
        FROM WebChat_MessageLogs m
        WHERE (m.SentAt >= '2026-06-01' AND m.SentAt <= '2026-07-07')
    """
    rows = execute_query(query1)
    print(f"Total rows in date range: {rows[0]['cnt']} (Time: {time.time() - start:.2f}s)")
    
    print("Testing DB with join...")
    start = time.time()
    query2 = """
        SELECT COUNT(*) as cnt 
        FROM WebChat_MessageLogs m
        LEFT JOIN dbo.WebChat_MessageAnalytics a ON m.id_webchat_messageLogs = a.messageId
        WHERE (m.SentAt >= '2026-06-01' AND m.SentAt <= '2026-07-07')
    """
    rows = execute_query(query2)
    print(f"Total rows in date range WITH join: {rows[0]['cnt']} (Time: {time.time() - start:.2f}s)")
    
    print("Testing DB with 10 CASE WHENs...")
    start = time.time()
    query3 = """
        SELECT 
            SUM(CASE WHEN m.TextContent LIKE '%toeic%' THEN 1 ELSE 0 END) as w1,
            SUM(CASE WHEN m.TextContent LIKE '%mos%' THEN 1 ELSE 0 END) as w2,
            SUM(CASE WHEN m.TextContent LIKE '%tin học%' THEN 1 ELSE 0 END) as w3,
            SUM(CASE WHEN m.TextContent LIKE '%tiếng anh%' THEN 1 ELSE 0 END) as w4,
            SUM(CASE WHEN m.TextContent LIKE '%lịch thi%' THEN 1 ELSE 0 END) as w5
        FROM WebChat_MessageLogs m
        WHERE (m.SentAt >= '2026-06-01' AND m.SentAt <= '2026-07-07')
    """
    rows = execute_query(query3)
    print(f"Results: {rows[0]} (Time: {time.time() - start:.2f}s)")

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    debug_query()
