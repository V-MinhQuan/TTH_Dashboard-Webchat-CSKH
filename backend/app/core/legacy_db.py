import os
from pathlib import Path
import pymssql
from dotenv import load_dotenv

# Load .env from root or backend directory
root_env = Path(__file__).resolve().parents[2] / ".env"
local_env = Path(__file__).resolve().parents[1] / ".env"

if local_env.exists():
    load_dotenv(dotenv_path=local_env)
elif root_env.exists():
    load_dotenv(dotenv_path=root_env)
else:
    load_dotenv()

DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_SERVER = os.getenv("DB_SERVER", "14.225.192.252")
DB_PORT = int(os.getenv("DB_PORT", "1433"))
DB_DATABASE = os.getenv("DB_DATABASE")

print("Đang cấu hình kết nối Database với:")
print({
    "server": DB_SERVER,
    "port": DB_PORT,
    "database": DB_DATABASE,
    "user": DB_USER
})

def get_db_connection():
    """
    Tạo kết nối mới tới Microsoft SQL Server sử dụng pymssql.
    Trả về đối tượng connection. Người gọi có trách nhiệm đóng connection này.
    """
    try:
        conn = pymssql.connect(
            server=DB_SERVER,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_DATABASE,
            port=DB_PORT,
            tds_version='7.0',
            timeout=30,
            login_timeout=10
        )
        return conn
    except Exception as e:
        print("=== KẾT NỐI DATABASE THẤT BẠI ===")
        print(f"Chi tiết lỗi: {str(e)}")
        raise RuntimeError(f"Database connection failed: {str(e)}")
