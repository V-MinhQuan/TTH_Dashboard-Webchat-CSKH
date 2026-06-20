from __future__ import annotations

from typing import Any, Callable, Dict, List, Tuple

from app.db.session import execute_all, execute_one, get_connection
from app.repositories.display_filters import conversation_status_case, valid_analytics_condition
from app.repositories.schema_inspector import inspect_message_analytics_columns
from app.utils.date_filters import build_date_filter
from app.utils.pagination import normalize_pagination


_STATUS_EXPR = conversation_status_case("c", "latestStatus")

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
                  COUNT(*) AS msgCount,
                  SUM(CASE WHEN a.sentimentLabel = 'positive' THEN 1 ELSE 0 END) AS positive,
                  SUM(CASE WHEN a.sentimentLabel = 'neutral' THEN 1 ELSE 0 END) AS neutral,
                  SUM(CASE WHEN a.sentimentLabel = 'negative' THEN 1 ELSE 0 END) AS negative
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
            standardized_question_expr = (
                "NULLIF(LTRIM(RTRIM(a.standardizedQuestion)), '')"
                if columns.get("standardizedQuestion")
                else "CAST(NULL AS NVARCHAR(4000))"
            )
            keyword_context_expr = f"""
              CAST(
                COALESCE(
                  {standardized_question_expr},
                  CAST(cmsg.TextContent AS NVARCHAR(4000)),
                  CAST(m.TextContent AS NVARCHAR(4000)),
                  N''
                ) AS NVARCHAR(4000)
              )
            """
            rows = execute_all(
                conn,
                f"""
                SELECT
                  a.matchedNegativeKeywords,
                  a.detectedTopics,
                  {issue_type_expr} AS issueType,
                  MAX({keyword_context_expr}) AS keywordContext,
                  COUNT(*) AS msgCount
                FROM dbo.WebChat_MessageAnalytics a
                LEFT JOIN dbo.WebChat_MessageLogs m
                  ON m.id_webchat_messagelogs = a.messageId
                LEFT JOIN dbo.WebChat_Conversations c
                  ON c.Id = a.conversationId
                OUTER APPLY (
                  SELECT TOP 1 cmsg.TextContent
                  FROM dbo.WebChat_MessageLogs cmsg
                  WHERE cmsg.Source = c.Source
                    AND cmsg.SenderId = c.CustomerId
                    AND cmsg.FromHost = 0
                    AND cmsg.SentAt <= COALESCE(m.SentAt, a.messageAt)
                  ORDER BY cmsg.SentAt DESC
                ) cmsg
                {where + " AND" if where else "WHERE"} {extra_condition}
                  AND (
                    (a.matchedNegativeKeywords IS NOT NULL AND a.matchedNegativeKeywords <> '[]')
                    {"OR a.issueType IS NOT NULL" if columns.get("issueType") and mode != "negative" else ""}
                  )
                GROUP BY a.matchedNegativeKeywords, a.detectedTopics, {issue_type_expr}
                ORDER BY msgCount DESC
                """,
                params,
            )
        return {"rows": rows, "optionalColumns": columns}

    def get_need_review_conversations(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        return self._get_review_conversations(filters, self._build_need_review_where)

    def get_negative_review_conversations(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        return self._get_review_conversations(filters, self._build_negative_review_where)

    def _get_review_conversations(
        self,
        filters: Dict[str, Any],
        where_builder: Callable[[Dict[str, Any], Dict[str, bool]], Tuple[str, List[Any]]],
    ) -> Dict[str, Any]:
        pagination = normalize_pagination(
            page=int(filters.get("page") or 1),
            page_size=int(filters.get("pageSize") or 20),
        )
        with self._connection_factory() as conn:
            columns = inspect_message_analytics_columns(conn)
            data_where, data_params = where_builder(filters, columns)
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
                  cmsg.TextContent AS textContent,
                  m.TextContent AS aiAnswer,
                  a.conversationId,
                  c.CustomerId AS customerId,
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
                LEFT JOIN dbo.WebChat_Conversations c
                  ON c.Id = a.conversationId
                OUTER APPLY (
                  SELECT TOP 1 cmsg.TextContent
                  FROM dbo.WebChat_MessageLogs cmsg
                  WHERE cmsg.Source = c.Source
                    AND cmsg.SenderId = c.CustomerId
                    AND cmsg.FromHost = 0
                    AND cmsg.SentAt <= m.SentAt
                  ORDER BY cmsg.SentAt DESC
                ) cmsg
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

    def get_ai_quality_metrics(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        with self._connection_factory() as conn:
            columns = inspect_message_analytics_columns(conn)
            where, params = self._build_read_where(filters, columns)
            if not columns.get("issueFlag"):
                return {"row": {}, "optionalColumns": columns}

            row = execute_one(
                conn,
                f"""
                SELECT
                  COUNT(*) AS total,
                  SUM(CASE WHEN a.issueFlag = 1 THEN 1 ELSE 0 END) AS failure_count,
                  SUM(CASE WHEN a.issueType = N'AI có nguy cơ tự tạo thông tin' THEN 1 ELSE 0 END) AS hallucination_count,
                  AVG(a.issueConfidence) AS avg_confidence
                FROM dbo.WebChat_MessageAnalytics a
                {where}
                """,
                params,
            )
        return {"row": row, "optionalColumns": columns}

    def get_staff_activity_metrics(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        with self._connection_factory() as conn:
            columns = inspect_message_analytics_columns(conn)
            where, params = self._build_read_where(filters, columns)

            row = execute_one(
                conn,
                f"""
                SELECT
                  SUM(CASE WHEN a.needStaffReview = 1 AND a.issueFlag = 1 THEN 1 ELSE 0 END) AS reported_errors,
                  SUM(CASE WHEN a.needStaffReview = 1 THEN 1 ELSE 0 END) AS pending_review
                FROM dbo.WebChat_MessageAnalytics a
                {where}
                """,
                params,
            )
        return {"row": row, "optionalColumns": columns}

    def get_ai_failure_trend(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        with self._connection_factory() as conn:
            columns = inspect_message_analytics_columns(conn)
            where, params = self._build_read_where(filters, columns)
            if not columns.get("issueFlag"):
                return {"rows": [], "optionalColumns": columns}

            rows = execute_all(
                conn,
                f"""
                SELECT
                  CONVERT(date, a.messageAt) AS date,
                  SUM(CASE WHEN a.issueFlag = 1 THEN 1 ELSE 0 END) AS failure,
                  SUM(CASE WHEN a.issueType = N'AI có nguy cơ tự tạo thông tin' THEN 1 ELSE 0 END) AS hallucination,
                  SUM(CASE WHEN a.issueType = N'AI không chắc chắn' THEN 1 ELSE 0 END) AS uncertain
                FROM dbo.WebChat_MessageAnalytics a
                {where}
                GROUP BY CONVERT(date, a.messageAt)
                ORDER BY date ASC
                """,
                params,
            )
        return {"rows": rows, "optionalColumns": columns}

    def get_ai_failure_by_topic(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        with self._connection_factory() as conn:
            columns = inspect_message_analytics_columns(conn)
            where, params = self._build_read_where(filters, columns)
            if not columns.get("issueFlag"):
                return {"rows": [], "optionalColumns": columns}

            rows = execute_all(
                conn,
                f"""
                SELECT
                  a.detectedTopics,
                  SUM(CASE WHEN a.issueType = N'Không tìm thấy dữ liệu' THEN 1 ELSE 0 END) AS thieuDL,
                  SUM(CASE WHEN a.issueType = N'AI không chắc chắn' THEN 1 ELSE 0 END) AS khongChac,
                  SUM(CASE WHEN a.issueType = N'Câu hỏi ngoài phạm vi' THEN 1 ELSE 0 END) AS ngoaiPhamVi,
                  SUM(CASE WHEN a.issueType = N'AI có nguy cơ tự tạo thông tin' THEN 1 ELSE 0 END) AS hallucination
                FROM dbo.WebChat_MessageAnalytics a
                {where + " AND" if where else "WHERE"} a.issueFlag = 1
                GROUP BY a.detectedTopics
                """,
                params,
            )
        return {"rows": rows, "optionalColumns": columns}

    def get_failed_conversations(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        pagination = normalize_pagination(
            page=int(filters.get("page") or 1),
            page_size=int(filters.get("pageSize") or 20),
        )
        with self._connection_factory() as conn:
            columns = inspect_message_analytics_columns(conn)
            base_filters = dict(filters)
            base_filters["issueFlag"] = True # Force filter for AI failed ones
            where, params = self._build_read_where(base_filters, columns)

            # Since we add condition to where directly, need to check if where exists
            condition_str = "a.issueFlag = 1"
            if where:
                where += f" AND {condition_str}"
            else:
                where = f"WHERE {condition_str}"

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
                {where}
                """,
                params,
            )
            records = execute_all(
                conn,
                f"""
                SELECT
                  a.id,
                  a.messageId,
                  cmsg.TextContent AS textContent,
                  m.TextContent AS aiAnswer,
                  a.conversationId,
                  c.CustomerId AS customerId,
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
                LEFT JOIN dbo.WebChat_Conversations c
                  ON c.Id = a.conversationId
                OUTER APPLY (
                  SELECT TOP 1 cmsg.TextContent
                  FROM dbo.WebChat_MessageLogs cmsg
                  WHERE cmsg.Source = c.Source
                    AND cmsg.SenderId = c.CustomerId
                    AND cmsg.FromHost = 0
                    AND cmsg.SentAt <= m.SentAt
                  ORDER BY cmsg.SentAt DESC
                ) cmsg
                {where}
                ORDER BY a.messageAt DESC
                OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
                """,
                [*params, pagination.offset, pagination.page_size],
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

    def get_staff_reported_errors(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        pagination = normalize_pagination(
            page=int(filters.get("page") or 1),
            page_size=int(filters.get("pageSize") or 20),
        )
        with self._connection_factory() as conn:
            columns = inspect_message_analytics_columns(conn)
            where, params = self._build_read_where(filters, columns)

            condition_str = "a.needStaffReview = 1 AND a.issueFlag = 1"
            if where:
                where += f" AND {condition_str}"
            else:
                where = f"WHERE {condition_str}"

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
                {where}
                """,
                params,
            )
            records = execute_all(
                conn,
                f"""
                SELECT
                  a.id,
                  a.messageId,
                  cmsg.TextContent AS textContent,
                  m.TextContent AS aiAnswer,
                  a.conversationId,
                  c.CustomerId AS customerId,
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
                LEFT JOIN dbo.WebChat_Conversations c
                  ON c.Id = a.conversationId
                OUTER APPLY (
                  SELECT TOP 1 cmsg.TextContent
                  FROM dbo.WebChat_MessageLogs cmsg
                  WHERE cmsg.Source = c.Source
                    AND cmsg.SenderId = c.CustomerId
                    AND cmsg.FromHost = 0
                    AND cmsg.SentAt <= m.SentAt
                  ORDER BY cmsg.SentAt DESC
                ) cmsg
                {where}
                ORDER BY a.messageAt DESC
                OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
                """,
                [*params, pagination.offset, pagination.page_size],
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

    def get_suggested_faqs(self, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        with self._connection_factory() as conn:
            columns = inspect_message_analytics_columns(conn)
            where, params = self._build_read_where(filters, columns)
            if not columns.get("issueFlag"):
                return []

            standardized_question_expr = (
                "NULLIF(LTRIM(RTRIM(a.standardizedQuestion)), '')"
                if columns.get("standardizedQuestion")
                else "CAST(NULL AS NVARCHAR(MAX))"
            )
            extra_join = ""
            extra_conditions = ["a.issueFlag = 1"]
            conversation_status = filters.get("conversationStatus")
            if conversation_status and conversation_status != "Tất cả":
                extra_join = """
                    LEFT JOIN dbo.WebChat_ConversationStatus s
                      ON c.CustomerId = s.CustomerId
                     AND c.Source = s.Source
                """
                closed_sql = "(s.NoResponseNeeded = 1 AND (s.MarkedAt IS NULL OR c.LastCustomerMessageAt <= s.MarkedAt))"
                active_sql = "(s.NoResponseNeeded IS NULL OR s.NoResponseNeeded = 0 OR c.LastCustomerMessageAt > s.MarkedAt)"
                if conversation_status == "Chờ xử lý":
                    extra_conditions.append(f"c.CustomerId IS NOT NULL AND {active_sql} AND (c.LastHostMessageAt IS NULL OR c.LastCustomerMessageAt > c.LastHostMessageAt)")
                elif conversation_status == "Đang xử lý":
                    extra_conditions.append(f"c.CustomerId IS NOT NULL AND {active_sql} AND c.LastHostMessageAt IS NOT NULL AND c.LastCustomerMessageAt <= c.LastHostMessageAt")
                elif conversation_status == "Hoàn thành":
                    extra_conditions.append(f"c.CustomerId IS NOT NULL AND {closed_sql}")

            ai_status = filters.get("aiStatus")
            if ai_status and ai_status != "Tất cả":
                if ai_status == "AI trả lời thành công":
                    extra_conditions.append("a.issueFlag = 0")
                elif ai_status == "AI trả lời thất bại":
                    extra_conditions.append("a.issueFlag = 1")
                elif ai_status == "Không tìm thấy dữ liệu":
                    extra_conditions.append("a.issueType = N'Không tìm thấy dữ liệu'" if columns.get("issueType") else "1 = 0")
                elif ai_status in ("AI không chắc chắn", "AI trả lời không chắc chắn"):
                    extra_conditions.append("a.issueType = N'AI không chắc chắn'" if columns.get("issueType") else "1 = 0")

            condition_str = " AND ".join(f"({condition})" for condition in extra_conditions)
            if where:
                where += f" AND {condition_str}"
            else:
                where = f"WHERE {condition_str}"

            rows = execute_all(
                conn,
                f"""
                WITH ValidMessages AS (
                    SELECT
                      a.id,
                      a.messageId,
                      a.detectedTopics,
                      a.messageAt,
                      {standardized_question_expr} AS StandardizedQuestion,
                      NULLIF(LTRIM(RTRIM(cmsg.TextContent)), '') AS RawQuestion
                    FROM dbo.WebChat_MessageAnalytics a
                    LEFT JOIN dbo.WebChat_Conversations c ON c.Id = a.conversationId
                    {extra_join}
                    OUTER APPLY (
                        SELECT TOP 1 m.TextContent
                        FROM dbo.WebChat_MessageLogs m
                        WHERE m.Source = c.Source AND m.SenderId = c.CustomerId AND m.FromHost = 0 AND m.SentAt <= a.messageAt
                        ORDER BY m.SentAt DESC
                    ) cmsg
                    {where}
                ),
                FilteredMessages AS (
                    SELECT *
                    FROM ValidMessages a
                    WHERE a.StandardizedQuestion IS NOT NULL
                       OR (
                         a.RawQuestion IS NOT NULL
                         AND (
                           a.RawQuestion LIKE N'%?%'
                           OR LOWER(a.RawQuestion) LIKE N'%phải không%'
                           OR LOWER(a.RawQuestion) LIKE N'%đúng không%'
                           OR LOWER(a.RawQuestion) LIKE N'%làm sao%'
                           OR LOWER(a.RawQuestion) LIKE N'%như thế nào%'
                           OR LOWER(a.RawQuestion) LIKE N'%tại sao%'
                           OR LOWER(a.RawQuestion) LIKE N'%thế nào%'
                           OR LOWER(a.RawQuestion) LIKE N'%sao %'
                           OR LOWER(a.RawQuestion) LIKE N'%vậy ạ%'
                           OR LOWER(a.RawQuestion) LIKE N'%khi nào%'
                           OR LOWER(a.RawQuestion) LIKE N'%bao giờ%'
                           OR LOWER(a.RawQuestion) LIKE N'%bao nhiêu%'
                           OR LOWER(a.RawQuestion) LIKE N'%ở đâu%'
                           OR LOWER(a.RawQuestion) LIKE N'%được không%'
                           OR LOWER(a.RawQuestion) LIKE N'%hay không%'
                           OR LOWER(a.RawQuestion) LIKE N'%là gì%'
                           OR LOWER(a.RawQuestion) LIKE N'%cần những gì%'
                           OR LOWER(a.RawQuestion) LIKE N'%có % không%'
                         )
                       )
                ),
                TopTopics AS (
                    SELECT TOP 20
                      a.detectedTopics,
                      COUNT(*) AS freq,
                      MAX(a.id) AS sample_id
                    FROM FilteredMessages a
                    GROUP BY a.detectedTopics
                    ORDER BY freq DESC
                )
                SELECT
                  t.detectedTopics,
                  t.freq,
                  ISNULL(fm.StandardizedQuestion, fm.RawQuestion) AS question,
                  mlog.TextContent AS suggestedAnswer
                FROM TopTopics t
                JOIN FilteredMessages fm ON fm.id = t.sample_id
                LEFT JOIN dbo.WebChat_MessageLogs mlog ON mlog.id_webchat_messagelogs = fm.messageId
                ORDER BY t.freq DESC
                """,
                params,
            )
        return rows

    def _build_read_where(self, filters: Dict[str, Any], columns: Dict[str, bool]) -> Tuple[str, List[Any]]:
        conditions: List[str] = [valid_analytics_condition("a")]
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
        include_search: bool = True,
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

    def _build_negative_review_where(
        self,
        filters: Dict[str, Any],
        columns: Dict[str, bool],
        *,
        include_search: bool = True,
    ) -> Tuple[str, List[Any]]:
        base_filters = dict(filters)
        search = base_filters.pop("search", None)
        base_filters.pop("sentiment", None)
        base_filters.pop("sentimentLabel", None)
        where, params = self._build_read_where(base_filters, columns)
        conditions = ["a.sentimentLabel = 'negative'", "a.needStaffReview = 1"]
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

    def _deprecated_custom_chart_data(self, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
            x_axis = filters.get("xAxis") or "topic"
            y_axis = filters.get("yAxis") or "total"
    
            with self._connection_factory() as conn:
                columns = inspect_message_analytics_columns(conn)
                where, params = self._build_read_where(filters, columns)
    
                group_by_expr = ""
                select_name_expr = ""
                x_where_extra = ""
    
                if x_axis == "channel":
                    group_by_expr = "a.source"
                    select_name_expr = "a.source AS name"
                    x_where_extra = "a.source IS NOT NULL"
                elif x_axis == "date":
                    group_by_expr = "CONVERT(date, a.messageAt)"
                    select_name_expr = "CONVERT(varchar, CONVERT(date, a.messageAt), 23) AS name"
                elif x_axis == "month":
                    group_by_expr = "FORMAT(a.messageAt, 'yyyy-MM')"
                    select_name_expr = "FORMAT(a.messageAt, 'yyyy-MM') AS name"
                else:  # topic
                    group_by_expr = "a.detectedTopics"
                    select_name_expr = "a.detectedTopics AS name"
                    x_where_extra = "a.detectedTopics IS NOT NULL AND a.detectedTopics <> '[]'"
    
                if x_where_extra:
                    where = (where + f" AND {x_where_extra}") if where else f"WHERE {x_where_extra}"
    
                issue_expr = "a.issueFlag" if columns.get("issueFlag") else "0"
    
                if y_axis == "ai_success":
                    select_val_expr = f"""
                      SUM(CASE WHEN {issue_expr} = 0 THEN 1 ELSE 0 END) AS value,
                      SUM(CASE WHEN {issue_expr} = 0 THEN 1 ELSE 0 END) AS [AI thành công]
                    """
                elif y_axis == "ai_fail":
                    select_val_expr = f"""
                      SUM(CASE WHEN {issue_expr} = 1 THEN 1 ELSE 0 END) AS value,
                      SUM(CASE WHEN {issue_expr} = 1 THEN 1 ELSE 0 END) AS [AI thất bại]
                    """
                elif y_axis == "sentiment":
                    select_val_expr = """
                      SUM(CASE WHEN a.sentimentLabel = 'positive' THEN 1 ELSE 0 END) AS value,
                      SUM(CASE WHEN a.sentimentLabel = 'positive' THEN 1 ELSE 0 END) AS [Tích cực],
                      SUM(CASE WHEN a.sentimentLabel = 'neutral' THEN 1 ELSE 0 END) AS [Trung lập],
                      SUM(CASE WHEN a.sentimentLabel = 'negative' THEN 1 ELSE 0 END) AS [Tiêu cực]
                    """
                else:  # total
                    select_val_expr = f"""
                      COUNT(*) AS value,
                      COUNT(*) AS [Tổng hội thoại],
                      SUM(CASE WHEN {issue_expr} = 0 THEN 1 ELSE 0 END) AS [AI thành công],
                      SUM(CASE WHEN {issue_expr} = 1 THEN 1 ELSE 0 END) AS [AI thất bại]
                    """
    
                rows = execute_all(
                    conn,
                    f"""
                    SELECT
                      {select_name_expr},
                      {select_val_expr}
                    FROM dbo.WebChat_MessageAnalytics a
                    {where}
                    GROUP BY {group_by_expr}
                    ORDER BY value DESC
                    """,
                    params,
                )
    
                # Format source names if channel
                if x_axis == "channel":
                    for r in rows:
                        raw_source = str(r.get("name", "")).strip().lower()
                        if raw_source in ("facebook", "fb", "messenger"):
                            r["name"] = "Facebook"
                        elif raw_source in ("zalooa", "zalo"):
                            r["name"] = "Zalo OA"
                        elif raw_source in ("zalobusiness", "zalobiz"):
                            r["name"] = "Zalo Business"
                        elif raw_source in ("chatwidget", "website", "web"):
                            r["name"] = "Chat Widget"
                return rows

    def get_custom_chart_data(self, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
            x_axis = filters["xAxis"]
            y_axis = filters["yAxis"]
            chart_filters = filters.get("filters") or {}
            use_conversations = (
                y_axis == "total_conversations"
                and x_axis in {"channel", "date", "month", "status"}
                and not chart_filters.get("topic")
                and not chart_filters.get("sentiment")
            )
            if use_conversations:
                return self._get_conversation_chart(x_axis, chart_filters)
            return self._get_analytics_chart(x_axis, y_axis, chart_filters)

    def _get_conversation_chart(self, x_axis: str, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
            expressions = {
                "channel": ("c.Source", "c.Source"),
                "date": ("CONVERT(date, c.LastMessageAt)", "CONVERT(varchar, CONVERT(date, c.LastMessageAt), 23)"),
                "month": ("CONVERT(char(7), c.LastMessageAt, 126)", "CONVERT(char(7), c.LastMessageAt, 126)"),
                "status": (_STATUS_EXPR, _STATUS_EXPR),
            }
            group_expr, name_expr = expressions[x_axis]
            where, params = self._build_custom_where(
                filters, date_column="c.LastMessageAt", channel_column="c.Source"
            )
            with self._connection_factory() as conn:
                return execute_all(
                    conn,
                    f"""
                    SELECT {name_expr} AS name, COUNT(DISTINCT c.Id) AS value
                    FROM dbo.WebChat_Conversations c
                    OUTER APPLY (
                      SELECT TOP 1 s.NoResponseNeeded, s.MarkedAt
                      FROM dbo.WebChat_ConversationStatus s
                      WHERE s.CustomerId = c.CustomerId AND s.Source = c.Source
                      ORDER BY s.MarkedAt DESC
                    ) latestStatus
                    {where}
                    GROUP BY {group_expr}
                    ORDER BY value DESC
                    """,
                    params,
                )

    def _get_analytics_chart(
            self, x_axis: str, y_axis: str, filters: Dict[str, Any]
        ) -> List[Dict[str, Any]]:
            expressions = {
                "channel": ("a.source", "a.source"),
                "date": ("CONVERT(date, a.messageAt)", "CONVERT(varchar, CONVERT(date, a.messageAt), 23)"),
                "month": ("CONVERT(char(7), a.messageAt, 126)", "CONVERT(char(7), a.messageAt, 126)"),
                "topic": ("a.detectedTopics", "a.detectedTopics"),
                "sentiment": ("a.sentimentLabel", "a.sentimentLabel"),
                "status": (_STATUS_EXPR, _STATUS_EXPR),
            }
            metrics = {
                "total_conversations": "COUNT(DISTINCT a.conversationId)",
                "total_messages": "COUNT(*)",
                "positive_count": "SUM(CASE WHEN a.sentimentLabel = 'positive' THEN 1 ELSE 0 END)",
                "neutral_count": "SUM(CASE WHEN a.sentimentLabel = 'neutral' THEN 1 ELSE 0 END)",
                "negative_count": "SUM(CASE WHEN a.sentimentLabel = 'negative' THEN 1 ELSE 0 END)",
            }
            group_expr, name_expr = expressions[x_axis]
            if y_axis == "sentiment_count":
                value_expr = """COUNT(*) AS value,
                  SUM(CASE WHEN a.sentimentLabel = 'positive' THEN 1 ELSE 0 END) AS [Tích cực],
                  SUM(CASE WHEN a.sentimentLabel = 'neutral' THEN 1 ELSE 0 END) AS [Trung tính],
                  SUM(CASE WHEN a.sentimentLabel = 'negative' THEN 1 ELSE 0 END) AS [Tiêu cực]"""
            else:
                value_expr = f"{metrics[y_axis]} AS value"
            where, params = self._build_custom_where(
                filters,
                date_column="a.messageAt",
                channel_column="a.source",
                sentiment_column="a.sentimentLabel",
                topic_column="a.detectedTopics",
            )
            required = []
            if x_axis == "topic":
                required.append("a.detectedTopics IS NOT NULL AND a.detectedTopics <> '[]'")
            if x_axis == "sentiment":
                required.append("a.sentimentLabel IS NOT NULL")
            if required:
                suffix = " AND ".join(required)
                where = f"{where} AND {suffix}" if where else f"WHERE {suffix}"
            with self._connection_factory() as conn:
                return execute_all(
                    conn,
                    f"""
                    SELECT {name_expr} AS name, {value_expr}
                    FROM dbo.WebChat_MessageAnalytics a
                    LEFT JOIN dbo.WebChat_Conversations c ON c.Id = a.conversationId
                    OUTER APPLY (
                      SELECT TOP 1 s.NoResponseNeeded, s.MarkedAt
                      FROM dbo.WebChat_ConversationStatus s
                      WHERE s.CustomerId = c.CustomerId AND s.Source = c.Source
                      ORDER BY s.MarkedAt DESC
                    ) latestStatus
                    {where}
                    GROUP BY {group_expr}
                    ORDER BY value DESC
                    """,
                    params,
                )

    def _build_custom_where(
            self,
            filters: Dict[str, Any],
            *,
            date_column: str,
            channel_column: str,
            sentiment_column: str | None = None,
            topic_column: str | None = None,
        ) -> Tuple[str, List[Any]]:
            conditions: List[str] = []
            params: List[Any] = []
            if filters.get("fromDate"):
                conditions.append(f"{date_column} >= ?")
                params.append(filters["fromDate"])
            if filters.get("toDate"):
                conditions.append(f"{date_column} < DATEADD(day, 1, ?)")
                params.append(filters["toDate"])
            if filters.get("channel"):
                conditions.append(f"{channel_column} = ?")
                params.append(filters["channel"])
            if filters.get("status"):
                conditions.append(f"{_STATUS_EXPR} = ?")
                params.append(filters["status"])
            if filters.get("sentiment") and sentiment_column:
                conditions.append(f"{sentiment_column} = ?")
                params.append(filters["sentiment"])
            if filters.get("topic") and topic_column:
                conditions.append(f"{topic_column} LIKE ?")
                params.append(f'%"{filters["topic"]}"%')
            return ("WHERE " + " AND ".join(conditions)) if conditions else "", params
