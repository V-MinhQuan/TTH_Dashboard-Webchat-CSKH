import os
import sys

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.session import get_connection

from app.services.ai_issue_sync_service import sync_ai_issue_flags

def restore_manual_ai_issues():
    print("Running ai_issue_sync_service to backfill/restore AI issues...")
    result = sync_ai_issue_flags(apply=True)
    print(f"Update complete! Updated {result.updated_rows} rows and inserted {result.inserted_rows} rows.")

if __name__ == "__main__":
    restore_manual_ai_issues()
