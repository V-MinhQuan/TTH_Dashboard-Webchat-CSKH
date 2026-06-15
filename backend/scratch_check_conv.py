import os
from dotenv import load_dotenv
load_dotenv()
from app.db.session import get_connection

with get_connection() as conn:
    c = conn.cursor()
    c.execute("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='WebChat_Conversations'")
    print([row[0] for row in c.fetchall()])
