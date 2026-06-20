import argparse
import sys
from pathlib import Path

from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent
sys.path.insert(0, str(BACKEND_ROOT))
load_dotenv(REPO_ROOT / ".env")

from app.services.ai_issue_sync_service import sync_ai_issue_flags


def main():
    parser = argparse.ArgumentParser(
        description="Sync AI answer issue flags into dbo.WebChat_MessageAnalytics."
    )
    parser.add_argument("--apply", action="store_true", help="Commit changes to the database.")
    parser.add_argument("--since", help="Only scan AI messages from this date/time, e.g. 2026-06-01.")
    args = parser.parse_args()

    result = sync_ai_issue_flags(apply=args.apply, since=args.since)
    mode = "APPLY" if args.apply else "DRY-RUN"
    print(f"[{mode}] AI messages scanned: {result.total_ai_messages}")
    print(f"[{mode}] Rows to update: {result.would_update_rows}")
    print(f"[{mode}] Rows to insert: {result.would_insert_rows}")
    print(f"[{mode}] Flagged AI answers: {result.flagged_rows}")
    for issue_type, count in sorted(result.issue_counts.items()):
        print(f"  - {issue_type}: {count}")
    if not args.apply:
        print("No database changes were committed. Re-run with --apply to update the database.")


if __name__ == "__main__":
    main()
