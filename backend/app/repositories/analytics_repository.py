from __future__ import annotations

import json
import unicodedata
from typing import Any, Callable, Dict, List, Tuple

from app.db.session import execute_all, execute_one, get_connection
from app.core.topic_taxonomy import canonical_topic_id, canonical_topic_label, normalize_topic_text, topic_filter_aliases
from app.repositories.display_filters import (
    conversation_status_case,
    non_placeholder_text_condition,
    valid_analytics_condition,
)
from app.repositories.schema_inspector import inspect_message_analytics_columns
from app.utils.date_filters import build_date_filter
from app.utils.pagination import normalize_pagination


_STATUS_EXPR = conversation_status_case("c", "latestStatus")
_CUSTOMER_INFO_APPLY = """
    OUTER APPLY (
      SELECT MAX(NULLIF(LTRIM(RTRIM(ui.DisplayName)), N'')) AS customerName
      FROM dbo.WebChat_Messagelogs_User_Info ui
      WHERE ui.SenderId = c.CustomerId AND ui.Source = c.Source
    ) customerInfo
"""


def _clamped_int(value: Any, default: int, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = default
    return max(minimum, min(maximum, parsed))


def _escape_like(value: str) -> str:
    return (
        str(value)
        .replace("~", "~~")
        .replace("%", "~%")
        .replace("_", "~_")
        .replace("[", "~[")
    )


def _clean_keyword_filters(value: Any) -> List[str]:
    if not value:
        return []
    candidates = [value] if isinstance(value, str) else list(value)
    seen = set()
    keywords: List[str] = []
    for item in candidates:
        keyword = str(item or "").strip()
        if not keyword:
            continue
        key = unicodedata.normalize("NFC", keyword).casefold()
        if key in seen:
            continue
        seen.add(key)
        keywords.append(keyword)
    return keywords[:25]


def _build_text_match_condition(
    keywords: List[str],
    *,
    include_detected_topics: bool = True,
) -> Tuple[str, List[Any]]:
    conditions: List[str] = []
    params: List[Any] = []
    detected_topic_clause = (
        "\n              OR ISNULL(a.detectedTopics, N'') LIKE ? ESCAPE '~'"
        if include_detected_topics
        else ""
    )
    for keyword in keywords:
        pattern = f"%{_escape_like(keyword)}%"
        conditions.append(
            f"""
            (
              ISNULL(a.QuestionText, N'') LIKE ? ESCAPE '~'
              OR ISNULL(a.RawQuestion, N'') LIKE ? ESCAPE '~'
              OR ISNULL(a.MatchedNegativeKeywords, N'') LIKE ? ESCAPE '~'{detected_topic_clause}
            )
            """
        )
        params.extend([pattern, pattern, pattern])
        if include_detected_topics:
            params.append(pattern)
    return " OR ".join(f"({condition})" for condition in conditions), params


def _topic_filter_terms(value: Any) -> List[str]:
    terms: List[str] = []
    seen = set()
    for alias in topic_filter_aliases(value):
        for candidate in (str(alias or "").strip(), normalize_topic_text(alias)):
            if not candidate:
                continue
            key = unicodedata.normalize("NFC", candidate).casefold()
            if key in seen:
                continue
            seen.add(key)
            terms.append(candidate)
    return terms


def _dedupe_terms(values: List[str]) -> List[str]:
    result: List[str] = []
    seen = set()
    for value in values:
        text = str(value or "").strip()
        if not text:
            continue
        key = unicodedata.normalize("NFC", text).casefold()
        if key in seen:
            continue
        seen.add(key)
        result.append(text)
    return result


def _normalized_source_expr(source_column: str) -> str:
    return f"LOWER(LTRIM(RTRIM({source_column})))"


def _source_match_values(source: Any) -> Tuple[str, ...]:
    normalized = str(source or "").strip().lower().replace(" ", "")
    values = {
        "zalooa": ("zalooa", "zalo"),
        "zalo": ("zalooa", "zalo"),
        "zalobusiness": ("zalobusiness", "zalobiz"),
        "zalobiz": ("zalobusiness", "zalobiz"),
        "facebook": ("facebook", "fb", "messenger"),
        "fb": ("facebook", "fb", "messenger"),
        "messenger": ("facebook", "fb", "messenger"),
        "chatwidget": ("chatwidget", "website", "web"),
        "website": ("chatwidget", "website", "web"),
        "web": ("chatwidget", "website", "web"),
    }.get(normalized, (normalized,))
    return tuple(dict.fromkeys(value for value in values if value))


def _conversation_status_filter_value(value: Any) -> str | None:
    return {
        "Chờ xử lý": "pending",
        "Đang tư vấn": "open",
        "Đang tư vấn / Chờ phản hồi": "open",
        "Đang xử lý": "open",
        "Hoàn thành": "closed",
    }.get(str(value or "").strip())


def _topic_message_terms(value: Any) -> List[str]:
    topic_id = canonical_topic_id(value)
    if topic_id == "toeic":
        return ["toeic"]
    if topic_id == "mos":
        return ["mos", "microsoft office specialist"]
    if topic_id == "sat_hach_cntt":
        return _dedupe_terms([
            "sát hạch",
            "sat hach",
            "cntt",
            "công nghệ thông tin",
            "cong nghe thong tin",
            "ic3",
            "thcb",
            "thnc",
            "tin cơ bản",
            "tin co ban",
            "tin nâng cao",
            "tin nang cao",
        ])
    if topic_id == "hoc_tieng_anh":
        return _dedupe_terms([
            "tiếng anh",
            "tieng anh",
            "anh văn",
            "anh van",
            "ngoại ngữ",
            "ngoai ngu",
            "vstep",
            "b1",
            "b2",
            "chuẩn đầu ra",
            "chuan dau ra",
        ])
    if topic_id == "hoc_tin_hoc":
        return _dedupe_terms([
            "học tin học",
            "hoc tin hoc",
            "khóa tin học",
            "khoa tin hoc",
            "lớp tin học",
            "lop tin hoc",
            "tin học văn phòng",
            "tin hoc van phong",
            "word",
            "excel",
            "powerpoint",
            "microsoft office",
        ])
    return _topic_filter_terms(value)


def _topic_like_pattern(value: Any) -> str:
    return f"%{_escape_like(str(value or '').strip().lower())}%"


def _selected_topic_json(value: Any) -> str | None:
    text = str(value or "").strip()
    if not text or normalize_topic_text(text) == "tat ca":
        return None
    return json.dumps([canonical_topic_label(text, default=text)], ensure_ascii=False)


def _build_topic_filter_condition(filters: Dict[str, Any]) -> Tuple[str, List[Any]]:
    terms = _topic_filter_terms(filters.get("topic"))
    if not terms:
        return "", []

    params: List[Any] = []
    analytics_conditions: List[str] = []
    for term in terms:
        pattern = _topic_like_pattern(term)
        analytics_conditions.append(
            """
            (
              LOWER(ISNULL(a.detectedTopics, N'')) LIKE ? ESCAPE '~'
              OR LOWER(ISNULL(a.matchedNegativeKeywords, N'')) LIKE ? ESCAPE '~'
            )
            """
        )
        params.extend([pattern, pattern])

    condition = f"""
        (
          {" OR ".join(analytics_conditions)}
        )
    """
    return condition, params


class AnalyticsRepository:
    def __init__(self, connection_factory: Callable = get_connection):
        self._connection_factory = connection_factory

    def get_sentiment_summary(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        with self._connection_factory() as conn:
            columns = inspect_message_analytics_columns(conn)
            where, params = self._build_read_where(filters, columns)
            issue_expr = "SUM(CASE WHEN a.issueFlag = 1 AND ISNULL(a.issueResolved, 0) = 0 AND a.issueType IN (N'Không tìm thấy dữ liệu', N'AI không chắc chắn') THEN 1 ELSE 0 END)" if columns.get("issueFlag") else "0"
            version_expr = "a.analyzerVersion" if columns.get("analyzerVersion") else "CAST(NULL AS NVARCHAR(50))"
            source_expr = "a.sentimentSource" if columns.get("sentimentSource") else "CAST(NULL AS NVARCHAR(50))"

            row = execute_one(
                conn,
                f"""
                SELECT
                  COUNT(*) AS total,
                  COUNT(DISTINCT a.conversationId) AS totalConversations,
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
            include_version_distribution = bool(filters.get("includeAnalyzerVersionDistribution"))
            version_rows = []
            if include_version_distribution:
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
            "analyzerVersionDistributionSkipped": not include_version_distribution,
            "optionalColumns": columns,
        }

    def get_sentiment_trend(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        with self._connection_factory() as conn:
            columns = inspect_message_analytics_columns(conn)
            where, params = self._build_read_where(filters, columns)
            issue_expr = "SUM(CASE WHEN a.issueFlag = 1 AND ISNULL(a.issueResolved, 0) = 0 AND a.issueType IN (N'Không tìm thấy dữ liệu', N'AI không chắc chắn') THEN 1 ELSE 0 END)" if columns.get("issueFlag") else "0"
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

    def get_positive_conversations(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        pagination = normalize_pagination(
            page=int(filters.get("page") or 1),
            page_size=int(filters.get("pageSize") or 20),
        )
        with self._connection_factory() as conn:
            columns = inspect_message_analytics_columns(conn)
            base_filters = dict(filters)
            base_filters.pop("sentiment", None)
            base_filters.pop("sentimentLabel", None)
            base_filters.pop("search", None)
            base_filters.pop("conversationStatus", None)
            base_filters.pop("aiStatus", None)
            where, params = self._build_read_where(base_filters, columns)
            conditions = ["ranked.rn = 1"]
            status_filter = _conversation_status_filter_value(filters.get("conversationStatus"))
            if status_filter:
                conditions.append("ranked.conversationStatus = ?")
                params.append(status_filter)
            search = str(filters.get("search") or "").strip()
            if search:
                conditions.append("(ranked.textContent LIKE ? OR ranked.customerId LIKE ? OR ranked.customerName LIKE ?)")
                params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])
            ranked_where = "WHERE " + " AND ".join(conditions)
            cte = f"""
                WITH RankedPositiveCandidates AS (
                  SELECT
                    a.id,
                    a.messageId,
                    cmsg.TextContent AS textContent,
                    m.TextContent AS aiAnswer,
                    a.conversationId,
                    c.CustomerId AS customerId,
                    customerInfo.customerName,
                    CAST(NULL AS NVARCHAR(50)) AS phoneNumber,
                    a.source,
                    a.sentimentLabel,
                    a.sentimentScore,
                    a.detectedTopics,
                    a.messageAt,
                    {_STATUS_EXPR} AS conversationStatus,
                    ROW_NUMBER() OVER (
                      PARTITION BY a.conversationId
                      ORDER BY a.messageAt DESC, a.id DESC
                    ) AS rn
                  FROM dbo.WebChat_MessageAnalytics a
                  LEFT JOIN dbo.WebChat_MessageLogs m
                    ON m.id_webchat_messagelogs = a.messageId
                  LEFT JOIN dbo.WebChat_Conversations c
                    ON c.Id = a.conversationId
                  OUTER APPLY (
                    SELECT TOP 1 s.NoResponseNeeded, s.MarkedAt
                    FROM dbo.WebChat_ConversationStatus s
                    WHERE s.CustomerId = c.CustomerId AND s.Source = c.Source
                    ORDER BY s.MarkedAt DESC, s.Id DESC
                  ) latestStatus
                  {_CUSTOMER_INFO_APPLY}
                  OUTER APPLY (
                    SELECT TOP 1 customerMessage.TextContent
                    FROM dbo.WebChat_MessageLogs customerMessage
                    WHERE customerMessage.Source = c.Source
                      AND customerMessage.SenderId = c.CustomerId
                      AND customerMessage.FromHost = 0
                      AND customerMessage.SentAt <= COALESCE(m.SentAt, a.messageAt)
                    ORDER BY customerMessage.SentAt DESC, customerMessage.id_webchat_messagelogs DESC
                  ) cmsg
                  {where}
                    {"AND" if where else "WHERE"} a.conversationId IS NOT NULL
                    AND a.sentimentLabel = 'positive'
                )
            """
            total_row = execute_one(
                conn,
                f"{cte} SELECT COUNT(*) AS total FROM RankedPositiveCandidates ranked {ranked_where}",
                params,
            )
            rows = execute_all(
                conn,
                f"""
                {cte}
                SELECT
                  ranked.id,
                  ranked.messageId,
                  ranked.textContent,
                  ranked.aiAnswer,
                  ranked.conversationId,
                  ranked.customerId,
                  ranked.customerName,
                  ranked.phoneNumber,
                  ranked.source,
                  ranked.sentimentLabel,
                  ranked.sentimentScore,
                  ranked.detectedTopics,
                  ranked.messageAt,
                  ranked.conversationStatus
                FROM RankedPositiveCandidates ranked
                {ranked_where}
                ORDER BY ranked.messageAt DESC, ranked.id DESC
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
            "optionalColumns": columns,
        }

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
                  customerInfo.customerName,
                  CAST(NULL AS NVARCHAR(50)) AS phoneNumber,
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
                {_CUSTOMER_INFO_APPLY}
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
                  SUM(CASE WHEN a.issueFlag = 1 AND ISNULL(a.issueResolved, 0) = 0
                           AND a.issueType IN (N'Không tìm thấy dữ liệu', N'AI không chắc chắn') 
                           AND (latestStatus.NoResponseNeeded IS NULL OR latestStatus.NoResponseNeeded = 0)
                           THEN 1 ELSE 0 END) AS failure_count,
                  SUM(CASE WHEN a.issueType = N'AI có nguy cơ tự tạo thông tin' THEN 1 ELSE 0 END) AS hallucination_count,
                  AVG(a.issueConfidence) AS avg_confidence
                FROM dbo.WebChat_MessageAnalytics a
                LEFT JOIN dbo.WebChat_Conversations c ON c.Id = a.conversationId
                OUTER APPLY (
                  SELECT TOP 1 s.NoResponseNeeded
                  FROM dbo.WebChat_ConversationStatus s WITH (NOLOCK)
                  WHERE s.CustomerId = c.CustomerId AND s.Source = c.Source
                  ORDER BY CASE WHEN s.MarkedAt IS NULL THEN 0 ELSE 1 END DESC, s.MarkedAt DESC, s.Id DESC
                ) latestStatus
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
                  SUM(CASE WHEN a.needStaffReview = 1 AND a.issueFlag = 1 AND ISNULL(a.issueResolved, 0) = 0 AND a.issueType IN (N'Không tìm thấy dữ liệu', N'AI không chắc chắn') THEN 1 ELSE 0 END) AS reported_errors,
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
                  SUM(CASE WHEN a.issueFlag = 1 AND ISNULL(a.issueResolved, 0) = 0
                           AND a.issueType IN (N'Không tìm thấy dữ liệu', N'AI không chắc chắn') 
                           AND (latestStatus.NoResponseNeeded IS NULL OR latestStatus.NoResponseNeeded = 0)
                           THEN 1 ELSE 0 END) AS failure,
                  SUM(CASE WHEN a.issueFlag = 1 AND ISNULL(a.issueResolved, 0) = 0
                           AND a.issueType = N'Không tìm thấy dữ liệu' 
                           AND (latestStatus.NoResponseNeeded IS NULL OR latestStatus.NoResponseNeeded = 0)
                           THEN 1 ELSE 0 END) AS thieuDL,
                  SUM(CASE WHEN a.issueFlag = 1 AND ISNULL(a.issueResolved, 0) = 0
                           AND a.issueType = N'AI không chắc chắn' 
                           AND (latestStatus.NoResponseNeeded IS NULL OR latestStatus.NoResponseNeeded = 0)
                           THEN 1 ELSE 0 END) AS khongChac
                FROM dbo.WebChat_MessageAnalytics a
                LEFT JOIN dbo.WebChat_Conversations c ON c.Id = a.conversationId
                OUTER APPLY (
                  SELECT TOP 1 s.NoResponseNeeded
                  FROM dbo.WebChat_ConversationStatus s WITH (NOLOCK)
                  WHERE s.CustomerId = c.CustomerId AND s.Source = c.Source
                  ORDER BY CASE WHEN s.MarkedAt IS NULL THEN 0 ELSE 1 END DESC, s.MarkedAt DESC, s.Id DESC
                ) latestStatus
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

            selected_topic = _selected_topic_json(filters.get("topic"))
            detected_topics_expr = "? AS detectedTopics" if selected_topic else "a.detectedTopics"
            group_by_clause = "" if selected_topic else "GROUP BY a.detectedTopics"
            query_params = [selected_topic, *params] if selected_topic else params
            rows = execute_all(
                conn,
                f"""
                SELECT
                  {detected_topics_expr},
                  SUM(CASE WHEN a.issueType = N'Không tìm thấy dữ liệu' THEN 1 ELSE 0 END) AS thieuDL,
                  SUM(CASE WHEN a.issueType = N'AI không chắc chắn' THEN 1 ELSE 0 END) AS khongChac
                FROM dbo.WebChat_MessageAnalytics a
                LEFT JOIN dbo.WebChat_Conversations c ON c.Id = a.conversationId
                OUTER APPLY (
                  SELECT TOP 1 s.NoResponseNeeded
                  FROM dbo.WebChat_ConversationStatus s WITH (NOLOCK)
                  WHERE s.CustomerId = c.CustomerId AND s.Source = c.Source
                  ORDER BY CASE WHEN s.MarkedAt IS NULL THEN 0 ELSE 1 END DESC, s.MarkedAt DESC, s.Id DESC
                ) latestStatus
                {where + " AND" if where else "WHERE"} a.issueFlag = 1 AND ISNULL(a.issueResolved, 0) = 0
                  AND a.issueType IN (N'Không tìm thấy dữ liệu', N'AI không chắc chắn')
                  AND (latestStatus.NoResponseNeeded IS NULL OR latestStatus.NoResponseNeeded = 0)
                {group_by_clause}
                """,
                query_params,
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

            # Chỉ lấy lỗi AI chưa được xử lý (issueResolved=0 hoặc NULL)
            condition_str = "a.issueFlag = 1 AND ISNULL(a.issueResolved, 0) = 0 AND a.issueType IN (N'Không tìm thấy dữ liệu', N'AI không chắc chắn')"
            if where:
                where += f" AND {condition_str}"
            else:
                where = f"WHERE {condition_str}"

            issue_flag_expr = "a.issueFlag" if columns.get("issueFlag") else "CAST(NULL AS BIT)"
            issue_type_expr = "a.issueType" if columns.get("issueType") else "CAST(NULL AS NVARCHAR(100))"
            issue_reason_expr = "a.issueReason" if columns.get("issueReason") else "CAST(NULL AS NVARCHAR(1000))"
            issue_conf_expr = "a.issueConfidence" if columns.get("issueConfidence") else "CAST(NULL AS FLOAT)"

            if filters.get("uniqueConversations"):
                where = f"{where} AND a.conversationId IS NOT NULL" if where else "WHERE a.conversationId IS NOT NULL"
                ranked_cte = f"""
                    WITH RankedFailures AS (
                      SELECT
                        a.id,
                        a.messageId,
                        cmsg.TextContent AS textContent,
                        m.TextContent AS aiAnswer,
                        a.conversationId,
                        c.CustomerId AS customerId,
                        customerInfo.customerName,
                        CAST(NULL AS NVARCHAR(50)) AS phoneNumber,
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
                        a.messageAt,
                        ROW_NUMBER() OVER (
                          PARTITION BY a.conversationId
                          ORDER BY a.messageAt DESC, a.id DESC
                        ) AS conversationRank
                      FROM dbo.WebChat_MessageAnalytics a
                      LEFT JOIN dbo.WebChat_MessageLogs m
                        ON m.id_webchat_messagelogs = a.messageId
                      LEFT JOIN dbo.WebChat_Conversations c
                        ON c.Id = a.conversationId
                      OUTER APPLY (
                        SELECT TOP 1 s.NoResponseNeeded
                        FROM dbo.WebChat_ConversationStatus s WITH (NOLOCK)
                        WHERE s.CustomerId = c.CustomerId AND s.Source = c.Source
                        ORDER BY CASE WHEN s.MarkedAt IS NULL THEN 0 ELSE 1 END DESC, s.MarkedAt DESC, s.Id DESC
                      ) latestStatus
                      {_CUSTOMER_INFO_APPLY}
                      OUTER APPLY (
                        SELECT TOP 1 customerMessage.TextContent
                        FROM dbo.WebChat_MessageLogs customerMessage
                        WHERE customerMessage.Source = c.Source
                          AND customerMessage.SenderId = c.CustomerId
                          AND customerMessage.FromHost = 0
                          AND customerMessage.SentAt <= COALESCE(m.SentAt, a.messageAt)
                        ORDER BY customerMessage.SentAt DESC, customerMessage.id_webchat_messagelogs DESC
                      ) cmsg
                      {where} AND (latestStatus.NoResponseNeeded IS NULL OR latestStatus.NoResponseNeeded = 0)
                    )
                """
                total_row = execute_one(
                    conn,
                    f"{ranked_cte} SELECT COUNT(*) AS total FROM RankedFailures WHERE conversationRank = 1",
                    params,
                )
                records = execute_all(
                    conn,
                    f"""
                    {ranked_cte}
                    SELECT *
                    FROM RankedFailures
                    WHERE conversationRank = 1
                    ORDER BY messageAt DESC, id DESC
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

            total_row = execute_one(
                conn,
                f"""
                SELECT COUNT(*) AS total
                FROM dbo.WebChat_MessageAnalytics a
                LEFT JOIN dbo.WebChat_MessageLogs m
                  ON m.id_webchat_messagelogs = a.messageId
                LEFT JOIN dbo.WebChat_Conversations c
                  ON c.Id = a.conversationId
                OUTER APPLY (
                  SELECT TOP 1 s.NoResponseNeeded
                  FROM dbo.WebChat_ConversationStatus s WITH (NOLOCK)
                  WHERE s.CustomerId = c.CustomerId AND s.Source = c.Source
                  ORDER BY CASE WHEN s.MarkedAt IS NULL THEN 0 ELSE 1 END DESC, s.MarkedAt DESC, s.Id DESC
                ) latestStatus
                {where} AND (latestStatus.NoResponseNeeded IS NULL OR latestStatus.NoResponseNeeded = 0)
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
                  customerInfo.customerName,
                  CAST(NULL AS NVARCHAR(50)) AS phoneNumber,
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
                  SELECT TOP 1 s.NoResponseNeeded
                  FROM dbo.WebChat_ConversationStatus s WITH (NOLOCK)
                  WHERE s.CustomerId = c.CustomerId AND s.Source = c.Source
                  ORDER BY CASE WHEN s.MarkedAt IS NULL THEN 0 ELSE 1 END DESC, s.MarkedAt DESC, s.Id DESC
                ) latestStatus
                {_CUSTOMER_INFO_APPLY}
                OUTER APPLY (
                  SELECT TOP 1 cmsg.TextContent
                  FROM dbo.WebChat_MessageLogs cmsg
                  WHERE cmsg.Source = c.Source
                    AND cmsg.SenderId = c.CustomerId
                    AND cmsg.FromHost = 0
                    AND cmsg.SentAt <= m.SentAt
                  ORDER BY cmsg.SentAt DESC
                ) cmsg
                {where} AND (latestStatus.NoResponseNeeded IS NULL OR latestStatus.NoResponseNeeded = 0)
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

            condition_str = "a.needStaffReview = 1 AND a.issueFlag = 1 AND ISNULL(a.issueResolved, 0) = 0 AND a.issueType IN (N'Không tìm thấy dữ liệu', N'AI không chắc chắn')"
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
                  customerInfo.customerName,
                  CAST(NULL AS NVARCHAR(50)) AS phoneNumber,
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
                {_CUSTOMER_INFO_APPLY}
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
            extra_conditions = ["a.issueFlag = 1 AND ISNULL(a.issueResolved, 0) = 0 AND a.issueType IN (N'Không tìm thấy dữ liệu', N'AI không chắc chắn')"]
            conversation_status = filters.get("conversationStatus")
            if conversation_status and conversation_status != "Tất cả":
                extra_join = """
                    LEFT JOIN dbo.WebChat_ConversationStatus s
                      ON c.CustomerId = s.CustomerId
                     AND c.Source = s.Source
                """
                status_expr = conversation_status_case('c', 's')
                if conversation_status == "Chờ xử lý":
                    extra_conditions.append(f"c.CustomerId IS NOT NULL AND {status_expr} = 'pending'")
                elif conversation_status in ("Đang xử lý", "Đang tư vấn", "Đang tư vấn / Chờ phản hồi"):
                    extra_conditions.append(f"c.CustomerId IS NOT NULL AND {status_expr} = 'open'")
                elif conversation_status == "Hoàn thành":
                    extra_conditions.append(f"c.CustomerId IS NOT NULL AND {status_expr} = 'closed'")

            ai_status = filters.get("aiStatus")
            if ai_status and ai_status != "Tất cả":
                if ai_status == "AI trả lời thành công":
                    extra_conditions.append("a.issueFlag = 0")
                elif ai_status == "AI trả lời thất bại":
                    extra_conditions.append("a.issueFlag = 1 AND ISNULL(a.issueResolved, 0) = 0 AND a.issueType IN (N'Không tìm thấy dữ liệu', N'AI không chắc chắn')")
                elif ai_status == "Không tìm thấy dữ liệu":
                    extra_conditions.append("a.issueType = N'Không tìm thấy dữ liệu'" if columns.get("issueType") else "1 = 0")
                elif ai_status in ("AI không chắc chắn", "AI trả lời không chắc chắn"):
                    extra_conditions.append("a.issueType = N'AI không chắc chắn'" if columns.get("issueType") else "1 = 0")

            condition_str = " AND ".join(f"({condition})" for condition in extra_conditions)
            if where:
                where += f" AND {condition_str}"
            else:
                where = f"WHERE {condition_str}"

            keywords = _clean_keyword_filters(filters.get("keywords"))
            scope_keywords = _clean_keyword_filters(filters.get("scopeKeywords"))
            exclude_keywords = _clean_keyword_filters(filters.get("excludeKeywords"))
            candidate_limit = _clamped_int(filters.get("candidateLimit"), 120, 1, 300)
            if keywords:
                keyword_condition_sql, keyword_params = _build_text_match_condition(keywords)
                filter_conditions = [f"({keyword_condition_sql})"]
                filter_params = list(keyword_params)
                if scope_keywords:
                    scope_condition_sql, scope_params = _build_text_match_condition(scope_keywords)
                    filter_conditions.append(f"({scope_condition_sql})")
                    filter_params.extend(scope_params)
                if exclude_keywords:
                    exclude_condition_sql, exclude_params = _build_text_match_condition(
                        exclude_keywords,
                        include_detected_topics=False,
                    )
                    filter_conditions.append(f"NOT ({exclude_condition_sql})")
                    filter_params.extend(exclude_params)
                scoped_filter_sql = " AND ".join(filter_conditions)

                rows = execute_all(
                    conn,
                    f"""
                    WITH ValidMessages AS (
                        SELECT
                          a.id,
                          a.messageId,
                          a.source,
                          a.detectedTopics,
                          a.matchedNegativeKeywords AS MatchedNegativeKeywords,
                          a.messageAt,
                          {standardized_question_expr} AS StandardizedQuestion,
                          NULLIF(LTRIM(RTRIM(cmsg.TextContent)), '') AS RawQuestion,
                          NULLIF(LTRIM(RTRIM(mlog.TextContent)), '') AS SuggestedAnswer
                        FROM dbo.WebChat_MessageAnalytics a
                        LEFT JOIN dbo.WebChat_Conversations c ON c.Id = a.conversationId
                        LEFT JOIN dbo.WebChat_MessageLogs mlog ON mlog.id_webchat_messagelogs = a.messageId
                        {extra_join}
                        OUTER APPLY (
                            SELECT TOP 1 m.TextContent
                            FROM dbo.WebChat_MessageLogs m
                            WHERE m.Source = c.Source AND m.SenderId = c.CustomerId AND m.FromHost = 0 AND m.SentAt <= a.messageAt
                            ORDER BY m.SentAt DESC
                        ) cmsg
                        {where}
                    ),
                    QuestionMessages AS (
                        SELECT
                          *,
                          NULLIF(LEFT(LTRIM(RTRIM(ISNULL(a.StandardizedQuestion, a.RawQuestion))), 4000), N'') AS QuestionText
                        FROM ValidMessages a
                        WHERE a.StandardizedQuestion IS NOT NULL
                           OR (
                             a.RawQuestion IS NOT NULL
                             AND (
                               CHARINDEX(NCHAR(63), a.RawQuestion) > 0
                               OR CHARINDEX(N'phải không', LOWER(a.RawQuestion)) > 0
                               OR CHARINDEX(N'đúng không', LOWER(a.RawQuestion)) > 0
                               OR CHARINDEX(N'làm sao', LOWER(a.RawQuestion)) > 0
                               OR CHARINDEX(N'như thế nào', LOWER(a.RawQuestion)) > 0
                               OR CHARINDEX(N'tại sao', LOWER(a.RawQuestion)) > 0
                               OR CHARINDEX(N'thế nào', LOWER(a.RawQuestion)) > 0
                               OR CHARINDEX(N'sao ', LOWER(a.RawQuestion)) > 0
                               OR CHARINDEX(N'vậy ạ', LOWER(a.RawQuestion)) > 0
                               OR CHARINDEX(N'khi nào', LOWER(a.RawQuestion)) > 0
                               OR CHARINDEX(N'bao giờ', LOWER(a.RawQuestion)) > 0
                               OR CHARINDEX(N'bao nhiêu', LOWER(a.RawQuestion)) > 0
                               OR CHARINDEX(N'ở đâu', LOWER(a.RawQuestion)) > 0
                               OR CHARINDEX(N'được không', LOWER(a.RawQuestion)) > 0
                               OR CHARINDEX(N'hay không', LOWER(a.RawQuestion)) > 0
                               OR CHARINDEX(N'là gì', LOWER(a.RawQuestion)) > 0
                               OR CHARINDEX(N'cần những gì', LOWER(a.RawQuestion)) > 0
                               OR (CHARINDEX(N'có ', LOWER(a.RawQuestion)) > 0 AND CHARINDEX(N' không', LOWER(a.RawQuestion)) > 0)
                             )
                           )
                    ),
                    FilteredMessages AS (
                        SELECT *
                        FROM QuestionMessages a
                        WHERE a.QuestionText IS NOT NULL
                          AND ({scoped_filter_sql})
                    ),
                    GroupedQuestions AS (
                        SELECT TOP {candidate_limit}
                          a.QuestionText AS question,
                          COUNT(*) AS freq,
                          MAX(a.id) AS sample_id
                        FROM FilteredMessages a
                        GROUP BY a.QuestionText
                        ORDER BY freq DESC
                    )
                    SELECT
                      fm.detectedTopics,
                      fm.source,
                      g.freq,
                      g.question,
                      fm.SuggestedAnswer AS suggestedAnswer
                    FROM GroupedQuestions g
                    JOIN FilteredMessages fm ON fm.id = g.sample_id
                    ORDER BY g.freq DESC
                    """,
                    [*params, *filter_params],
                )
                return rows

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
                           CHARINDEX(NCHAR(63), a.RawQuestion) > 0
                           OR CHARINDEX(N'phải không', LOWER(a.RawQuestion)) > 0
                           OR CHARINDEX(N'đúng không', LOWER(a.RawQuestion)) > 0
                           OR CHARINDEX(N'làm sao', LOWER(a.RawQuestion)) > 0
                           OR CHARINDEX(N'như thế nào', LOWER(a.RawQuestion)) > 0
                           OR CHARINDEX(N'tại sao', LOWER(a.RawQuestion)) > 0
                           OR CHARINDEX(N'thế nào', LOWER(a.RawQuestion)) > 0
                           OR CHARINDEX(N'sao ', LOWER(a.RawQuestion)) > 0
                           OR CHARINDEX(N'vậy ạ', LOWER(a.RawQuestion)) > 0
                           OR CHARINDEX(N'khi nào', LOWER(a.RawQuestion)) > 0
                           OR CHARINDEX(N'bao giờ', LOWER(a.RawQuestion)) > 0
                           OR CHARINDEX(N'bao nhiêu', LOWER(a.RawQuestion)) > 0
                           OR CHARINDEX(N'ở đâu', LOWER(a.RawQuestion)) > 0
                           OR CHARINDEX(N'được không', LOWER(a.RawQuestion)) > 0
                           OR CHARINDEX(N'hay không', LOWER(a.RawQuestion)) > 0
                           OR CHARINDEX(N'là gì', LOWER(a.RawQuestion)) > 0
                           OR CHARINDEX(N'cần những gì', LOWER(a.RawQuestion)) > 0
                           OR (CHARINDEX(N'có ', LOWER(a.RawQuestion)) > 0 AND CHARINDEX(N' không', LOWER(a.RawQuestion)) > 0)
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
            source_values = _source_match_values(source)
            placeholders = ", ".join(["?"] * len(source_values))
            conditions.append(f"{_normalized_source_expr('a.source')} IN ({placeholders})")
            params.extend(source_values)
        sentiment = filters.get("sentimentLabel") or filters.get("sentiment")
        if sentiment:
            conditions.append("a.sentimentLabel = ?")
            params.append(sentiment)
        topic = filters.get("topic")
        if topic:
            topic_condition, topic_params = _build_topic_filter_condition(filters)
            if topic_condition:
                conditions.append(topic_condition)
                params.extend(topic_params)
        issue_type = filters.get("issueType")
        if issue_type:
            conditions.append("a.issueType = ?" if columns.get("issueType") else "1 = 0")
            if columns.get("issueType"):
                params.append(issue_type)
        ai_status = str(filters.get("aiStatus") or "").strip()
        normalized_ai_status = "".join(
            char for char in unicodedata.normalize("NFD", ai_status.lower())
            if unicodedata.category(char) != "Mn"
        )
        if normalized_ai_status and normalized_ai_status not in {"all", "tat ca"}:
            if not columns.get("issueFlag"):
                conditions.append("1 = 0")
            elif normalized_ai_status in {"success", "ai tra loi thanh cong"}:
                conditions.append("(ISNULL(a.issueFlag, 0) = 0 OR a.issueResolved = 1 OR a.issueType NOT IN (N'Không tìm thấy dữ liệu', N'AI không chắc chắn'))")
            elif normalized_ai_status in {"failed", "failure", "ai tra loi that bai"}:
                conditions.append("a.issueFlag = 1 AND ISNULL(a.issueResolved, 0) = 0 AND a.issueType IN (N'Không tìm thấy dữ liệu', N'AI không chắc chắn')")
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
            review_parts.append("a.issueFlag = 1 AND ISNULL(a.issueResolved, 0) = 0 AND a.issueType IN (N'Không tìm thấy dữ liệu', N'AI không chắc chắn')")
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
                parts.append("a.issueFlag = 1 AND ISNULL(a.issueResolved, 0) = 0 AND a.issueType IN (N'Không tìm thấy dữ liệu', N'AI không chắc chắn')")
            return f"({ ' OR '.join(parts) })"
        if mode == "issue":
            parts = []
            if columns.get("issueFlag"):
                parts.append("a.issueFlag = 1 AND ISNULL(a.issueResolved, 0) = 0 AND a.issueType IN (N'Không tìm thấy dữ liệu', N'AI không chắc chắn')")
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

    def resolve_ai_issues(self, analytics_ids: List[int]) -> int:
        if not analytics_ids:
            return 0
        with self._connection_factory() as conn:
            placeholders = ",".join(["?"] * len(analytics_ids))
            sql = f"""
            UPDATE dbo.WebChat_MessageAnalytics
            SET issueResolved = 1
            WHERE id IN ({placeholders})
              AND issueFlag = 1
            """
            cursor = conn.cursor()
            cursor.execute(sql, analytics_ids)
            count = cursor.rowcount
            conn.commit()
            return count
