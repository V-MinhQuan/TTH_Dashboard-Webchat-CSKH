import os
from dotenv import load_dotenv
load_dotenv()
from app.db.session import get_connection

with get_connection() as conn:
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM dbo.WebChat_MessageAnalytics WHERE issueFlag = 1")
    count = c.fetchone()[0]
    print(f"Number of rows with issueFlag=1 currently: {count}")
