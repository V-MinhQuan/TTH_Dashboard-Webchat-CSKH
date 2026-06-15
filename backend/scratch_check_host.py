import os
from dotenv import load_dotenv
load_dotenv()
from app.db.session import get_connection

with get_connection() as conn:
    c = conn.cursor()
    c.execute("""
        SELECT FromHost, HostDisplayName, COUNT(*)
        FROM dbo.WebChat_MessageLogs
        GROUP BY FromHost, HostDisplayName
    """)
    for r in c.fetchall():
        print(r)
