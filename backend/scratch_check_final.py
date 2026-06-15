import os
from dotenv import load_dotenv
load_dotenv()
from app.db.session import get_connection

with get_connection() as conn:
    c = conn.cursor()
    c.execute("""
        SELECT TOP 5 a.id, a.messageId, a.customerId as a_cust, c.CustomerId as c_cust, a.conversationId
        FROM dbo.WebChat_MessageAnalytics a
        LEFT JOIN dbo.WebChat_Conversations c ON c.Id = a.conversationId
        WHERE a.issueFlag = 1
    """)
    for row in c.fetchall():
        print(f"a.id={row[0]} a_cust={row[2]} c_cust={row[3]} conv_id={row[4]}")
