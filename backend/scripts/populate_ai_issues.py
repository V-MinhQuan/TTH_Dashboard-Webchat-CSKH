import os
from dotenv import load_dotenv
load_dotenv()
from app.db.session import get_connection

def populate():
    print("Starting population...")
    with get_connection() as conn:
        c = conn.cursor()
        
        # 1. Reset all existing issue flags first to cleanly apply the new rules
        c.execute("""
            UPDATE dbo.WebChat_MessageAnalytics 
            SET issueFlag = 0, issueType = NULL, issueReason = NULL, issueConfidence = NULL
        """)
        
        # 2. Get all AI Assistant messages
        c.execute("""
            SELECT id_webchat_messageLogs, TextContent, SentAt, SenderId, Source, ReceiverId
            FROM dbo.WebChat_MessageLogs
            WHERE FromHost = 1 AND HostDisplayName = 'AI Assistant' AND TextContent IS NOT NULL
        """)
        messages = c.fetchall()
        
        # 3. Analyze and Upsert
        updates = []
        inserts = []
        
        # We will fetch existing analytics to know whether to insert or update
        c.execute("SELECT messageId FROM dbo.WebChat_MessageAnalytics")
        existing_analytics = {row[0] for row in c.fetchall()}
        
        # Rules
        no_data_kws = ['không tìm thấy', 'chưa có', 'chưa hỗ trợ', 'không thể', 'trợ lý ai', 'không thể tiếp nhận thông tin', 'không thể xác nhận trực tiếp']
        uncertain_kws = ['chưa hiểu', 'chưa rõ', 'không chắc chắn', 'chưa có thông tin cụ thể', 'độ tin cậy', 'chưa xác nhận']
        hallucination_kws = ['có vẻ như', 'chắc là', 'có lẽ', 'hình như', 'tôi đoán']
        
        for msg in messages:
            msg_id = msg[0]
            text = msg[1].lower()
            
            issue_type = None
            issue_reason = None
            confidence = None
            
            # Check No Data
            if any(kw in text for kw in no_data_kws):
                issue_type = 'Không tìm thấy dữ liệu'
                issue_reason = 'Dựa trên phân tích từ khóa: không tìm thấy, chưa có, không thể...'
                confidence = 0.85
            # Check Uncertain
            elif any(kw in text for kw in uncertain_kws):
                issue_type = 'AI không chắc chắn'
                issue_reason = 'Dựa trên phân tích từ khóa: chưa hiểu, chưa rõ, không chắc chắn...'
                confidence = 0.75
            # Check Hallucination
            elif any(kw in text for kw in hallucination_kws):
                issue_type = 'AI có nguy cơ tự tạo thông tin'
                issue_reason = 'Dựa trên phân tích từ khóa: có vẻ như, chắc là, hình như...'
                confidence = 0.65
            
            if issue_type:
                if msg_id in existing_analytics:
                    updates.append((issue_type, issue_reason, confidence, msg_id))
                else:
                    # Insert new row
                    # messageId, conversationId, customerId, source, sentimentLabel, sentimentScore, needStaffReview, messageAt, analyzedAt, issueFlag, issueType, issueReason, issueConfidence
                    # We leave some fields NULL or default
                    from datetime import datetime
                    inserts.append((
                        msg_id, None, msg[5], msg[4], 'neutral', 0.0, 1 if issue_type else 0,
                        msg[2], datetime.now(), 1, issue_type, issue_reason, confidence
                    ))
                    
        # Apply updates
        for i in range(0, len(updates), 100):
            batch = updates[i:i+100]
            c.executemany("""
                UPDATE dbo.WebChat_MessageAnalytics
                SET issueFlag = 1, issueType = ?, issueReason = ?, issueConfidence = ?
                WHERE messageId = ?
            """, batch)
            
        # Apply inserts
        for i in range(0, len(inserts), 100):
            batch = inserts[i:i+100]
            c.executemany("""
                INSERT INTO dbo.WebChat_MessageAnalytics 
                (messageId, conversationId, customerId, source, sentimentLabel, sentimentScore, needStaffReview, messageAt, analyzedAt, issueFlag, issueType, issueReason, issueConfidence)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, batch)
            
        conn.commit()
        print(f"Analysis completed! Updated {len(updates)} records, Inserted {len(inserts)} new records.")

if __name__ == '__main__':
    populate()
