from backend.config.db import get_db_connection


def _to_pymssql_query(query: str) -> str:
    """Convert pyodbc-style placeholders used by keyword queries to pymssql placeholders."""
    return query.replace("?", "%s")


def execute_query(query: str, params: tuple = ()) -> list:
    """Execute a SQL query and return rows as dictionaries."""
    conn = get_db_connection()
    try:
        with conn.cursor(as_dict=True) as cursor:
            cursor.execute(_to_pymssql_query(query), params)
            if cursor.description:
                return cursor.fetchall()
            conn.commit()
            return []
    except Exception as e:
        conn.rollback()
        print(f"Query execution failed: {query}. Error: {str(e)}")
        raise
    finally:
        conn.close()
