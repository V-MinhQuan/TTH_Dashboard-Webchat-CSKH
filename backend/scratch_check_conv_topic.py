import os
from dotenv import load_dotenv
load_dotenv()
from app.db.session import get_connection

with get_connection() as conn:
    c = conn.cursor()
    c.execute("""
        SELECT TOP 5 a.conversationId, c.Topic
        FROM dbo.WebChat_MessageAnalytics a
        JOIN dbo.WebChat_Conversations c ON a.conversationId = c.Id
        WHERE a.issueFlag = 1
    """)
    for r in c.fetchall():
        print(r)
