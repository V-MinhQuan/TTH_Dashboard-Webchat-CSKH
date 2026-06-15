import os
from dotenv import load_dotenv
load_dotenv()
from app.db.session import get_connection

with get_connection() as conn:
    c = conn.cursor()
    c.execute("UPDATE dbo.WebChat_MessageAnalytics SET issueFlag = 0, issueType = NULL, issueConfidence = NULL")
    conn.commit()
    print("Reset mock data successfully.")
