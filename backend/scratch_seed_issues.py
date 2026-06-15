import os
import random
from dotenv import load_dotenv
load_dotenv()
from app.db.session import get_connection

issue_types = [
    "AI có nguy cơ tự tạo thông tin",
    "Không tìm thấy dữ liệu",
    "Không hiểu intent",
    "AI không chắc chắn",
    "Câu hỏi ngoài phạm vi"
]

with get_connection() as conn:
    c = conn.cursor()
    # Reset
    c.execute("UPDATE dbo.WebChat_MessageAnalytics SET issueFlag = 0, issueType = NULL, issueConfidence = NULL")
    
    # Randomly set issueFlag for ~1% of rows for each issue_type
    for t in issue_types:
        c.execute(f"""
            UPDATE dbo.WebChat_MessageAnalytics
            SET issueFlag = 1,
                issueType = N'{t}',
                issueConfidence = 0.5 + (0.45 * RAND(CHECKSUM(NEWID())))
            WHERE id IN (
                SELECT TOP 1 PERCENT id
                FROM dbo.WebChat_MessageAnalytics
                WHERE issueFlag = 0
                ORDER BY NEWID()
            )
        """)
        
    # Also set issueFlag = 1 for ~50% of the ones that already have needStaffReview = 1
    c.execute("""
        UPDATE dbo.WebChat_MessageAnalytics
        SET issueFlag = 1,
            issueType = N'AI có nguy cơ tự tạo thông tin',
            issueConfidence = 0.5 + (0.45 * RAND(CHECKSUM(NEWID())))
        WHERE id IN (
            SELECT TOP 50 PERCENT id
            FROM dbo.WebChat_MessageAnalytics
            WHERE needStaffReview = 1 AND issueFlag = 0
            ORDER BY NEWID()
        )
    """)
        
    conn.commit()
    print("Mock data updated!")
