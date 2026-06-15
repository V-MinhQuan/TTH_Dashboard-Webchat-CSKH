import asyncio
import logging
from datetime import datetime

from app.db.session import get_connection

logger = logging.getLogger(__name__)

NO_DATA_KWS = ['không tìm thấy', 'chưa có', 'chưa hỗ trợ', 'không thể', 'trợ lý ai', 'không thể tiếp nhận thông tin', 'không thể xác nhận trực tiếp']
UNCERTAIN_KWS = ['chưa hiểu', 'chưa rõ', 'không chắc chắn', 'chưa có thông tin cụ thể', 'độ tin cậy', 'chưa xác nhận']
HALLUCINATION_KWS = ['có vẻ như', 'chắc là', 'có lẽ', 'hình như', 'tôi đoán']

def process_new_messages():
    """Finds new AI messages, analyzes text, and inserts them into WebChat_MessageAnalytics."""
    with get_connection() as conn:
        c = conn.cursor()
        
        # Select AI messages that are NOT YET in WebChat_MessageAnalytics
        # We also need conversationId from WebChat_Conversations
        c.execute("""
            SELECT 
                m.id_webchat_messageLogs AS messageId,
                m.TextContent,
                m.SentAt,
                m.SenderId,
                m.Source,
                m.ReceiverId,
                c.Id AS conversationId
            FROM dbo.WebChat_MessageLogs m
            LEFT JOIN dbo.WebChat_MessageAnalytics a 
                ON a.messageId = m.id_webchat_messageLogs
            LEFT JOIN dbo.WebChat_Conversations c
                ON c.Source = m.Source
                AND c.CustomerId = CASE
                    WHEN m.FromHost = 1 THEN m.ReceiverId
                    ELSE m.SenderId
                END
            WHERE m.FromHost = 1 
              AND m.HostDisplayName = 'AI Assistant'
              AND m.TextContent IS NOT NULL
              AND a.messageId IS NULL
        """)
        
        messages = c.fetchall()
        if not messages:
            return 0
            
        inserts = []
        for msg in messages:
            msg_id = msg[0]
            text = msg[1].lower() if msg[1] else ""
            sent_at = msg[2]
            source = msg[4]
            receiver_id = msg[5]
            conv_id = msg[6]
            
            issue_type = None
            issue_reason = None
            confidence = None
            
            if any(kw in text for kw in NO_DATA_KWS):
                issue_type = 'Không tìm thấy dữ liệu'
                issue_reason = 'Dựa trên phân tích từ khóa: không tìm thấy, chưa có, không thể...'
                confidence = 0.85
            elif any(kw in text for kw in UNCERTAIN_KWS):
                issue_type = 'AI không chắc chắn'
                issue_reason = 'Dựa trên phân tích từ khóa: chưa hiểu, chưa rõ, không chắc chắn...'
                confidence = 0.75
            elif any(kw in text for kw in HALLUCINATION_KWS):
                issue_type = 'AI có nguy cơ tự tạo thông tin'
                issue_reason = 'Dựa trên phân tích từ khóa: có vẻ như, chắc là, hình như...'
                confidence = 0.65
                
            issue_flag = 1 if issue_type else 0
            
            inserts.append((
                msg_id, conv_id, receiver_id, source, 'neutral', 0.0, issue_flag,
                sent_at, datetime.now(), issue_flag, issue_type, issue_reason, confidence
            ))
            
        # Apply inserts
        for i in range(0, len(inserts), 100):
            batch = inserts[i:i+100]
            c.executemany("""
                INSERT INTO dbo.WebChat_MessageAnalytics 
                (messageId, conversationId, customerId, source, sentimentLabel, sentimentScore, needStaffReview, messageAt, analyzedAt, issueFlag, issueType, issueReason, issueConfidence)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, batch)
            
        conn.commit()
        return len(inserts)

async def start_analytics_worker():
    """Background task that polls every 1 minute."""
    logger.info("AI Analytics Worker started.")
    while True:
        try:
            # We run the synchronous db logic in a background thread to not block the event loop
            count = await asyncio.to_thread(process_new_messages)
            if count > 0:
                logger.info(f"AI Analytics Worker processed {count} new messages.")
        except Exception as e:
            logger.error(f"Error in AI Analytics Worker: {e}")
        
        await asyncio.sleep(60)
