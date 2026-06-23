import os
from datetime import datetime, timedelta
import pymssql
from app.core.legacy_db import get_db_connection
from app.repositories.display_filters import (
    valid_analytics_condition,
    valid_conversation_condition,
    valid_message_condition,
)

class ConversationRepository:
    def _normalized_source_expr(self, source_column):
        return f"LOWER(LTRIM(RTRIM({source_column})))"

    def _source_key_case_expr(self, source_column):
        normalized_source = self._normalized_source_expr(source_column)
        return f"""
            CASE
              WHEN {normalized_source} IN ('zalooa', 'zalo') THEN 'ZaloOA'
              WHEN {normalized_source} IN ('zalobusiness', 'zalobiz') THEN 'ZaloBusiness'
              WHEN {normalized_source} IN ('facebook', 'fb', 'messenger') THEN 'Facebook'
              WHEN {normalized_source} IN ('chatwidget', 'website', 'web') THEN 'ChatWidget'
              ELSE 'other'
            END
        """

    def _source_match_values(self, source):
        normalized = str(source or "").strip().lower()
        values = {
            "zalo oa": ("zalooa", "zalo"),
            "zalooa": ("zalooa", "zalo"),
            "zalo": ("zalooa", "zalo"),
            "zalo business": ("zalobusiness", "zalobiz"),
            "zalobusiness": ("zalobusiness", "zalobiz"),
            "zalobiz": ("zalobusiness", "zalobiz"),
            "facebook": ("facebook", "fb", "messenger"),
            "fb": ("facebook", "fb", "messenger"),
            "messenger": ("facebook", "fb", "messenger"),
            "chat widget": ("chatwidget", "website", "web"),
            "chatwidget": ("chatwidget", "website", "web"),
            "website": ("chatwidget", "website", "web"),
            "web": ("chatwidget", "website", "web"),
        }.get(normalized, (normalized,))
        return tuple(dict.fromkeys(value for value in values if value))

    def _message_customer_expr(self, message_alias="m"):
        return f"CASE WHEN {message_alias}.FromHost = 1 THEN {message_alias}.ReceiverId ELSE {message_alias}.SenderId END"

    def _analytics_issue_condition(self, alias="ai", issue_group="any"):
        message_id_match = f"a.messageId = {alias}.id_webchat_messageLogs"
        same_conversation_match = f"""
            (
              CAST(a.customerId AS NVARCHAR(255)) = CAST({self._message_customer_expr(alias)} AS NVARCHAR(255))
              AND LOWER(LTRIM(RTRIM(a.source))) = {self._normalized_source_expr(f'{alias}.Source')}
              AND ABS(DATEDIFF(SECOND, a.messageAt, {alias}.SentAt)) <= 2
            )
        """

        if issue_group == "no_data":
            issue_filter = "a.issueType = N'Không tìm thấy dữ liệu'"
        elif issue_group == "uncertain":
            issue_filter = "a.issueType IN (N'AI không chắc chắn', N'AI có nguy cơ tự tạo thông tin')"
        else:
            issue_filter = "a.issueFlag = 1"

        return f"""
            EXISTS (
              SELECT 1
              FROM WebChat_MessageAnalytics a
              WHERE a.issueFlag = 1
                AND ({message_id_match} OR {same_conversation_match})
                AND {issue_filter}
            )
        """

    def _append_date_and_channel_filters(self, conditions, params, date_column, source_column, start_date=None, end_date=None, channel=None):
        if start_date:
            conditions.append(f"{date_column} >= %s")
            params.append(start_date)

        if end_date:
            conditions.append(f"{date_column} <= %s")
            params.append(f"{end_date} 23:59:59.999")

        channel_values = {
            "Zalo OA": ("zalooa", "zalo", "zalooa"),
            "ZaloOA": ("zalooa", "zalo", "zalooa"),
            "Zalo Business": ("zalobusiness", "zalobiz", "zalobusiness"),
            "ZaloBusiness": ("zalobusiness", "zalobiz", "zalobusiness"),
            "Facebook": ("facebook", "fb", "messenger"),
            "Chat Widget": ("chatwidget", "website", "web"),
            "ChatWidget": ("chatwidget", "website", "web"),
        }.get(channel)

        if channel_values:
            placeholders = ", ".join(["%s"] * len(channel_values))
            conditions.append(f"{self._normalized_source_expr(source_column)} IN ({placeholders})")
            params.extend(channel_values)

    def _status_filter_value(self, conversation_status=None):
        return {
            "Chờ xử lý": "pending",
            "Đang xử lý": "open",
            "Hoàn thành": "closed",
        }.get(conversation_status)

    def _conversation_status_case(self, conversation_alias="c", status_alias="s"):
        return f"""
            CASE
              WHEN {status_alias}.NoResponseNeeded = 1
                   AND ({status_alias}.MarkedAt IS NULL OR {conversation_alias}.LastCustomerMessageAt <= {status_alias}.MarkedAt)
                   THEN 'closed'
              WHEN {conversation_alias}.LastHostMessageAt IS NULL
                   OR {conversation_alias}.LastCustomerMessageAt > {conversation_alias}.LastHostMessageAt
                   THEN 'pending'
              ELSE 'open'
            END
        """

    def _ai_no_data_keyword_condition(self, alias="ai"):
        return f"""(
            {alias}.TextContent LIKE N'%không tìm thấy%'
            OR {alias}.TextContent LIKE N'%chưa có%'
            OR {alias}.TextContent LIKE N'%chưa hỗ trợ%'
            OR {alias}.TextContent LIKE N'%không thể%'
            OR {alias}.TextContent LIKE N'%Trợ lý AI%'
            OR {alias}.TextContent LIKE N'%Không thể tiếp nhận thông tin%'
            OR {alias}.TextContent LIKE N'%Không thể xác nhận trực tiếp%'
        )"""

    def _ai_uncertain_keyword_condition(self, alias="ai"):
        return f"""(
            {alias}.TextContent LIKE N'%chưa hiểu%'
            OR {alias}.TextContent LIKE N'%chưa rõ%'
            OR {alias}.TextContent LIKE N'%không chắc chắn%'
            OR {alias}.TextContent LIKE N'%chưa có thông tin cụ thể%'
            OR {alias}.TextContent LIKE N'%độ tin cậy%'
            OR {alias}.TextContent LIKE N'%chưa xác nhận%'
            OR {alias}.TextContent LIKE N'%có vẻ như%'
            OR {alias}.TextContent LIKE N'%chắc là%'
            OR {alias}.TextContent LIKE N'%có lẽ%'
            OR {alias}.TextContent LIKE N'%hình như%'
            OR {alias}.TextContent LIKE N'%tôi đoán%'
        )"""

    def _ai_no_data_condition(self, alias="ai"):
        keyword_condition = self._ai_no_data_keyword_condition(alias)
        analytics_no_data = self._analytics_issue_condition(alias, "no_data")
        analytics_uncertain = self._analytics_issue_condition(alias, "uncertain")
        return f"({analytics_no_data} OR ({keyword_condition} AND NOT {analytics_uncertain}))"

    def _ai_uncertain_condition(self, alias="ai"):
        keyword_condition = self._ai_uncertain_keyword_condition(alias)
        analytics_no_data = self._analytics_issue_condition(alias, "no_data")
        analytics_uncertain = self._analytics_issue_condition(alias, "uncertain")
        return f"({analytics_uncertain} OR ({keyword_condition} AND NOT {analytics_no_data}))"

    def _ai_failure_condition(self, alias="ai"):
        return f"({self._ai_no_data_condition(alias)} OR {self._ai_uncertain_condition(alias)})"

    def _ai_status_condition(self, ai_status=None, alias="ai"):
        ai_message_sql = f"{alias}.FromHost = 1 AND {alias}.HostDisplayName = 'AI Assistant'"
        if ai_status == "AI trả lời thành công":
            return f"{ai_message_sql} AND NOT {self._ai_failure_condition(alias)}"
        if ai_status == "AI trả lời thất bại":
            return f"{ai_message_sql} AND {self._ai_failure_condition(alias)}"
        if ai_status == "Không tìm thấy dữ liệu":
            return f"{ai_message_sql} AND {self._ai_no_data_condition(alias)}"
        if ai_status in ("AI không chắc chắn", "AI trả lời không chắc chắn"):
            return f"{ai_message_sql} AND {self._ai_uncertain_condition(alias)}"
        return None

    def _ai_classified_filter_sql(self, ai_status=None):
        if ai_status == "AI trả lời thành công":
            return "is_no_data = 0 AND is_uncertain = 0"
        if ai_status == "AI trả lời thất bại":
            return "(is_no_data = 1 OR is_uncertain = 1)"
        if ai_status == "Không tìm thấy dữ liệu":
            return "is_no_data = 1"
        if ai_status in ("AI không chắc chắn", "AI trả lời không chắc chắn"):
            return "is_uncertain = 1"
        return None

    def _topic_condition(self, text_column, topic=None):
        if not topic or topic == "Tất cả":
            return None
        if topic == "TOEIC":
            return f"LOWER({text_column}) LIKE N'%toeic%'"
        if topic == "VSTEP":
            return f"LOWER({text_column}) LIKE N'%vstep%'"
        if topic == "Chuẩn đầu ra":
            return f"(LOWER({text_column}) LIKE N'%đầu ra%' OR LOWER({text_column}) LIKE N'%chuẩn đầu ra%')"
        if topic == "Tin học":
            return f"""(
                LOWER({text_column}) LIKE N'%tin học%'
                OR LOWER({text_column}) LIKE N'%mos%'
                OR LOWER({text_column}) LIKE N'%ic3%'
                OR LOWER({text_column}) LIKE N'%cntt%'
                OR LOWER({text_column}) LIKE N'%cơ bản%'
                OR LOWER({text_column}) LIKE N'%nâng cao%'
            )"""
        if topic == "Tra cứu điểm":
            return f"""(
                LOWER({text_column}) LIKE N'%điểm%'
                OR LOWER({text_column}) LIKE N'%tra cứu điểm%'
                OR LOWER({text_column}) LIKE N'%xem điểm%'
                OR LOWER({text_column}) LIKE N'%kết quả thi%'
            )"""
        if topic == "Lịch thi":
            return f"""(
                LOWER({text_column}) LIKE N'%lịch thi%'
                OR LOWER({text_column}) LIKE N'%ngày thi%'
                OR LOWER({text_column}) LIKE N'%ca thi%'
                OR LOWER({text_column}) LIKE N'%giờ thi%'
            )"""
        if topic == "Khác":
            known_conditions = [
                self._topic_condition(text_column, "TOEIC"),
                self._topic_condition(text_column, "VSTEP"),
                self._topic_condition(text_column, "Chuẩn đầu ra"),
                self._topic_condition(text_column, "Tin học"),
                self._topic_condition(text_column, "Tra cứu điểm"),
                self._topic_condition(text_column, "Lịch thi"),
            ]
            return " AND ".join(f"NOT ({condition})" for condition in known_conditions if condition)
        return None

    def _append_conversation_scope_filters(
        self,
        conditions,
        params,
        start_date=None,
        end_date=None,
        channel=None,
        conversation_status=None,
        topic=None,
        ai_status=None,
        conversation_alias="c",
        status_alias="s",
    ):
        conditions.append(valid_conversation_condition(conversation_alias))
        self._append_date_and_channel_filters(
            conditions,
            params,
            f"{conversation_alias}.LastCustomerMessageAt",
            f"{conversation_alias}.Source",
            start_date,
            end_date,
            channel,
        )

        status_filter = self._status_filter_value(conversation_status)
        if status_filter:
            conditions.append(f"{self._conversation_status_case(conversation_alias, status_alias)} = %s")
            params.append(status_filter)

        topic_sql = self._topic_condition("topic_msg.TextContent", topic)
        if topic_sql:
            exists_conditions = [
                f"{self._normalized_source_expr('topic_msg.Source')} = {self._normalized_source_expr(f'{conversation_alias}.Source')}",
                f"""(
                    (topic_msg.FromHost = 1 AND topic_msg.ReceiverId = {conversation_alias}.CustomerId)
                    OR (topic_msg.FromHost = 0 AND topic_msg.SenderId = {conversation_alias}.CustomerId)
                )""",
                "topic_msg.TextContent IS NOT NULL",
                valid_message_condition("topic_msg"),
                topic_sql,
            ]
            if start_date:
                exists_conditions.append("topic_msg.SentAt >= %s")
                params.append(start_date)
            if end_date:
                exists_conditions.append("topic_msg.SentAt <= %s")
                params.append(f"{end_date} 23:59:59.999")
            conditions.append(f"""
                EXISTS (
                  SELECT 1
                  FROM WebChat_MessageLogs topic_msg
                  WHERE {" AND ".join(exists_conditions)}
                )
            """)

        ai_sql = self._ai_status_condition(ai_status, "ai_msg")
        if ai_sql:
            exists_conditions = [
                f"{self._normalized_source_expr('ai_msg.Source')} = {self._normalized_source_expr(f'{conversation_alias}.Source')}",
                f"ai_msg.ReceiverId = {conversation_alias}.CustomerId",
                valid_message_condition("ai_msg"),
                ai_sql,
            ]
            if start_date:
                exists_conditions.append("ai_msg.SentAt >= %s")
                params.append(start_date)
            if end_date:
                exists_conditions.append("ai_msg.SentAt <= %s")
                params.append(f"{end_date} 23:59:59.999")
            conditions.append(f"""
                EXISTS (
                  SELECT 1
                  FROM WebChat_MessageLogs ai_msg
                  WHERE {" AND ".join(exists_conditions)}
                )
            """)

    def _append_message_scope_filters(
        self,
        conditions,
        params,
        start_date=None,
        end_date=None,
        channel=None,
        conversation_status=None,
        topic=None,
        ai_status=None,
        message_alias="m",
    ):
        conditions.append(valid_message_condition(message_alias))
        self._append_date_and_channel_filters(
            conditions,
            params,
            f"{message_alias}.SentAt",
            f"{message_alias}.Source",
            start_date,
            end_date,
            channel,
        )

        topic_sql = self._topic_condition(f"{message_alias}.TextContent", topic)
        if topic_sql:
            conditions.append(topic_sql)

        ai_sql = self._ai_status_condition(ai_status, message_alias)
        if ai_sql:
            conditions.append(ai_sql)

        status_filter = self._status_filter_value(conversation_status)
        if status_filter:
            status_case = self._conversation_status_case("status_conv", "status_meta")
            conditions.append(f"""
                EXISTS (
                  SELECT 1
                  FROM WebChat_Conversations status_conv
                  LEFT JOIN WebChat_ConversationStatus status_meta
                    ON status_conv.CustomerId = status_meta.CustomerId
                   AND {self._normalized_source_expr('status_conv.Source')} = {self._normalized_source_expr('status_meta.Source')}
                  WHERE {self._normalized_source_expr('status_conv.Source')} = {self._normalized_source_expr(f'{message_alias}.Source')}
                    AND {valid_conversation_condition("status_conv")}
                    AND status_conv.CustomerId = CASE
                      WHEN {message_alias}.FromHost = 1 THEN {message_alias}.ReceiverId
                      ELSE {message_alias}.SenderId
                    END
                    AND {status_case} = %s
                )
            """)
            params.append(status_filter)

    def get_conversation_summary(self, start_date=None, end_date=None, channel=None, conversation_status=None, topic=None, ai_status=None):
        conn = get_db_connection()
        try:
            conditions = []
            params = []
            self._append_message_scope_filters(
                conditions,
                params,
                start_date,
                end_date,
                channel,
                None,
                topic,
                ai_status,
                "m",
            )
            conditions.extend([
                "m.Source IS NOT NULL",
                """(
                    (m.FromHost = 1 AND m.ReceiverId IS NOT NULL)
                    OR (m.FromHost = 0 AND m.SenderId IS NOT NULL)
                )""",
            ])

            where_sql = "WHERE " + " AND ".join(conditions) if conditions else ""
            status_filter = self._status_filter_value(conversation_status)
            classified_where = "WHERE status = %s" if status_filter else ""
            if status_filter:
                params.append(status_filter)

            query = f"""
                WITH scoped_messages AS (
                  SELECT
                    CAST(CASE WHEN m.FromHost = 1 THEN m.ReceiverId ELSE m.SenderId END AS NVARCHAR(255)) AS customer_id,
                    CASE
                      WHEN LOWER(LTRIM(RTRIM(m.Source))) IN ('zalooa', 'zalo') THEN 'ZaloOA'
                      WHEN LOWER(LTRIM(RTRIM(m.Source))) IN ('zalobusiness', 'zalobiz') THEN 'ZaloBusiness'
                      WHEN LOWER(LTRIM(RTRIM(m.Source))) IN ('facebook', 'fb', 'messenger') THEN 'Facebook'
                      WHEN LOWER(LTRIM(RTRIM(m.Source))) IN ('chatwidget', 'website', 'web') THEN 'ChatWidget'
                      ELSE 'other'
                    END AS source_key,
                    m.FromHost,
                    m.SentAt
                  FROM WebChat_MessageLogs m
                  {where_sql}
                ),
                latest AS (
                  SELECT
                    customer_id,
                    source_key,
                    MAX(CASE WHEN FromHost = 0 THEN SentAt END) AS last_customer_at,
                    MAX(CASE WHEN FromHost = 1 THEN SentAt END) AS last_host_at
                  FROM scoped_messages
                  GROUP BY customer_id, source_key
                ),
                latest_status AS (
                  SELECT
                    CAST(status_meta.CustomerId AS NVARCHAR(255)) AS customer_id,
                    CASE
                      WHEN LOWER(LTRIM(RTRIM(status_meta.Source))) IN ('zalooa', 'zalo') THEN 'ZaloOA'
                      WHEN LOWER(LTRIM(RTRIM(status_meta.Source))) IN ('zalobusiness', 'zalobiz') THEN 'ZaloBusiness'
                      WHEN LOWER(LTRIM(RTRIM(status_meta.Source))) IN ('facebook', 'fb', 'messenger') THEN 'Facebook'
                      WHEN LOWER(LTRIM(RTRIM(status_meta.Source))) IN ('chatwidget', 'website', 'web') THEN 'ChatWidget'
                      ELSE 'other'
                    END AS source_key,
                    status_meta.NoResponseNeeded AS no_response,
                    status_meta.MarkedAt AS marked_at,
                    ROW_NUMBER() OVER (
                      PARTITION BY CAST(status_meta.CustomerId AS NVARCHAR(255)), LOWER(LTRIM(RTRIM(status_meta.Source)))
                      ORDER BY CASE WHEN status_meta.MarkedAt IS NULL THEN 0 ELSE 1 END DESC, status_meta.MarkedAt DESC
                    ) AS rn
                  FROM WebChat_ConversationStatus status_meta
                ),
                classified AS (
                  SELECT
                    l.source_key,
                    l.customer_id,
                    CASE
                      WHEN s.no_response = 1 AND (s.marked_at IS NULL OR l.last_customer_at <= s.marked_at) THEN 'closed'
                      WHEN l.last_host_at IS NULL OR l.last_customer_at > l.last_host_at THEN 'pending'
                      ELSE 'open'
                    END AS status,
                    CASE
                      WHEN l.last_host_at IS NOT NULL AND l.last_customer_at IS NOT NULL AND l.last_host_at >= l.last_customer_at
                      THEN DATEDIFF(MINUTE, l.last_customer_at, l.last_host_at)
                      ELSE NULL
                    END AS response_minutes
                  FROM latest l
                  LEFT JOIN latest_status s
                    ON s.customer_id = l.customer_id
                   AND s.source_key = l.source_key
                   AND s.rn = 1
                )
                SELECT
                  COUNT(*) AS total_conversations,
                  COUNT(DISTINCT customer_id) AS new_customers,
                  SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open_count,
                  SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
                  SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed_count,
                  SUM(CASE WHEN status NOT IN ('open', 'pending', 'closed') THEN 1 ELSE 0 END) AS unknown_count,
                  SUM(CASE WHEN source_key = 'ZaloOA' THEN 1 ELSE 0 END) AS zalooa_count,
                  SUM(CASE WHEN source_key = 'ZaloBusiness' THEN 1 ELSE 0 END) AS zalobusiness_count,
                  SUM(CASE WHEN source_key = 'Facebook' THEN 1 ELSE 0 END) AS facebook_count,
                  SUM(CASE WHEN source_key = 'ChatWidget' THEN 1 ELSE 0 END) AS chatwidget_count,
                  SUM(CASE WHEN source_key = 'other' THEN 1 ELSE 0 END) AS other_count,
                  SUM(CASE WHEN source_key = 'ZaloOA' AND status IN ('pending', 'open') THEN 1 ELSE 0 END) AS zalooa_unresolved,
                  SUM(CASE WHEN source_key = 'ZaloBusiness' AND status IN ('pending', 'open') THEN 1 ELSE 0 END) AS zalobusiness_unresolved,
                  SUM(CASE WHEN source_key = 'Facebook' AND status IN ('pending', 'open') THEN 1 ELSE 0 END) AS facebook_unresolved,
                  SUM(CASE WHEN source_key = 'ChatWidget' AND status IN ('pending', 'open') THEN 1 ELSE 0 END) AS chatwidget_unresolved,
                  AVG(response_minutes) AS avg_response_minutes
                FROM classified
                {classified_where}
            """

            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(query, tuple(params))
                row = cursor.fetchone() or {}
                return {
                    "totalConversations": row.get("total_conversations") or 0,
                    "newCustomers": row.get("new_customers") or 0,
                    "statusSummary": {
                        "new": 0,
                        "open": row.get("open_count") or 0,
                        "pending": row.get("pending_count") or 0,
                        "closed": row.get("closed_count") or 0,
                        "unknown": row.get("unknown_count") or 0,
                    },
                    "sourceSummary": {
                        "ZaloOA": row.get("zalooa_count") or 0,
                        "ZaloBusiness": row.get("zalobusiness_count") or 0,
                        "Facebook": row.get("facebook_count") or 0,
                        "ChatWidget": row.get("chatwidget_count") or 0,
                        "other": row.get("other_count") or 0,
                    },
                    "unresolvedSummary": {
                        "ZaloOA": row.get("zalooa_unresolved") or 0,
                        "ZaloBusiness": row.get("zalobusiness_unresolved") or 0,
                        "Facebook": row.get("facebook_unresolved") or 0,
                        "ChatWidget": row.get("chatwidget_unresolved") or 0,
                    },
                    "averageResponseTimeMinutes": int(round(row.get("avg_response_minutes") or 0)),
                }
        finally:
            conn.close()

    def get_ai_daily_stats(self, start_date=None, end_date=None, channel=None, conversation_status=None, topic=None, ai_status=None):
        conn = get_db_connection()
        try:
            conditions = [
                "m.FromHost = 1",
                "m.HostDisplayName = 'AI Assistant'",
            ]
            params = []
            self._append_message_scope_filters(
                conditions,
                params,
                start_date,
                end_date,
                channel,
                conversation_status,
                topic,
                None,
                "m",
            )

            where_sql = "WHERE " + " AND ".join(conditions) if conditions else ""
            no_data_keyword_sql = self._ai_no_data_keyword_condition("m")
            uncertain_keyword_sql = self._ai_uncertain_keyword_condition("m")
            source_case = self._source_key_case_expr("m.Source")
            analytics_source_case = self._source_key_case_expr("a.source")
            ai_filter_sql = self._ai_classified_filter_sql(ai_status)
            classified_where = f"WHERE {ai_filter_sql}" if ai_filter_sql else ""

            query = f"""
                WITH scoped AS (
                  SELECT
                    m.id_webchat_messageLogs AS message_id,
                    CAST({self._message_customer_expr("m")} AS NVARCHAR(255)) AS customer_id,
                    {source_case} AS source_key,
                    m.SentAt AS sent_at,
                    CONVERT(VARCHAR(10), m.SentAt, 120) AS date_str,
                    CASE WHEN {no_data_keyword_sql} THEN 1 ELSE 0 END AS keyword_no_data,
                    CASE WHEN {uncertain_keyword_sql} THEN 1 ELSE 0 END AS keyword_uncertain
                  FROM WebChat_MessageLogs m
                  {where_sql}
                ),
                analytics_issues AS (
                  SELECT
                    CAST(a.messageId AS BIGINT) AS message_id,
                    CAST(a.customerId AS NVARCHAR(255)) AS customer_id,
                    {analytics_source_case} AS source_key,
                    a.messageAt AS message_at,
                    a.issueType AS issue_type
                  FROM WebChat_MessageAnalytics a
                  WHERE a.issueFlag = 1
                ),
                flagged AS (
                  SELECT
                    s.message_id,
                    s.date_str,
                    s.keyword_no_data,
                    s.keyword_uncertain,
                    MAX(CASE WHEN direct_issue.issue_type = N'Không tìm thấy dữ liệu' OR context_issue.issue_type = N'Không tìm thấy dữ liệu' THEN 1 ELSE 0 END) AS analytics_no_data,
                    MAX(CASE WHEN direct_issue.issue_type IN (N'AI không chắc chắn', N'AI có nguy cơ tự tạo thông tin') OR context_issue.issue_type IN (N'AI không chắc chắn', N'AI có nguy cơ tự tạo thông tin') THEN 1 ELSE 0 END) AS analytics_uncertain
                  FROM scoped s
                  LEFT JOIN analytics_issues direct_issue
                    ON direct_issue.message_id = s.message_id
                  LEFT JOIN analytics_issues context_issue
                    ON context_issue.customer_id = s.customer_id
                   AND context_issue.source_key = s.source_key
                   AND context_issue.message_at >= DATEADD(SECOND, -2, s.sent_at)
                   AND context_issue.message_at <= DATEADD(SECOND, 2, s.sent_at)
                  GROUP BY s.message_id, s.date_str, s.keyword_no_data, s.keyword_uncertain
                ),
                classified AS (
                  SELECT
                    date_str,
                    CASE
                      WHEN analytics_no_data = 1 OR (keyword_no_data = 1 AND analytics_uncertain = 0) THEN 1
                      ELSE 0
                    END AS is_no_data,
                    CASE
                      WHEN analytics_uncertain = 1 OR (keyword_uncertain = 1 AND analytics_no_data = 0) THEN 1
                      ELSE 0
                    END AS is_uncertain
                  FROM flagged
                ),
                filtered AS (
                  SELECT
                    date_str,
                    is_no_data,
                    is_uncertain,
                    CASE WHEN is_no_data = 1 OR is_uncertain = 1 THEN 1 ELSE 0 END AS is_fail
                  FROM classified
                  {classified_where}
                )
                SELECT
                  date_str,
                  SUM(CASE WHEN is_fail = 1 THEN 1 ELSE 0 END) AS ai_fail,
                  SUM(CASE WHEN is_fail = 0 THEN 1 ELSE 0 END) AS ai_ok
                FROM filtered
                GROUP BY date_str
            """

            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(query, tuple(params))
                return cursor.fetchall()
        finally:
            conn.close()

    def get_daily_conversation_summary(self, start_date=None, end_date=None, channel=None, conversation_status=None, topic=None, ai_status=None):
        conn = get_db_connection()
        try:
            conditions = []
            params = []
            self._append_message_scope_filters(
                conditions,
                params,
                start_date,
                end_date,
                channel,
                None,
                topic,
                ai_status,
                "m",
            )
            conditions.extend([
                "m.Source IS NOT NULL",
                """(
                    (m.FromHost = 1 AND m.ReceiverId IS NOT NULL)
                    OR (m.FromHost = 0 AND m.SenderId IS NOT NULL)
                )""",
            ])

            where_sql = "WHERE " + " AND ".join(conditions) if conditions else ""
            status_filter = self._status_filter_value(conversation_status)
            filtered_where = "WHERE status = %s" if status_filter else ""
            if status_filter:
                params.append(status_filter)

            source_case = self._source_key_case_expr("m.Source")
            status_source_case = self._source_key_case_expr("status_meta.Source")

            query = f"""
                WITH scoped_messages AS (
                  SELECT
                    CONVERT(VARCHAR(10), m.SentAt, 120) AS date_str,
                    CAST(CASE WHEN m.FromHost = 1 THEN m.ReceiverId ELSE m.SenderId END AS NVARCHAR(255)) AS customer_id,
                    {source_case} AS source_key,
                    m.FromHost,
                    m.SentAt
                  FROM WebChat_MessageLogs m
                  {where_sql}
                ),
                latest AS (
                  SELECT
                    date_str,
                    customer_id,
                    source_key,
                    MAX(CASE WHEN FromHost = 0 THEN SentAt END) AS last_customer_at,
                    MAX(CASE WHEN FromHost = 1 THEN SentAt END) AS last_host_at
                  FROM scoped_messages
                  GROUP BY date_str, customer_id, source_key
                ),
                latest_status AS (
                  SELECT
                    CAST(status_meta.CustomerId AS NVARCHAR(255)) AS customer_id,
                    {status_source_case} AS source_key,
                    status_meta.NoResponseNeeded AS no_response,
                    status_meta.MarkedAt AS marked_at,
                    ROW_NUMBER() OVER (
                      PARTITION BY CAST(status_meta.CustomerId AS NVARCHAR(255)), {status_source_case}
                      ORDER BY CASE WHEN status_meta.MarkedAt IS NULL THEN 0 ELSE 1 END DESC, status_meta.MarkedAt DESC
                    ) AS rn
                  FROM WebChat_ConversationStatus status_meta
                ),
                filtered AS (
                  SELECT
                    l.date_str,
                    CASE
                      WHEN s.no_response = 1 AND (s.marked_at IS NULL OR l.last_customer_at <= s.marked_at) THEN 'closed'
                      WHEN l.last_host_at IS NULL OR l.last_customer_at > l.last_host_at THEN 'pending'
                      ELSE 'open'
                    END AS status
                  FROM latest l
                  LEFT JOIN latest_status s
                    ON s.customer_id = l.customer_id
                   AND s.source_key = l.source_key
                   AND s.rn = 1
                )
                SELECT
                  date_str,
                  COUNT(*) AS total,
                  SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS processed,
                  SUM(CASE WHEN status <> 'closed' THEN 1 ELSE 0 END) AS unprocessed
                FROM filtered
                {filtered_where}
                GROUP BY date_str
                ORDER BY date_str
            """

            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(query, tuple(params))
                return cursor.fetchall()
        finally:
            conn.close()

    def get_priority_conversations_data(self, start_date=None, end_date=None, channel=None, conversation_status=None, topic=None, ai_status=None, limit=10):
        conn = get_db_connection()
        try:
            conditions = [
                "(s.NoResponseNeeded IS NULL OR s.NoResponseNeeded = 0 OR c.LastCustomerMessageAt > s.MarkedAt)"
            ]
            params = []
            self._append_conversation_scope_filters(
                conditions,
                params,
                start_date,
                end_date,
                channel,
                conversation_status,
                topic,
                ai_status,
            )
            conditions.append(f"""
                EXISTS (
                  SELECT 1
                  FROM WebChat_MessageLogs customer_msg
                  WHERE customer_msg.FromHost = 0
                    AND {valid_message_condition("customer_msg")}
                    AND customer_msg.TextContent IS NOT NULL
                    AND CAST(customer_msg.SenderId AS NVARCHAR(255)) = CAST(c.CustomerId AS NVARCHAR(255))
                    AND {self._normalized_source_expr('customer_msg.Source')} = {self._normalized_source_expr('c.Source')}
                )
            """)

            query = f"""
                SELECT TOP {int(limit)}
                  c.Id AS id,
                  c.CustomerId AS customer_id,
                  customerInfo.customer_name,
                  CAST(NULL AS NVARCHAR(50)) AS phone_number,
                  c.Source AS source,
                  CASE
                    WHEN c.LastHostMessageAt IS NULL OR c.LastCustomerMessageAt > c.LastHostMessageAt THEN 'pending'
                    ELSE 'open'
                  END AS status,
                  DATEDIFF(MINUTE, c.LastCustomerMessageAt, GETDATE()) AS wait_mins
                FROM WebChat_Conversations c
                OUTER APPLY (
                  SELECT MAX(NULLIF(LTRIM(RTRIM(u.DisplayName)), N'')) AS customer_name
                  FROM WebChat_Messagelogs_User_Info u
                  WHERE CAST(u.SenderId AS NVARCHAR(255)) = CAST(c.CustomerId AS NVARCHAR(255))
                    AND {self._normalized_source_expr('u.Source')} = {self._normalized_source_expr('c.Source')}
                ) customerInfo
                LEFT JOIN WebChat_ConversationStatus s
                  ON c.CustomerId = s.CustomerId AND c.Source = s.Source
                WHERE {" AND ".join(conditions)}
                ORDER BY c.LastCustomerMessageAt ASC
            """

            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(query, tuple(params))
                return cursor.fetchall()
        finally:
            conn.close()


    def get_channel_conversation_stats(self, start_date=None, end_date=None, channel=None, conversation_status=None, topic=None, ai_status=None):
        conn = get_db_connection()
        try:
            conditions = []
            params = []
            self._append_message_scope_filters(
                conditions,
                params,
                start_date,
                end_date,
                channel,
                None,
                topic,
                ai_status,
                "m",
            )
            conditions.extend([
                "m.Source IS NOT NULL",
                """(
                    (m.FromHost = 1 AND m.ReceiverId IS NOT NULL)
                    OR (m.FromHost = 0 AND m.SenderId IS NOT NULL)
                )""",
            ])

            where_sql = "WHERE " + " AND ".join(conditions) if conditions else ""
            status_filter = self._status_filter_value(conversation_status)
            filtered_where = "WHERE status = %s" if status_filter else ""
            if status_filter:
                params.append(status_filter)

            source_case = self._source_key_case_expr("m.Source")
            status_source_case = self._source_key_case_expr("status_meta.Source")

            query = f"""
                WITH scoped_messages AS (
                  SELECT
                    CONVERT(VARCHAR(10), m.SentAt, 120) AS date_str,
                    CAST(CASE WHEN m.FromHost = 1 THEN m.ReceiverId ELSE m.SenderId END AS NVARCHAR(255)) AS customer_id,
                    {source_case} AS source_key,
                    m.FromHost,
                    m.SentAt
                  FROM WebChat_MessageLogs m
                  {where_sql}
                ),
                latest AS (
                  SELECT
                    date_str,
                    customer_id,
                    source_key,
                    MAX(CASE WHEN FromHost = 0 THEN SentAt END) AS last_customer_at,
                    MAX(CASE WHEN FromHost = 1 THEN SentAt END) AS last_host_at
                  FROM scoped_messages
                  GROUP BY date_str, customer_id, source_key
                ),
                latest_status AS (
                  SELECT
                    CAST(status_meta.CustomerId AS NVARCHAR(255)) AS customer_id,
                    {status_source_case} AS source_key,
                    status_meta.NoResponseNeeded AS no_response,
                    status_meta.MarkedAt AS marked_at,
                    ROW_NUMBER() OVER (
                      PARTITION BY CAST(status_meta.CustomerId AS NVARCHAR(255)), {status_source_case}
                      ORDER BY CASE WHEN status_meta.MarkedAt IS NULL THEN 0 ELSE 1 END DESC, status_meta.MarkedAt DESC
                    ) AS rn
                  FROM WebChat_ConversationStatus status_meta
                ),
                filtered AS (
                  SELECT
                    l.source_key AS source,
                    l.date_str,
                    CASE
                      WHEN s.no_response = 1 AND (s.marked_at IS NULL OR l.last_customer_at <= s.marked_at) THEN 'closed'
                      WHEN l.last_host_at IS NULL OR l.last_customer_at > l.last_host_at THEN 'pending'
                      ELSE 'open'
                    END AS status,
                    CASE
                      WHEN l.last_host_at IS NOT NULL AND l.last_customer_at IS NOT NULL AND l.last_host_at >= l.last_customer_at
                      THEN DATEDIFF(MINUTE, l.last_customer_at, l.last_host_at)
                      ELSE NULL
                    END AS response_minutes
                  FROM latest l
                  LEFT JOIN latest_status s
                    ON s.customer_id = l.customer_id
                   AND s.source_key = l.source_key
                   AND s.rn = 1
                )
                SELECT
                  source,
                  date_str,
                  status,
                  COUNT(*) AS total,
                  AVG(response_minutes) AS avg_response_minutes
                FROM filtered
                {filtered_where}
                GROUP BY source, date_str, status
                ORDER BY date_str
            """

            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(query, tuple(params))
                return cursor.fetchall()
        finally:
            conn.close()

    def get_channel_ai_summary(self, start_date=None, end_date=None, channel=None, conversation_status=None, topic=None, ai_status=None):
        conn = get_db_connection()
        try:
            conditions = [
                "m.FromHost = 1",
                "m.HostDisplayName = 'AI Assistant'",
                "m.Source IS NOT NULL"
            ]
            params = []

            self._append_message_scope_filters(
                conditions,
                params,
                start_date,
                end_date,
                channel,
                conversation_status,
                topic,
                None,
                "m",
            )

            where_sql = "WHERE " + " AND ".join(conditions)
            no_data_keyword_sql = self._ai_no_data_keyword_condition("m")
            uncertain_keyword_sql = self._ai_uncertain_keyword_condition("m")
            source_case = self._source_key_case_expr("m.Source")
            analytics_source_case = self._source_key_case_expr("a.source")
            ai_filter_sql = self._ai_classified_filter_sql(ai_status)
            classified_where = f"WHERE {ai_filter_sql}" if ai_filter_sql else ""

            query = f"""
                WITH scoped AS (
                  SELECT
                    m.id_webchat_messageLogs AS message_id,
                    CAST({self._message_customer_expr("m")} AS NVARCHAR(255)) AS customer_id,
                    {source_case} AS source,
                    {source_case} AS source_key,
                    m.SentAt AS sent_at,
                    CASE WHEN {no_data_keyword_sql} THEN 1 ELSE 0 END AS keyword_no_data,
                    CASE WHEN {uncertain_keyword_sql} THEN 1 ELSE 0 END AS keyword_uncertain
                  FROM WebChat_MessageLogs m
                  {where_sql}
                ),
                analytics_issues AS (
                  SELECT
                    CAST(a.messageId AS BIGINT) AS message_id,
                    CAST(a.customerId AS NVARCHAR(255)) AS customer_id,
                    {analytics_source_case} AS source_key,
                    a.messageAt AS message_at,
                    a.issueType AS issue_type
                  FROM WebChat_MessageAnalytics a
                  WHERE a.issueFlag = 1
                ),
                flagged AS (
                  SELECT
                    s.message_id,
                    s.source,
                    s.keyword_no_data,
                    s.keyword_uncertain,
                    MAX(CASE WHEN direct_issue.issue_type = N'Không tìm thấy dữ liệu' OR context_issue.issue_type = N'Không tìm thấy dữ liệu' THEN 1 ELSE 0 END) AS analytics_no_data,
                    MAX(CASE WHEN direct_issue.issue_type IN (N'AI không chắc chắn', N'AI có nguy cơ tự tạo thông tin') OR context_issue.issue_type IN (N'AI không chắc chắn', N'AI có nguy cơ tự tạo thông tin') THEN 1 ELSE 0 END) AS analytics_uncertain
                  FROM scoped s
                  LEFT JOIN analytics_issues direct_issue
                    ON direct_issue.message_id = s.message_id
                  LEFT JOIN analytics_issues context_issue
                    ON context_issue.customer_id = s.customer_id
                   AND context_issue.source_key = s.source_key
                   AND context_issue.message_at >= DATEADD(SECOND, -2, s.sent_at)
                   AND context_issue.message_at <= DATEADD(SECOND, 2, s.sent_at)
                  GROUP BY s.message_id, s.source, s.keyword_no_data, s.keyword_uncertain
                ),
                classified AS (
                  SELECT
                    source,
                    CASE
                      WHEN analytics_no_data = 1 OR (keyword_no_data = 1 AND analytics_uncertain = 0) THEN 1
                      ELSE 0
                    END AS is_no_data,
                    CASE
                      WHEN analytics_uncertain = 1 OR (keyword_uncertain = 1 AND analytics_no_data = 0) THEN 1
                      ELSE 0
                    END AS is_uncertain
                  FROM flagged
                ),
                filtered AS (
                  SELECT
                    source,
                    is_no_data,
                    is_uncertain,
                    CASE WHEN is_no_data = 1 OR is_uncertain = 1 THEN 1 ELSE 0 END AS is_fail
                  FROM classified
                  {classified_where}
                )
                SELECT
                  source,
                  SUM(CASE WHEN is_fail = 1 THEN 1 ELSE 0 END) AS ai_fail,
                  SUM(CASE WHEN is_fail = 0 THEN 1 ELSE 0 END) AS ai_ok
                FROM filtered
                GROUP BY source
            """

            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(query, tuple(params))
                return cursor.fetchall()
        finally:
            conn.close()

    def get_channel_topic_stats(self, start_date=None, end_date=None, channel=None, conversation_status=None, topic=None, ai_status=None):
        ai_status_filter = None if ai_status == "Tất cả" else ai_status
        if ai_status_filter == "AI trả lời thành công":
            return []

        conn = get_db_connection()
        try:
            topic_text = "COALESCE(NULLIF(customer_msg.TextContent, ''), m.TextContent)"
            topic_case = """
                CASE
                  WHEN LOWER({topic_text}) LIKE N'%toeic%' THEN 'TOEIC'
                  WHEN LOWER({topic_text}) LIKE N'%vstep%' THEN 'VSTEP'
                  WHEN LOWER({topic_text}) LIKE N'%đầu ra%' OR LOWER({topic_text}) LIKE N'%chuẩn đầu ra%' THEN N'Chuẩn đầu ra'
                  WHEN LOWER({topic_text}) LIKE N'%tin học%' OR LOWER({topic_text}) LIKE N'%mos%' OR LOWER({topic_text}) LIKE N'%ic3%' OR LOWER({topic_text}) LIKE N'%cntt%' THEN N'Tin học'
                  WHEN LOWER({topic_text}) LIKE N'%điểm%' OR LOWER({topic_text}) LIKE N'%tra cứu điểm%' OR LOWER({topic_text}) LIKE N'%xem điểm%' OR LOWER({topic_text}) LIKE N'%kết quả thi%' THEN N'Tra cứu điểm'
                  WHEN LOWER({topic_text}) LIKE N'%lịch thi%' OR LOWER({topic_text}) LIKE N'%ngày thi%' OR LOWER({topic_text}) LIKE N'%ca thi%' OR LOWER({topic_text}) LIKE N'%giờ thi%' THEN N'Lịch thi'
                  ELSE N'Khác'
                END
            """.format(topic_text=topic_text)
            conditions = [
                "m.TextContent IS NOT NULL",
                "m.TextContent != ''",
                "m.Source IS NOT NULL",
                "m.FromHost = 1",
                "m.HostDisplayName = 'AI Assistant'",
            ]
            params = []

            self._append_message_scope_filters(
                conditions,
                params,
                start_date,
                end_date,
                channel,
                conversation_status,
                None,
                None,
                "m",
            )

            topic_sql = self._topic_condition(topic_text, topic)
            if topic_sql:
                conditions.append(topic_sql)

            where_sql = "WHERE " + " AND ".join(conditions)
            no_data_keyword_sql = self._ai_no_data_keyword_condition("m")
            uncertain_keyword_sql = self._ai_uncertain_keyword_condition("m")
            source_case = self._source_key_case_expr("m.Source")
            analytics_source_case = self._source_key_case_expr("a.source")
            ai_filter_sql = self._ai_classified_filter_sql(ai_status_filter) or "(is_no_data = 1 OR is_uncertain = 1)"

            query = f"""
                WITH scoped AS (
                  SELECT
                    m.id_webchat_messageLogs AS message_id,
                    CAST({self._message_customer_expr("m")} AS NVARCHAR(255)) AS customer_id,
                    {source_case} AS source,
                    {source_case} AS source_key,
                    m.SentAt AS sent_at,
                    {topic_case} AS topic,
                    CASE WHEN {no_data_keyword_sql} THEN 1 ELSE 0 END AS keyword_no_data,
                    CASE WHEN {uncertain_keyword_sql} THEN 1 ELSE 0 END AS keyword_uncertain
                  FROM WebChat_MessageLogs m
                  OUTER APPLY (
                    SELECT TOP 1 customer.TextContent
                    FROM WebChat_MessageLogs customer
                    WHERE customer.FromHost = 0
                      AND customer.Source = m.Source
                      AND customer.SenderId = m.ReceiverId
                      AND customer.SentAt <= m.SentAt
                    ORDER BY customer.SentAt DESC
                  ) customer_msg
                  {where_sql}
                ),
                analytics_issues AS (
                  SELECT
                    CAST(a.messageId AS BIGINT) AS message_id,
                    CAST(a.customerId AS NVARCHAR(255)) AS customer_id,
                    {analytics_source_case} AS source_key,
                    a.messageAt AS message_at,
                    a.issueType AS issue_type
                  FROM WebChat_MessageAnalytics a
                  WHERE a.issueFlag = 1
                ),
                flagged AS (
                  SELECT
                    s.message_id,
                    s.source,
                    s.topic,
                    s.keyword_no_data,
                    s.keyword_uncertain,
                    MAX(CASE WHEN direct_issue.issue_type = N'Không tìm thấy dữ liệu' OR context_issue.issue_type = N'Không tìm thấy dữ liệu' THEN 1 ELSE 0 END) AS analytics_no_data,
                    MAX(CASE WHEN direct_issue.issue_type IN (N'AI không chắc chắn', N'AI có nguy cơ tự tạo thông tin') OR context_issue.issue_type IN (N'AI không chắc chắn', N'AI có nguy cơ tự tạo thông tin') THEN 1 ELSE 0 END) AS analytics_uncertain
                  FROM scoped s
                  LEFT JOIN analytics_issues direct_issue
                    ON direct_issue.message_id = s.message_id
                  LEFT JOIN analytics_issues context_issue
                    ON context_issue.customer_id = s.customer_id
                   AND context_issue.source_key = s.source_key
                   AND context_issue.message_at >= DATEADD(SECOND, -2, s.sent_at)
                   AND context_issue.message_at <= DATEADD(SECOND, 2, s.sent_at)
                  GROUP BY s.message_id, s.source, s.topic, s.keyword_no_data, s.keyword_uncertain
                ),
                classified AS (
                  SELECT
                    source,
                    topic,
                    CASE
                      WHEN analytics_no_data = 1 OR (keyword_no_data = 1 AND analytics_uncertain = 0) THEN 1
                      ELSE 0
                    END AS is_no_data,
                    CASE
                      WHEN analytics_uncertain = 1 OR (keyword_uncertain = 1 AND analytics_no_data = 0) THEN 1
                      ELSE 0
                    END AS is_uncertain
                  FROM flagged
                ),
                filtered AS (
                  SELECT
                    source,
                    topic
                  FROM classified
                  WHERE {ai_filter_sql}
                )
                SELECT
                  source,
                  topic,
                  COUNT(*) AS value
                FROM filtered
                GROUP BY source, topic
            """

            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(query, tuple(params))
                return cursor.fetchall()
        finally:
            conn.close()

    def get_conversations(self, start_date=None, end_date=None):
        conn = get_db_connection()
        try:
            query = """
                SELECT 
                  c.Id AS id,
                  c.CustomerId AS customer_id,
                  u.DisplayName AS customer_name,
                  CASE 
                    WHEN s.NoResponseNeeded = 1 AND (s.MarkedAt IS NULL OR c.LastCustomerMessageAt <= s.MarkedAt) THEN 'closed'
                    WHEN c.LastHostMessageAt IS NULL OR c.LastCustomerMessageAt > c.LastHostMessageAt THEN 'pending'
                    ELSE 'open'
                  END AS status,
                  c.Source AS source,
                  c.LastCustomerMessageAt AS created_at,
                  c.LastHostMessageAt AS first_response_at,
                  c.LastMessageAt AS updated_at
                FROM WebChat_Conversations c
                LEFT JOIN WebChat_Messagelogs_User_Info u 
                  ON c.CustomerId = u.SenderId AND c.Source = u.Source
                LEFT JOIN WebChat_ConversationStatus s 
                  ON c.CustomerId = s.CustomerId AND c.Source = s.Source
            """
            conditions = [valid_conversation_condition("c")]
            params = []
            
            if start_date:
                conditions.append("c.LastCustomerMessageAt >= %s")
                params.append(start_date)
                
            if end_date:
                conditions.append("c.LastCustomerMessageAt <= %s")
                params.append(f"{end_date} 23:59:59.999")
                
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
                
            query += " ORDER BY c.LastCustomerMessageAt DESC"
            
            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(query, tuple(params))
                return cursor.fetchall()
        finally:
            conn.close()

    def get_message_counts(self, start_date=None, end_date=None):
        conn = get_db_connection()
        try:
            query = """
                SELECT 
                  Source AS source, 
                  COUNT(*) AS count,
                  MIN(SentAt) AS min_date,
                  MAX(SentAt) AS max_date
                FROM WebChat_MessageLogs
            """
            conditions = [valid_message_condition("WebChat_MessageLogs")]
            params = []
            
            if start_date:
                conditions.append("SentAt >= %s")
                params.append(start_date)
                
            if end_date:
                conditions.append("SentAt <= %s")
                params.append(f"{end_date} 23:59:59.999")
                
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
                
            query += " GROUP BY Source"
            
            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(query, tuple(params))
                return cursor.fetchall()
        finally:
            conn.close()

    def get_message_counts_filtered(self, start_date=None, end_date=None, channel=None, conversation_status=None, topic=None, ai_status=None):
        conn = get_db_connection()
        try:
            query = """
                SELECT
                  m.Source AS source,
                  COUNT(*) AS count,
                  MIN(m.SentAt) AS min_date,
                  MAX(m.SentAt) AS max_date
                FROM WebChat_MessageLogs m
            """
            conditions = []
            params = []

            self._append_message_scope_filters(
                conditions,
                params,
                start_date,
                end_date,
                channel,
                conversation_status,
                topic,
                ai_status,
                "m",
            )

            if conditions:
                query += " WHERE " + " AND ".join(conditions)

            query += " GROUP BY m.Source"

            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(query, tuple(params))
                return cursor.fetchall()
        finally:
            conn.close()

    def get_ai_failures_count(self, start_date=None, end_date=None):
        conn = get_db_connection()
        try:
            query = f"""
                SELECT COUNT(*) AS count 
                FROM WebChat_MessageLogs
                WHERE FromHost = 1 
                  AND HostDisplayName = 'AI Assistant' 
                  AND {valid_message_condition("WebChat_MessageLogs")}
                  AND (
                    TextContent LIKE N'%chưa hiểu%' 
                    OR TextContent LIKE N'%chưa rõ%' 
                    OR TextContent LIKE N'%không tìm thấy%' 
                    OR TextContent LIKE N'%chưa có%'
                    OR TextContent LIKE N'%Trợ lý AI%'
                    OR TextContent LIKE N'%Không thể tiếp nhận thông tin%'
                    OR TextContent LIKE N'%Không thể xác nhận trực tiếp%'
                    OR TextContent LIKE N'%không chắc chắn%'
                    OR TextContent LIKE N'%chưa có thông tin cụ thể%'
                    OR TextContent LIKE N'%độ tin cậy%'
                    OR TextContent LIKE N'%chưa xác nhận%'
                    OR TextContent LIKE N'%có vẻ như%'
                    OR TextContent LIKE N'%chắc là%'
                    OR TextContent LIKE N'%có lẽ%'
                    OR TextContent LIKE N'%hình như%'
                    OR TextContent LIKE N'%tôi đoán%'
                    OR EXISTS (
                        SELECT 1 FROM WebChat_MessageAnalytics ma
                        WHERE ma.messageId = WebChat_MessageLogs.id_webchat_messageLogs
                          AND {valid_analytics_condition("ma")}
                          AND ma.issueType IN (N'Không tìm thấy dữ liệu', N'AI không chắc chắn', N'AI có nguy cơ tự tạo thông tin')
                    )
                  )
            """
            conditions = []
            params = []
            
            if start_date:
                conditions.append("SentAt >= %s")
                params.append(start_date)
                
            if end_date:
                conditions.append("SentAt <= %s")
                params.append(f"{end_date} 23:59:59.999")
                
            if conditions:
                query += " AND " + " AND ".join(conditions)
                
            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(query, tuple(params))
                row = cursor.fetchone()
                return row['count'] if row else 0
        finally:
            conn.close()

    def get_trends(self, start_date=None, end_date=None):
        conn = get_db_connection()
        try:
            # 1. Tìm ngày lớn nhất có dữ liệu
            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(f"""
                    SELECT MAX(LastCustomerMessageAt) AS max_date
                    FROM WebChat_Conversations
                    WHERE {valid_conversation_condition("WebChat_Conversations")}
                """)
                row = cursor.fetchone()
                db_max_date = row['max_date'] if row else None
            
            ref_end_date_str = end_date
            ref_start_date_str = start_date
            
            if db_max_date:
                db_max_date_str = db_max_date.strftime('%Y-%m-%d') if isinstance(db_max_date, datetime) else str(db_max_date).split(' ')[0]
                if not ref_end_date_str:
                    ref_end_date_str = db_max_date_str
                else:
                    # Kiểm tra xem khoảng lọc có bản ghi nào không
                    check_query = f"""
                        SELECT COUNT(*) AS count 
                        FROM WebChat_Conversations 
                        WHERE {valid_conversation_condition("WebChat_Conversations")}
                          AND LastCustomerMessageAt >= %s
                          AND LastCustomerMessageAt <= %s
                    """
                    with conn.cursor(as_dict=True) as cursor:
                        cursor.execute(check_query, (start_date, f"{end_date} 23:59:59.999"))
                        r = cursor.fetchone()
                        if r and r['count'] == 0:
                            ref_end_date_str = db_max_date_str
            
            days = 30
            if start_date and end_date:
                try:
                    d1 = datetime.strptime(start_date, '%Y-%m-%d')
                    d2 = datetime.strptime(end_date, '%Y-%m-%d')
                    days = (d2 - d1).days + 1
                    if days <= 0:
                        days = 30
                except Exception:
                    days = 30
                    
            if not ref_end_date_str:
                ref_end_date_str = datetime.now().strftime('%Y-%m-%d')
                
            current_end = datetime.strptime(ref_end_date_str, '%Y-%m-%d')
            current_end = current_end.replace(hour=23, minute=59, second=59, microsecond=999000)
            
            current_start = current_end - timedelta(days=days-1)
            current_start = current_start.replace(hour=0, minute=0, second=0, microsecond=0)
            
            prev_end = current_start - timedelta(days=1)
            prev_end = prev_end.replace(hour=23, minute=59, second=59, microsecond=999000)
            
            prev_start = prev_end - timedelta(days=days-1)
            prev_start = prev_start.replace(hour=0, minute=0, second=0, microsecond=0)
            
            query = f"""
                SELECT
                  SUM(CASE WHEN type = 'conv' AND date >= %s AND date <= %s THEN 1 ELSE 0 END) AS today_convs,
                  SUM(CASE WHEN type = 'msg' AND date >= %s AND date <= %s THEN 1 ELSE 0 END) AS today_msgs,
                  SUM(CASE WHEN type = 'active_conv' AND date >= %s AND date <= %s THEN 1 ELSE 0 END) AS today_active_convs,
                  SUM(CASE WHEN type = 'closed_conv' AND date >= %s AND date <= %s THEN 1 ELSE 0 END) AS today_closed_convs,
                  SUM(CASE WHEN type = 'ai_fail' AND date >= %s AND date <= %s THEN 1 ELSE 0 END) AS today_ai_fails,

                  SUM(CASE WHEN type = 'conv' AND date >= %s AND date <= %s THEN 1 ELSE 0 END) AS prev_convs,
                  SUM(CASE WHEN type = 'msg' AND date >= %s AND date <= %s THEN 1 ELSE 0 END) AS prev_msgs,
                  SUM(CASE WHEN type = 'active_conv' AND date >= %s AND date <= %s THEN 1 ELSE 0 END) AS prev_active_convs,
                  SUM(CASE WHEN type = 'closed_conv' AND date >= %s AND date <= %s THEN 1 ELSE 0 END) AS prev_closed_convs,
                  SUM(CASE WHEN type = 'ai_fail' AND date >= %s AND date <= %s THEN 1 ELSE 0 END) AS prev_ai_fails
                FROM (
                  SELECT 'conv' AS type, LastCustomerMessageAt AS date
                  FROM WebChat_Conversations
                  WHERE {valid_conversation_condition("WebChat_Conversations")}
                    AND LastCustomerMessageAt >= %s
                    AND LastCustomerMessageAt <= %s
                  UNION ALL
                  SELECT 'msg' AS type, SentAt AS date
                  FROM WebChat_MessageLogs
                  WHERE {valid_message_condition("WebChat_MessageLogs")}
                    AND SentAt >= %s
                    AND SentAt <= %s
                  UNION ALL
                  SELECT 'active_conv' AS type, c.LastCustomerMessageAt AS date 
                  FROM WebChat_Conversations c
                  LEFT JOIN WebChat_ConversationStatus s ON c.CustomerId = s.CustomerId AND c.Source = s.Source
                  WHERE {valid_conversation_condition("c")}
                    AND (s.NoResponseNeeded IS NULL OR s.NoResponseNeeded = 0 OR c.LastCustomerMessageAt > s.MarkedAt)
                    AND c.LastCustomerMessageAt >= %s
                    AND c.LastCustomerMessageAt <= %s
                  UNION ALL
                  SELECT 'closed_conv' AS type, c.LastCustomerMessageAt AS date 
                  FROM WebChat_Conversations c
                  LEFT JOIN WebChat_ConversationStatus s ON c.CustomerId = s.CustomerId AND c.Source = s.Source
                  WHERE {valid_conversation_condition("c")}
                    AND s.NoResponseNeeded = 1
                    AND (s.MarkedAt IS NULL OR c.LastCustomerMessageAt <= s.MarkedAt)
                    AND c.LastCustomerMessageAt >= %s
                    AND c.LastCustomerMessageAt <= %s
                  UNION ALL
                  SELECT 'ai_fail' AS type, SentAt AS date 
                  FROM WebChat_MessageLogs
                  WHERE FromHost = 1 
                    AND HostDisplayName = 'AI Assistant' 
                    AND {valid_message_condition("WebChat_MessageLogs")}
                    AND (
                      TextContent LIKE N'%chưa hiểu%' 
                      OR TextContent LIKE N'%chưa rõ%' 
                      OR TextContent LIKE N'%không tìm thấy%' 
                      OR TextContent LIKE N'%chưa có%'
                      OR TextContent LIKE N'%Trợ lý AI%'
                      OR TextContent LIKE N'%Không thể tiếp nhận thông tin%'
                      OR TextContent LIKE N'%Không thể xác nhận trực tiếp%'
                      OR TextContent LIKE N'%không chắc chắn%'
                      OR TextContent LIKE N'%chưa có thông tin cụ thể%'
                      OR TextContent LIKE N'%độ tin cậy%'
                      OR TextContent LIKE N'%chưa xác nhận%'
                      OR TextContent LIKE N'%có vẻ như%'
                      OR TextContent LIKE N'%chắc là%'
                      OR TextContent LIKE N'%có lẽ%'
                      OR TextContent LIKE N'%hình như%'
                      OR TextContent LIKE N'%tôi đoán%'
                      OR EXISTS (
                          SELECT 1 FROM WebChat_MessageAnalytics ma
                          WHERE ma.messageId = WebChat_MessageLogs.id_webchat_messageLogs
                            AND {valid_analytics_condition("ma")}
                            AND ma.issueType IN (N'Không tìm thấy dữ liệu', N'AI không chắc chắn', N'AI có nguy cơ tự tạo thông tin')
                      )
                    )
                    AND SentAt >= %s AND SentAt <= %s
                ) combined
            """
            
            params = (
                current_start, current_end,
                current_start, current_end,
                current_start, current_end,
                current_start, current_end,
                current_start, current_end,
                
                prev_start, prev_end,
                prev_start, prev_end,
                prev_start, prev_end,
                prev_start, prev_end,
                prev_start, prev_end,
                
                prev_start, current_end,
                prev_start, current_end,
                prev_start, current_end,
                prev_start, current_end,
                prev_start, current_end
            )
            
            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(query, params)
                tr = cursor.fetchone() or {}
                
                def calc_trend(today_val, prev_val):
                    today = today_val or 0
                    prev = prev_val or 0
                    if prev == 0:
                        return 100 if today > 0 else 0
                    return int(round(((today - prev) / prev) * 100))
                
                return {
                    "totalConversations": calc_trend(tr.get("today_convs"), tr.get("prev_convs")),
                    "totalMessages": calc_trend(tr.get("today_msgs"), tr.get("prev_msgs")),
                    "activeConversations": calc_trend(tr.get("today_active_convs"), tr.get("prev_active_convs")),
                    "closedConversations": calc_trend(tr.get("today_closed_convs"), tr.get("prev_closed_convs")),
                    "aiFailures": calc_trend(tr.get("today_ai_fails"), tr.get("prev_ai_fails"))
                }
        finally:
            conn.close()

    def _execute_overtime_alerts_query(self, cursor, start_date=None, end_date=None, limit=100):
        try:
            limit = int(limit or 100)
        except (TypeError, ValueError):
            limit = 100
        limit = max(1, min(limit, 200))

        conditions = [
            valid_conversation_condition("c"),
            "c.LastCustomerMessageAt IS NOT NULL",
            "(s.NoResponseNeeded IS NULL OR s.NoResponseNeeded = 0 OR c.LastCustomerMessageAt > s.MarkedAt)",
            "c.LastMessageId > 0",
            "(c.LastHostMessageAt IS NULL OR c.LastCustomerMessageAt > c.LastHostMessageAt)",
            "DATEDIFF(MINUTE, c.LastCustomerMessageAt, @dbNow) > 600",
        ]
        params = []

        if start_date:
            conditions.append("c.LastCustomerMessageAt >= %s")
            params.append(start_date)

        if end_date:
            conditions.append("c.LastCustomerMessageAt <= %s")
            params.append(f"{end_date} 23:59:59.999")

        where_sql = " AND ".join(conditions)

        query = f"""
            DECLARE @dbNow DATETIME;
            SET @dbNow = GETDATE();

            WITH OvertimeConversations AS (
              SELECT TOP ({limit})
                c.Id AS id,
                c.CustomerId AS customer_id,
                c.Source AS source,
                c.LastCustomerMessageAt AS last_customer_msg_at,
                c.LastHostMessageAt AS last_host_msg_at,
                DATEDIFF(MINUTE, c.LastCustomerMessageAt, @dbNow) AS wait_mins
              FROM WebChat_Conversations c
              OUTER APPLY (
                SELECT TOP 1
                  status_meta.NoResponseNeeded,
                  status_meta.MarkedAt
                FROM WebChat_ConversationStatus status_meta
                WHERE CAST(status_meta.CustomerId AS NVARCHAR(255)) = CAST(c.CustomerId AS NVARCHAR(255))
                  AND {self._normalized_source_expr('status_meta.Source')} = {self._normalized_source_expr('c.Source')}
                ORDER BY CASE WHEN status_meta.MarkedAt IS NULL THEN 0 ELSE 1 END DESC, status_meta.MarkedAt DESC
              ) s
              WHERE {where_sql}
              ORDER BY DATEDIFF(MINUTE, c.LastCustomerMessageAt, @dbNow) DESC, c.LastCustomerMessageAt ASC
            )
            SELECT
              o.id,
              o.customer_id,
              o.source,
              o.last_customer_msg_at,
              o.last_host_msg_at,
              u.DisplayName AS customer_name,
              cust.TextContent AS last_cust_text,
              ai.TextContent AS last_ai_text,
              'overtime' AS alert_type,
              o.wait_mins
            FROM OvertimeConversations o
            OUTER APPLY (
              SELECT TOP 1 user_info.DisplayName
              FROM WebChat_Messagelogs_User_Info user_info
              WHERE CAST(user_info.SenderId AS NVARCHAR(255)) = CAST(o.customer_id AS NVARCHAR(255))
                AND {self._normalized_source_expr('user_info.Source')} = {self._normalized_source_expr('o.source')}
              ORDER BY user_info.DisplayName
            ) u
            OUTER APPLY (
              SELECT TOP 1 cust_msg.TextContent
              FROM WebChat_MessageLogs cust_msg
              WHERE cust_msg.FromHost = 0
                AND {valid_message_condition("cust_msg")}
                AND CAST(cust_msg.SenderId AS NVARCHAR(255)) = CAST(o.customer_id AS NVARCHAR(255))
                AND {self._normalized_source_expr('cust_msg.Source')} = {self._normalized_source_expr('o.source')}
              ORDER BY cust_msg.SentAt DESC
            ) cust
            OUTER APPLY (
              SELECT TOP 1 ai_msg.TextContent
              FROM WebChat_MessageLogs ai_msg
              WHERE ai_msg.FromHost = 1
                AND ai_msg.HostDisplayName = 'AI Assistant'
                AND {valid_message_condition("ai_msg")}
                AND CAST(ai_msg.ReceiverId AS NVARCHAR(255)) = CAST(o.customer_id AS NVARCHAR(255))
                AND {self._normalized_source_expr('ai_msg.Source')} = {self._normalized_source_expr('o.source')}
              ORDER BY ai_msg.SentAt DESC
            ) ai
            ORDER BY o.wait_mins DESC, o.last_customer_msg_at ASC
        """

        cursor.execute(query, tuple(params))
        return cursor.fetchall()

    def get_overtime_alerts_data(self, start_date=None, end_date=None, limit=100):
        conn = get_db_connection()
        try:
            with conn.cursor(as_dict=True) as cursor:
                return self._execute_overtime_alerts_query(cursor, start_date, end_date, limit)
        finally:
            conn.close()

    def get_urgent_alerts_data(self, start_date=None, end_date=None, include_overtime=True, include_ai=True):
        conn = get_db_connection()
        try:
            rows = []
            with conn.cursor(as_dict=True) as cursor:
                if include_overtime:
                    rows.extend(self._execute_overtime_alerts_query(cursor, start_date, end_date))

                if include_ai:
                    ai_conditions = [
                        "m.FromHost = 1",
                        "m.HostDisplayName = 'AI Assistant'",
                        valid_message_condition("m"),
                        "m.Source IS NOT NULL",
                        "m.TextContent IS NOT NULL",
                        "m.TextContent != ''",
                        "(c.Id IS NULL OR s.NoResponseNeeded IS NULL OR s.NoResponseNeeded = 0 OR c.LastCustomerMessageAt > s.MarkedAt)",
                    ]
                    ai_params = []

                    if start_date:
                        ai_conditions.append("m.SentAt >= %s")
                        ai_params.append(start_date)

                    if end_date:
                        ai_conditions.append("m.SentAt <= %s")
                        ai_params.append(f"{end_date} 23:59:59.999")

                    where_sql = "WHERE " + " AND ".join(ai_conditions)
                    no_data_keyword_sql = self._ai_no_data_keyword_condition("m")
                    uncertain_keyword_sql = self._ai_uncertain_keyword_condition("m")
                    source_case = self._source_key_case_expr("m.Source")
                    analytics_source_case = self._source_key_case_expr("a.source")

                    ai_query = f"""
                        DECLARE @dbNow DATETIME;
                        SET @dbNow = GETDATE();

                        WITH scoped AS (
                          SELECT
                            'ai-' + CAST(m.id_webchat_messageLogs AS VARCHAR(30)) AS id,
                            m.id_webchat_messageLogs AS message_id,
                            c.Id AS conversation_id,
                            CAST({self._message_customer_expr("m")} AS NVARCHAR(255)) AS customer_id,
                            m.Source AS source,
                            {source_case} AS source_key,
                            m.SentAt AS ai_sent_at,
                            cust.SentAt AS last_customer_msg_at,
                            m.SentAt AS last_host_msg_at,
                            u.DisplayName AS customer_name,
                            cust.TextContent AS last_cust_text,
                            m.TextContent AS last_ai_text,
                            DATEDIFF(MINUTE, COALESCE(c.LastCustomerMessageAt, cust.SentAt, m.SentAt), @dbNow) AS wait_mins,
                            CASE WHEN {no_data_keyword_sql} THEN 1 ELSE 0 END AS keyword_no_data,
                            CASE WHEN {uncertain_keyword_sql} THEN 1 ELSE 0 END AS keyword_uncertain
                          FROM WebChat_MessageLogs m
                          OUTER APPLY (
                            SELECT TOP 1 customer.SentAt, customer.TextContent
                            FROM WebChat_MessageLogs customer
                            WHERE customer.FromHost = 0
                              AND {valid_message_condition("customer")}
                              AND {self._normalized_source_expr('customer.Source')} = {self._normalized_source_expr('m.Source')}
                              AND customer.SenderId = m.ReceiverId
                              AND customer.SentAt <= m.SentAt
                            ORDER BY customer.SentAt DESC
                          ) cust
                          LEFT JOIN WebChat_Conversations c
                            ON c.CustomerId = m.ReceiverId
                           AND {self._normalized_source_expr('c.Source')} = {self._normalized_source_expr('m.Source')}
                          LEFT JOIN WebChat_ConversationStatus s
                            ON c.CustomerId = s.CustomerId
                           AND {self._normalized_source_expr('c.Source')} = {self._normalized_source_expr('s.Source')}
                          LEFT JOIN WebChat_Messagelogs_User_Info u
                            ON u.SenderId = m.ReceiverId
                           AND {self._normalized_source_expr('u.Source')} = {self._normalized_source_expr('m.Source')}
                          {where_sql}
                        ),
                        analytics_issues AS (
                          SELECT
                            CAST(a.messageId AS BIGINT) AS message_id,
                            CAST(a.customerId AS NVARCHAR(255)) AS customer_id,
                            {analytics_source_case} AS source_key,
                            a.messageAt AS message_at,
                            a.issueType AS issue_type
                          FROM WebChat_MessageAnalytics a
                          WHERE a.issueFlag = 1
                            AND {valid_analytics_condition("a")}
                        ),
                        flagged AS (
                          SELECT
                            s.id,
                            s.message_id,
                            s.conversation_id,
                            s.customer_id,
                            s.source,
                            s.source_key,
                            s.ai_sent_at,
                            s.last_customer_msg_at,
                            s.last_host_msg_at,
                            s.customer_name,
                            s.last_cust_text,
                            s.last_ai_text,
                            s.wait_mins,
                            s.keyword_no_data,
                            s.keyword_uncertain,
                            MAX(CASE WHEN direct_issue.issue_type = N'Không tìm thấy dữ liệu' OR context_issue.issue_type = N'Không tìm thấy dữ liệu' THEN 1 ELSE 0 END) AS analytics_no_data,
                            MAX(CASE WHEN direct_issue.issue_type IN (N'AI không chắc chắn', N'AI có nguy cơ tự tạo thông tin') OR context_issue.issue_type IN (N'AI không chắc chắn', N'AI có nguy cơ tự tạo thông tin') THEN 1 ELSE 0 END) AS analytics_uncertain
                          FROM scoped s
                          LEFT JOIN analytics_issues direct_issue
                            ON direct_issue.message_id = s.message_id
                          LEFT JOIN analytics_issues context_issue
                            ON context_issue.customer_id = s.customer_id
                           AND context_issue.source_key = s.source_key
                           AND context_issue.message_at >= DATEADD(SECOND, -2, s.ai_sent_at)
                           AND context_issue.message_at <= DATEADD(SECOND, 2, s.ai_sent_at)
                          GROUP BY
                            s.id,
                            s.message_id,
                            s.conversation_id,
                            s.customer_id,
                            s.source,
                            s.source_key,
                            s.ai_sent_at,
                            s.last_customer_msg_at,
                            s.last_host_msg_at,
                            s.customer_name,
                            s.last_cust_text,
                            s.last_ai_text,
                            s.wait_mins,
                            s.keyword_no_data,
                            s.keyword_uncertain
                        ),
                        classified AS (
                          SELECT
                            id,
                            conversation_id,
                            customer_id,
                            source,
                            ai_sent_at,
                            last_customer_msg_at,
                            last_host_msg_at,
                            customer_name,
                            last_cust_text,
                            last_ai_text,
                            wait_mins,
                            CASE
                              WHEN analytics_no_data = 1 OR (keyword_no_data = 1 AND analytics_uncertain = 0) THEN 'ai_no_data'
                              WHEN analytics_uncertain = 1 OR (keyword_uncertain = 1 AND analytics_no_data = 0) THEN 'ai_uncertain'
                              ELSE 'none'
                            END AS alert_type
                          FROM flagged
                        ),
                        ranked AS (
                          SELECT
                            *,
                            ROW_NUMBER() OVER (PARTITION BY alert_type ORDER BY ai_sent_at DESC) AS rn
                          FROM classified
                          WHERE alert_type IN ('ai_no_data', 'ai_uncertain')
                        )
                        SELECT
                          id,
                          conversation_id,
                          customer_id,
                          source,
                          last_customer_msg_at,
                          last_host_msg_at,
                          customer_name,
                          last_cust_text,
                          last_ai_text,
                          alert_type,
                          wait_mins
                        FROM ranked
                        WHERE rn <= 100
                        ORDER BY
                          CASE WHEN alert_type = 'ai_uncertain' THEN 0 ELSE 1 END,
                          ai_sent_at DESC
                    """

                    cursor.execute(ai_query, tuple(ai_params))
                    rows.extend(cursor.fetchall())

                return rows
        finally:
            conn.close()

    def get_top_questions_data(self, start_date=None, end_date=None, channel=None):
        conn = get_db_connection()
        try:
            query = """
                SELECT
                  TextContent AS question,
                  Source AS source,
                  COUNT(*) AS count,
                  MAX(SentAt) AS sent_at
                FROM WebChat_MessageLogs
            """
            conditions = [
                "FromHost = 0",
                valid_message_condition("WebChat_MessageLogs"),
                "LEN(TextContent) > 4",
                "TextContent NOT LIKE N'%http%'",
                "TextContent NOT LIKE N'%www.%'"
            ]
            params = []

            self._append_date_and_channel_filters(
                conditions,
                params,
                "SentAt",
                "Source",
                start_date,
                end_date,
                channel,
            )
                
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
                
            query += " GROUP BY TextContent, Source ORDER BY count DESC, sent_at DESC"
            
            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(query, tuple(params))
                return cursor.fetchall()
        finally:
            conn.close()

    def get_ai_failures_count_filtered(self, start_date=None, end_date=None, channel=None, conversation_status=None, topic=None, ai_status=None):
        if ai_status == "AI trả lời thành công":
            return 0

        conn = get_db_connection()
        try:
            query = """
                SELECT COUNT(*) AS count
                FROM WebChat_MessageLogs m
            """
            conditions = [
                "m.FromHost = 1",
                "m.HostDisplayName = 'AI Assistant'",
            ]
            params = []

            self._append_message_scope_filters(
                conditions,
                params,
                start_date,
                end_date,
                channel,
                conversation_status,
                topic,
                None,
                "m",
            )

            if ai_status == "Không tìm thấy dữ liệu":
                conditions.append(self._ai_no_data_condition("m"))
            elif ai_status in ("AI không chắc chắn", "AI trả lời không chắc chắn"):
                conditions.append(self._ai_uncertain_condition("m"))
            else:
                conditions.append(self._ai_failure_condition("m"))

            query += " WHERE " + " AND ".join(conditions)

            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(query, tuple(params))
                row = cursor.fetchone()
                return row['count'] if row else 0
        finally:
            conn.close()

    def get_ai_grouped_stats(self, start_date=None, end_date=None):
        conn = get_db_connection()
        try:
            query = """
                SELECT 
                  CONVERT(VARCHAR(10), SentAt, 120) AS date_str,
                  ReceiverId AS customer_id,
                  Source AS source,
                  SUM(CASE WHEN FromHost = 1 AND HostDisplayName = 'AI Assistant' AND (
                    TextContent LIKE N'%chưa hiểu%' 
                    OR TextContent LIKE N'%chưa rõ%' 
                    OR TextContent LIKE N'%không tìm thấy%' 
                    OR TextContent LIKE N'%chưa có%'
                    OR TextContent LIKE N'%Trợ lý AI%'
                    OR TextContent LIKE N'%Không thể tiếp nhận thông tin%'
                    OR TextContent LIKE N'%Không thể xác nhận trực tiếp%'
                  ) THEN 1 ELSE 0 END) AS ai_fail,
                  SUM(CASE WHEN FromHost = 1 AND HostDisplayName = 'AI Assistant' AND NOT (
                    TextContent LIKE N'%chưa hiểu%' 
                    OR TextContent LIKE N'%chưa rõ%' 
                    OR TextContent LIKE N'%không tìm thấy%' 
                    OR TextContent LIKE N'%chưa có%'
                    OR TextContent LIKE N'%Trợ lý AI%'
                    OR TextContent LIKE N'%Không thể tiếp nhận thông tin%'
                    OR TextContent LIKE N'%Không thể xác nhận trực tiếp%'
                  ) THEN 1 ELSE 0 END) AS ai_ok
                FROM WebChat_MessageLogs
            """
            conditions = []
            params = []
            
            if start_date:
                conditions.append("SentAt >= %s")
                params.append(start_date)
                
            if end_date:
                conditions.append("SentAt <= %s")
                params.append(f"{end_date} 23:59:59.999")
                
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
                
            query += " GROUP BY CONVERT(VARCHAR(10), SentAt, 120), ReceiverId, Source"
            
            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(query, tuple(params))
                return cursor.fetchall()
        finally:
            conn.close()

    def get_topic_hints(self, start_date=None, end_date=None):
        conn = get_db_connection()
        try:
            query = """
                SELECT
                  customer_id,
                  source,
                  CASE
                    WHEN has_toeic = 1 THEN 'TOEIC'
                    WHEN has_vstep = 1 THEN 'VSTEP'
                    WHEN has_chuandaura = 1 THEN N'Chuẩn đầu ra'
                    WHEN has_tinhoc = 1 THEN N'Tin học'
                    WHEN has_tracuudiem = 1 THEN N'Tra cứu điểm'
                    WHEN has_lichthi = 1 THEN N'Lịch thi'
                    ELSE N'Khác'
                  END AS topic
                FROM (
                  SELECT
                    CASE WHEN FromHost = 1 THEN ReceiverId ELSE SenderId END AS customer_id,
                    Source AS source,
                    MAX(CASE WHEN LOWER(TextContent) LIKE N'%toeic%' THEN 1 ELSE 0 END) AS has_toeic,
                    MAX(CASE WHEN LOWER(TextContent) LIKE N'%vstep%' THEN 1 ELSE 0 END) AS has_vstep,
                    MAX(CASE WHEN LOWER(TextContent) LIKE N'%đầu ra%' OR LOWER(TextContent) LIKE N'%chuẩn đầu ra%' THEN 1 ELSE 0 END) AS has_chuandaura,
                    MAX(CASE WHEN LOWER(TextContent) LIKE N'%tin học%' OR LOWER(TextContent) LIKE N'%mos%' OR LOWER(TextContent) LIKE N'%ic3%' OR LOWER(TextContent) LIKE N'%cntt%' THEN 1 ELSE 0 END) AS has_tinhoc,
                    MAX(CASE WHEN LOWER(TextContent) LIKE N'%điểm%' OR LOWER(TextContent) LIKE N'%tra cứu điểm%' OR LOWER(TextContent) LIKE N'%xem điểm%' OR LOWER(TextContent) LIKE N'%kết quả thi%' THEN 1 ELSE 0 END) AS has_tracuudiem,
                    MAX(CASE WHEN LOWER(TextContent) LIKE N'%lịch thi%' OR LOWER(TextContent) LIKE N'%ngày thi%' OR LOWER(TextContent) LIKE N'%ca thi%' OR LOWER(TextContent) LIKE N'%giờ thi%' THEN 1 ELSE 0 END) AS has_lichthi
                  FROM WebChat_MessageLogs
            """
            conditions = [
                "TextContent IS NOT NULL",
                "Source IS NOT NULL",
                "((FromHost = 1 AND ReceiverId IS NOT NULL) OR (FromHost = 0 AND SenderId IS NOT NULL))"
            ]
            params = []

            if start_date:
                conditions.append("SentAt >= %s")
                params.append(start_date)

            if end_date:
                conditions.append("SentAt <= %s")
                params.append(f"{end_date} 23:59:59.999")

            query += " WHERE " + " AND ".join(conditions)
            query += """
                  GROUP BY CASE WHEN FromHost = 1 THEN ReceiverId ELSE SenderId END, Source
                ) topic_flags
            """

            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(query, tuple(params))
                return cursor.fetchall()
        finally:
            conn.close()

    def get_message_texts(self, start_date=None, end_date=None):
        conn = get_db_connection()
        try:
            query = """
                SELECT 
                  Source AS source,
                  SenderId AS sender_id,
                  ReceiverId AS receiver_id,
                  FromHost AS from_host,
                  TextContent AS text
                FROM WebChat_MessageLogs
            """
            conditions = []
            params = []
            
            if start_date:
                conditions.append("SentAt >= %s")
                params.append(start_date)
                
            if end_date:
                conditions.append("SentAt <= %s")
                params.append(f"{end_date} 23:59:59.999")
                
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
                
            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(query, tuple(params))
                return cursor.fetchall()
        finally:
            conn.close()

    def close_conversation(self, customer_id, source, user_name='Staff_Dashboard'):
        conn = get_db_connection()
        try:
            source_values = self._source_match_values(source)
            placeholders = ", ".join(["%s"] * len(source_values))
            conversation_query = f"""
                SELECT TOP 1 c.CustomerId, c.Source
                FROM WebChat_Conversations c
                WHERE c.CustomerId = %s
                  AND {self._normalized_source_expr("c.Source")} IN ({placeholders})
                  AND {valid_conversation_condition("c")}
                ORDER BY c.LastCustomerMessageAt DESC, c.LastMessageAt DESC, c.Id DESC
            """
            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(conversation_query, (customer_id, *source_values))
                conversation = cursor.fetchone()
                if not conversation:
                    raise ValueError("Không tìm thấy hội thoại tương ứng để cập nhật trạng thái.")

                canonical_customer_id = conversation["CustomerId"]
                canonical_source = conversation["Source"]

                check_query = "SELECT COUNT(*) AS count FROM WebChat_ConversationStatus WHERE CustomerId = %s AND Source = %s"
                cursor.execute(check_query, (canonical_customer_id, canonical_source))
                row = cursor.fetchone()
                exists = row['count'] > 0 if row else False

                if exists:
                    update_query = """
                        UPDATE WebChat_ConversationStatus 
                        SET NoResponseNeeded = 1, MarkedAt = GETDATE(), MarkedBy = %s 
                        WHERE CustomerId = %s AND Source = %s
                    """
                    cursor.execute(update_query, (user_name, canonical_customer_id, canonical_source))
                else:
                    insert_query = """
                        INSERT INTO WebChat_ConversationStatus (CustomerId, Source, NoResponseNeeded, MarkedAt, MarkedBy)
                        VALUES (%s, %s, 1, GETDATE(), %s)
                    """
                    cursor.execute(insert_query, (canonical_customer_id, canonical_source, user_name))
            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
