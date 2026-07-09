"""
Script backfill issueResolved cho các bản ghi AI error da xu ly truoc day.

Logic phat hien:
- issueFlag = 0 hoac NULL  (da bi clear boi code cu)
- issueType IS NULL        (da bi clear boi code cu)
- issueReason IS NOT NULL  (KHONG bi clear -> con dau vet cu)
  HOAC issueConfidence IS NOT NULL (KHONG bi clear -> con dau vet cu)

Hanh dong:
- Restore issueFlag = 1 (day la loi AI that su)
- Set issueResolved = 1 (da duoc xu ly)
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.db.session import get_connection


def run():
    with get_connection() as conn:
        cursor = conn.cursor()

        # === BUOC 1: Xem preview so luong ban ghi anh huong ===
        cursor.execute("""
            SELECT
                COUNT(*) AS total_candidates,
                SUM(CASE WHEN issueReason IS NOT NULL THEN 1 ELSE 0 END) AS has_reason,
                SUM(CASE WHEN issueConfidence IS NOT NULL THEN 1 ELSE 0 END) AS has_confidence
            FROM dbo.WebChat_MessageAnalytics
            WHERE ISNULL(issueFlag, 0) = 0
              AND issueType IS NULL
              AND (issueReason IS NOT NULL OR issueConfidence IS NOT NULL)
        """)
        row = cursor.fetchone()
        total = row[0] if row else 0
        has_reason = row[1] if row else 0
        has_conf = row[2] if row else 0

        print(f"=== PREVIEW ban ghi co the la loi AI da xu ly cu ===")
        print(f"  Tong ban ghi phat hien : {total:,}")
        print(f"  Co issueReason         : {has_reason:,}")
        print(f"  Co issueConfidence     : {has_conf:,}")

        if total == 0:
            print("\nKhong tim thay ban ghi nao can backfill. Ket thuc.")
            return

        # === BUOC 2: Hien thi 5 ban ghi mau de xac nhan ===
        cursor.execute("""
            SELECT TOP 5
                id, messageAt, issueReason, issueConfidence
            FROM dbo.WebChat_MessageAnalytics
            WHERE ISNULL(issueFlag, 0) = 0
              AND issueType IS NULL
              AND (issueReason IS NOT NULL OR issueConfidence IS NOT NULL)
            ORDER BY messageAt DESC
        """)
        rows = cursor.fetchall()
        print("\n--- 5 ban ghi mau ---")
        for r in rows:
            print(f"  id={r[0]}, messageAt={r[1]}, reason={r[2]}, confidence={r[3]}")

        # === BUOC 3: Thuc hien backfill ===
        print(f"\nDang cap nhat {total:,} ban ghi...")
        cursor.execute("""
            UPDATE dbo.WebChat_MessageAnalytics
            SET
                issueFlag    = 1,
                issueResolved = 1
            WHERE ISNULL(issueFlag, 0) = 0
              AND issueType IS NULL
              AND (issueReason IS NOT NULL OR issueConfidence IS NOT NULL)
        """)
        updated = cursor.rowcount
        conn.commit()
        print(f"[OK] Da cap nhat {updated:,} ban ghi.")

        # === BUOC 4: Thong ke tong ket ===
        cursor.execute("""
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN issueFlag = 1 AND ISNULL(issueResolved,0) = 0 THEN 1 ELSE 0 END) AS unresolved,
            SUM(CASE WHEN issueFlag = 1 AND issueResolved = 1 THEN 1 ELSE 0 END) AS resolved
        FROM dbo.WebChat_MessageAnalytics
        WHERE issueFlag = 1
        """)
        row = cursor.fetchone()
        print("\n=== Thong ke sau backfill ===")
        print(f"  Tong loi AI (issueFlag=1) : {row[0]:,}")
        print(f"  Loi CHUA xu ly            : {row[1]:,}  <- KPI + bang hien thi")
        print(f"  Loi DA xu ly              : {row[2]:,}  <- Lich su duoc bao ton")

        print("\nBackfill hoan thanh!")


if __name__ == "__main__":
    run()
