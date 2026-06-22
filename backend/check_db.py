import sys
import os
sys.path.append(os.path.abspath(os.path.dirname(__file__)))
from app.db.session import get_connection

try:
    with get_connection() as conn:
        print("Connection successful!")
        cursor = conn.cursor()
        cursor.execute("SELECT TOP 1 UserName FROM [User]")
        row = cursor.fetchone()
        print(f"Sample user: {row}")
except Exception as e:
    print(f"Connection failed: {e}")
