import os
from dotenv import load_dotenv
load_dotenv()
from app.db.session import get_connection

with get_connection() as conn:
    c = conn.cursor()
    c.execute("""
        SELECT TOP 5 TextContent
        FROM dbo.WebChat_MessageLogs
        WHERE FromHost = 1 AND HostDisplayName = 'AI Assistant'
          AND (
            TextContent LIKE N'%không tìm thấy%'
            OR TextContent LIKE N'%chưa hiểu%'
          )
    """)
    for r in c.fetchall():
        print(r)
    
    c.execute("""
        SELECT COUNT(*)
        FROM dbo.WebChat_MessageLogs
        WHERE FromHost = 1 AND HostDisplayName = 'AI Assistant'
          AND (
            TextContent LIKE N'%không tìm thấy%'
            OR TextContent LIKE N'%chưa hiểu%'
          )
    """)
    print("Match count raw:", c.fetchone()[0])
