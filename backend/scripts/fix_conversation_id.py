import os
from dotenv import load_dotenv
load_dotenv()
from app.db.session import get_connection

with get_connection() as conn:
    c = conn.cursor()
    c.execute("""
        UPDATE a
        SET a.conversationId = c.Id
        FROM dbo.WebChat_MessageAnalytics a
        INNER JOIN dbo.WebChat_MessageLogs m ON a.messageId = m.id_webchat_messageLogs
        INNER JOIN dbo.WebChat_Conversations c ON c.Source = m.Source
            AND c.CustomerId = CASE
                WHEN m.FromHost = 1 THEN m.ReceiverId
                ELSE m.SenderId
            END
        WHERE a.conversationId IS NULL
    """)
    updated = c.rowcount
    conn.commit()
    print(f"Updated {updated} rows with conversationId")
