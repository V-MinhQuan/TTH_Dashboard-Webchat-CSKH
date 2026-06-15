import os
from dotenv import load_dotenv
load_dotenv()
from app.db.session import get_connection

with get_connection() as conn:
    c = conn.cursor()
    c.execute("""
        SELECT TOP 10 messageAt, issueFlag, issueType
        FROM dbo.WebChat_MessageAnalytics
        WHERE issueFlag = 1
    """)
    for r in c.fetchall():
        print(r)
