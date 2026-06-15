import os
from dotenv import load_dotenv
load_dotenv()
from app.db.session import get_connection

with get_connection() as conn:
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM dbo.WebChat_MessageAnalytics WHERE needStaffReview = 1")
    print("needStaffReview=1:", c.fetchone()[0])
