from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from app.db.session import get_connection, rows_to_dicts
from app.repositories.display_filters import valid_message_condition
from app.services.ai_issue_classifier import IssueClassification, classify_ai_issue


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


def _is_same_issue_state(row: dict, classification: IssueClassification) -> bool:
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
    )


def _fetch_ai_messages(cursor, since: Optional[str]) -> list[dict]:
    params: list[str] = []
    since_filter = ""
    if since:
        since_filter = "AND m.SentAt >= ?"
        params.append(since)

    cursor.execute(
        f"""
        SELECT
            m.id_webchat_messageLogs AS messageId,
            m.TextContent,
            m.SentAt,
            m.Source,
            m.ReceiverId,
            conv.Id AS conversationId,
            CASE WHEN a.messageId IS NULL THEN 0 ELSE 1 END AS hasAnalytics,
            a.issueFlag,
            a.issueType,
            a.issueReason,
            a.issueConfidence
        FROM dbo.WebChat_MessageLogs m
        LEFT JOIN dbo.WebChat_MessageAnalytics a
            ON a.messageId = m.id_webchat_messageLogs
        LEFT JOIN dbo.WebChat_Conversations conv
            ON conv.Source = m.Source
            AND conv.CustomerId = CASE
                WHEN m.FromHost = 1 THEN m.ReceiverId
                ELSE m.SenderId
            END
        WHERE m.FromHost = 1
          AND m.HostDisplayName = 'AI Assistant'
          AND m.TextContent IS NOT NULL
          AND {valid_message_condition("m")}
          {since_filter}
        """,
        tuple(params),
    )
    return rows_to_dicts(cursor)


def sync_ai_issue_flags(*, apply: bool = False, since: Optional[str] = None) -> AiIssueSyncResult:
    with get_connection() as conn:
        cursor = conn.cursor()
        rows = _fetch_ai_messages(cursor, since)

        updates = []
        inserts = []
        issue_counts: Counter[str] = Counter()

        analyzed_at = datetime.now()
        for row in rows:
            classification = classify_ai_issue(row.get("TextContent"))
            if classification.issue_flag and classification.issue_type:
                issue_counts[classification.issue_type] += 1

            issue_flag = 1 if classification.issue_flag else 0
            issue_type = classification.issue_type
            issue_reason = classification.issue_reason
            issue_confidence = classification.issue_confidence
            need_staff_review = issue_flag

            if row.get("hasAnalytics"):
                if not _is_same_issue_state(row, classification):
                    updates.append((
                        issue_flag,
                        issue_type,
                        issue_reason,
                        issue_confidence,
                        need_staff_review,
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
                ))

        result = AiIssueSyncResult(
            dry_run=not apply,
            total_ai_messages=len(rows),
            would_update_rows=len(updates),
            would_insert_rows=len(inserts),
            flagged_rows=sum(issue_counts.values()),
            issue_counts=dict(issue_counts),
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
                    needStaffReview = ?
                WHERE messageId = ?
                """,
                updates[i:i + 100],
            )

        for i in range(0, len(inserts), 100):
            cursor.executemany(
                """
                INSERT INTO dbo.WebChat_MessageAnalytics
                (messageId, conversationId, customerId, source, sentimentLabel, sentimentScore,
                 needStaffReview, messageAt, analyzedAt, issueFlag, issueType, issueReason, issueConfidence)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                inserts[i:i + 100],
            )

        conn.commit()
        result.updated_rows = len(updates)
        result.inserted_rows = len(inserts)
        return result
