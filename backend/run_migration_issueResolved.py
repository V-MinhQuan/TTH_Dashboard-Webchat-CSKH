"""
Script chay migration: Them cot issueResolved vao WebChat_MessageAnalytics
Chay tu thu muc goc project: python backend/run_migration_issueResolved.py
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from app.db.session import get_connection


def run():
    with get_connection() as conn:
        cursor = conn.cursor()

        # Buoc 1: Kiem tra va them cot issueResolved
        cursor.execute("""
            SELECT COUNT(1)
            FROM sys.columns
            WHERE object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics')
              AND name = N'issueResolved'
        """)
        row = cursor.fetchone()
        col_exists = (row[0] if row else 0) > 0

        if col_exists:
            print("[OK] Cot issueResolved da ton tai, bo qua ALTER TABLE.")
        else:
            cursor.execute("""
                ALTER TABLE dbo.WebChat_MessageAnalytics
                ADD issueResolved BIT NOT NULL DEFAULT 0
            """)
            conn.commit()
            print("[OK] Da them cot issueResolved thanh cong.")

        # Buoc 2: Kiem tra va tao index
        cursor.execute("""
            SELECT COUNT(1)
            FROM sys.indexes
            WHERE object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics')
              AND name = N'IX_MessageAnalytics_IssueUnresolved'
        """)
        row = cursor.fetchone()
        idx_exists = (row[0] if row else 0) > 0

        if idx_exists:
            print("[OK] Index IX_MessageAnalytics_IssueUnresolved da ton tai, bo qua.")
        else:
            cursor.execute("""
                CREATE NONCLUSTERED INDEX IX_MessageAnalytics_IssueUnresolved
                ON dbo.WebChat_MessageAnalytics (issueFlag, issueResolved)
                INCLUDE (issueType, messageAt, source, detectedTopics)
            """)
            conn.commit()
            print("[OK] Da tao index IX_MessageAnalytics_IssueUnresolved.")

        # Buoc 3: Thong ke xac nhan
        cursor.execute("""
        SELECT
            COUNT(*) AS total_messages,
            SUM(CASE WHEN issueFlag = 1 THEN 1 ELSE 0 END) AS total_ai_failures,
            SUM(CASE WHEN issueFlag = 1 AND issueResolved = 0 THEN 1 ELSE 0 END) AS unresolved,
            SUM(CASE WHEN issueFlag = 1 AND issueResolved = 1 THEN 1 ELSE 0 END) AS resolved
        FROM dbo.WebChat_MessageAnalytics
        """)
        row = cursor.fetchone()
        if row:
            print("\n--- Thong ke sau migration ---")
            print(f"  Tong tin nhan analytics  : {row[0]:,}")
            print(f"  Tong loi AI (issueFlag=1) : {row[1]:,}")
            print(f"  Loi chua xu ly            : {row[2]:,}")
            print(f"  Loi da xu ly              : {row[3]:,}")

        print("\nMigration hoan thanh!")


if __name__ == "__main__":
    run()
