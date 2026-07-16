import os
import json
import pyodbc
from datetime import datetime
from dotenv import load_dotenv

# Load main .env for DB credentials
load_dotenv(".env")
# Load backend .env for HF settings
load_dotenv("backend/.env", override=True)

DB_SERVER = os.getenv("DB_SERVER")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")

print(f"Connecting to DB: {DB_NAME} on {DB_SERVER}")

conn_str = f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={DB_SERVER};DATABASE={DB_NAME};UID={DB_USER};PWD={DB_PASSWORD};Encrypt=no;TrustServerCertificate=yes"

try:
    conn = pyodbc.connect(conn_str, autocommit=True)
    cursor = conn.cursor()
    print("Database connected successfully.")
    
    # 3. Chụp số liệu pre-migration
    print("Capturing pre-migration metrics...")
    pre_metrics = {
        "timestamp": datetime.now().isoformat(),
        "database_name": DB_NAME
    }
    
    cursor.execute("SELECT COUNT(*) FROM dbo.WebChat_MessageAnalytics")
    pre_metrics["Total rows"] = cursor.fetchone()[0]
    
    try:
        cursor.execute("SELECT COUNT(*) FROM dbo.WebChat_MessageAnalytics WHERE sentimentSource IS NOT NULL")
        pre_metrics["Trusted provenance rows"] = cursor.fetchone()[0]
    except Exception as e:
        pre_metrics["Trusted provenance rows"] = "Column not found yet"
        
    try:
        cursor.execute("SELECT COUNT(*) FROM dbo.WebChat_MessageAnalytics WHERE sentimentLabel = 'NEU' AND sentimentScore = 0.0 AND sentimentSource IS NULL")
        pre_metrics["Unverified neutral/0.0 rows"] = cursor.fetchone()[0]
    except Exception as e:
        pre_metrics["Unverified neutral/0.0 rows"] = "Could not query"
        
    report_path = f"backend/reports/hf_migration_precheck_{datetime.now().strftime('%Y%md_%H%M%S')}.json"
    os.makedirs("backend/reports", exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(pre_metrics, f, indent=2)
    print(f"Pre-migration metrics saved to {report_path}")
    print(json.dumps(pre_metrics, indent=2))
    
    # 4, 5, 6. Run Migrations
    migrations = [
        "backend/database/migrations/01_add_hf_analysis_schema.sql",
        "backend/database/migrations/02_backfill_verified_legacy.sql",
        "backend/database/migrations/03_quarantine_unverified_legacy.sql"
    ]
    
    for mig in migrations:
        print(f"Running migration: {mig}")
        with open(mig, "r", encoding="utf-8") as f:
            sql_script = f.read()
        
        # Split GO statements for pyodbc
        batches = [b.strip() for b in sql_script.split("GO") if b.strip()]
        for batch in batches:
            cursor.execute(batch)
        print(f"Migration {mig} executed successfully.")
        
    # 8. Post-migration validation
    print("Capturing post-migration metrics...")
    post_metrics = {
        "timestamp": datetime.now().isoformat(),
        "database_name": DB_NAME
    }
    
    cursor.execute("SELECT COUNT(*) FROM dbo.WebChat_MessageAnalytics")
    post_metrics["Total rows"] = cursor.fetchone()[0]
    
    cursor.execute("SELECT analysisStatus, COUNT(*) FROM dbo.WebChat_MessageAnalytics GROUP BY analysisStatus")
    status_counts = {}
    for row in cursor.fetchall():
        status_counts[row[0]] = row[1]
    post_metrics["Status counts"] = status_counts
    
    val_path = f"backend/reports/hf_migration_validation_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(val_path, "w", encoding="utf-8") as f:
        json.dump(post_metrics, f, indent=2)
    print(f"Post-migration metrics saved to {val_path}")
    print(json.dumps(post_metrics, indent=2))

except Exception as e:
    print(f"ERROR: {e}")
finally:
    if 'conn' in locals():
        conn.close()
