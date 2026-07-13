import asyncio
import json
import logging
from datetime import datetime

from app.core.topic_taxonomy import TOPIC_NAME_BY_ID
from app.db.session import get_connection, rows_to_dicts
from app.repositories.display_filters import valid_message_condition
from app.services.ai_issue_classifier import classify_ai_issue
from app.services.topic_resolver import TopicResolution, build_topic_keyword_catalog, keyword_classifier_version, resolve_topic
from app.services.message_keyword_sync_service import sync_customer_message_keywords
from app.keywords.repository import keyword_repository

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
                customerMessage.primaryTopicId AS CustomerPrimaryTopicId,
                customerMessage.detectedTopics AS CustomerDetectedTopics,
                customerMessage.detectedKeywords AS CustomerDetectedKeywords,
                customerMessage.topicConfidence AS CustomerTopicConfidence,
                customerMessage.topicSource AS CustomerTopicSource,
                customerMessage.contextMessageId AS CustomerContextMessageId,
                customerMessage.contextDistance AS CustomerContextDistance,
                customerMessage.keywordClassifierVersion AS CustomerClassifierVersion,
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
                SELECT TOP 1 cm.TextContent, cm.primaryTopicId, cm.detectedTopics, cm.detectedKeywords,
                    cm.topicConfidence, cm.topicSource, cm.contextMessageId, cm.contextDistance, cm.keywordClassifierVersion
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
        keyword_catalog = build_topic_keyword_catalog(keyword_repository.get_all())
        classifier_version = keyword_classifier_version(keyword_catalog)
        for msg in messages:
            msg_id = msg["messageId"]
            classification = classify_ai_issue(msg["TextContent"])
            customer_text = msg.get("CustomerText") or ""
            if msg.get("CustomerClassifierVersion") == classifier_version:
                try:
                    topic_ids = tuple(
                        topic_id for label in json.loads(msg.get("CustomerDetectedTopics") or "[]")
                        if (topic_id := next((key for key, value in TOPIC_NAME_BY_ID.items() if value == label), None))
                    )
                    matched_keywords = tuple(json.loads(msg.get("CustomerDetectedKeywords") or "[]"))
                except (TypeError, ValueError, json.JSONDecodeError):
                    topic_ids, matched_keywords = (), ()
                resolution = TopicResolution(
                    msg.get("CustomerPrimaryTopicId"), topic_ids, matched_keywords,
                    float(msg.get("CustomerTopicConfidence") or 0), msg.get("CustomerTopicSource") or "unknown",
                    msg.get("CustomerContextMessageId"), msg.get("CustomerContextDistance"), classifier_version,
                )
            else:
                resolution = resolve_topic(customer_text, keyword_catalog=keyword_catalog, classifier_version=classifier_version)
            detected_topics = json.dumps(
                resolution.labels,
                ensure_ascii=False,
            )
            detected_keywords = json.dumps(
                list(resolution.matched_keywords),
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
                classification.issue_reason, classification.issue_confidence, detected_topics,
                detected_keywords, resolution.primary_topic_id, resolution.confidence,
                resolution.source, resolution.context_message_id, resolution.context_distance,
                resolution.classifier_version
            ))
            
        # Apply inserts
        for i in range(0, len(inserts), 100):
            batch = inserts[i:i+100]
            c.executemany("""
                INSERT INTO dbo.WebChat_MessageAnalytics 
                (messageId, conversationId, customerId, source, sentimentLabel, sentimentScore, needStaffReview, messageAt, analyzedAt, issueFlag, issueType, issueReason, issueConfidence, detectedTopics, detectedKeywords,
                 primaryTopicId, topicConfidence, topicSource, contextMessageId, contextDistance, classifierVersion)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, batch)
            
        conn.commit()
        return len(inserts)

async def start_analytics_worker():
    """Background task that polls every 1 minute."""
    logger.info("AI Analytics Worker started.")
    while True:
        try:
            keyword_updated = 0
            keyword_result = None
            # Drain a bounded backlog after a classifier/catalog version change,
            # while keeping each transaction small and yielding to AI processing.
            for _ in range(5):
                keyword_result = await asyncio.to_thread(
                    sync_customer_message_keywords,
                    apply=True,
                    batch_size=1000,
                )
                keyword_updated += keyword_result.updated_rows
                if keyword_result.scanned_rows < 1000:
                    break
            # We run the synchronous db logic in a background thread to not block the event loop
            count = await asyncio.to_thread(process_new_messages)
            if keyword_updated > 0:
                logger.info("Customer keyword worker updated %s messages.", keyword_updated)
            if count > 0:
                logger.info(f"AI Analytics Worker processed {count} new messages.")
        except Exception as e:
            logger.error(f"Error in AI Analytics Worker: {e}")
        
        await asyncio.sleep(60)
