import os
from dotenv import load_dotenv
load_dotenv()
from app.db.session import get_connection

with get_connection() as conn:
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM dbo.WebChat_MessageAnalytics")
    print("Analytics total rows:", c.fetchone()[0])
    
    c.execute("SELECT COUNT(*) FROM dbo.WebChat_MessageLogs")
    print("Logs total rows:", c.fetchone()[0])
