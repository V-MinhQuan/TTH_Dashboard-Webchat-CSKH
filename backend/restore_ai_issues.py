import os
import sys

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.session import get_connection

def restore_manual_ai_issues():
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # 1. Update "Không tìm thấy dữ liệu"
        cursor.execute("""
            UPDATE a
            SET issueFlag = 1,
                issueType = N'Không tìm thấy dữ liệu',
                needStaffReview = 1
            FROM dbo.WebChat_MessageAnalytics a
            JOIN dbo.WebChat_MessageLogs m ON a.messageId = m.id_webchat_messageLogs
            WHERE m.FromHost = 1
              AND m.HostDisplayName = 'AI Assistant'
              AND (
                  m.TextContent LIKE N'%không tìm thấy%'
                  OR m.TextContent LIKE N'%chưa có%'
                  OR m.TextContent LIKE N'%chưa hỗ trợ%'
                  OR m.TextContent LIKE N'%không thể%'
                  OR m.TextContent LIKE N'%Trợ lý AI%'
                  OR m.TextContent LIKE N'%Không thể tiếp nhận thông tin%'
                  OR m.TextContent LIKE N'%Không thể xác nhận trực tiếp%'
              )
        """)
        updated_no_data = cursor.rowcount
        print(f"Updated {updated_no_data} rows to 'Không tìm thấy dữ liệu'")

        # 2. Update "AI không chắc chắn"
        cursor.execute("""
            UPDATE a
            SET issueFlag = 1,
                issueType = N'AI không chắc chắn',
                needStaffReview = 1
            FROM dbo.WebChat_MessageAnalytics a
            JOIN dbo.WebChat_MessageLogs m ON a.messageId = m.id_webchat_messageLogs
            WHERE m.FromHost = 1
              AND m.HostDisplayName = 'AI Assistant'
              AND (
                  m.TextContent LIKE N'%chưa hiểu%'
                  OR m.TextContent LIKE N'%chưa rõ%'
                  OR m.TextContent LIKE N'%không chắc chắn%'
                  OR m.TextContent LIKE N'%chưa có thông tin cụ thể%'
                  OR m.TextContent LIKE N'%độ tin cậy%'
                  OR m.TextContent LIKE N'%chưa xác nhận%'
                  OR m.TextContent LIKE N'%có vẻ như%'
                  OR m.TextContent LIKE N'%chắc là%'
                  OR m.TextContent LIKE N'%có lẽ%'
                  OR m.TextContent LIKE N'%hình như%'
                  OR m.TextContent LIKE N'%tôi đoán%'
              )
        """)
        updated_uncertain = cursor.rowcount
        print(f"Updated {updated_uncertain} rows to 'AI không chắc chắn'")

        conn.commit()

if __name__ == "__main__":
    restore_manual_ai_issues()
