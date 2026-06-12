from __future__ import annotations

from typing import Any, Callable, Dict, List, Tuple

from app.db.session import execute_all, execute_one, get_connection
from app.repositories.schema_inspector import inspect_message_analytics_columns
from app.utils.date_filters import build_date_filter


class DashboardRepository:
    def __init__(self, connection_factory: Callable = get_connection):
        self._connection_factory = connection_factory

    def _date_where(self, filters: Dict[str, Any], column: str) -> Tuple[str, List[Any]]:
        date_filter = build_date_filter(
            column=column,
            date_range=filters.get("dateRange"),
            from_date=filters.get("fromDate"),
            to_date=filters.get("toDate"),
            start_date=filters.get("startDate"),
            end_date=filters.get("endDate"),
        )
        conditions: List[str] = []
        params: List[Any] = []
        if date_filter.condition:
            conditions.append(date_filter.condition)
            params.extend(date_filter.params)
        return ("WHERE " + " AND ".join(conditions)) if conditions else "", params

    def get_kpi(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        with self._connection_factory() as conn:
            conversation_where, conversation_params = self._conversation_where(filters)
            message_where, message_params = self._date_where(filters, "m.SentAt")
            analytics_where, analytics_params = self._date_where(filters, "a.messageAt")
            optional_columns = inspect_message_analytics_columns(conn)
            issue_review_expr = "a.needStaffReview = 1 OR a.sentimentLabel = 'negative'"
            if optional_columns.get("issueFlag"):
                issue_review_expr = "a.needStaffReview = 1 OR a.issueFlag = 1 OR a.sentimentLabel = 'negative'"

            totals = execute_one(
                conn,
                f"""
                SELECT
                  COUNT(DISTINCT c.Id) AS totalConversations,
                  COUNT(DISTINCT c.CustomerId) AS newCustomers,
                  AVG(CASE
                    WHEN c.LastHostMessageAt IS NOT NULL
                     AND c.LastHostMessageAt >= c.LastCustomerMessageAt
                    THEN DATEDIFF(MINUTE, c.LastCustomerMessageAt, c.LastHostMessageAt)
                    ELSE NULL
                  END) AS averageResponseTimeMinutes
                FROM dbo.WebChat_Conversations c
                LEFT JOIN dbo.WebChat_ConversationStatus s
                  ON c.CustomerId = s.CustomerId AND c.Source = s.Source
                {conversation_where}
                """,
                conversation_params,
            )
            status_rows = execute_all(
                conn,
                f"""
                SELECT
                  CASE
                    WHEN s.NoResponseNeeded = 1 THEN 'closed'
                    WHEN s.NoResponseNeeded = 0 THEN 'open'
                    ELSE 'new'
                  END AS status,
                  COUNT(DISTINCT c.Id) AS total
                FROM dbo.WebChat_Conversations c
                LEFT JOIN dbo.WebChat_ConversationStatus s
                  ON c.CustomerId = s.CustomerId AND c.Source = s.Source
                {conversation_where}
                GROUP BY
                  CASE
                    WHEN s.NoResponseNeeded = 1 THEN 'closed'
                    WHEN s.NoResponseNeeded = 0 THEN 'open'
                    ELSE 'new'
                  END
                """,
                conversation_params,
            )
            source_rows = execute_all(
                conn,
                f"""
                SELECT
                  CASE
                    WHEN LOWER(LTRIM(RTRIM(c.Source))) IN ('facebook', 'fb', 'messenger') THEN 'Facebook'
                    WHEN LOWER(LTRIM(RTRIM(c.Source))) IN ('zalooa', 'zalo') THEN 'ZaloOA'
                    WHEN LOWER(LTRIM(RTRIM(c.Source))) IN ('zalobusiness', 'zalobiz') THEN 'ZaloBusiness'
                    WHEN LOWER(LTRIM(RTRIM(c.Source))) IN ('chatwidget', 'website', 'web') THEN 'ChatWidget'
                    ELSE 'other'
                  END AS source,
                  COUNT(DISTINCT c.Id) AS total
                FROM dbo.WebChat_Conversations c
                {conversation_where}
                GROUP BY
                  CASE
                    WHEN LOWER(LTRIM(RTRIM(c.Source))) IN ('facebook', 'fb', 'messenger') THEN 'Facebook'
                    WHEN LOWER(LTRIM(RTRIM(c.Source))) IN ('zalooa', 'zalo') THEN 'ZaloOA'
                    WHEN LOWER(LTRIM(RTRIM(c.Source))) IN ('zalobusiness', 'zalobiz') THEN 'ZaloBusiness'
                    WHEN LOWER(LTRIM(RTRIM(c.Source))) IN ('chatwidget', 'website', 'web') THEN 'ChatWidget'
                    ELSE 'other'
                  END
                """,
                conversation_params,
            )
            trend_rows = execute_all(
                conn,
                f"""
                SELECT
                  CONVERT(date, c.LastCustomerMessageAt) AS dateKey,
                  COUNT(DISTINCT c.Id) AS total,
                  SUM(CASE WHEN s.NoResponseNeeded = 1 THEN 1 ELSE 0 END) AS processed,
                  SUM(CASE WHEN ISNULL(s.NoResponseNeeded, 0) <> 1 THEN 1 ELSE 0 END) AS unprocessed
                FROM dbo.WebChat_Conversations c
                LEFT JOIN dbo.WebChat_ConversationStatus s
                  ON c.CustomerId = s.CustomerId AND c.Source = s.Source
                {conversation_where}
                GROUP BY CONVERT(date, c.LastCustomerMessageAt)
                ORDER BY dateKey ASC
                """,
                conversation_params,
            )
            total_messages = execute_one(
                conn,
                f"SELECT COUNT(*) AS totalMessages FROM dbo.WebChat_MessageLogs m {message_where}",
                message_params,
            )
            need_review = execute_one(
                conn,
                f"""
                SELECT COUNT(*) AS needStaffReviewCount
                FROM dbo.WebChat_MessageAnalytics a
                {analytics_where + " AND" if analytics_where else "WHERE"} ({issue_review_expr})
                """,
                analytics_params,
            )

        status_summary = {row.get("status") or "new": int(row.get("total") or 0) for row in status_rows}
        source_summary = {row.get("source") or "other": int(row.get("total") or 0) for row in source_rows}
        return {
            "totalConversations": int(totals.get("totalConversations") or 0),
            "totalMessages": int(total_messages.get("totalMessages") or 0),
            "pendingConversations": int(status_summary.get("open", 0) + status_summary.get("new", 0)),
            "completedConversations": int(status_summary.get("closed", 0)),
            "aiFailedCount": 0,
            "needStaffReviewCount": int(need_review.get("needStaffReviewCount") or 0),
            "newCustomers": int(totals.get("newCustomers") or 0),
            "averageResponseTimeMinutes": round(float(totals.get("averageResponseTimeMinutes") or 0), 2),
            "statusSummary": status_summary,
            "sourceSummary": source_summary,
            "trendData": [
                {
                    "date": str(row.get("dateKey")).split(" ")[0],
                    "total": int(row.get("total") or 0),
                    "processed": int(row.get("processed") or 0),
                    "unprocessed": int(row.get("unprocessed") or 0),
                }
                for row in trend_rows
            ],
        }

    def _conversation_where(self, filters: Dict[str, Any]) -> Tuple[str, List[Any]]:
        date_filter = build_date_filter(
            column="c.LastCustomerMessageAt",
            date_range=filters.get("dateRange"),
            from_date=filters.get("fromDate"),
            to_date=filters.get("toDate"),
            start_date=filters.get("startDate"),
            end_date=filters.get("endDate"),
        )
        conditions = ["c.LastCustomerMessageAt IS NOT NULL"]
        params: List[Any] = []
        if date_filter.condition:
            conditions.append(date_filter.condition)
            params.extend(date_filter.params)
        source = filters.get("channel") or filters.get("source")
        if source:
            conditions.append("c.Source = ?")
            params.append(source)
        return "WHERE " + " AND ".join(conditions), params

