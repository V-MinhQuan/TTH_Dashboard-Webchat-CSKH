import os
from dotenv import load_dotenv
load_dotenv()
from app.db.session import get_connection

with get_connection() as conn:
    c = conn.cursor()
    c.execute("""
        SELECT COUNT(*)
        FROM dbo.WebChat_MessageAnalytics a
        INNER JOIN dbo.WebChat_MessageLogs m ON a.messageId = m.id_webchat_messageLogs
        WHERE m.FromHost = 1 AND m.HostDisplayName = 'AI Assistant'
          AND (
            m.TextContent LIKE N'%không tìm thấy%'
            OR m.TextContent LIKE N'%chưa có%'
            OR m.TextContent LIKE N'%chưa hỗ trợ%'
            OR m.TextContent LIKE N'%không thể%'
          )
    """)
    print("Match count for Không tìm thấy dữ liệu:", c.fetchone()[0])
