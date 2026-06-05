import pyodbc
import config

def get_db_connection():
    drivers = pyodbc.drivers()
    sql_driver = None
    
    # Prioritize ODBC Driver 17 for SQL Server, then fallback to legacy SQL Server
    for d in ["ODBC Driver 17 for SQL Server", "SQL Server"]:
        if d in drivers:
            sql_driver = d
            break
            
    if not sql_driver:
        if drivers:
            sql_driver = drivers[0]
        else:
            raise Exception("No ODBC drivers found on the system.")

    conn_str = (
        f"DRIVER={{{sql_driver}}};"
        f"SERVER={config.DB_SERVER},{config.DB_PORT};"
        f"DATABASE={config.DB_DATABASE};"
        f"UID={config.DB_USER};"
        f"PWD={config.DB_PASSWORD};"
        "Encrypt=no;"
        "TrustServerCertificate=yes;"
    )
    
    try:
        conn = pyodbc.connect(conn_str, timeout=15)
        return conn
    except Exception as e:
        print("=== DATABASE CONNECTION FAILED ===")
        print("Error details:", str(e))
        raise Exception(f"Database connection failed: {str(e)}")

def execute_query(query: str, params: tuple = ()) -> list:
    """Helper to execute query and return results as list of dicts"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(query, params)
        if cursor.description:
            columns = [column[0] for column in cursor.description]
            results = []
            for row in cursor.fetchall():
                results.append(dict(zip(columns, row)))
            return results
        else:
            conn.commit()
            return []
    except Exception as e:
        print(f"Query execution failed: {query}. Error: {str(e)}")
        raise e
    finally:
        conn.close()
