import os
from dotenv import load_dotenv
load_dotenv()
from app.db.session import get_connection

with get_connection() as conn:
    c = conn.cursor()
    c.execute("""
        SELECT TOP 10 detectedTopics, COUNT(*)
        FROM dbo.WebChat_MessageAnalytics
        GROUP BY detectedTopics
    """)
    for r in c.fetchall():
        print(r)
