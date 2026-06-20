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
        with self._connection_factory() as conn:
            total_row = execute_one(
                conn,
                f"""
                SELECT COUNT(DISTINCT c.Id) AS total
                FROM dbo.WebChat_Conversations c
                LEFT JOIN dbo.WebChat_Messagelogs_User_Info u
                  ON c.CustomerId = u.SenderId AND c.Source = u.Source
                LEFT JOIN dbo.WebChat_ConversationStatus s
                  ON c.CustomerId = s.CustomerId AND c.Source = s.Source
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
                  u.DisplayName AS customer_name,
                  {conversation_status_case("c", "latestStatus")} AS status,
                  c.Source AS source,
                  c.LastCustomerMessageAt AS created_at,
                  c.LastHostMessageAt AS first_response_at,
                  c.LastMessageAt AS updated_at
                FROM dbo.WebChat_Conversations c
                LEFT JOIN dbo.WebChat_Messagelogs_User_Info u
                  ON c.CustomerId = u.SenderId AND c.Source = u.Source
                OUTER APPLY (
                  SELECT TOP 1 s.NoResponseNeeded, s.MarkedAt
                  FROM dbo.WebChat_ConversationStatus s
                  WHERE s.CustomerId = c.CustomerId
                    AND s.Source = c.Source
                  ORDER BY CASE WHEN s.MarkedAt IS NULL THEN 0 ELSE 1 END DESC, s.MarkedAt DESC, s.Id DESC
                ) latestStatus
                {where}
                ORDER BY c.LastCustomerMessageAt DESC
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
                  c.Source AS source,
                  c.LastCustomerMessageAt AS created_at,
                  c.LastHostMessageAt AS first_response_at,
                  c.LastMessageAt AS updated_at
                FROM dbo.WebChat_Conversations c
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
        search = filters.get("search")
        if search:
            conditions.append("(c.CustomerId LIKE ? OR u.DisplayName LIKE ?)")
            params.extend([f"%{search}%", f"%{search}%"])
        return "WHERE " + " AND ".join(conditions), params

