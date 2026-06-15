import os
from dotenv import load_dotenv
load_dotenv()
from app.db.session import get_connection

with get_connection() as conn:
    c = conn.cursor()
    # Query AI failed messages and the very next user message (if any)
    c.execute("""
        SELECT TOP 10 
            a.messageId,
            m_ai.TextContent as AI_Text,
            m_user.TextContent as Next_User_Text,
            a_user.sentimentScore as Next_User_Sentiment,
            a.satisfactionScore,
            a.issueType,
            a.issueConfidence
        FROM dbo.WebChat_MessageAnalytics a
        JOIN dbo.WebChat_MessageLogs m_ai ON a.messageId = m_ai.id_webchat_messagelogs
        OUTER APPLY (
            SELECT TOP 1 id_webchat_messagelogs, TextContent
            FROM dbo.WebChat_MessageLogs next_m
            WHERE next_m.ConversationId = m_ai.ConversationId
              AND next_m.SentAt > m_ai.SentAt
              AND next_m.FromCustomer = 1
            ORDER BY next_m.SentAt ASC
        ) m_user
        LEFT JOIN dbo.WebChat_MessageAnalytics a_user ON m_user.id_webchat_messagelogs = a_user.messageId
        WHERE a.issueFlag = 1
    """)
    rows = c.fetchall()
    for r in rows:
        print(f"AI Issue: {r[5]} (Conf: {r[6]}) | SatScore: {r[4]}")
        print(f"AI: {r[1][:50]}...")
        if r[2]:
            print(f"User reply: {r[2][:50]}... | Sentiment: {r[3]}")
        else:
            print("User reply: None")
        print("-" * 40)
