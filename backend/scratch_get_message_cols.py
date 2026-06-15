import os
from dotenv import load_dotenv
load_dotenv()
from app.db.session import get_connection

with get_connection() as conn:
    c = conn.cursor()
    c.execute("""
        SELECT TOP 1 *
        FROM dbo.WebChat_MessageLogs
    """)
    columns = [column[0] for column in c.description]
    print(columns)
