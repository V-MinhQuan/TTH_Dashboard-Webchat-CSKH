import os
from datetime import datetime, timedelta
import pymssql
from app.core.legacy_db import get_db_connection

class ConversationRepository:
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
            conditions.append(f"LOWER({source_column}) IN ({placeholders})")
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

    def _ai_no_data_condition(self, alias="ai"):
        return f"""(
            {alias}.TextContent LIKE N'%không tìm thấy%'
            OR {alias}.TextContent LIKE N'%chưa có%'
            OR {alias}.TextContent LIKE N'%chưa hỗ trợ%'
            OR {alias}.TextContent LIKE N'%không thể%'
            OR {alias}.TextContent LIKE N'%Trợ lý AI%'
            OR {alias}.TextContent LIKE N'%Không thể tiếp nhận thông tin%'
            OR {alias}.TextContent LIKE N'%Không thể xác nhận trực tiếp%'
        )"""

    def _ai_uncertain_condition(self, alias="ai"):
        return f"""(
            {alias}.TextContent LIKE N'%chưa hiểu%'
            OR {alias}.TextContent LIKE N'%chưa rõ%'
            OR {alias}.TextContent LIKE N'%không chắc chắn%'
            OR {alias}.TextContent LIKE N'%chưa có thông tin cụ thể%'
            OR {alias}.TextContent LIKE N'%độ tin cậy%'
            OR {alias}.TextContent LIKE N'%chưa xác nhận%'
        )"""

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
                f"topic_msg.Source = {conversation_alias}.Source",
                f"""(
                    (topic_msg.FromHost = 1 AND topic_msg.ReceiverId = {conversation_alias}.CustomerId)
                    OR (topic_msg.FromHost = 0 AND topic_msg.SenderId = {conversation_alias}.CustomerId)
                )""",
                "topic_msg.TextContent IS NOT NULL",
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
                f"ai_msg.Source = {conversation_alias}.Source",
                f"ai_msg.ReceiverId = {conversation_alias}.CustomerId",
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
                   AND status_conv.Source = status_meta.Source
                  WHERE status_conv.Source = {message_alias}.Source
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

            where_sql = "WHERE " + " AND ".join(conditions) if conditions else ""

            query = f"""
                WITH filtered AS (
                  SELECT
                    c.Id,
                    c.CustomerId,
                    c.Source,
                    c.LastCustomerMessageAt,
                    c.LastHostMessageAt,
                    CASE
                      WHEN s.NoResponseNeeded = 1 AND (s.MarkedAt IS NULL OR c.LastCustomerMessageAt <= s.MarkedAt) THEN 'closed'
                      WHEN c.LastHostMessageAt IS NULL OR c.LastCustomerMessageAt > c.LastHostMessageAt THEN 'pending'
                      ELSE 'open'
                    END AS status
                  FROM WebChat_Conversations c
                  LEFT JOIN WebChat_ConversationStatus s
                    ON c.CustomerId = s.CustomerId AND c.Source = s.Source
                  {where_sql}
                )
                SELECT
                  COUNT(*) AS total_conversations,
                  COUNT(DISTINCT CustomerId) AS new_customers,
                  SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open_count,
                  SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
                  SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed_count,
                  SUM(CASE WHEN status NOT IN ('open', 'pending', 'closed') THEN 1 ELSE 0 END) AS unknown_count,
                  SUM(CASE WHEN LOWER(Source) IN ('zalooa', 'zalo') THEN 1 ELSE 0 END) AS zalooa_count,
                  SUM(CASE WHEN LOWER(Source) IN ('zalobusiness', 'zalobiz') THEN 1 ELSE 0 END) AS zalobusiness_count,
                  SUM(CASE WHEN LOWER(Source) IN ('facebook', 'fb', 'messenger') THEN 1 ELSE 0 END) AS facebook_count,
                  SUM(CASE WHEN LOWER(Source) IN ('chatwidget', 'website', 'web') THEN 1 ELSE 0 END) AS chatwidget_count,
                  AVG(CASE
                    WHEN LastHostMessageAt IS NOT NULL AND LastCustomerMessageAt IS NOT NULL AND LastHostMessageAt >= LastCustomerMessageAt
                    THEN DATEDIFF(MINUTE, LastCustomerMessageAt, LastHostMessageAt)
                    ELSE NULL
                  END) AS avg_response_minutes
                FROM filtered
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
                    },
                    "averageResponseTimeMinutes": int(round(row.get("avg_response_minutes") or 0)),
                }
        finally:
            conn.close()

    def get_daily_conversation_summary(self, start_date=None, end_date=None, channel=None, conversation_status=None, topic=None, ai_status=None):
        conn = get_db_connection()
        try:
            conditions = []
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

            where_sql = "WHERE " + " AND ".join(conditions) if conditions else ""

            query = f"""
                WITH filtered AS (
                  SELECT
                    CONVERT(VARCHAR(10), c.LastCustomerMessageAt, 120) AS date_str,
                    CASE
                      WHEN s.NoResponseNeeded = 1 AND (s.MarkedAt IS NULL OR c.LastCustomerMessageAt <= s.MarkedAt) THEN 'closed'
                      WHEN c.LastHostMessageAt IS NULL OR c.LastCustomerMessageAt > c.LastHostMessageAt THEN 'pending'
                      ELSE 'open'
                    END AS status
                  FROM WebChat_Conversations c
                  LEFT JOIN WebChat_ConversationStatus s
                    ON c.CustomerId = s.CustomerId AND c.Source = s.Source
                  {where_sql}
                )
                SELECT
                  date_str,
                  COUNT(*) AS total,
                  SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS processed,
                  SUM(CASE WHEN status <> 'closed' THEN 1 ELSE 0 END) AS unprocessed
                FROM filtered
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

            query = f"""
                SELECT TOP {int(limit)}
                  c.Id AS id,
                  c.CustomerId AS customer_id,
                  c.Source AS source,
                  CASE
                    WHEN c.LastHostMessageAt IS NULL OR c.LastCustomerMessageAt > c.LastHostMessageAt THEN 'pending'
                    ELSE 'open'
                  END AS status,
                  DATEDIFF(MINUTE, c.LastCustomerMessageAt, GETDATE()) AS wait_mins
                FROM WebChat_Conversations c
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

    def get_ai_daily_stats(self, start_date=None, end_date=None, channel=None, conversation_status=None, topic=None, ai_status=None):
        conn = get_db_connection()
        try:
            failure_sql = self._ai_failure_condition("m")
            query = f"""
                SELECT
                  CONVERT(VARCHAR(10), m.SentAt, 120) AS date_str,
                  SUM(CASE WHEN {failure_sql} THEN 1 ELSE 0 END) AS ai_fail,
                  SUM(CASE WHEN NOT {failure_sql} THEN 1 ELSE 0 END) AS ai_ok
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
                ai_status,
                "m",
            )

            if conditions:
                query += " WHERE " + " AND ".join(conditions)

            query += " GROUP BY CONVERT(VARCHAR(10), m.SentAt, 120)"

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

            where_sql = "WHERE " + " AND ".join(conditions) if conditions else ""

            query = f"""
                WITH filtered AS (
                  SELECT
                    c.Source AS source,
                    CONVERT(VARCHAR(10), COALESCE(c.LastMessageAt, c.LastCustomerMessageAt), 120) AS date_str,
                    CASE
                      WHEN s.NoResponseNeeded = 1 AND (s.MarkedAt IS NULL OR c.LastCustomerMessageAt <= s.MarkedAt) THEN 'closed'
                      WHEN c.LastHostMessageAt IS NULL OR c.LastCustomerMessageAt > c.LastHostMessageAt THEN 'pending'
                      ELSE 'open'
                    END AS status,
                    CASE
                      WHEN c.LastHostMessageAt IS NOT NULL AND c.LastCustomerMessageAt IS NOT NULL AND c.LastHostMessageAt >= c.LastCustomerMessageAt
                      THEN DATEDIFF(MINUTE, c.LastCustomerMessageAt, c.LastHostMessageAt)
                      ELSE NULL
                    END AS response_minutes
                  FROM WebChat_Conversations c
                  LEFT JOIN WebChat_ConversationStatus s
                    ON c.CustomerId = s.CustomerId AND c.Source = s.Source
                  {where_sql}
                )
                SELECT
                  source,
                  date_str,
                  status,
                  COUNT(*) AS total,
                  AVG(response_minutes) AS avg_response_minutes
                FROM filtered
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
            failure_sql = self._ai_failure_condition("m")
            query = f"""
                SELECT
                  m.Source AS source,
                  SUM(CASE WHEN {failure_sql} THEN 1 ELSE 0 END) AS ai_fail,
                  SUM(CASE WHEN NOT {failure_sql} THEN 1 ELSE 0 END) AS ai_ok
                FROM WebChat_MessageLogs m
            """
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
                ai_status,
                "m",
            )

            query += " WHERE " + " AND ".join(conditions)
            query += " GROUP BY m.Source"

            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(query, tuple(params))
                return cursor.fetchall()
        finally:
            conn.close()

    def get_channel_topic_stats(self, start_date=None, end_date=None, channel=None, conversation_status=None, topic=None, ai_status=None):
        ai_status_filter = None if ai_status == "Tất cả" else ai_status
        if ai_status_filter == "AI trả lời thành công":
            return []
        failure_ai_statuses = (
            "AI trả lời thất bại",
            "Không tìm thấy dữ liệu",
            "AI không chắc chắn",
            "AI trả lời không chắc chắn",
        )
        scoped_ai_status = ai_status_filter if ai_status_filter in failure_ai_statuses else None

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
            query = f"""
                SELECT
                  m.Source AS source,
                  {topic_case} AS topic,
                  COUNT(*) AS value
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
            """
            conditions = [
                "m.TextContent IS NOT NULL",
                "m.TextContent != ''",
                "m.Source IS NOT NULL",
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
                scoped_ai_status,
                "m",
            )

            if not scoped_ai_status:
                conditions.extend([
                    "m.FromHost = 1",
                    "m.HostDisplayName = 'AI Assistant'",
                    self._ai_failure_condition("m"),
                ])

            topic_sql = self._topic_condition(topic_text, topic)
            if topic_sql:
                conditions.append(topic_sql)

            if conditions:
                query += " WHERE " + " AND ".join(conditions)

            query += f" GROUP BY m.Source, {topic_case}"

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
            conditions = []
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
            query = """
                SELECT COUNT(*) AS count 
                FROM WebChat_MessageLogs
                WHERE FromHost = 1 
                  AND HostDisplayName = 'AI Assistant' 
                  AND (
                    TextContent LIKE N'%chưa hiểu%' 
                    OR TextContent LIKE N'%chưa rõ%' 
                    OR TextContent LIKE N'%không tìm thấy%' 
                    OR TextContent LIKE N'%chưa có%'
                    OR TextContent LIKE N'%Trợ lý AI%'
                    OR TextContent LIKE N'%Không thể tiếp nhận thông tin%'
                    OR TextContent LIKE N'%Không thể xác nhận trực tiếp%'
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
                cursor.execute("SELECT MAX(LastCustomerMessageAt) AS max_date FROM WebChat_Conversations")
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
                    check_query = """
                        SELECT COUNT(*) AS count 
                        FROM WebChat_Conversations 
                        WHERE LastCustomerMessageAt >= %s AND LastCustomerMessageAt <= %s
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
            
            query = """
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
                  SELECT 'conv' AS type, LastCustomerMessageAt AS date FROM WebChat_Conversations WHERE LastCustomerMessageAt >= %s AND LastCustomerMessageAt <= %s
                  UNION ALL
                  SELECT 'msg' AS type, SentAt AS date FROM WebChat_MessageLogs WHERE SentAt >= %s AND SentAt <= %s
                  UNION ALL
                  SELECT 'active_conv' AS type, c.LastCustomerMessageAt AS date 
                  FROM WebChat_Conversations c
                  LEFT JOIN WebChat_ConversationStatus s ON c.CustomerId = s.CustomerId AND c.Source = s.Source
                  WHERE (s.NoResponseNeeded IS NULL OR s.NoResponseNeeded = 0 OR c.LastCustomerMessageAt > s.MarkedAt) AND c.LastCustomerMessageAt >= %s AND c.LastCustomerMessageAt <= %s
                  UNION ALL
                  SELECT 'closed_conv' AS type, c.LastCustomerMessageAt AS date 
                  FROM WebChat_Conversations c
                  LEFT JOIN WebChat_ConversationStatus s ON c.CustomerId = s.CustomerId AND c.Source = s.Source
                  WHERE s.NoResponseNeeded = 1 AND (s.MarkedAt IS NULL OR c.LastCustomerMessageAt <= s.MarkedAt) AND c.LastCustomerMessageAt >= %s AND c.LastCustomerMessageAt <= %s
                  UNION ALL
                  SELECT 'ai_fail' AS type, SentAt AS date 
                  FROM WebChat_MessageLogs
                  WHERE FromHost = 1 
                    AND HostDisplayName = 'AI Assistant' 
                    AND (
                      TextContent LIKE N'%chưa hiểu%' 
                      OR TextContent LIKE N'%chưa rõ%' 
                      OR TextContent LIKE N'%không tìm thấy%' 
                      OR TextContent LIKE N'%chưa có%'
                      OR TextContent LIKE N'%Trợ lý AI%'
                      OR TextContent LIKE N'%Không thể tiếp nhận thông tin%'
                      OR TextContent LIKE N'%Không thể xác nhận trực tiếp%'
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

    def get_urgent_alerts_data(self, start_date=None, end_date=None):
        conn = get_db_connection()
        try:
            # Query dùng CTE giống Express backend
            query = """
                DECLARE @dbNow DATETIME;
                SET @dbNow = GETDATE();

                WITH LatestAI AS (
                  SELECT ReceiverId, Source, TextContent,
                         ROW_NUMBER() OVER (PARTITION BY ReceiverId, Source ORDER BY SentAt DESC) as rn
                  FROM WebChat_MessageLogs
                  WHERE FromHost = 1 AND HostDisplayName = 'AI Assistant'
                ),
                LatestCust AS (
                  SELECT SenderId, Source, TextContent,
                         ROW_NUMBER() OVER (PARTITION BY SenderId, Source ORDER BY SentAt DESC) as rn
                  FROM WebChat_MessageLogs
                  WHERE FromHost = 0
                )
                SELECT TOP 100
                  c.Id AS id,
                  c.CustomerId AS customer_id,
                  c.Source AS source,
                  c.LastCustomerMessageAt AS last_customer_msg_at,
                  c.LastHostMessageAt AS last_host_msg_at,
                  u.DisplayName AS customer_name,
                  cust.TextContent AS last_cust_text,
                  ai.TextContent AS last_ai_text,
                  CASE 
                    WHEN (c.LastHostMessageAt IS NULL OR c.LastCustomerMessageAt > c.LastHostMessageAt) 
                         AND DATEDIFF(MINUTE, c.LastCustomerMessageAt, @dbNow) > 600 
                         THEN 'overtime'
                         
                    WHEN ai.TextContent LIKE N'%không tìm thấy%' OR ai.TextContent LIKE N'%chưa hiểu%' 
                         OR ai.TextContent LIKE N'%chưa có%' OR ai.TextContent LIKE N'%không thể%' 
                         OR ai.TextContent LIKE N'%chưa hỗ trợ%' 
                         OR ai.TextContent LIKE N'%Trợ lý AI%'
                         OR ai.TextContent LIKE N'%Không thể tiếp nhận thông tin%'
                         OR ai.TextContent LIKE N'%Không thể xác nhận trực tiếp%'
                         THEN 'ai_no_data'
                         
                    WHEN ai.TextContent LIKE N'%chắc chắn%' OR ai.TextContent LIKE N'%chưa có thông tin cụ thể%' 
                         OR ai.TextContent LIKE N'%chưa rõ%' OR ai.TextContent LIKE N'%độ tin cậy%' 
                         OR ai.TextContent LIKE N'%chưa xác nhận%' 
                         THEN 'ai_uncertain'
                         
                    ELSE 'none'
                  END AS alert_type,
                  DATEDIFF(MINUTE, c.LastCustomerMessageAt, @dbNow) AS wait_mins
                FROM WebChat_Conversations c
                LEFT JOIN WebChat_Messagelogs_User_Info u ON c.CustomerId = u.SenderId AND c.Source = u.Source
                LEFT JOIN WebChat_ConversationStatus s ON c.CustomerId = s.CustomerId AND c.Source = s.Source
                LEFT JOIN LatestCust cust ON c.CustomerId = cust.SenderId AND c.Source = cust.Source AND cust.rn = 1
                LEFT JOIN LatestAI ai ON c.CustomerId = ai.ReceiverId AND c.Source = ai.Source AND ai.rn = 1
            """
            conditions = [
                "(s.NoResponseNeeded IS NULL OR s.NoResponseNeeded = 0 OR c.LastCustomerMessageAt > s.MarkedAt)",
                "c.LastMessageId > 0",
                """(
                  ((c.LastHostMessageAt IS NULL OR c.LastCustomerMessageAt > c.LastHostMessageAt) 
                       AND DATEDIFF(MINUTE, c.LastCustomerMessageAt, @dbNow) > 600)
                  OR (ai.TextContent LIKE N'%không tìm thấy%' OR ai.TextContent LIKE N'%chưa hiểu%' 
                       OR ai.TextContent LIKE N'%chưa có%' OR ai.TextContent LIKE N'%không thể%' 
                       OR ai.TextContent LIKE N'%chưa hỗ trợ%'
                       OR ai.TextContent LIKE N'%Trợ lý AI%'
                       OR ai.TextContent LIKE N'%Không thể tiếp nhận thông tin%'
                       OR ai.TextContent LIKE N'%Không thể xác nhận trực tiếp%')
                  OR (ai.TextContent LIKE N'%chắc chắn%' OR ai.TextContent LIKE N'%chưa có thông tin cụ thể%' 
                       OR ai.TextContent LIKE N'%chưa rõ%' OR ai.TextContent LIKE N'%độ tin cậy%' 
                       OR ai.TextContent LIKE N'%chưa xác nhận%')
                )"""
            ]
            params = []
            
            if start_date:
                conditions.append("c.LastCustomerMessageAt >= %s")
                params.append(start_date)
                
            if end_date:
                conditions.append("c.LastCustomerMessageAt <= %s")
                params.append(f"{end_date} 23:59:59.999")
                
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
                
            query += """
                ORDER BY
                  CASE
                    WHEN (c.LastHostMessageAt IS NULL OR c.LastCustomerMessageAt > c.LastHostMessageAt)
                         AND DATEDIFF(MINUTE, c.LastCustomerMessageAt, @dbNow) > 600
                    THEN 0 ELSE 1
                  END,
                  c.LastCustomerMessageAt DESC
            """
            
            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(query, tuple(params))
                return cursor.fetchall()
        finally:
            conn.close()

    def get_top_questions_data(self, start_date=None, end_date=None):
        conn = get_db_connection()
        try:
            query = """
                SELECT TOP 20
                  TextContent AS question,
                  COUNT(*) AS count,
                  MAX(Source) AS source,
                  MAX(SentAt) AS last_sent
                FROM WebChat_MessageLogs
            """
            conditions = [
                "FromHost = 0",
                "(TextContent LIKE N'%?%' OR TextContent LIKE N'%phải không ạ%' OR TextContent LIKE N'%đúng không ạ%')",
                "LEN(TextContent) > 20",
                "TextContent NOT LIKE N'%http%'"
            ]
            params = []
            
            if start_date:
                conditions.append("SentAt >= %s")
                params.append(start_date)
                
            if end_date:
                conditions.append("SentAt <= %s")
                params.append(f"{end_date} 23:59:59.999")
                
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
                
            query += " GROUP BY TextContent ORDER BY count DESC"
            
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
            check_query = "SELECT COUNT(*) AS count FROM WebChat_ConversationStatus WHERE CustomerId = %s AND Source = %s"
            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(check_query, (customer_id, source))
                row = cursor.fetchone()
                exists = row['count'] > 0 if row else False
                
                if exists:
                    update_query = """
                        UPDATE WebChat_ConversationStatus 
                        SET NoResponseNeeded = 1, MarkedAt = GETDATE(), MarkedBy = %s 
                        WHERE CustomerId = %s AND Source = %s
                    """
                    cursor.execute(update_query, (user_name, customer_id, source))
                else:
                    insert_query = """
                        INSERT INTO WebChat_ConversationStatus (CustomerId, Source, NoResponseNeeded, MarkedAt, MarkedBy)
                        VALUES (%s, %s, 1, GETDATE(), %s)
                    """
                    cursor.execute(insert_query, (customer_id, source, user_name))
            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
