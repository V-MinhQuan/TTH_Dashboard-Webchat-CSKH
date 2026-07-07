import os
from datetime import datetime, timedelta
from typing import List, Optional

from app.core.topic_taxonomy import TOPIC_LEGACY_ALIASES, TOPIC_NAME_BY_ID, canonical_topic_id, canonical_topic_label

class BaseRepository:
    def _escape_pymssql_literal_percent(self, query: str) -> str:
        """Keep literal LIKE '%' patterns from being parsed as pymssql placeholders."""
        return query.replace("%", "%%").replace("%%s", "%s")

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
            "Đang tư vấn": "open",
            "Đang tư vấn / Chờ phản hồi": "open",
            "Đang xử lý": "open",
            "Hoàn thành": "closed",
        }.get(conversation_status)

    def _conversation_status_case(self, conversation_alias="c", status_alias="s"):
        return f"""
            CASE
              WHEN {status_alias}.NoResponseNeeded = 1
                   AND ({status_alias}.MarkedAt IS NULL OR {conversation_alias}.LastCustomerMessageAt <= {status_alias}.MarkedAt)
                   THEN 'closed'
              WHEN {status_alias}.NoResponseNeeded = 1
                   AND {status_alias}.MarkedAt IS NOT NULL
                   AND {conversation_alias}.LastCustomerMessageAt > {status_alias}.MarkedAt
                   THEN 'pending'
              WHEN {conversation_alias}.LastHostMessageAt IS NULL
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

    def _topic_condition(self, text_column, topic=None, params=None):
        if not topic or topic == "Tất cả":
            return None

        def like_any(needles):
            parts = []
            for needle in needles:
                if params is not None:
                    parts.append(f"LOWER({text_column}) LIKE %s")
                    params.append(f"%{str(needle).lower()}%")
                else:
                    escaped = str(needle).lower().replace("'", "''")
                    parts.append(f"LOWER({text_column}) LIKE N'%{escaped}%'")
            return "(" + " OR ".join(parts) + ")"

        topic_id = canonical_topic_id(topic)
        if topic_id == "toeic":
            return like_any(["toeic"])
        if topic_id == "mos":
            return like_any(["mos", "microsoft office specialist"])
        if topic_id == "sat_hach_cntt":
            return like_any([
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
                "tin học cơ bản",
                "tin hoc co ban",
                "tin nâng cao",
                "tin nang cao",
                "tin học nâng cao",
                "tin hoc nang cao",
                "chứng chỉ cntt",
                "chung chi cntt",
                "nhận chứng chỉ cntt",
                "nhan chung chi cntt",
                "cấp chứng chỉ cntt",
                "cap chung chi cntt",
                "cntt cơ bản",
                "cntt co ban",
                "cntt nâng cao",
                "cntt nang cao",
                "chứng chỉ cơ bản",
                "chung chi co ban",
                "chứng chỉ nâng cao",
                "chung chi nang cao",
            ])
        if topic_id == "hoc_tieng_anh":
            return like_any([
                "tiếng anh",
                "anh văn",
                "ngoại ngữ",
                "vstep",
                "b1",
                "b2",
                "chuẩn đầu ra",
            ])
        if topic_id == "hoc_tin_hoc":
            return like_any([
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
            ])
        if topic == "Tin học":
            return like_any(["tin học", "cntt", "mos", "ic3"])
        if topic == "Chuẩn đầu ra":
            return like_any(["đầu ra", "chuẩn đầu ra"])
        if topic == "VSTEP":
            return like_any(["vstep"])
        if topic == "Tra cứu điểm":
            return like_any(["điểm", "tra cứu điểm", "xem điểm", "kết quả thi"])
        if topic == "Lịch thi":
            return like_any(["lịch thi", "ngày thi", "ca thi", "giờ thi"])
        if topic_id == "khac" or topic == "Khác":
            known_conditions = [
                self._topic_condition(text_column, TOPIC_NAME_BY_ID["sat_hach_cntt"], params),
                self._topic_condition(text_column, TOPIC_NAME_BY_ID["toeic"], params),
                self._topic_condition(text_column, TOPIC_NAME_BY_ID["mos"], params),
                self._topic_condition(text_column, TOPIC_NAME_BY_ID["hoc_tieng_anh"], params),
                self._topic_condition(text_column, TOPIC_NAME_BY_ID["hoc_tin_hoc"], params),
            ]
            return " AND ".join(f"NOT ({condition})" for condition in known_conditions if condition)
        return None

    def _topic_detected_aliases(self, topic=None):
        topic_id = canonical_topic_id(topic)
        if not topic_id:
            text = str(topic or "").strip()
            return [text] if text else []

        aliases = [
            TOPIC_NAME_BY_ID[topic_id],
            *TOPIC_LEGACY_ALIASES.get(topic_id, []),
        ]
        seen = set()
        result = []
        for alias in aliases:
            normalized = str(alias or "").strip().lower()
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            result.append(alias)
        return result

    def _detected_topics_condition(self, analytics_alias, topic=None, params=None):
        aliases = self._topic_detected_aliases(topic)
        if not aliases:
            return None

        column = f"{analytics_alias}.detectedTopics"
        parts = []
        for alias in aliases:
            if params is not None:
                parts.append(f"(LTRIM(RTRIM({column})) = %s OR {column} LIKE %s)")
                params.extend([alias, f'%"{alias}"%'])
            else:
                escaped = str(alias).replace("'", "''")
                escaped_json = escaped.replace('"', '""')
                parts.append(f"(LTRIM(RTRIM({column})) = N'{escaped}' OR {column} LIKE N'%\"{escaped_json}\"%')")
        return "(" + " OR ".join(parts) + ")"

    def _analytics_ai_status_condition(self, ai_status=None, alias="a"):
        if ai_status == "AI trả lời thành công":
            return f"(({alias}.issueFlag IS NULL OR {alias}.issueFlag = 0) AND ({alias}.issueType IS NULL OR {alias}.issueType NOT IN (N'Không tìm thấy dữ liệu', N'AI không chắc chắn', N'AI có nguy cơ tự tạo thông tin')))"
        if ai_status == "AI trả lời thất bại":
            return f"({alias}.issueFlag = 1 OR {alias}.issueType IN (N'Không tìm thấy dữ liệu', N'AI không chắc chắn', N'AI có nguy cơ tự tạo thông tin'))"
        if ai_status == "Không tìm thấy dữ liệu":
            return f"({alias}.issueFlag = 1 OR {alias}.issueFlag IS NULL OR {alias}.issueFlag = 0) AND {alias}.issueType = N'Không tìm thấy dữ liệu'"
        if ai_status in ("AI không chắc chắn", "AI trả lời không chắc chắn"):
            return f"({alias}.issueFlag = 1 OR {alias}.issueFlag IS NULL OR {alias}.issueFlag = 0) AND {alias}.issueType IN (N'AI không chắc chắn', N'AI có nguy cơ tự tạo thông tin')"
        return None

