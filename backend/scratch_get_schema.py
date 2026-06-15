import os
from dotenv import load_dotenv
load_dotenv()
from app.db.session import get_connection

with get_connection() as conn:
    c = conn.cursor()
    c.execute("""
        SELECT 
            c.name AS ColumnName,
            t.name AS DataType,
            c.max_length AS MaxLength,
            c.is_nullable AS IsNullable
        FROM sys.columns c
        INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
        WHERE c.object_id = OBJECT_ID('dbo.WebChat_MessageAnalytics')
    """)
    rows = c.fetchall()
    print("=== WebChat_MessageAnalytics SCHEMA ===")
    for r in rows:
        print(f"{r[0]} - {r[1]} ({r[2]}) - Nullable: {r[3]}")
