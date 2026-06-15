import os
from dotenv import load_dotenv
load_dotenv()
from app.db.session import get_connection
from app.repositories.schema_inspector import inspect_message_analytics_columns

with get_connection() as conn:
    cols = inspect_message_analytics_columns(conn)
    print(cols)
