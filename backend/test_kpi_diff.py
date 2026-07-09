import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app.db.session import get_connection

def run():
    with get_connection() as conn:
        cursor = conn.cursor()
        
        print("=== CHECKING DIFFERENCE BETWEEN KPI AND TABLE ===")
        
        # 1. KPI Logic (Without NoResponseNeeded filter)
        cursor.execute("""
            SELECT COUNT(*) 
            FROM dbo.WebChat_MessageAnalytics a
            WHERE a.issueFlag = 1 
              AND ISNULL(a.issueResolved, 0) = 0 
              AND a.issueType IN (N'Không tìm thấy dữ liệu', N'AI không chắc chắn')
        """)
        kpi_count = cursor.fetchone()[0]
        
        # 2. Table Logic (With NoResponseNeeded filter and JOINS)
        cursor.execute("""
            SELECT COUNT(*) AS total
            FROM dbo.WebChat_MessageAnalytics a
            LEFT JOIN dbo.WebChat_MessageLogs m ON m.id_webchat_messagelogs = a.messageId
            LEFT JOIN dbo.WebChat_Conversations c ON c.Id = a.conversationId
            OUTER APPLY (
                SELECT TOP 1 s.NoResponseNeeded
                FROM dbo.WebChat_ConversationStatus s WITH (NOLOCK)
                WHERE s.CustomerId = c.CustomerId AND s.Source = c.Source
                ORDER BY CASE WHEN s.MarkedAt IS NULL THEN 0 ELSE 1 END DESC, s.MarkedAt DESC, s.Id DESC
            ) latestStatus
            WHERE a.issueFlag = 1 
              AND ISNULL(a.issueResolved, 0) = 0 
              AND a.issueType IN (N'Không tìm thấy dữ liệu', N'AI không chắc chắn')
              AND (latestStatus.NoResponseNeeded IS NULL OR latestStatus.NoResponseNeeded = 0)
        """)
        table_count = cursor.fetchone()[0]
        
        print(f"KPI failure_count: {kpi_count}")
        print(f"Table total:       {table_count}")
        
        # Check topic "Học Tin học"
        print("\n=== CHECKING TOPIC 'Học Tin học' ===")
        cursor.execute("""
            SELECT a.detectedTopics, a.issueFlag, a.issueResolved, a.issueType, COUNT(*) as cnt
            FROM dbo.WebChat_MessageAnalytics a
            WHERE a.detectedTopics LIKE N'%Học Tin học%'
            GROUP BY a.detectedTopics, a.issueFlag, a.issueResolved, a.issueType
        """)
        rows = cursor.fetchall()
        for r in rows:
            print(r)

if __name__ == "__main__":
    run()
