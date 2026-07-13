from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime

from app.db.session import get_connection, rows_to_dicts
from app.repositories.display_filters import valid_message_condition
from app.services.topic_resolver import build_topic_keyword_catalog, keyword_classifier_version, resolve_topic
from app.keywords.repository import keyword_repository


@dataclass
class MessageKeywordSyncResult:
    dry_run: bool
    scanned_rows: int
    updated_rows: int = 0
    would_update_rows: int = 0
    last_message_id: int | None = None


def _fetch_customer_messages(cursor, *, batch_size: int, after_id: int | None,
                             force_version: bool, expected_version: str) -> list[dict]:
    version_filter = "" if force_version else "AND ISNULL(m.keywordClassifierVersion, '') <> ?"
    params: list[object] = [batch_size]
    if not force_version:
        params.append(expected_version)
    after_filter = ""
    if after_id is not None:
        after_filter = "AND m.id_webchat_messageLogs > ?"
        params.append(after_id)
    cursor.execute(
        f"""
        WITH targets AS (
            SELECT TOP (?)
                m.id_webchat_messageLogs AS messageId,
                m.TextContent,
                m.SentAt,
                m.Source,
                m.SenderId
            FROM dbo.WebChat_MessageLogs m
            WHERE m.FromHost = 0
              AND m.TextContent IS NOT NULL
              AND {valid_message_condition("m")}
              {version_filter}
              {after_filter}
            ORDER BY m.id_webchat_messageLogs
        ), context_ranked AS (
            SELECT
                t.messageId AS targetMessageId,
                cm.id_webchat_messageLogs AS contextMessageId,
                cm.TextContent AS contextTextContent,
                cm.SentAt AS contextSentAt,
                ROW_NUMBER() OVER (
                    PARTITION BY t.messageId
                    ORDER BY cm.SentAt DESC, cm.id_webchat_messageLogs DESC
                ) AS contextRank
            FROM targets t
            JOIN dbo.WebChat_MessageLogs cm
              ON cm.Source = t.Source
             AND cm.SenderId = t.SenderId
             AND cm.FromHost = 0
             AND cm.TextContent IS NOT NULL
             AND (cm.SentAt < t.SentAt OR (cm.SentAt = t.SentAt AND cm.id_webchat_messageLogs < t.messageId))
             AND cm.SentAt >= DATEADD(MINUTE, -30, t.SentAt)
             AND {valid_message_condition("cm")}
        )
        SELECT
            t.messageId,
            t.TextContent,
            t.SentAt,
            c.contextMessageId,
            c.contextTextContent,
            c.contextSentAt
        FROM targets t
        LEFT JOIN context_ranked c
          ON c.targetMessageId = t.messageId
         AND c.contextRank <= 5
        ORDER BY t.messageId, c.contextRank
        """,
        tuple(params),
    )
    flat_rows = rows_to_dicts(cursor)
    grouped: dict[int, dict] = {}
    for row in flat_rows:
        target = grouped.setdefault(row["messageId"], {
            "messageId": row["messageId"],
            "TextContent": row.get("TextContent"),
            "SentAt": row.get("SentAt"),
            "ContextMessages": [],
        })
        if row.get("contextMessageId") is not None:
            target["ContextMessages"].append({
                "messageId": row["contextMessageId"],
                "textContent": row.get("contextTextContent"),
                "sentAt": row.get("contextSentAt"),
            })
    return list(grouped.values())


def sync_customer_message_keywords(*, apply: bool = False, batch_size: int = 1000,
                                   after_id: int | None = None,
                                   force_version: bool = False) -> MessageKeywordSyncResult:
    batch_size = max(1, min(int(batch_size), 5000))
    with get_connection() as conn:
        cursor = conn.cursor()
        keyword_catalog = build_topic_keyword_catalog(keyword_repository.get_all())
        expected_version = keyword_classifier_version(keyword_catalog)
        rows = _fetch_customer_messages(
            cursor,
            batch_size=batch_size,
            after_id=after_id,
            force_version=force_version,
            expected_version=expected_version,
        )
        updates = []
        analyzed_at = datetime.now()
        for row in rows:
            context = row.get("ContextMessages") or []
            resolution = resolve_topic(
                row.get("TextContent") or "",
                context,
                current_time=row.get("SentAt"),
                keyword_catalog=keyword_catalog,
                classifier_version=expected_version,
            )
            updates.append((
                resolution.primary_topic_id,
                json.dumps(resolution.labels, ensure_ascii=False),
                json.dumps(list(resolution.matched_keywords), ensure_ascii=False),
                resolution.confidence,
                resolution.source,
                resolution.context_message_id,
                resolution.context_distance,
                resolution.classifier_version,
                analyzed_at,
                row["messageId"],
            ))

        result = MessageKeywordSyncResult(
            dry_run=not apply,
            scanned_rows=len(rows),
            would_update_rows=len(updates),
            last_message_id=rows[-1]["messageId"] if rows else after_id,
        )
        if not apply or not updates:
            return result

        cursor.executemany(
            """
            UPDATE dbo.WebChat_MessageLogs
            SET primaryTopicId = ?,
                detectedTopics = ?,
                detectedKeywords = ?,
                topicConfidence = ?,
                topicSource = ?,
                contextMessageId = ?,
                contextDistance = ?,
                keywordClassifierVersion = ?,
                keywordAnalyzedAt = ?
            WHERE id_webchat_messageLogs = ?
            """,
            updates,
        )
        conn.commit()
        result.updated_rows = len(updates)
        return result
