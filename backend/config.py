import os
from pathlib import Path
from dotenv import load_dotenv

# Find .env in current directory or parent directory
backend_dir = Path(__file__).resolve().parent
parent_dir = backend_dir.parent

load_dotenv(dotenv_path=backend_dir / ".env")
load_dotenv(dotenv_path=parent_dir / ".env")

PORT = int(os.getenv("PORT", 5000))
CORS_ORIGIN = os.getenv("CORS_ORIGIN", "*")

DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_SERVER = os.getenv("DB_SERVER", "localhost")
DB_PORT = int(os.getenv("DB_PORT", 1433))
DB_DATABASE = os.getenv("DB_DATABASE")
DB_ENCRYPT = os.getenv("DB_ENCRYPT", "false").lower() == "true"
DB_TRUST_SERVER_CERTIFICATE = os.getenv("DB_TRUST_SERVER_CERTIFICATE", "false").lower() == "true"
