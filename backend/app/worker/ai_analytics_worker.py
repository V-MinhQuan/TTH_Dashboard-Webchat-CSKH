import asyncio
import json
import logging
from datetime import datetime

from app.core.topic_taxonomy import canonical_topic_labels
from app.db.session import get_connection, rows_to_dicts
from app.repositories.display_filters import valid_message_condition
from app.services.ai_issue_classifier import classify_ai_issue

logger = logging.getLogger(__name__)

def process_new_messages():
    """Finds new AI messages, analyzes text, and inserts them into WebChat_MessageAnalytics."""
    with get_connection() as conn:
        c = conn.cursor()
        
        # Select AI messages that are NOT YET in WebChat_MessageAnalytics
        # We also need conversationId from WebChat_Conversations
        c.execute(f"""
            SELECT 
                m.id_webchat_messageLogs AS messageId,
                m.TextContent,
                customerMessage.TextContent AS CustomerText,
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
            OUTER APPLY (
                SELECT TOP 1 cm.TextContent
                FROM dbo.WebChat_MessageLogs cm
                WHERE cm.Source = c.Source
                  AND cm.SenderId = c.CustomerId
                  AND cm.FromHost = 0
                  AND cm.TextContent IS NOT NULL
                  AND cm.SentAt <= m.SentAt
                  AND {valid_message_condition("cm")}
                ORDER BY cm.SentAt DESC, cm.id_webchat_messagelogs DESC
            ) customerMessage
            WHERE m.FromHost = 1 
              AND m.HostDisplayName = 'AI Assistant'
              AND m.TextContent IS NOT NULL
              AND {valid_message_condition("m")}
              AND a.messageId IS NULL
        """)
        
        messages = rows_to_dicts(c)
        if not messages:
            return 0
            
        inserts = []
        for msg in messages:
            msg_id = msg["messageId"]
            classification = classify_ai_issue(msg["TextContent"])
            detected_topics = json.dumps(
                canonical_topic_labels(msg.get("CustomerText"), msg.get("TextContent")),
                ensure_ascii=False,
            )
            sent_at = msg["SentAt"]
            source = msg["Source"]
            receiver_id = msg["ReceiverId"]
            conv_id = msg["conversationId"]
            issue_flag = 1 if classification.issue_flag else 0
            
            inserts.append((
                msg_id, conv_id, receiver_id, source, 'neutral', 0.0, issue_flag,
                sent_at, datetime.now(), issue_flag, classification.issue_type,
                classification.issue_reason, classification.issue_confidence, detected_topics
            ))
            
        # Apply inserts
        for i in range(0, len(inserts), 100):
            batch = inserts[i:i+100]
            c.executemany("""
                INSERT INTO dbo.WebChat_MessageAnalytics 
                (messageId, conversationId, customerId, source, sentimentLabel, sentimentScore, needStaffReview, messageAt, analyzedAt, issueFlag, issueType, issueReason, issueConfidence, detectedTopics)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
