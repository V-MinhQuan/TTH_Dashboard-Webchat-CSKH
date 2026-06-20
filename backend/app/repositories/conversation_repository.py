from __future__ import annotations

from typing import Any, Callable, Dict, List, Tuple

from app.db.session import execute_all, execute_one, get_connection
from app.repositories.display_filters import (
    conversation_status_case,
    valid_conversation_condition,
    valid_message_condition,
)
from app.utils.date_filters import build_date_filter
from app.utils.pagination import normalize_pagination


class ConversationRepository:
    def __init__(self, connection_factory: Callable = get_connection):
        self._connection_factory = connection_factory

    def list_conversations(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        pagination = normalize_pagination(
            page=int(filters.get("page") or 1),
            page_size=int(filters.get("pageSize") or 20),
        )
        where, params = self._where(filters)
        from_clause = self._list_from_clause()
        with self._connection_factory() as conn:
            total_row = execute_one(
                conn,
                f"""
                SELECT COUNT(DISTINCT c.Id) AS total
                {from_clause}
                {where}
                """,
                params,
            )
            rows = execute_all(
                conn,
                f"""
                SELECT
                  c.Id AS id,
                  c.CustomerId AS customer_id,
                  customerInfo.customer_name,
                  {conversation_status_case("c", "latestStatus")} AS status,
                  c.Source AS source,
                  latestAnalytics.sentimentLabel AS sentiment,
                  latestAnalytics.detectedTopics AS topic,
                  c.LastCustomerMessageAt AS created_at,
                  c.LastHostMessageAt AS first_response_at,
                  c.LastMessageAt AS updated_at
                {from_clause}
                {where}
                ORDER BY c.LastCustomerMessageAt DESC, c.Id DESC
                OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
                """,
                [*params, pagination.offset, pagination.page_size],
            )
        return {
            "records": rows,
            "pagination": {
                "page": pagination.page,
                "pageSize": pagination.page_size,
                "total": int(total_row.get("total") or 0),
            },
        }

    def get_conversation(self, conversation_id: int) -> Dict[str, Any]:
        with self._connection_factory() as conn:
            conversation = execute_one(
                conn,
                f"""
                SELECT
                  c.Id AS id,
                  c.CustomerId AS customer_id,
                  customerInfo.customer_name,
                  c.Source AS source,
                  c.LastCustomerMessageAt AS created_at,
                  c.LastHostMessageAt AS first_response_at,
                  c.LastMessageAt AS updated_at
                FROM dbo.WebChat_Conversations c
                OUTER APPLY (
                  SELECT MAX(NULLIF(LTRIM(RTRIM(u.DisplayName)), N'')) AS customer_name
                  FROM dbo.WebChat_Messagelogs_User_Info u
                  WHERE u.SenderId = c.CustomerId AND u.Source = c.Source
                ) customerInfo
                WHERE c.Id = ?
                  AND {valid_conversation_condition("c")}
                """,
                [conversation_id],
            )
            if not conversation:
                return {}
            messages = execute_all(
                conn,
                f"""
                SELECT TOP 200
                  m.id_webchat_messagelogs AS messageId,
                  m.TextContent AS textContent,
                  m.FromHost AS fromHost,
                  m.SentAt AS sentAt,
                  m.Source AS source
                FROM dbo.WebChat_MessageLogs m
                WHERE m.Source = ?
                  AND (m.SenderId = ? OR m.ReceiverId = ?)
                  AND {valid_message_condition("m")}
                ORDER BY m.SentAt ASC
                """,
                [
                    conversation.get("source"),
                    conversation.get("customer_id"),
                    conversation.get("customer_id"),
                ],
            )
        return {**conversation, "messages": messages}

    def get_by_message(self, message_id: int) -> Dict[str, Any]:
        with self._connection_factory() as conn:
            row = execute_one(
                conn,
                f"""
                SELECT TOP 1 c.Id AS conversationId
                FROM dbo.WebChat_MessageLogs m
                LEFT JOIN dbo.WebChat_Conversations c
                  ON c.CustomerId = CASE WHEN m.FromHost = 1 THEN m.ReceiverId ELSE m.SenderId END
                 AND c.Source = m.Source
                WHERE m.id_webchat_messagelogs = ?
                  AND {valid_message_condition("m")}
                """,
                [message_id],
            )
        if not row.get("conversationId"):
            return {}
        return self.get_conversation(int(row["conversationId"]))

    def close_conversations(
        self,
        conversation_ids: tuple[int, ...],
        marked_by: str,
    ) -> Dict[str, int]:
        with self._connection_factory() as conn:
            try:
                result = self._close_selected(conn, conversation_ids, marked_by)
                conn.commit()
                return result
            except Exception:
                conn.rollback()
                raise

    def close_latest(
        self,
        customer_id: str,
        source: str,
        marked_by: str,
    ) -> Dict[str, int]:
        with self._connection_factory() as conn:
            try:
                row = execute_one(
                    conn,
                    f"""
                    SELECT TOP 1 c.Id AS id
                    FROM dbo.WebChat_Conversations c WITH (UPDLOCK, HOLDLOCK)
                    WHERE c.CustomerId = ?
                      AND LOWER(LTRIM(RTRIM(c.Source))) = LOWER(LTRIM(RTRIM(?)))
                      AND {valid_conversation_condition("c")}
                    ORDER BY c.LastCustomerMessageAt DESC, c.LastMessageAt DESC, c.Id DESC
                    """,
                    [customer_id, source],
                )
                if not row.get("id"):
                    result = self._close_result(1, 0, 0)
                else:
                    result = self._close_selected(conn, (int(row["id"]),), marked_by)
                conn.commit()
                return result
            except Exception:
                conn.rollback()
                raise

    def _close_selected(
        self,
        conn: Any,
        conversation_ids: tuple[int, ...],
        marked_by: str,
    ) -> Dict[str, int]:
        placeholders = ", ".join("?" for _ in conversation_ids)
        rows = execute_all(
            conn,
            f"""
            SELECT
              c.Id AS id,
              c.CustomerId AS customer_id,
              c.Source AS source,
              c.LastCustomerMessageAt AS last_customer_message_at,
              latestStatus.Id AS status_id,
              {conversation_status_case("c", "latestStatus")} AS status
            FROM dbo.WebChat_Conversations c WITH (UPDLOCK, HOLDLOCK)
            OUTER APPLY (
              SELECT TOP 1 s.Id, s.NoResponseNeeded, s.MarkedAt
              FROM dbo.WebChat_ConversationStatus s WITH (UPDLOCK, HOLDLOCK)
              WHERE s.CustomerId = c.CustomerId AND s.Source = c.Source
              ORDER BY CASE WHEN s.MarkedAt IS NULL THEN 0 ELSE 1 END DESC,
                       s.MarkedAt DESC,
                       s.Id DESC
            ) latestStatus
            WHERE c.Id IN ({placeholders})
              AND {valid_conversation_condition("c")}
            """,
            list(conversation_ids),
        )

        affected_count = 0
        cursor = conn.cursor()
        for row in rows:
            if str(row.get("status") or "").lower() == "closed":
                continue
            status_id = row.get("status_id")
            if status_id is not None:
                cursor.execute(
                    """
                    UPDATE dbo.WebChat_ConversationStatus
                    SET NoResponseNeeded = 1, MarkedAt = GETDATE(), MarkedBy = ?
                    WHERE Id = ?
                    """,
                    (marked_by, status_id),
                )
            else:
                cursor.execute(
                    """
                    INSERT INTO dbo.WebChat_ConversationStatus
                      (CustomerId, Source, NoResponseNeeded, MarkedAt, MarkedBy)
                    VALUES (?, ?, 1, GETDATE(), ?)
                    """,
                    (row.get("customer_id"), row.get("source"), marked_by),
                )
            affected_count += 1

        return self._close_result(len(conversation_ids), len(rows), affected_count)

    @staticmethod
    def _close_result(requested: int, matched: int, affected: int) -> Dict[str, int]:
        return {
            "requestedCount": requested,
            "matchedCount": matched,
            "affectedCount": affected,
            "alreadyClosedCount": matched - affected,
        }

    @staticmethod
    def _list_from_clause() -> str:
        return """
            FROM dbo.WebChat_Conversations c
            OUTER APPLY (
              SELECT TOP 1 s.NoResponseNeeded, s.MarkedAt
              FROM dbo.WebChat_ConversationStatus s
              WHERE s.CustomerId = c.CustomerId AND s.Source = c.Source
              ORDER BY CASE WHEN s.MarkedAt IS NULL THEN 0 ELSE 1 END DESC,
                       s.MarkedAt DESC,
                       s.Id DESC
            ) latestStatus
            OUTER APPLY (
              SELECT MAX(NULLIF(LTRIM(RTRIM(u.DisplayName)), N'')) AS customer_name
              FROM dbo.WebChat_Messagelogs_User_Info u
              WHERE u.SenderId = c.CustomerId AND u.Source = c.Source
            ) customerInfo
            OUTER APPLY (
              SELECT TOP 1 a.sentimentLabel, a.detectedTopics
              FROM dbo.WebChat_MessageAnalytics a
              WHERE a.conversationId = c.Id
              ORDER BY a.messageAt DESC, a.id DESC
            ) latestAnalytics
        """

    def _where(self, filters: Dict[str, Any]) -> Tuple[str, List[Any]]:
        conditions = ["c.LastCustomerMessageAt IS NOT NULL", valid_conversation_condition("c")]
        params: List[Any] = []
        date_filter = build_date_filter(
            column="c.LastCustomerMessageAt",
            date_range=filters.get("dateRange"),
            from_date=filters.get("fromDate"),
            to_date=filters.get("toDate"),
            start_date=filters.get("startDate"),
            end_date=filters.get("endDate"),
        )
        if date_filter.condition:
            conditions.append(date_filter.condition)
            params.extend(date_filter.params)

        source = filters.get("channel") or filters.get("source")
        if source:
            conditions.append("c.Source = ?")
            params.append(source)

        conversation_status = filters.get("status") or filters.get("conversationStatus")
        if conversation_status:
            conditions.append(f"({conversation_status_case('c', 'latestStatus')}) = ?")
            params.append(conversation_status)

        sentiment = filters.get("sentiment")
        if sentiment:
            conditions.append("latestAnalytics.sentimentLabel = ?")
            params.append(sentiment)

        topic = filters.get("topic")
        if topic:
            conditions.append("latestAnalytics.detectedTopics LIKE ?")
            params.append(f"%{topic}%")

        search = filters.get("search")
        if search:
            conditions.append("(c.CustomerId LIKE ? OR customerInfo.customer_name LIKE ?)")
            params.extend([f"%{search}%", f"%{search}%"])
        return "WHERE " + " AND ".join(conditions), params
