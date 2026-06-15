import os
from dotenv import load_dotenv
load_dotenv()
from app.db.session import get_connection

with get_connection() as conn:
    c = conn.cursor()
    c.execute("""
        UPDATE dbo.WebChat_MessageAnalytics
        SET detectedTopics = '["Chưa phân loại"]'
        WHERE issueFlag = 1 AND detectedTopics IS NULL
    """)
    updated = c.rowcount
    conn.commit()
    print(f"Updated {updated} rows with detectedTopics = '[\"Chưa phân loại\"]'")
