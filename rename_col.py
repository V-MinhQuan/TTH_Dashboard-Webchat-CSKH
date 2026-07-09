import sys
sys.path.append('backend')
from app.core.legacy_db import get_db_connection
from app.sheet_chatbot.repository import SQL_TABLE_NAME

conn = get_db_connection()
cursor = conn.cursor()
try:
    cursor.execute(f"EXEC sp_rename '{SQL_TABLE_NAME}.Channel', 'Source', 'COLUMN'")
    conn.commit()
    print('Renamed Channel to Source successfully.')
except Exception as e:
    print('Error:', e)
