import pyodbc
from dotenv import load_dotenv
import os

load_dotenv()

DB_SERVER = os.getenv("DB_SERVER")
DB_DATABASE = os.getenv("DB_DATABASE")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")

conn_str = f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={DB_SERVER};DATABASE={DB_DATABASE};UID={DB_USER};PWD={DB_PASSWORD}"

query = """
SELECT TOP 5
    c.Id as ConversationId,
    c.LastMessageAt,
    MAX(m.SentAt) as MaxSentAt,
    DATEDIFF(day, c.LastMessageAt, MAX(m.SentAt)) as DiffMax
FROM dbo.WebChat_Conversations c
JOIN dbo.WebChat_MessageLogs m ON m.Source = c.Source AND m.ReceiverId = c.CustomerId
GROUP BY c.Id, c.LastMessageAt
HAVING ABS(DATEDIFF(day, c.LastMessageAt, MAX(m.SentAt))) > 20
"""

try:
    conn = pyodbc.connect(conn_str)
    cursor = conn.cursor()
    cursor.execute(query)
    
    print("ConversationId | LastMessageAt | MaxSentAt | DiffMax")
    for row in cursor.fetchall():
        print(f"{row.ConversationId} | {row.LastMessageAt} | {row.MaxSentAt} | {row.DiffMax}")
except Exception as e:
    print(f"Error: {e}")
