from __future__ import annotations

from typing import Any, Callable, Dict, List, Tuple

from app.db.session import execute_all, execute_one, get_connection
from app.repositories.schema_inspector import inspect_message_analytics_columns
from app.utils.date_filters import build_date_filter
from app.utils.pagination import normalize_pagination


class AnalyticsRepository:
    def __init__(self, connection_factory: Callable = get_connection):
        self._connection_factory = connection_factory

    def get_sentiment_summary(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        with self._connection_factory() as conn:
            columns = inspect_message_analytics_columns(conn)
            where, params = self._build_read_where(filters, columns)
            issue_expr = "SUM(CASE WHEN a.issueFlag = 1 THEN 1 ELSE 0 END)" if columns.get("issueFlag") else "0"
            version_expr = "a.analyzerVersion" if columns.get("analyzerVersion") else "CAST(NULL AS NVARCHAR(50))"
            source_expr = "a.sentimentSource" if columns.get("sentimentSource") else "CAST(NULL AS NVARCHAR(50))"

            row = execute_one(
                conn,
                f"""
                SELECT
                  COUNT(*) AS total,
                  SUM(CASE WHEN a.sentimentLabel = 'positive' THEN 1 ELSE 0 END) AS positive,
                  SUM(CASE WHEN a.sentimentLabel = 'neutral' THEN 1 ELSE 0 END) AS neutral,
                  SUM(CASE WHEN a.sentimentLabel = 'negative' THEN 1 ELSE 0 END) AS negative,
                  {issue_expr} AS issueFlag,
                  SUM(CASE WHEN a.needStaffReview = 1 THEN 1 ELSE 0 END) AS needStaffReview,
                  AVG(a.satisfactionScore) AS avgSatisfaction,
                  AVG(CASE WHEN a.sentimentLabel = 'positive' THEN a.sentimentScore END) AS avgPositive,
                  AVG(CASE WHEN a.sentimentLabel = 'neutral' THEN a.sentimentScore END) AS avgNeutral,
                  AVG(CASE WHEN a.sentimentLabel = 'negative' THEN a.sentimentScore END) AS avgNegative
                FROM dbo.WebChat_MessageAnalytics a
                {where}
                """,
                params,
            )
            version_rows = execute_all(
                conn,
                f"""
                SELECT
                  {source_expr} AS sentimentSource,
                  {version_expr} AS analyzerVersion,
                  a.sentimentLabel,
                  COUNT(*) AS total
                FROM dbo.WebChat_MessageAnalytics a
                {where}
                GROUP BY {source_expr}, {version_expr}, a.sentimentLabel
                ORDER BY analyzerVersion, a.sentimentLabel
                """,
                params,
            )
        return {
            "row": row,
            "analyzerVersionDistribution": version_rows,
            "optionalColumns": columns,
        }

    def get_sentiment_trend(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        with self._connection_factory() as conn:
            columns = inspect_message_analytics_columns(conn)
            where, params = self._build_read_where(filters, columns)
            issue_expr = "SUM(CASE WHEN a.issueFlag = 1 THEN 1 ELSE 0 END)" if columns.get("issueFlag") else "0"
            rows = execute_all(
                conn,
                f"""
                SELECT
                  CONVERT(date, a.messageAt) AS date,
                  SUM(CASE WHEN a.sentimentLabel = 'positive' THEN 1 ELSE 0 END) AS positive,
                  SUM(CASE WHEN a.sentimentLabel = 'neutral' THEN 1 ELSE 0 END) AS neutral,
                  SUM(CASE WHEN a.sentimentLabel = 'negative' THEN 1 ELSE 0 END) AS negative,
                  {issue_expr} AS issueFlag,
                  SUM(CASE WHEN a.needStaffReview = 1 THEN 1 ELSE 0 END) AS needStaffReview
                FROM dbo.WebChat_MessageAnalytics a
                {where}
                GROUP BY CONVERT(date, a.messageAt)
                ORDER BY date ASC
                """,
                params,
            )
        return {"rows": rows, "optionalColumns": columns}

    def get_satisfaction_summary(self, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        with self._connection_factory() as conn:
            columns = inspect_message_analytics_columns(conn)
            where, params = self._build_read_where(filters, columns)
            return execute_all(
                conn,
                f"""
                SELECT
                  a.satisfactionLevel,
                  COUNT(*) AS levelCount,
                  AVG(a.satisfactionScore) AS avgSatisfactionScore,
                  SUM(CASE WHEN a.needStaffReview = 1 THEN 1 ELSE 0 END) AS needReviewCount
                FROM dbo.WebChat_MessageAnalytics a
                {where}
                GROUP BY a.satisfactionLevel
                ORDER BY levelCount DESC
                """,
                params,
            )

    def get_satisfaction_trend(self, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        with self._connection_factory() as conn:
            columns = inspect_message_analytics_columns(conn)
            where, params = self._build_read_where(filters, columns)
            return execute_all(
                conn,
                f"""
                SELECT
                  CONVERT(date, a.messageAt) AS date,
                  AVG(a.satisfactionScore) AS avgScore,
                  COUNT(*) AS count,
                  SUM(CASE WHEN a.needStaffReview = 1 THEN 1 ELSE 0 END) AS needReviewCount
                FROM dbo.WebChat_MessageAnalytics a
                {where}
                GROUP BY CONVERT(date, a.messageAt)
                ORDER BY date ASC
                """,
                params,
            )

    def get_topic_raw_data(self, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        with self._connection_factory() as conn:
            columns = inspect_message_analytics_columns(conn)
            where, params = self._build_read_where(filters, columns)
            return execute_all(
                conn,
                f"""
                SELECT
                  a.detectedTopics,
                  a.detectedKeywords,
                  COUNT(*) AS msgCount
                FROM dbo.WebChat_MessageAnalytics a
                {where + " AND" if where else "WHERE"} a.detectedTopics IS NOT NULL
                  AND a.detectedTopics <> '[]'
                GROUP BY a.detectedTopics, a.detectedKeywords
                ORDER BY msgCount DESC
                """,
                params,
            )

    def get_keyword_raw_data(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        with self._connection_factory() as conn:
            columns = inspect_message_analytics_columns(conn)
            where, params = self._build_read_where(filters, columns)
            mode = filters.get("mode") or "negative"
            extra_condition = self._keyword_mode_condition(mode, columns)
            if extra_condition == "1 = 0":
                return {"rows": [], "optionalColumns": columns}

            issue_type_expr = "a.issueType" if columns.get("issueType") else "CAST(NULL AS NVARCHAR(100))"
            rows = execute_all(
                conn,
                f"""
                SELECT
                  a.matchedNegativeKeywords,
                  {issue_type_expr} AS issueType,
                  COUNT(*) AS msgCount
                FROM dbo.WebChat_MessageAnalytics a
                {where + " AND" if where else "WHERE"} {extra_condition}
                  AND (
                    (a.matchedNegativeKeywords IS NOT NULL AND a.matchedNegativeKeywords <> '[]')
                    {"OR a.issueType IS NOT NULL" if columns.get("issueType") and mode != "negative" else ""}
                  )
                GROUP BY a.matchedNegativeKeywords, {issue_type_expr}
                ORDER BY msgCount DESC
                """,
                params,
            )
        return {"rows": rows, "optionalColumns": columns}

    def get_need_review_conversations(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        pagination = normalize_pagination(
            page=int(filters.get("page") or 1),
            page_size=int(filters.get("pageSize") or 20),
        )
        with self._connection_factory() as conn:
            columns = inspect_message_analytics_columns(conn)
            data_where, data_params = self._build_need_review_where(filters, columns, include_search=True)
            issue_flag_expr = "a.issueFlag" if columns.get("issueFlag") else "CAST(NULL AS BIT)"
            issue_type_expr = "a.issueType" if columns.get("issueType") else "CAST(NULL AS NVARCHAR(100))"
            issue_reason_expr = "a.issueReason" if columns.get("issueReason") else "CAST(NULL AS NVARCHAR(1000))"
            issue_conf_expr = "a.issueConfidence" if columns.get("issueConfidence") else "CAST(NULL AS FLOAT)"
            total_row = execute_one(
                conn,
                f"""
                SELECT COUNT(*) AS total
                FROM dbo.WebChat_MessageAnalytics a
                LEFT JOIN dbo.WebChat_MessageLogs m
                  ON m.id_webchat_messagelogs = a.messageId
                {data_where}
                """,
                data_params,
            )
            records = execute_all(
                conn,
                f"""
                SELECT
                  a.id,
                  a.messageId,
                  m.TextContent AS textContent,
                  a.conversationId,
                  a.customerId,
                  a.source,
                  a.sentimentLabel,
                  a.sentimentScore,
                  a.sentimentReason,
                  a.satisfactionScore,
                  a.satisfactionLevel,
                  a.satisfactionReason,
                  a.needStaffReview,
                  {issue_flag_expr} AS issueFlag,
                  {issue_type_expr} AS issueType,
                  {issue_reason_expr} AS issueReason,
                  {issue_conf_expr} AS issueConfidence,
                  a.detectedTopics,
                  a.matchedNegativeKeywords,
                  a.messageAt
                FROM dbo.WebChat_MessageAnalytics a
                LEFT JOIN dbo.WebChat_MessageLogs m
                  ON m.id_webchat_messagelogs = a.messageId
                {data_where}
                ORDER BY a.messageAt DESC
                OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
                """,
                [*data_params, pagination.offset, pagination.page_size],
            )
        return {
            "records": records,
            "pagination": {
                "page": pagination.page,
                "pageSize": pagination.page_size,
                "total": int(total_row.get("total") or 0),
            },
            "optionalColumns": columns,
        }

    def _build_read_where(self, filters: Dict[str, Any], columns: Dict[str, bool]) -> Tuple[str, List[Any]]:
        conditions: List[str] = []
        params: List[Any] = []
        date_filter = build_date_filter(
            column="a.messageAt",
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
            conditions.append("a.source = ?")
            params.append(source)
        sentiment = filters.get("sentimentLabel") or filters.get("sentiment")
        if sentiment:
            conditions.append("a.sentimentLabel = ?")
            params.append(sentiment)
        topic = filters.get("topic")
        if topic:
            conditions.append("a.detectedTopics LIKE ?")
            params.append(f"%{topic}%")
        issue_type = filters.get("issueType")
        if issue_type:
            conditions.append("a.issueType = ?" if columns.get("issueType") else "1 = 0")
            if columns.get("issueType"):
                params.append(issue_type)
        return ("WHERE " + " AND ".join(conditions)) if conditions else "", params

    def _build_need_review_where(
        self,
        filters: Dict[str, Any],
        columns: Dict[str, bool],
        *,
        include_search: bool,
    ) -> Tuple[str, List[Any]]:
        review_parts = ["a.needStaffReview = 1", "a.sentimentLabel = 'negative'"]
        if columns.get("issueFlag"):
            review_parts.append("a.issueFlag = 1")
        base_filters = dict(filters)
        search = base_filters.pop("search", None)
        where, params = self._build_read_where(base_filters, columns)
        conditions = [f"({ ' OR '.join(review_parts) })"]
        if where:
            conditions.append(where.removeprefix("WHERE "))
        if include_search and search:
            conditions.append("(m.TextContent LIKE ? OR a.customerId LIKE ?)")
            params.extend([f"%{search}%", f"%{search}%"])
        return "WHERE " + " AND ".join(conditions), params

    def _keyword_mode_condition(self, mode: str, columns: Dict[str, bool]) -> str:
        if mode == "needReview":
            parts = ["a.needStaffReview = 1", "a.sentimentLabel = 'negative'"]
            if columns.get("issueFlag"):
                parts.append("a.issueFlag = 1")
            return f"({ ' OR '.join(parts) })"
        if mode == "issue":
            parts = []
            if columns.get("issueFlag"):
                parts.append("a.issueFlag = 1")
            if columns.get("issueType"):
                parts.append("a.issueType IS NOT NULL")
            return f"({ ' OR '.join(parts) })" if parts else "1 = 0"
        return "a.sentimentLabel = 'negative'"
