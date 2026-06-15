import os
from dotenv import load_dotenv
load_dotenv()
from app.db.session import get_connection

def sync_analytics():
    print("Starting sync...")
    with get_connection() as conn:
        c = conn.cursor()
        
        # Reset current AI issues
        c.execute("""
            UPDATE dbo.WebChat_MessageAnalytics 
            SET issueFlag = 0, issueType = NULL, issueConfidence = NULL, issueReason = NULL
        """)
        
        # 1. Update 'Không tìm thấy dữ liệu'
        # based on _ai_no_data_condition
        c.execute("""
            UPDATE a
            SET a.issueFlag = 1,
                a.issueType = N'Không tìm thấy dữ liệu',
                a.issueConfidence = 0.85,
                a.issueReason = N'Dựa trên phân tích từ khóa: không tìm thấy / chưa có / không thể'
            FROM dbo.WebChat_MessageAnalytics a
            INNER JOIN dbo.WebChat_MessageLogs m ON a.messageId = m.id_webchat_messageLogs
            WHERE m.FromHost = 1 AND m.HostDisplayName = 'AI Assistant'
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
        
        # 2. Update 'AI không chắc chắn'
        # based on _ai_uncertain_condition
        c.execute("""
            UPDATE a
            SET a.issueFlag = 1,
                a.issueType = N'AI không chắc chắn',
                a.issueConfidence = 0.75,
                a.issueReason = N'Dựa trên phân tích từ khóa: chưa hiểu / chưa rõ / không chắc chắn'
            FROM dbo.WebChat_MessageAnalytics a
            INNER JOIN dbo.WebChat_MessageLogs m ON a.messageId = m.id_webchat_messageLogs
            WHERE m.FromHost = 1 AND m.HostDisplayName = 'AI Assistant'
              AND a.issueFlag = 0 -- Don't overwrite if already flagged
              AND (
                m.TextContent LIKE N'%chưa hiểu%'
                OR m.TextContent LIKE N'%chưa rõ%'
                OR m.TextContent LIKE N'%không chắc chắn%'
                OR m.TextContent LIKE N'%chưa có thông tin cụ thể%'
                OR m.TextContent LIKE N'%độ tin cậy%'
                OR m.TextContent LIKE N'%chưa xác nhận%'
              )
        """)
        
        # Also let's set a few 'AI có nguy cơ tự tạo thông tin' 
        # (Since there is no legacy rule for this, we will find long messages that start with certain phrases, or we can just leave it 0 since it's "do not mock data")
        
        # We MUST NOT MOCK DATA. The user explicitly said: "Không được giả lập dữ liệu phải làm đúng theo dữ liệu"
        
        conn.commit()
        print("Sync completed!")

if __name__ == "__main__":
    sync_analytics()
