import os
from dotenv import load_dotenv
load_dotenv()
from app.db.session import get_connection

with get_connection() as conn:
    c = conn.cursor()
    c.execute("""
        SELECT messageAt, issueType
        FROM dbo.WebChat_MessageAnalytics
        WHERE issueType = N'AI có nguy cơ tự tạo thông tin'
    """)
    for r in c.fetchall():
        print(r)
