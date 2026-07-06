import sys
import os
import json

# Add the backend directory to sys.path so we can import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.session import get_connection, rows_to_dicts
from app.core.topic_taxonomy import canonical_topic_ids, TOPIC_NAME_BY_ID, TOPIC_GROUP_BY_ID, normalize_topic_text, _has_code_token
from app.services.ai_issue_classifier import classify_ai_issue

def get_matched_topic_keywords(text: str, topic_id: str) -> list[str]:
    group = TOPIC_GROUP_BY_ID.get(topic_id)
    if not group:
        return []
    
    matched = []
    text_norm = normalize_topic_text(text)
    
    for term in group.get("scope_terms", []):
        normalized = normalize_topic_text(term)
        if not normalized or normalized == "khac":
            continue
        if normalized.isalnum() and len(normalized) <= 10:
            if _has_code_token(text_norm, normalized):
                matched.append(term)
        elif normalized in text_norm:
            matched.append(term)
    return matched

def main():
    print("Fetching records from WebChat_MessageAnalytics...")
    with get_connection() as conn:
        c = conn.cursor()
        
        c.execute("""
            SELECT 
                a.messageId,
                m.TextContent AS botMessage,
                cm.TextContent AS customerMessage
            FROM dbo.WebChat_MessageAnalytics a
            LEFT JOIN dbo.WebChat_MessageLogs m ON a.messageId = m.id_webchat_messagelogs
            OUTER APPLY (
                SELECT TOP 1 cm_inner.TextContent
                FROM dbo.WebChat_MessageLogs cm_inner
                LEFT JOIN dbo.WebChat_Conversations c ON c.Id = a.conversationId
                WHERE cm_inner.Source = c.Source
                  AND cm_inner.SenderId = c.CustomerId
                  AND cm_inner.FromHost = 0
                  AND cm_inner.TextContent IS NOT NULL
                  AND cm_inner.SentAt <= m.SentAt
                ORDER BY cm_inner.SentAt DESC, cm_inner.id_webchat_messagelogs DESC
            ) cm
        """)
        records = rows_to_dicts(c)
        
        print(f"Found {len(records)} records. Updating...")
        
        updates = []
        for row in records:
            bot_text = row.get("botMessage") or ""
            customer_text = row.get("customerMessage") or ""
            
            # Topic & Keyword Extraction
            topic_ids = canonical_topic_ids(customer_text, bot_text)
            topic_labels = [TOPIC_NAME_BY_ID[t] for t in topic_ids if t in TOPIC_NAME_BY_ID]
            
            matched_keywords = []
            for t in topic_ids:
                # We check both customer and bot text for keywords to be comprehensive
                kws = get_matched_topic_keywords(customer_text, t)
                kws.extend(get_matched_topic_keywords(bot_text, t))
                matched_keywords.extend(kws)
                
            # Remove duplicates from matched_keywords
            matched_keywords = list(dict.fromkeys(matched_keywords))
            
            # AI Issue Classification
            issue_class = classify_ai_issue(bot_text)
            
            updates.append((
                json.dumps(topic_labels, ensure_ascii=False),
                json.dumps(matched_keywords, ensure_ascii=False),
                1 if issue_class.issue_flag else 0,
                issue_class.issue_type,
                issue_class.issue_reason,
                issue_class.issue_confidence,
                row["messageId"]
            ))
            
        print("Executing bulk update...")
        for i in range(0, len(updates), 500):
            batch = updates[i:i+500]
            c.executemany("""
                UPDATE dbo.WebChat_MessageAnalytics
                SET 
                    detectedTopics = ?,
                    detectedKeywords = ?,
                    issueFlag = ?,
                    issueType = ?,
                    issueReason = ?,
                    issueConfidence = ?
                WHERE messageId = ?
            """, batch)
            print(f"Updated batch {i} to {i + len(batch)}")
            
        conn.commit()
        print("Done!")

if __name__ == "__main__":
    main()
