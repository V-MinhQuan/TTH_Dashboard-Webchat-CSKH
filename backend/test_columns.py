from app.db.session import execute_one, get_connection

with get_connection() as conn:
    row = execute_one(conn, "SELECT TOP 1 * FROM dbo.WebChat_MessageLogs")
    print(list(row.keys()))
