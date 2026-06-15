import os
from dotenv import load_dotenv
load_dotenv()
from app.db.session import get_connection

with get_connection() as conn:
    c = conn.cursor()
    c.execute("""
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN issueFlag = 1 THEN 1 ELSE 0 END) AS failure_count,
            AVG(issueConfidence) AS avg_confidence
        FROM dbo.WebChat_MessageAnalytics
    """)
    print(c.fetchone())
