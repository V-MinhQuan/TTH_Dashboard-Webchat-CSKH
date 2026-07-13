from __future__ import annotations

import json
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from app.core.topic_taxonomy import TOPIC_NAME_BY_ID
from app.db.session import get_connection, rows_to_dicts
from app.repositories.display_filters import valid_message_condition
from app.services.ai_issue_classifier import IssueClassification, classify_ai_issue
from app.services.topic_resolver import TopicResolution, build_topic_keyword_catalog, keyword_classifier_version, resolve_topic
from app.keywords.repository import keyword_repository


@dataclass
class AiIssueSyncResult:
    dry_run: bool
    total_ai_messages: int
    would_update_rows: int = 0
    updated_rows: int = 0
    would_insert_rows: int = 0
    inserted_rows: int = 0
    flagged_rows: int = 0
    issue_counts: dict[str, int] = field(default_factory=dict)
    topic_counts: dict[str, int] = field(default_factory=dict)
    last_message_id: int | None = None


def _serialize_topics(topics: list[str]) -> str:
    return json.dumps(topics, ensure_ascii=False)


def _is_same_issue_state(row: dict, classification: IssueClassification, detected_topics: str, detected_keywords: str, resolution) -> bool:
    issue_flag = bool(row.get("issueFlag"))
    target_flag = bool(classification.issue_flag)
    issue_type = row.get("issueType") or None
    target_type = classification.issue_type or None
    issue_reason = row.get("issueReason") or None
    target_reason = classification.issue_reason or None

    current_conf = row.get("issueConfidence")
    current_conf = None if current_conf is None else round(float(current_conf), 4)
    target_conf = classification.issue_confidence
    target_conf = None if target_conf is None else round(float(target_conf), 4)

    return (
        issue_flag == target_flag
        and issue_type == target_type
        and issue_reason == target_reason
        and current_conf == target_conf
        and (row.get("detectedTopics") or "[]") == detected_topics
        and (row.get("detectedKeywords") or "[]") == detected_keywords
        and (row.get("primaryTopicId") or None) == resolution.primary_topic_id
        and (row.get("topicSource") or None) == resolution.source
        and (row.get("classifierVersion") or None) == resolution.classifier_version
    )


def _fetch_ai_messages(cursor, since: Optional[str], classifier_version: str,
                       batch_size: int, after_message_id: int | None) -> list[dict]:
    params: list[object] = [batch_size]
    since_filter = ""
    if since:
        since_filter = "AND m.SentAt >= ?"
        params.append(since)
    after_filter = ""
    if after_message_id is not None:
        after_filter = "AND m.id_webchat_messageLogs > ?"
        params.append(after_message_id)
    params.append(classifier_version)

    cursor.execute(
        f"""
        SELECT TOP (?)
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
            m.Source,
            m.ReceiverId,
            conv.Id AS conversationId,
            CASE WHEN a.messageId IS NULL THEN 0 ELSE 1 END AS hasAnalytics,
            a.issueFlag,
            a.issueType,
            a.issueReason,
            a.issueConfidence,
            a.detectedTopics,
            a.detectedKeywords
            ,a.primaryTopicId
            ,a.topicConfidence
            ,a.topicSource
            ,a.contextMessageId
            ,a.contextDistance
            ,a.classifierVersion
        FROM dbo.WebChat_MessageLogs m
        LEFT JOIN dbo.WebChat_MessageAnalytics a
            ON a.messageId = m.id_webchat_messageLogs
        LEFT JOIN dbo.WebChat_Conversations conv
            ON conv.Source = m.Source
            AND conv.CustomerId = CASE
                WHEN m.FromHost = 1 THEN m.ReceiverId
                ELSE m.SenderId
            END
        OUTER APPLY (
            SELECT TOP 1 cm.TextContent, cm.primaryTopicId, cm.detectedTopics, cm.detectedKeywords,
                cm.topicConfidence, cm.topicSource, cm.contextMessageId, cm.contextDistance, cm.keywordClassifierVersion
            FROM dbo.WebChat_MessageLogs cm
            WHERE cm.Source = conv.Source
              AND cm.SenderId = conv.CustomerId
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
          {since_filter}
          {after_filter}
          AND (a.messageId IS NULL OR ISNULL(a.classifierVersion, '') <> ?)
        ORDER BY m.id_webchat_messageLogs
        """,
        tuple(params),
    )
    return rows_to_dicts(cursor)


def sync_ai_issue_flags(*, apply: bool = False, since: Optional[str] = None,
                        batch_size: int = 1000, after_message_id: int | None = None) -> AiIssueSyncResult:
    with get_connection() as conn:
        cursor = conn.cursor()
        batch_size = max(1, min(int(batch_size), 5000))
        keyword_catalog = build_topic_keyword_catalog(keyword_repository.get_all())
        classifier_version = keyword_classifier_version(keyword_catalog)
        rows = _fetch_ai_messages(cursor, since, classifier_version, batch_size, after_message_id)

        updates = []
        inserts = []
        issue_counts: Counter[str] = Counter()
        topic_counts: Counter[str] = Counter()

        analyzed_at = datetime.now()
        for row in rows:
            bot_text = row.get("TextContent") or ""
            customer_text = row.get("CustomerText") or ""
            classification = classify_ai_issue(bot_text)
            if row.get("CustomerClassifierVersion") == classifier_version:
                try:
                    topic_ids = tuple(
                        topic_id for label in json.loads(row.get("CustomerDetectedTopics") or "[]")
                        if (topic_id := next((key for key, value in TOPIC_NAME_BY_ID.items() if value == label), None))
                    )
                    matched_keywords = tuple(json.loads(row.get("CustomerDetectedKeywords") or "[]"))
                except (TypeError, ValueError, json.JSONDecodeError):
                    topic_ids, matched_keywords = (), ()
                resolution = TopicResolution(
                    row.get("CustomerPrimaryTopicId"), topic_ids, matched_keywords,
                    float(row.get("CustomerTopicConfidence") or 0), row.get("CustomerTopicSource") or "unknown",
                    row.get("CustomerContextMessageId"), row.get("CustomerContextDistance"), classifier_version,
                )
            else:
                resolution = resolve_topic(customer_text, keyword_catalog=keyword_catalog, classifier_version=classifier_version)
            detected_topic_labels = resolution.labels
            detected_topics = _serialize_topics(detected_topic_labels)
            detected_keywords = _serialize_topics(list(resolution.matched_keywords))
            
            if classification.issue_flag and classification.issue_type:
                issue_counts[classification.issue_type] += 1
                topic_counts.update(detected_topic_labels)

            issue_flag = 1 if classification.issue_flag else 0
            issue_type = classification.issue_type
            issue_reason = classification.issue_reason
            issue_confidence = classification.issue_confidence
            need_staff_review = issue_flag

            if row.get("hasAnalytics"):
                if not _is_same_issue_state(row, classification, detected_topics, detected_keywords, resolution):
                    updates.append((
                        issue_flag,
                        issue_type,
                        issue_reason,
                        issue_confidence,
                        need_staff_review,
                        detected_topics,
                        detected_keywords,
                        resolution.primary_topic_id,
                        resolution.confidence,
                        resolution.source,
                        resolution.context_message_id,
                        resolution.context_distance,
                        resolution.classifier_version,
                        analyzed_at,
                        row["messageId"],
                    ))
            else:
                inserts.append((
                    row["messageId"],
                    row.get("conversationId"),
                    row.get("ReceiverId"),
                    row.get("Source"),
                    "neutral",
                    0.0,
                    need_staff_review,
                    row.get("SentAt"),
                    analyzed_at,
                    issue_flag,
                    issue_type,
                    issue_reason,
                    issue_confidence,
                    detected_topics,
                    detected_keywords,
                    resolution.primary_topic_id,
                    resolution.confidence,
                    resolution.source,
                    resolution.context_message_id,
                    resolution.context_distance,
                    resolution.classifier_version,
                ))

        result = AiIssueSyncResult(
            dry_run=not apply,
            total_ai_messages=len(rows),
            would_update_rows=len(updates),
            would_insert_rows=len(inserts),
            flagged_rows=sum(issue_counts.values()),
            issue_counts=dict(issue_counts),
            topic_counts=dict(topic_counts),
            last_message_id=rows[-1]["messageId"] if rows else after_message_id,
        )

        if not apply:
            return result

        for i in range(0, len(updates), 100):
            cursor.executemany(
                """
                UPDATE dbo.WebChat_MessageAnalytics
                SET issueFlag = ?,
                    issueType = ?,
                    issueReason = ?,
                    issueConfidence = ?,
                    needStaffReview = ?,
                    detectedTopics = ?,
                    detectedKeywords = ?,
                    primaryTopicId = ?,
                    topicConfidence = ?,
                    topicSource = ?,
                    contextMessageId = ?,
                    contextDistance = ?,
                    classifierVersion = ?,
                    analyzedAt = ?
                WHERE messageId = ?
                """,
                updates[i:i + 100],
            )

        for i in range(0, len(inserts), 100):
            cursor.executemany(
                """
                INSERT INTO dbo.WebChat_MessageAnalytics
                (messageId, conversationId, customerId, source, sentimentLabel, sentimentScore,
                 needStaffReview, messageAt, analyzedAt, issueFlag, issueType, issueReason, issueConfidence, detectedTopics, detectedKeywords,
                 primaryTopicId, topicConfidence, topicSource, contextMessageId, contextDistance, classifierVersion)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                inserts[i:i + 100],
            )

        conn.commit()
        result.updated_rows = len(updates)
        result.inserted_rows = len(inserts)
        return result
