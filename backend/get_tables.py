import pyodbc
from app.db.session import get_connection, execute_all
with get_connection() as conn:
    tables = execute_all(conn, "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'")
    for t in tables:
        print(t['TABLE_NAME'])
