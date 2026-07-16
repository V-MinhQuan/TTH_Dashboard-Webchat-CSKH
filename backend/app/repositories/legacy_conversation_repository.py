import os
from datetime import datetime, timedelta
import pymssql
from app.core.topic_taxonomy import TOPIC_LEGACY_ALIASES, TOPIC_NAME_BY_ID, canonical_topic_id, canonical_topic_label
from app.core.legacy_db import get_db_connection
from app.repositories.display_filters import (
    valid_analytics_condition,
    valid_conversation_condition,
    valid_message_condition,
)

from app.repositories.base_repository import BaseRepository

class ConversationRepository(BaseRepository):
    def _analytics_topic_scope_cte(
        self,
        cte_name,
        analytics_alias,
        start_date=None,
        end_date=None,
        channel=None,
        topic=None,
        ai_status=None,
    ):
        analytics_conditions = [
            valid_analytics_condition(analytics_alias),
            f"{analytics_alias}.detectedTopics IS NOT NULL",
            f"LTRIM(RTRIM({analytics_alias}.detectedTopics)) NOT IN (N'', N'[]')",
        ]
        params = []
        self._append_date_and_channel_filters(
            analytics_conditions,
            params,
            f"{analytics_alias}.messageAt",
            f"{analytics_alias}.source",
            start_date,
            end_date,
            channel,
        )

        topic_sql = self._detected_topics_condition(analytics_alias, topic, params)
        if topic_sql:
            analytics_conditions.append(topic_sql)

        ai_sql = self._analytics_ai_status_condition(ai_status, analytics_alias)
        if ai_sql:
            analytics_conditions.append(ai_sql)

        return f"""{cte_name} AS (
                  SELECT DISTINCT
                    CAST({analytics_alias}.customerId AS NVARCHAR(255)) AS customer_id,
                    {self._source_key_case_expr(f'{analytics_alias}.source')} AS source_key
                  FROM WebChat_MessageAnalytics {analytics_alias}
                  WHERE {" AND ".join(analytics_conditions)}
                )
            """, params

    def _append_analytics_scope_filters(
        self,
        conditions,
        params,
        start_date=None,
        end_date=None,
        channel=None,
        conversation_status=None,
        topic=None,
        ai_status=None,
        analytics_alias="a",
        conversation_alias="c_status",
        status_alias="latest_status",
    ):
        conditions.append(valid_analytics_condition(analytics_alias))
        self._append_date_and_channel_filters(
            conditions,
            params,
            f"{analytics_alias}.messageAt",
            f"{analytics_alias}.source",
            start_date,
            end_date,
            channel,
        )

        topic_sql = self._detected_topics_condition(analytics_alias, topic, params)
        if topic_sql:
            conditions.append(topic_sql)

        ai_sql = self._analytics_ai_status_condition(ai_status, analytics_alias)
        if ai_sql:
            conditions.append(ai_sql)

        status_join = ""
        status_filter = self._status_filter_value(conversation_status)
        if status_filter:
            status_join = f"""
                LEFT JOIN WebChat_Conversations {conversation_alias}
                  ON {conversation_alias}.Id = {analytics_alias}.conversationId
                OUTER APPLY (
                  SELECT TOP 1
                    status_meta.NoResponseNeeded,
                    status_meta.MarkedAt
                  FROM WebChat_ConversationStatus status_meta
                  WHERE CAST(status_meta.CustomerId AS NVARCHAR(255)) = CAST({conversation_alias}.CustomerId AS NVARCHAR(255))
                    AND {self._normalized_source_expr('status_meta.Source')} = {self._normalized_source_expr(f'{conversation_alias}.Source')}
                  ORDER BY CASE WHEN status_meta.MarkedAt IS NULL THEN 0 ELSE 1 END DESC, status_meta.MarkedAt DESC
                ) {status_alias}
            """
            conditions.append(f"{conversation_alias}.Id IS NOT NULL")
            conditions.append(f"{self._conversation_status_case(conversation_alias, status_alias)} = %s")
            params.append(status_filter)
        return status_join

    def _get_analytics_ai_daily_stats(
        self,
        start_date=None,
        end_date=None,
        channel=None,
        conversation_status=None,
        topic=None,
        ai_status=None,
    ):
        """Đếm số lần AI phản hồi thành công/thất bại theo ngày.

        Không áp dụng valid_analytics_condition (lọc customerId/source placeholder)
        vì AI có thể phản hồi thất bại ngay cả khi customerId chưa được xác định.
        Chỉ lọc theo ngày và kênh để đếm chính xác tổng số lần AI thất bại.
        """
        conn = get_db_connection()
        try:
            conditions = []
            params = []
            # Chỉ áp dụng filter ngày và kênh, KHÔNG dùng valid_analytics_condition
            # để tránh bỏ sót các bản ghi AI thất bại có customerId/source là null/unknown
            self._append_date_and_channel_filters(
                conditions,
                params,
                "a.messageAt",
                "a.source",
                start_date,
                end_date,
                channel,
            )

            # Thêm filter topic nếu có
            topic_sql = self._detected_topics_condition("a", topic, params)
            if topic_sql:
                conditions.append(topic_sql)

            # Thêm filter ai_status nếu có
            ai_sql = self._analytics_ai_status_condition(ai_status, "a")
            if ai_sql:
                conditions.append(ai_sql)

            # Thêm filter conversation_status nếu có (vẫn cần JOIN)
            status_join = ""
            status_filter = self._status_filter_value(conversation_status)
            if status_filter:
                status_join = """
                    LEFT JOIN WebChat_Conversations c_status
                      ON c_status.Id = a.conversationId
                    OUTER APPLY (
                      SELECT TOP 1
                        status_meta.NoResponseNeeded,
                        status_meta.MarkedAt
                      FROM WebChat_ConversationStatus status_meta
                      WHERE CAST(status_meta.CustomerId AS NVARCHAR(255)) = CAST(c_status.CustomerId AS NVARCHAR(255))
                        AND {self._normalized_source_expr('status_meta.Source')} = {self._normalized_source_expr('c_status.Source')}
                      ORDER BY CASE WHEN status_meta.MarkedAt IS NULL THEN 0 ELSE 1 END DESC, status_meta.MarkedAt DESC
                    ) latest_status
                """
                conditions.append("c_status.Id IS NOT NULL")
                conditions.append(f"{self._conversation_status_case('c_status', 'latest_status')} = %s")
                params.append(status_filter)

            where_sql = "WHERE " + " AND ".join(conditions) if conditions else ""
            query = f"""
                SELECT
                  CONVERT(VARCHAR(10), a.messageAt, 120) AS date_str,
                  SUM(CASE WHEN a.issueFlag = 1 AND ISNULL(a.issueResolved, 0) = 0 AND a.issueType IN (N'Không tìm thấy dữ liệu', N'AI không chắc chắn') THEN 1 ELSE 0 END) AS ai_fail,
                  SUM(CASE WHEN NOT (a.issueFlag = 1 AND ISNULL(a.issueResolved, 0) = 0 AND a.issueType IN (N'Không tìm thấy dữ liệu', N'AI không chắc chắn')) THEN 1 ELSE 0 END) AS ai_ok
                FROM WebChat_MessageAnalytics a
                {status_join}
                {where_sql}
                GROUP BY CONVERT(VARCHAR(10), a.messageAt, 120)
                ORDER BY date_str
            """
            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(query, tuple(params))
                return cursor.fetchall()
        finally:
            conn.close()

    def _get_analytics_channel_ai_summary(
        self,
        start_date=None,
        end_date=None,
        channel=None,
        conversation_status=None,
        topic=None,
        ai_status=None,
    ):
        conn = get_db_connection()
        try:
            conditions = []
            params = []
            status_join = self._append_analytics_scope_filters(
                conditions,
                params,
                start_date,
                end_date,
                channel,
                conversation_status,
                topic,
                ai_status,
                "a",
            )
            source_case = self._source_key_case_expr("a.source")
            query = f"""
                SELECT
                  {source_case} AS source,
                  SUM(CASE WHEN a.issueFlag = 1 AND ISNULL(a.issueResolved, 0) = 0 AND a.issueType IN (N'Không tìm thấy dữ liệu', N'AI không chắc chắn') THEN 1 ELSE 0 END) AS ai_fail,
                  SUM(CASE WHEN NOT (a.issueFlag = 1 AND ISNULL(a.issueResolved, 0) = 0 AND a.issueType IN (N'Không tìm thấy dữ liệu', N'AI không chắc chắn')) THEN 1 ELSE 0 END) AS ai_ok
                FROM WebChat_MessageAnalytics a
                {status_join}
                WHERE {" AND ".join(conditions)}
                GROUP BY {source_case}
            """
            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(query, tuple(params))
                return cursor.fetchall()
        finally:
            conn.close()

    def _get_analytics_channel_topic_stats(
        self,
        start_date=None,
        end_date=None,
        channel=None,
        conversation_status=None,
        topic=None,
        ai_status=None,
    ):
        ai_status_filter = None if ai_status == "Tất cả" else ai_status
        if ai_status_filter == "AI trả lời thành công":
            return []

        selected_topic_id = canonical_topic_id(topic)
        topic_ids = (
            [selected_topic_id]
            if selected_topic_id and selected_topic_id != "khac"
            else ["sat_hach_cntt", "toeic", "mos", "hoc_tieng_anh", "hoc_tin_hoc"]
        )

        conn = get_db_connection()
        try:
            conditions = ["a.issueFlag = 1 AND ISNULL(a.issueResolved, 0) = 0 AND a.issueType IN (N'Không tìm thấy dữ liệu', N'AI không chắc chắn')"]
            params = []
            status_join = self._append_analytics_scope_filters(
                conditions,
                params,
                start_date,
                end_date,
                channel,
                conversation_status,
                None,
                ai_status_filter,
                "a",
            )
            source_case = self._source_key_case_expr("a.source")
            union_parts = []
            topic_params = []
            for topic_id in topic_ids:
                label = TOPIC_NAME_BY_ID[topic_id]
                topic_condition = self._detected_topics_condition("topic_row", label, topic_params)
                if not topic_condition:
                    continue
                union_parts.append(f"""
                    SELECT
                      source,
                      N'{label.replace("'", "''")}' AS topic,
                      COUNT(*) AS value
                    FROM filtered topic_row
                    WHERE {topic_condition}
                    GROUP BY source
                """)

            if not union_parts:
                return []

            query = f"""
                WITH filtered AS (
                  SELECT
                    {source_case} AS source,
                    a.detectedTopics
                  FROM WebChat_MessageAnalytics a
                  {status_join}
                  WHERE {" AND ".join(conditions)}
                )
                {" UNION ALL ".join(union_parts)}
            """
            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(query, tuple(params + topic_params))
                return cursor.fetchall()
        finally:
            conn.close()

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

        topic_sql = self._topic_condition("ma.detectedTopics", topic, params)
        if topic_sql:
            exists_conditions = [
                f"{self._normalized_source_expr('ma.source')} = {self._normalized_source_expr(f'{conversation_alias}.Source')}",
                f"CAST(ma.customerId AS NVARCHAR(255)) = CAST({conversation_alias}.CustomerId AS NVARCHAR(255))",
                "1=1",
                topic_sql,
            ]
            if start_date:
                exists_conditions.append("ma.messageAt >= %s")
                params.append(start_date)
            if end_date:
                exists_conditions.append("ma.messageAt <= %s")
                params.append(f"{end_date} 23:59:59.999")
            # Using IN subquery to optimize
            conditions.append(f"""
                CAST({conversation_alias}.CustomerId AS NVARCHAR(255)) IN (
                  SELECT CAST(ma.customerId AS NVARCHAR(255))
                  FROM WebChat_MessageAnalytics ma
                  WHERE {self._normalized_source_expr('ma.source')} = {self._normalized_source_expr(f'{conversation_alias}.Source')}
                    AND {" AND ".join(exists_conditions)}
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

        topic_sql = self._topic_condition("ma.detectedTopics", topic, params)
        if topic_sql:
            conditions.append(f"""
                {message_alias}.id_webchat_messageLogs IN (
                    SELECT ma.messageId FROM WebChat_MessageAnalytics ma 
                    WHERE 1=1 
                      AND {topic_sql}
                )
            """)

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

    def _get_topic_scoped_conversation_summary(
        self,
        start_date=None,
        end_date=None,
        channel=None,
        conversation_status=None,
        topic=None,
        ai_status=None,
    ):
        conn = get_db_connection()
        try:
            topic_scope_cte, params = self._analytics_topic_scope_cte(
                "topic_scope",
                "topic_a",
                start_date,
                end_date,
                channel,
                topic,
                ai_status,
            )
            status_filter = self._status_filter_value(conversation_status)
            classified_where = "WHERE status = %s" if status_filter else ""
            if status_filter:
                params.append(status_filter)

            conversation_source_case = self._source_key_case_expr("c.Source")

            query = f"""
                WITH {topic_scope_cte},
                classified AS (
                  SELECT
                    {conversation_source_case} AS source_key,
                    CAST(c.CustomerId AS NVARCHAR(255)) AS customer_id,
                    {self._conversation_status_case('c', 's')} AS status,
                    CASE
                      WHEN c.LastHostMessageAt IS NOT NULL
                       AND c.LastCustomerMessageAt IS NOT NULL
                       AND c.LastHostMessageAt >= c.LastCustomerMessageAt
                      THEN DATEDIFF(MINUTE, c.LastCustomerMessageAt, c.LastHostMessageAt)
                      ELSE NULL
                    END AS response_minutes
                  FROM WebChat_Conversations c
                  INNER JOIN topic_scope t
                    ON t.customer_id = CAST(c.CustomerId AS NVARCHAR(255))
                   AND t.source_key = {conversation_source_case}
                  OUTER APPLY (
                    SELECT TOP 1
                      status_meta.NoResponseNeeded,
                      status_meta.MarkedAt
                    FROM WebChat_ConversationStatus status_meta
                    WHERE CAST(status_meta.CustomerId AS NVARCHAR(255)) = CAST(c.CustomerId AS NVARCHAR(255))
                      AND {self._normalized_source_expr('status_meta.Source')} = {self._normalized_source_expr('c.Source')}
                    ORDER BY CASE WHEN status_meta.MarkedAt IS NULL THEN 0 ELSE 1 END DESC, status_meta.MarkedAt DESC
                  ) s
                  WHERE {valid_conversation_condition("c")}
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

    def get_conversation_summary(self, start_date=None, end_date=None, channel=None, conversation_status=None, topic=None, ai_status=None):
        if topic and str(topic).strip() != "Tất cả":
            return self._get_topic_scoped_conversation_summary(
                start_date,
                end_date,
                channel,
                conversation_status,
                topic,
                ai_status,
            )

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
        return self._get_analytics_ai_daily_stats(
            start_date,
            end_date,
            channel,
            conversation_status,
            topic,
            ai_status,
        )
        if topic and str(topic).strip() != "Tất cả":
            return self._get_topic_scoped_ai_daily_stats(
                start_date,
                end_date,
                channel,
                conversation_status,
                topic,
                ai_status,
            )

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
                  WHERE a.issueFlag = 1 AND ISNULL(a.issueResolved, 0) = 0 AND a.issueType IN (N'Không tìm thấy dữ liệu', N'AI không chắc chắn')
                ),
                flagged AS (
                  SELECT
                    s.message_id,
                    s.date_str,
                    s.keyword_no_data,
                    s.keyword_uncertain,
                    MAX(CASE WHEN direct_issue.issue_type = N'Không tìm thấy dữ liệu' THEN 1 ELSE 0 END) AS analytics_no_data,
                    MAX(CASE WHEN direct_issue.issue_type IN (N'AI không chắc chắn', N'AI có nguy cơ tự tạo thông tin') THEN 1 ELSE 0 END) AS analytics_uncertain
                  FROM scoped s
                  LEFT JOIN analytics_issues direct_issue
                    ON direct_issue.message_id = s.message_id
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
                cursor.execute(self._escape_pymssql_literal_percent(query), tuple(params))
                return cursor.fetchall()
        finally:
            conn.close()

    def get_daily_conversation_summary(self, start_date=None, end_date=None, channel=None, conversation_status=None, topic=None, ai_status=None):
        if topic and str(topic).strip() != "Tất cả":
            return self._get_topic_scoped_daily_conversation_summary(
                start_date,
                end_date,
                channel,
                conversation_status,
                topic,
                ai_status,
            )

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
                cursor.execute(self._escape_pymssql_literal_percent(query), tuple(params))
                return cursor.fetchall()
        finally:
            conn.close()

    def _get_topic_scoped_ai_daily_stats(
        self,
        start_date=None,
        end_date=None,
        channel=None,
        conversation_status=None,
        topic=None,
        ai_status=None,
    ):
        return self._get_analytics_ai_daily_stats(
            start_date,
            end_date,
            channel,
            conversation_status,
            topic,
            ai_status,
        )
        conn = get_db_connection()
        try:
            topic_scope_cte, topic_params = self._analytics_topic_scope_cte(
                "topic_scope",
                "topic_a",
                start_date,
                end_date,
                channel,
                topic,
                None,
            )
            conditions = [
                "m.FromHost = 1",
                "m.HostDisplayName = 'AI Assistant'",
            ]
            message_params = []
            self._append_message_scope_filters(
                conditions,
                message_params,
                start_date,
                end_date,
                channel,
                conversation_status,
                None,
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
                WITH {topic_scope_cte},
                scoped AS (
                  SELECT
                    m.id_webchat_messageLogs AS message_id,
                    CAST({self._message_customer_expr("m")} AS NVARCHAR(255)) AS customer_id,
                    {source_case} AS source_key,
                    m.SentAt AS sent_at,
                    CONVERT(VARCHAR(10), m.SentAt, 120) AS date_str,
                    CASE WHEN {no_data_keyword_sql} THEN 1 ELSE 0 END AS keyword_no_data,
                    CASE WHEN {uncertain_keyword_sql} THEN 1 ELSE 0 END AS keyword_uncertain
                  FROM WebChat_MessageLogs m
                  INNER JOIN topic_scope t
                    ON t.customer_id = CAST({self._message_customer_expr("m")} AS NVARCHAR(255))
                   AND t.source_key = {source_case}
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
                  WHERE a.issueFlag = 1 AND ISNULL(a.issueResolved, 0) = 0 AND a.issueType IN (N'Không tìm thấy dữ liệu', N'AI không chắc chắn')
                ),
                flagged AS (
                  SELECT
                    s.message_id,
                    s.date_str,
                    s.keyword_no_data,
                    s.keyword_uncertain,
                    MAX(CASE WHEN direct_issue.issue_type = N'Không tìm thấy dữ liệu' THEN 1 ELSE 0 END) AS analytics_no_data,
                    MAX(CASE WHEN direct_issue.issue_type IN (N'AI không chắc chắn', N'AI có nguy cơ tự tạo thông tin') THEN 1 ELSE 0 END) AS analytics_uncertain
                  FROM scoped s
                  LEFT JOIN analytics_issues direct_issue
                    ON direct_issue.message_id = s.message_id
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
                cursor.execute(self._escape_pymssql_literal_percent(query), tuple(topic_params + message_params))
                return cursor.fetchall()
        finally:
            conn.close()

    def _get_topic_scoped_daily_conversation_summary(
        self,
        start_date=None,
        end_date=None,
        channel=None,
        conversation_status=None,
        topic=None,
        ai_status=None,
    ):
        conn = get_db_connection()
        try:
            topic_scope_cte, topic_params = self._analytics_topic_scope_cte(
                "topic_scope",
                "topic_a",
                start_date,
                end_date,
                channel,
                topic,
                ai_status,
            )

            message_conditions = []
            message_params = []
            self._append_message_scope_filters(
                message_conditions,
                message_params,
                start_date,
                end_date,
                channel,
                None,
                None,
                None,
                "m",
            )
            message_conditions.extend([
                "m.Source IS NOT NULL",
                """(
                    (m.FromHost = 1 AND m.ReceiverId IS NOT NULL)
                    OR (m.FromHost = 0 AND m.SenderId IS NOT NULL)
                )""",
            ])

            where_sql = "WHERE " + " AND ".join(message_conditions) if message_conditions else ""
            status_filter = self._status_filter_value(conversation_status)
            filtered_where = "WHERE status = %s" if status_filter else ""
            if status_filter:
                message_params.append(status_filter)

            source_case = self._source_key_case_expr("m.Source")
            status_source_case = self._source_key_case_expr("status_meta.Source")

            query = f"""
                WITH {topic_scope_cte},
                scoped_messages AS (
                  SELECT
                    CONVERT(VARCHAR(10), m.SentAt, 120) AS date_str,
                    CAST(CASE WHEN m.FromHost = 1 THEN m.ReceiverId ELSE m.SenderId END AS NVARCHAR(255)) AS customer_id,
                    {source_case} AS source_key,
                    m.FromHost,
                    m.SentAt
                  FROM WebChat_MessageLogs m
                  INNER JOIN topic_scope t
                    ON t.customer_id = CAST({self._message_customer_expr("m")} AS NVARCHAR(255))
                   AND t.source_key = {source_case}
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
                cursor.execute(query, tuple(topic_params + message_params))
                return cursor.fetchall()
        finally:
            conn.close()

    def get_priority_conversations_data(self, start_date=None, end_date=None, channel=None, conversation_status=None, topic=None, ai_status=None, limit=10):
        conn = get_db_connection()
        try:
            try:
                limit_value = int(limit or 10)
            except (TypeError, ValueError):
                limit_value = 10
            limit_value = max(1, min(limit_value, 50))

            conditions = [
                valid_conversation_condition("c"),
                "c.LastCustomerMessageAt IS NOT NULL",
            ]
            params = []
            self._append_date_and_channel_filters(
                conditions,
                params,
                "c.LastCustomerMessageAt",
                "c.Source",
                start_date,
                end_date,
                channel,
            )

            status_filter = self._status_filter_value(conversation_status)
            if status_filter:
                conditions.append(f"{self._conversation_status_case('c', 's')} = %s")
                params.append(status_filter)
            else:
                conditions.append(f"{self._conversation_status_case('c', 's')} = 'pending'")

            ai_sql = self._ai_status_condition(ai_status, "ai_msg")
            if ai_sql:
                exists_conditions = [
                    f"{self._normalized_source_expr('ai_msg.Source')} = {self._normalized_source_expr('c.Source')}",
                    "CAST(ai_msg.ReceiverId AS NVARCHAR(255)) = CAST(c.CustomerId AS NVARCHAR(255))",
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

            topic_cte = ""
            topic_join = ""
            topic_params = []
            if topic and str(topic).strip() != "Tất cả":
                topic_cte_body, topic_params = self._analytics_topic_scope_cte(
                    "TopicMatches",
                    "topic_a",
                    start_date,
                    end_date,
                    channel,
                    topic,
                    None,
                )
                topic_cte = f"WITH {topic_cte_body}"
                topic_join = f"""
                    INNER JOIN TopicMatches topic_match
                      ON topic_match.customer_id = CAST(c.CustomerId AS NVARCHAR(255))
                     AND topic_match.source_key = {self._source_key_case_expr('c.Source')}
                """

            query = f"""
                {topic_cte}
                SELECT TOP ({limit_value})
                  c.Id AS id,
                  c.CustomerId AS customer_id,
                  customerInfo.customer_name,
                  CAST(NULL AS NVARCHAR(50)) AS phone_number,
                  c.Source AS source,
                  {self._conversation_status_case('c', 's')} AS status,
                  DATEDIFF(MINUTE, c.LastCustomerMessageAt, GETDATE()) AS wait_mins
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
                {topic_join}
                OUTER APPLY (
                  SELECT MAX(NULLIF(LTRIM(RTRIM(u.DisplayName)), N'')) AS customer_name
                  FROM WebChat_Messagelogs_User_Info u
                  WHERE CAST(u.SenderId AS NVARCHAR(255)) = CAST(c.CustomerId AS NVARCHAR(255))
                    AND {self._normalized_source_expr('u.Source')} = {self._normalized_source_expr('c.Source')}
                ) customerInfo
                OUTER APPLY (
                  SELECT TOP 1 customer_msg.TextContent
                  FROM WebChat_MessageLogs customer_msg
                  WHERE customer_msg.FromHost = 0
                    AND {valid_message_condition("customer_msg")}
                    AND customer_msg.TextContent IS NOT NULL
                    AND CAST(customer_msg.SenderId AS NVARCHAR(255)) = CAST(c.CustomerId AS NVARCHAR(255))
                    AND {self._normalized_source_expr('customer_msg.Source')} = {self._normalized_source_expr('c.Source')}
                  ORDER BY customer_msg.SentAt DESC
                ) latestCustomer
                WHERE {" AND ".join(conditions)}
                  AND latestCustomer.TextContent IS NOT NULL
                ORDER BY c.LastCustomerMessageAt ASC
            """

            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(self._escape_pymssql_literal_percent(query), tuple(topic_params + params))
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
        return self._get_analytics_channel_ai_summary(
            start_date,
            end_date,
            channel,
            conversation_status,
            topic,
            ai_status,
        )

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
                  WHERE a.issueFlag = 1 AND ISNULL(a.issueResolved, 0) = 0 AND a.issueType IN (N'Không tìm thấy dữ liệu', N'AI không chắc chắn')
                ),
                flagged AS (
                  SELECT
                    s.message_id,
                    s.source,
                    s.keyword_no_data,
                    s.keyword_uncertain,
                    MAX(CASE WHEN direct_issue.issue_type = N'Không tìm thấy dữ liệu' THEN 1 ELSE 0 END) AS analytics_no_data,
                    MAX(CASE WHEN direct_issue.issue_type IN (N'AI không chắc chắn', N'AI có nguy cơ tự tạo thông tin') THEN 1 ELSE 0 END) AS analytics_uncertain
                  FROM scoped s
                  LEFT JOIN analytics_issues direct_issue
                    ON direct_issue.message_id = s.message_id
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
        return self._get_analytics_channel_topic_stats(
            start_date,
            end_date,
            channel,
            conversation_status,
            topic,
            ai_status,
        )

        ai_status_filter = None if ai_status == "Tất cả" else ai_status
        if ai_status_filter == "AI trả lời thành công":
            return []

        conn = get_db_connection()
        try:
            topic_text = "COALESCE(NULLIF(customer_msg.TextContent, ''), m.TextContent)"
            select_params = []

            def like_any_sql(column, needles):
                parts = []
                for needle in needles:
                    parts.append(f"LOWER({column}) LIKE %s")
                    select_params.append(f"%{needle}%")
                return "(" + " OR ".join(parts) + ")"

            topic_case = f"""
                CASE
                  WHEN {like_any_sql(topic_text, ["toeic"])} THEN 'TOEIC'
                  WHEN {like_any_sql(topic_text, ["mos", "microsoft office specialist"])} THEN 'MOS'
                  WHEN {like_any_sql(topic_text, [
                      "[s]át hạch",
                      "[s]at hach",
                      "cntt",
                      "công nghệ thông tin",
                      "cong nghe thong tin",
                      "ic3",
                      "thcb",
                      "thnc",
                      "tin cơ bản",
                      "tin co ban",
                      "tin học cơ bản",
                      "tin hoc co ban",
                      "tin nâng cao",
                      "tin nang cao",
                      "tin học nâng cao",
                      "tin hoc nang cao",
                  ])} THEN N'Sát hạch CNTT'
                  WHEN {like_any_sql(topic_text, [
                      "học tiếng anh",
                      "hoc tieng anh",
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
                      "khóa anh văn",
                      "khoa anh van",
                      "lớp anh văn",
                      "lop anh van",
                      "luyện tiếng anh",
                      "luyen tieng anh",
                      "tiếng anh giao tiếp",
                      "tieng anh giao tiep",
                      "giao tiếp tiếng anh",
                      "giao tiep tieng anh",
                      "luyện nghe",
                      "luyen nghe",
                      "luyện nói",
                      "luyen noi",
                      "luyện đọc",
                      "luyen doc",
                      "luyện viết",
                      "luyen viet",
                      "học phí tiếng anh",
                      "hoc phi tieng anh",
                  ])} THEN N'Học Tiếng Anh'
                  WHEN {like_any_sql(topic_text, [
                      "học tin học",
                      "hoc tin hoc",
                      "khóa tin học",
                      "khoa tin hoc",
                      "lớp tin học",
                      "lop tin hoc",
                      "tin học văn phòng",
                      "tin hoc van phong",
                      "học word",
                      "hoc word",
                      "học excel",
                      "hoc excel",
                      "học powerpoint",
                      "hoc powerpoint",
                      "microsoft office",
                      "word",
                      "excel",
                      "powerpoint",
                      "đăng ký khóa tin học",
                      "dang ky khoa tin hoc",
                      "đăng ký lớp tin học",
                      "dang ky lop tin hoc",
                      "học phí tin học",
                      "hoc phi tin hoc",
                      "đăng nhập khóa học",
                      "dang nhap khoa hoc",
                      "quên mật khẩu khóa học",
                      "quen mat khau khoa hoc",
                  ])} THEN N'Học Tin học'
                  ELSE N'Khác'
                END
            """
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

            where_sql = "WHERE " + " AND ".join(conditions)

            def message_like_any_sql(alias, needles):
                parts = []
                for needle in needles:
                    parts.append(f"{alias}.TextContent LIKE %s")
                    select_params.append(f"%{needle}%")
                return "(" + " OR ".join(parts) + ")"

            no_data_keyword_sql = message_like_any_sql("m", [
                "không tìm thấy",
                "chưa có",
                "chưa hỗ trợ",
                "không thể",
                "Trợ lý AI",
                "Không thể tiếp nhận thông tin",
                "Không thể xác nhận trực tiếp",
            ])
            uncertain_keyword_sql = message_like_any_sql("m", [
                "chưa hiểu",
                "chưa rõ",
                "không chắc chắn",
                "chưa có thông tin cụ thể",
                "độ tin cậy",
                "chưa xác nhận",
                "có vẻ như",
                "chắc là",
                "có lẽ",
                "hình như",
                "tôi đoán",
            ])
            source_case = self._source_key_case_expr("m.Source")
            analytics_source_case = self._source_key_case_expr("a.source")
            ai_filter_sql = self._ai_classified_filter_sql(ai_status_filter) or "(is_no_data = 1 OR is_uncertain = 1)"
            filtered_conditions = [ai_filter_sql]
            filtered_params = []
            if topic and topic != "Tất cả":
                topic_label = canonical_topic_label(topic, default="")
                if topic_label:
                    filtered_conditions.append("topic = %s")
                    filtered_params.append(topic_label)
            filtered_where_sql = " AND ".join(f"({condition})" for condition in filtered_conditions)

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
                  WHERE a.issueFlag = 1 AND ISNULL(a.issueResolved, 0) = 0 AND a.issueType IN (N'Không tìm thấy dữ liệu', N'AI không chắc chắn')
                ),
                flagged AS (
                  SELECT
                    s.message_id,
                    s.source,
                    s.topic,
                    s.keyword_no_data,
                    s.keyword_uncertain,
                    MAX(CASE WHEN direct_issue.issue_type = N'Không tìm thấy dữ liệu' THEN 1 ELSE 0 END) AS analytics_no_data,
                    MAX(CASE WHEN direct_issue.issue_type IN (N'AI không chắc chắn', N'AI có nguy cơ tự tạo thông tin') THEN 1 ELSE 0 END) AS analytics_uncertain
                  FROM scoped s
                  LEFT JOIN analytics_issues direct_issue
                    ON direct_issue.message_id = s.message_id
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
                  WHERE {filtered_where_sql}
                )
                SELECT
                  source,
                  topic,
                  COUNT(*) AS value
                FROM filtered
                GROUP BY source, topic
            """

            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(query, tuple(select_params + params + filtered_params))
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
                  {self._conversation_status_case('c', 's')} AS status,
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

    def _get_topic_scoped_message_counts(
        self,
        start_date=None,
        end_date=None,
        channel=None,
        conversation_status=None,
        topic=None,
        ai_status=None,
    ):
        conn = get_db_connection()
        try:
            topic_scope_cte, topic_params = self._analytics_topic_scope_cte(
                "topic_scope",
                "topic_a",
                start_date,
                end_date,
                channel,
                topic,
                ai_status,
            )

            message_conditions = []
            message_params = []
            self._append_message_scope_filters(
                message_conditions,
                message_params,
                start_date,
                end_date,
                channel,
                conversation_status,
                None,
                None,
                "m",
            )

            message_where = "WHERE " + " AND ".join(message_conditions)

            query = f"""
                WITH {topic_scope_cte}
                SELECT
                  m.Source AS source,
                  COUNT(*) AS count,
                  MIN(m.SentAt) AS min_date,
                  MAX(m.SentAt) AS max_date
                FROM WebChat_MessageLogs m
                INNER JOIN topic_scope t
                  ON t.customer_id = CAST({self._message_customer_expr("m")} AS NVARCHAR(255))
                 AND t.source_key = {self._source_key_case_expr("m.Source")}
                {message_where}
                GROUP BY m.Source
            """

            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(query, tuple(topic_params + message_params))
                return cursor.fetchall()
        finally:
            conn.close()

    def get_message_counts_filtered(self, start_date=None, end_date=None, channel=None, conversation_status=None, topic=None, ai_status=None):
        if topic and str(topic).strip() != "Tất cả":
            return self._get_topic_scoped_message_counts(
                start_date,
                end_date,
                channel,
                conversation_status,
                topic,
                ai_status,
            )

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

    def get_trends(self, start_date=None, end_date=None, channel=None, conversation_status=None, topic=None, ai_status=None):
        conn = get_db_connection()
        try:
            status_join = f"""
                  LEFT JOIN WebChat_ConversationStatus s
                    ON c.CustomerId = s.CustomerId
                   AND {self._normalized_source_expr('c.Source')} = {self._normalized_source_expr('s.Source')}
            """

            # 1. Tìm ngày lớn nhất có dữ liệu
            with conn.cursor(as_dict=True) as cursor:
                max_conditions = []
                max_params = []
                self._append_conversation_scope_filters(
                    max_conditions,
                    max_params,
                    None,
                    None,
                    channel,
                    conversation_status,
                    topic,
                    ai_status,
                    "c",
                    "s",
                )
                cursor.execute(f"""
                    SELECT MAX(c.LastCustomerMessageAt) AS max_date
                    FROM WebChat_Conversations c
                    {status_join}
                    WHERE {" AND ".join(max_conditions)}
                """, tuple(max_params))
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
                    check_conditions = []
                    check_params = []
                    self._append_conversation_scope_filters(
                        check_conditions,
                        check_params,
                        start_date,
                        end_date,
                        channel,
                        conversation_status,
                        topic,
                        ai_status,
                        "c",
                        "s",
                    )
                    check_query = f"""
                        SELECT COUNT(DISTINCT c.Id) AS count
                        FROM WebChat_Conversations c
                        {status_join}
                        WHERE {" AND ".join(check_conditions)}
                    """
                    with conn.cursor(as_dict=True) as cursor:
                        cursor.execute(check_query, tuple(check_params))
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

            scoped_start_date = prev_start.strftime('%Y-%m-%d')
            scoped_end_date = current_end.strftime('%Y-%m-%d')

            def build_conversation_where(extra_conditions=None):
                conditions = []
                params = []
                self._append_conversation_scope_filters(
                    conditions,
                    params,
                    scoped_start_date,
                    scoped_end_date,
                    channel,
                    conversation_status,
                    topic,
                    ai_status,
                    "c",
                    "s",
                )
                if extra_conditions:
                    conditions.extend(extra_conditions)
                return " AND ".join(conditions), params

            def build_message_where(extra_conditions=None):
                conditions = []
                params = []
                self._append_message_scope_filters(
                    conditions,
                    params,
                    scoped_start_date,
                    scoped_end_date,
                    channel,
                    conversation_status,
                    topic,
                    ai_status,
                    "m",
                )
                if extra_conditions:
                    conditions.extend(extra_conditions)
                return " AND ".join(conditions), params

            conv_where, conv_params = build_conversation_where()
            msg_where, msg_params = build_message_where()
            active_where, active_params = build_conversation_where([
                "(s.NoResponseNeeded IS NULL OR s.NoResponseNeeded = 0 OR c.LastCustomerMessageAt > s.MarkedAt)",
            ])
            closed_where, closed_params = build_conversation_where([
                "s.NoResponseNeeded = 1",
                "(s.MarkedAt IS NULL OR c.LastCustomerMessageAt <= s.MarkedAt)",
            ])
            ai_fail_where, ai_fail_params = build_message_where([
                "m.FromHost = 1",
                "m.HostDisplayName = 'AI Assistant'",
                self._ai_failure_condition("m"),
            ])
            
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
                  FROM WebChat_Conversations c
                  {status_join}
                  WHERE {conv_where}
                  UNION ALL
                  SELECT 'msg' AS type, SentAt AS date
                  FROM WebChat_MessageLogs m
                  WHERE {msg_where}
                  UNION ALL
                  SELECT 'active_conv' AS type, c.LastCustomerMessageAt AS date 
                  FROM WebChat_Conversations c
                  {status_join}
                  WHERE {active_where}
                  UNION ALL
                  SELECT 'closed_conv' AS type, c.LastCustomerMessageAt AS date 
                  FROM WebChat_Conversations c
                  {status_join}
                  WHERE {closed_where}
                  UNION ALL
                  SELECT 'ai_fail' AS type, SentAt AS date 
                  FROM WebChat_MessageLogs m
                  WHERE {ai_fail_where}
                ) combined
            """
            
            period_params = [
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
            ]
            params = (
                period_params
                + conv_params
                + msg_params
                + active_params
                + closed_params
                + ai_fail_params
            )
            
            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(self._escape_pymssql_literal_percent(query), tuple(params))
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

    def _execute_overtime_alerts_query(
        self,
        cursor,
        start_date=None,
        end_date=None,
        channel=None,
        conversation_status=None,
        topic=None,
        ai_status=None,
        limit=100,
    ):
        if ai_status and ai_status != "Tất cả":
            return []

        try:
            limit = int(limit or 100)
        except (TypeError, ValueError):
            limit = 100
        limit = max(1, min(limit, 200))

        conditions = [
            "c.LastCustomerMessageAt IS NOT NULL",
            "(s.NoResponseNeeded IS NULL OR s.NoResponseNeeded = 0 OR c.LastCustomerMessageAt > s.MarkedAt)",
            "c.LastMessageId > 0",
            "(c.LastHostMessageAt IS NULL OR c.LastCustomerMessageAt > c.LastHostMessageAt)",
            "DATEDIFF(MINUTE, c.LastCustomerMessageAt, @dbNow) > 600",
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
            None,
            "c",
            "s",
        )

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
              cust.TextContent AS detected_topics,
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

        cursor.execute(self._escape_pymssql_literal_percent(query), tuple(params))
        return cursor.fetchall()

    def get_overtime_alerts_data(
        self,
        start_date=None,
        end_date=None,
        channel=None,
        conversation_status=None,
        topic=None,
        ai_status=None,
        limit=100,
    ):
        conn = get_db_connection()
        try:
            with conn.cursor(as_dict=True) as cursor:
                return self._execute_overtime_alerts_query(
                    cursor,
                    start_date,
                    end_date,
                    channel,
                    conversation_status,
                    topic,
                    ai_status,
                    limit,
                )
        finally:
            conn.close()

    def get_urgent_alerts_data(
        self,
        start_date=None,
        end_date=None,
        include_overtime=True,
        include_ai=True,
        channel=None,
        conversation_status=None,
        topic=None,
        ai_status=None,
    ):
        conn = get_db_connection()
        try:
            rows = []
            with conn.cursor(as_dict=True) as cursor:
                if include_overtime:
                    rows.extend(self._execute_overtime_alerts_query(
                        cursor,
                        start_date,
                        end_date,
                        channel,
                        conversation_status,
                        topic,
                        ai_status,
                    ))

                if include_ai:
                    ai_conditions = [
                        "m.FromHost = 1",
                        "m.HostDisplayName = 'AI Assistant'",
                        "m.Source IS NOT NULL",
                        "m.TextContent IS NOT NULL",
                        "m.TextContent != ''",
                        "(c.Id IS NULL OR s.NoResponseNeeded IS NULL OR s.NoResponseNeeded = 0 OR c.LastCustomerMessageAt > s.MarkedAt)",
                    ]
                    ai_params = []
                    self._append_message_scope_filters(
                        ai_conditions,
                        ai_params,
                        start_date,
                        end_date,
                        channel,
                        conversation_status,
                        None,
                        ai_status,
                        "m",
                    )
                    topic_sql = self._topic_condition("COALESCE(cust.TextContent, m.TextContent)", topic, ai_params)
                    if topic_sql:
                        ai_conditions.append(topic_sql)

                    analytics_conditions = [
                        "a.issueFlag = 1 AND ISNULL(a.issueResolved, 0) = 0 AND a.issueType IN (N'Không tìm thấy dữ liệu', N'AI không chắc chắn')",
                        valid_analytics_condition("a"),
                    ]
                    analytics_params = []
                    if start_date:
                        analytics_conditions.append("a.messageAt >= %s")
                        analytics_params.append(start_date)
                    if end_date:
                        analytics_conditions.append("a.messageAt <= %s")
                        analytics_params.append(f"{end_date} 23:59:59.999")

                    where_sql = "WHERE " + " AND ".join(ai_conditions)
                    analytics_where_sql = "WHERE " + " AND ".join(analytics_conditions)
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
                            COALESCE(cust.TextContent, m.TextContent) AS detected_topics,
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
                          {analytics_where_sql}
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
                            s.detected_topics,
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
                            s.detected_topics,
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
                            detected_topics,
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
                          detected_topics,
                          alert_type,
                          wait_mins
                        FROM ranked
                        WHERE rn <= 100
                        ORDER BY
                          CASE WHEN alert_type = 'ai_uncertain' THEN 0 ELSE 1 END,
                          ai_sent_at DESC
                    """

                    cursor.execute(
                        self._escape_pymssql_literal_percent(ai_query),
                        tuple(ai_params + analytics_params),
                    )
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
                    WHEN has_mos = 1 THEN 'MOS'
                    WHEN has_sat_hach_cntt = 1 THEN N'Sát hạch CNTT'
                    WHEN has_hoc_tieng_anh = 1 THEN N'Học Tiếng Anh'
                    WHEN has_hoc_tin_hoc = 1 THEN N'Học Tin học'
                    ELSE N'Khác'
                  END AS topic
                FROM (
                  SELECT
                    CASE WHEN FromHost = 1 THEN ReceiverId ELSE SenderId END AS customer_id,
                    Source AS source,
                    MAX(CASE WHEN LOWER(TextContent) LIKE N'%toeic%' THEN 1 ELSE 0 END) AS has_toeic,
                    MAX(CASE WHEN LOWER(TextContent) LIKE N'%mos%' OR LOWER(TextContent) LIKE N'%microsoft office specialist%' THEN 1 ELSE 0 END) AS has_mos,
                    MAX(CASE WHEN LOWER(TextContent) LIKE N'%[s]át hạch%' OR LOWER(TextContent) LIKE N'%[s]at hach%' OR LOWER(TextContent) LIKE N'%cntt%' OR LOWER(TextContent) LIKE N'%công nghệ thông tin%' OR LOWER(TextContent) LIKE N'%cong nghe thong tin%' OR LOWER(TextContent) LIKE N'%ic3%' OR LOWER(TextContent) LIKE N'%thcb%' OR LOWER(TextContent) LIKE N'%thnc%' OR LOWER(TextContent) LIKE N'%tin cơ bản%' OR LOWER(TextContent) LIKE N'%tin co ban%' OR LOWER(TextContent) LIKE N'%tin nâng cao%' OR LOWER(TextContent) LIKE N'%tin nang cao%' THEN 1 ELSE 0 END) AS has_sat_hach_cntt,
                    MAX(CASE WHEN LOWER(TextContent) LIKE N'%học tiếng anh%' OR LOWER(TextContent) LIKE N'%hoc tieng anh%' OR LOWER(TextContent) LIKE N'%tiếng anh%' OR LOWER(TextContent) LIKE N'%tieng anh%' OR LOWER(TextContent) LIKE N'%anh văn%' OR LOWER(TextContent) LIKE N'%anh van%' OR LOWER(TextContent) LIKE N'%ngoại ngữ%' OR LOWER(TextContent) LIKE N'%ngoai ngu%' OR LOWER(TextContent) LIKE N'%vstep%' OR LOWER(TextContent) LIKE N'%b1%' OR LOWER(TextContent) LIKE N'%b2%' OR LOWER(TextContent) LIKE N'%chuẩn đầu ra%' OR LOWER(TextContent) LIKE N'%chuan dau ra%' OR LOWER(TextContent) LIKE N'%khóa anh văn%' OR LOWER(TextContent) LIKE N'%khoa anh van%' OR LOWER(TextContent) LIKE N'%lớp anh văn%' OR LOWER(TextContent) LIKE N'%lop anh van%' OR LOWER(TextContent) LIKE N'%luyện tiếng anh%' OR LOWER(TextContent) LIKE N'%luyen tieng anh%' OR LOWER(TextContent) LIKE N'%tiếng anh giao tiếp%' OR LOWER(TextContent) LIKE N'%tieng anh giao tiep%' OR LOWER(TextContent) LIKE N'%luyện nghe%' OR LOWER(TextContent) LIKE N'%luyen nghe%' OR LOWER(TextContent) LIKE N'%luyện nói%' OR LOWER(TextContent) LIKE N'%luyen noi%' OR LOWER(TextContent) LIKE N'%luyện đọc%' OR LOWER(TextContent) LIKE N'%luyen doc%' OR LOWER(TextContent) LIKE N'%luyện viết%' OR LOWER(TextContent) LIKE N'%luyen viet%' OR LOWER(TextContent) LIKE N'%học phí tiếng anh%' OR LOWER(TextContent) LIKE N'%hoc phi tieng anh%' THEN 1 ELSE 0 END) AS has_hoc_tieng_anh,
                    MAX(CASE WHEN LOWER(TextContent) LIKE N'%học tin học%' OR LOWER(TextContent) LIKE N'%hoc tin hoc%' OR LOWER(TextContent) LIKE N'%khóa tin học%' OR LOWER(TextContent) LIKE N'%khoa tin hoc%' OR LOWER(TextContent) LIKE N'%lớp tin học%' OR LOWER(TextContent) LIKE N'%lop tin hoc%' OR LOWER(TextContent) LIKE N'%tin học văn phòng%' OR LOWER(TextContent) LIKE N'%tin hoc van phong%' OR LOWER(TextContent) LIKE N'%microsoft office%' OR LOWER(TextContent) LIKE N'%word%' OR LOWER(TextContent) LIKE N'%excel%' OR LOWER(TextContent) LIKE N'%powerpoint%' OR LOWER(TextContent) LIKE N'%học word%' OR LOWER(TextContent) LIKE N'%hoc word%' OR LOWER(TextContent) LIKE N'%học excel%' OR LOWER(TextContent) LIKE N'%hoc excel%' OR LOWER(TextContent) LIKE N'%học powerpoint%' OR LOWER(TextContent) LIKE N'%hoc powerpoint%' OR LOWER(TextContent) LIKE N'%đăng ký khóa tin học%' OR LOWER(TextContent) LIKE N'%dang ky khoa tin hoc%' OR LOWER(TextContent) LIKE N'%đăng ký lớp tin học%' OR LOWER(TextContent) LIKE N'%dang ky lop tin hoc%' OR LOWER(TextContent) LIKE N'%học phí tin học%' OR LOWER(TextContent) LIKE N'%hoc phi tin hoc%' OR LOWER(TextContent) LIKE N'%đăng nhập khóa học%' OR LOWER(TextContent) LIKE N'%dang nhap khoa hoc%' OR LOWER(TextContent) LIKE N'%quên mật khẩu khóa học%' OR LOWER(TextContent) LIKE N'%quen mat khau khoa hoc%' THEN 1 ELSE 0 END) AS has_hoc_tin_hoc
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
