from __future__ import annotations

from dataclasses import dataclass
from types import MappingProxyType
from typing import Mapping, Tuple


STRING_FILTERS = ("eq", "neq", "in", "not_in", "contains", "starts_with", "is_null", "is_not_null")
NUMBER_FILTERS = ("eq", "neq", "gt", "gte", "lt", "lte", "between", "in", "is_null", "is_not_null")
DATE_FILTERS = ("eq", "before", "after", "between", "is_null", "is_not_null")
BOOLEAN_FILTERS = ("eq", "neq", "is_null", "is_not_null")
DATE_GRAINS = ("day", "week", "month", "quarter", "year")
NUMBER_AGGREGATIONS = ("sum", "avg", "min", "max")
COUNT_AGGREGATIONS = ("count", "count_distinct")


@dataclass(frozen=True)
class RelationDefinition:
    id: str
    label: str
    sql: str
    cardinality: str
    required_objects: Mapping[str, Tuple[str, ...]]


@dataclass(frozen=True)
class FieldDefinition:
    id: str
    label: str
    expression: str
    data_type: str
    semantic_type: str
    roles: Tuple[str, ...]
    aggregations: Tuple[str, ...] = ()
    filter_operators: Tuple[str, ...] = ()
    date_grains: Tuple[str, ...] = ()
    default_aggregation: str | None = None
    relation_id: str | None = None
    nullable: bool = True
    available: bool = True
    unavailable_reason: str | None = None


@dataclass(frozen=True)
class DatasetDefinition:
    id: str
    label: str
    description: str
    root_sql: str
    root_alias: str
    fields: Mapping[str, FieldDefinition]
    relations: Mapping[str, RelationDefinition]
    required_objects: Mapping[str, Tuple[str, ...]]
    default_date_field: str | None
    default_dimension: str
    default_metric: str
    default_limit: int = 500
    max_limit: int = 5000
    base_conditions: Tuple[str, ...] = ()
    base_relation_ids: Tuple[str, ...] = ()


def _mapping(values):
    return MappingProxyType(dict(values))


LATEST_STATUS = RelationDefinition(
    id="latest_status",
    label="Trạng thái hội thoại mới nhất",
    cardinality="many_to_zero_or_one",
    sql="""
OUTER APPLY (
    SELECT TOP 1
        s.NoResponseNeeded,
        s.MarkedAt
    FROM dbo.WebChat_ConversationStatus s
    WHERE s.CustomerId = c.CustomerId
      AND s.Source = c.Source
    ORDER BY s.MarkedAt DESC, s.Id DESC
) status_meta
""".strip(),
    required_objects=_mapping(
        {
            "dbo.WebChat_ConversationStatus": (
                "Id",
                "CustomerId",
                "Source",
                "NoResponseNeeded",
                "MarkedAt",
            )
        }
    ),
)

LATEST_AGENT = RelationDefinition(
    id="latest_agent",
    label="Nhân viên phản hồi gần nhất",
    cardinality="many_to_zero_or_one",
    sql="""
OUTER APPLY (
    SELECT TOP 1
        NULLIF(LTRIM(RTRIM(m.HostDisplayName)), N'') AS HostDisplayName,
        m.SentAt
    FROM dbo.WebChat_MessageLogs m
    WHERE m.Source = c.Source
      AND m.ReceiverId = c.CustomerId
      AND m.FromHost = 1
    ORDER BY m.SentAt DESC, m.id_webchat_messageLogs DESC
) agent
""".strip(),
    required_objects=_mapping(
        {
            "dbo.WebChat_MessageLogs": (
                "id_webchat_messageLogs",
                "Source",
                "ReceiverId",
                "FromHost",
                "HostDisplayName",
                "SentAt",
            )
        }
    ),
)


CONVERSATION_FIELDS = _mapping(
    {
        "conversation_id": FieldDefinition(
            id="conversation_id",
            label="Số lượng hội thoại",
            expression="c.Id",
            data_type="number",
            semantic_type="identifier",
            roles=("metric",),
            aggregations=COUNT_AGGREGATIONS,
            default_aggregation="count_distinct",
            nullable=False,
        ),
        "channel": FieldDefinition(
            id="channel",
            label="Kênh",
            expression="c.Source",
            data_type="string",
            semantic_type="channel",
            roles=("dimension", "filter", "series"),
            filter_operators=STRING_FILTERS,
            nullable=False,
        ),
        "last_message_at": FieldDefinition(
            id="last_message_at",
            label="Thời gian tin nhắn cuối",
            expression="c.LastMessageAt",
            data_type="date",
            semantic_type="datetime",
            roles=("dimension", "filter"),
            filter_operators=DATE_FILTERS,
            date_grains=DATE_GRAINS,
            nullable=False,
        ),
        "last_customer_message_at": FieldDefinition(
            id="last_customer_message_at",
            label="Thời gian khách gửi cuối",
            expression="c.LastCustomerMessageAt",
            data_type="date",
            semantic_type="datetime",
            roles=("dimension", "filter"),
            filter_operators=DATE_FILTERS,
            date_grains=DATE_GRAINS,
        ),
        "response_minutes": FieldDefinition(
            id="response_minutes",
            label="Thời gian phản hồi (phút)",
            expression=(
                "CASE WHEN c.LastCustomerMessageAt IS NOT NULL "
                "AND c.LastHostMessageAt >= c.LastCustomerMessageAt "
                "AND DATEDIFF(second, c.LastCustomerMessageAt, c.LastHostMessageAt) BETWEEN 0 AND 86400 "
                "THEN DATEDIFF(second, c.LastCustomerMessageAt, c.LastHostMessageAt) / 60.0 END"
            ),
            data_type="number",
            semantic_type="duration_minutes",
            roles=("metric", "filter"),
            aggregations=NUMBER_AGGREGATIONS,
            filter_operators=NUMBER_FILTERS,
            default_aggregation="avg",
        ),
        "no_response_needed": FieldDefinition(
            id="no_response_needed",
            label="Không cần phản hồi",
            expression="status_meta.NoResponseNeeded",
            data_type="boolean",
            semantic_type="status",
            roles=("dimension", "filter", "series"),
            filter_operators=BOOLEAN_FILTERS,
            relation_id="latest_status",
        ),
        "status_marked_at": FieldDefinition(
            id="status_marked_at",
            label="Thời gian cập nhật trạng thái",
            expression="status_meta.MarkedAt",
            data_type="date",
            semantic_type="datetime",
            roles=("dimension", "filter"),
            filter_operators=DATE_FILTERS,
            date_grains=DATE_GRAINS,
            relation_id="latest_status",
        ),
    }
)

MESSAGE_FIELDS = _mapping(
    {
        "message_id": FieldDefinition(
            id="message_id",
            label="Số lượng tin nhắn",
            expression="m.id_webchat_messageLogs",
            data_type="number",
            semantic_type="identifier",
            roles=("metric",),
            aggregations=COUNT_AGGREGATIONS,
            default_aggregation="count",
            nullable=False,
        ),
        "sent_at": FieldDefinition(
            id="sent_at",
            label="Thời gian gửi",
            expression="m.SentAt",
            data_type="date",
            semantic_type="datetime",
            roles=("dimension", "filter"),
            filter_operators=DATE_FILTERS,
            date_grains=DATE_GRAINS,
            nullable=False,
        ),
        "channel": FieldDefinition(
            id="channel",
            label="Kênh",
            expression="m.Source",
            data_type="string",
            semantic_type="channel",
            roles=("dimension", "filter", "series"),
            filter_operators=STRING_FILTERS,
            nullable=False,
        ),
        "sender_type": FieldDefinition(
            id="sender_type",
            label="Loại người gửi",
            expression="CASE WHEN m.FromHost = 1 THEN N'Nhân viên/AI' ELSE N'Khách hàng' END",
            data_type="string",
            semantic_type="sender_type",
            roles=("dimension", "filter", "series"),
            filter_operators=("eq", "neq", "in", "not_in"),
            nullable=False,
        ),
        "agent_name": FieldDefinition(
            id="agent_name",
            label="Nhân viên/AI",
            expression="NULLIF(LTRIM(RTRIM(m.HostDisplayName)), N'')",
            data_type="string",
            semantic_type="agent",
            roles=("dimension", "filter", "series"),
            filter_operators=STRING_FILTERS,
        ),
    }
)

ANALYTICS_FIELDS = _mapping(
    {
        "record_id": FieldDefinition(
            id="record_id",
            label="Số lượng bản ghi phân tích",
            expression="a.id",
            data_type="number",
            semantic_type="identifier",
            roles=("metric",),
            aggregations=COUNT_AGGREGATIONS,
            default_aggregation="count",
            nullable=False,
        ),
        "conversation_id": FieldDefinition(
            id="conversation_id",
            label="Số lượng hội thoại đã phân tích",
            expression="a.conversationId",
            data_type="number",
            semantic_type="identifier",
            roles=("metric",),
            aggregations=COUNT_AGGREGATIONS,
            default_aggregation="count_distinct",
        ),
        "message_at": FieldDefinition(
            id="message_at",
            label="Thời gian tin nhắn",
            expression="a.messageAt",
            data_type="date",
            semantic_type="datetime",
            roles=("dimension", "filter"),
            filter_operators=DATE_FILTERS,
            date_grains=DATE_GRAINS,
        ),
        "analyzed_at": FieldDefinition(
            id="analyzed_at",
            label="Thời gian phân tích",
            expression="a.analyzedAt",
            data_type="date",
            semantic_type="datetime",
            roles=("dimension", "filter"),
            filter_operators=DATE_FILTERS,
            date_grains=DATE_GRAINS,
            nullable=False,
        ),
        "channel": FieldDefinition(
            id="channel",
            label="Kênh",
            expression="a.source",
            data_type="string",
            semantic_type="channel",
            roles=("dimension", "filter", "series"),
            filter_operators=STRING_FILTERS,
        ),
        "sentiment": FieldDefinition(
            id="sentiment",
            label="Cảm xúc",
            expression="a.sentimentLabel",
            data_type="string",
            semantic_type="sentiment",
            roles=("dimension", "filter", "series"),
            filter_operators=STRING_FILTERS,
            nullable=False,
        ),
        "sentiment_score": FieldDefinition(
            id="sentiment_score",
            label="Điểm cảm xúc",
            expression="a.sentimentScore",
            data_type="number",
            semantic_type="score",
            roles=("metric", "filter"),
            aggregations=NUMBER_AGGREGATIONS,
            filter_operators=NUMBER_FILTERS,
            default_aggregation="avg",
            nullable=False,
        ),
        "satisfaction_score": FieldDefinition(
            id="satisfaction_score",
            label="Điểm hài lòng",
            expression="a.satisfactionScore",
            data_type="number",
            semantic_type="score",
            roles=("metric", "filter"),
            aggregations=NUMBER_AGGREGATIONS,
            filter_operators=NUMBER_FILTERS,
            default_aggregation="avg",
        ),
        "satisfaction_level": FieldDefinition(
            id="satisfaction_level",
            label="Mức hài lòng",
            expression="a.satisfactionLevel",
            data_type="string",
            semantic_type="satisfaction",
            roles=("dimension", "filter", "series"),
            filter_operators=STRING_FILTERS,
        ),
        "need_staff_review": FieldDefinition(
            id="need_staff_review",
            label="Cần nhân viên kiểm tra",
            expression="a.needStaffReview",
            data_type="boolean",
            semantic_type="review_status",
            roles=("dimension", "filter", "series"),
            filter_operators=BOOLEAN_FILTERS,
            nullable=False,
        ),
        "issue_flag": FieldDefinition(
            id="issue_flag",
            label="Có vấn đề",
            expression="a.issueFlag",
            data_type="boolean",
            semantic_type="issue_status",
            roles=("dimension", "filter", "series"),
            filter_operators=BOOLEAN_FILTERS,
        ),
        "issue_type": FieldDefinition(
            id="issue_type",
            label="Loại vấn đề",
            expression="a.issueType",
            data_type="string",
            semantic_type="issue_type",
            roles=("dimension", "filter", "series"),
            filter_operators=STRING_FILTERS,
        ),
        "issue_confidence": FieldDefinition(
            id="issue_confidence",
            label="Độ tin cậy vấn đề",
            expression="a.issueConfidence",
            data_type="number",
            semantic_type="score",
            roles=("metric", "filter"),
            aggregations=NUMBER_AGGREGATIONS,
            filter_operators=NUMBER_FILTERS,
            default_aggregation="avg",
        ),
        "analyzer_version": FieldDefinition(
            id="analyzer_version",
            label="Phiên bản bộ phân tích",
            expression="a.analyzerVersion",
            data_type="string",
            semantic_type="version",
            roles=("dimension", "filter", "series"),
            filter_operators=STRING_FILTERS,
        ),
        "topic": FieldDefinition(
            id="topic",
            label="Chủ đề",
            expression="a.detectedTopics",
            data_type="string",
            semantic_type="topic",
            roles=("dimension", "filter", "series"),
            available=False,
            unavailable_reason="Trường này chưa được hỗ trợ trong Trình tạo biểu đồ.",
        ),
        "keyword": FieldDefinition(
            id="keyword",
            label="Từ khóa",
            expression="a.detectedKeywords",
            data_type="string",
            semantic_type="keyword",
            roles=("dimension", "filter", "series"),
            available=False,
            unavailable_reason="Trường này chưa được hỗ trợ trong Trình tạo biểu đồ.",
        ),
    }
)

AGENT_FIELDS = _mapping(
    {
        "agent_name": FieldDefinition(
            id="agent_name",
            label="Nhân viên/AI",
            expression="agent.HostDisplayName",
            data_type="string",
            semantic_type="agent",
            roles=("dimension", "filter", "series"),
            filter_operators=STRING_FILTERS,
            relation_id="latest_agent",
        ),
        "channel": FieldDefinition(
            id="channel",
            label="Kênh",
            expression="c.Source",
            data_type="string",
            semantic_type="channel",
            roles=("dimension", "filter", "series"),
            filter_operators=STRING_FILTERS,
            nullable=False,
        ),
        "last_message_at": FieldDefinition(
            id="last_message_at",
            label="Thời gian hội thoại",
            expression="c.LastMessageAt",
            data_type="date",
            semantic_type="datetime",
            roles=("dimension", "filter"),
            filter_operators=DATE_FILTERS,
            date_grains=DATE_GRAINS,
            nullable=False,
        ),
        "conversation_id": FieldDefinition(
            id="conversation_id",
            label="Số lượng hội thoại",
            expression="c.Id",
            data_type="number",
            semantic_type="identifier",
            roles=("metric",),
            aggregations=COUNT_AGGREGATIONS,
            default_aggregation="count_distinct",
            nullable=False,
        ),
        "response_minutes": FieldDefinition(
            id="response_minutes",
            label="Thời gian phản hồi (phút)",
            expression=(
                "CASE WHEN c.LastCustomerMessageAt IS NOT NULL "
                "AND c.LastHostMessageAt >= c.LastCustomerMessageAt "
                "AND DATEDIFF(second, c.LastCustomerMessageAt, c.LastHostMessageAt) BETWEEN 0 AND 86400 "
                "THEN DATEDIFF(second, c.LastCustomerMessageAt, c.LastHostMessageAt) / 60.0 END"
            ),
            data_type="number",
            semantic_type="duration_minutes",
            roles=("metric", "filter"),
            aggregations=NUMBER_AGGREGATIONS,
            filter_operators=NUMBER_FILTERS,
            default_aggregation="avg",
            relation_id="latest_agent",
        ),
    }
)


DATASETS = _mapping(
    {
        "conversations": DatasetDefinition(
            id="conversations",
            label="Hội thoại",
            description="Số lượng hội thoại, kênh, trạng thái và thời gian phản hồi.",
            root_sql="dbo.WebChat_Conversations c",
            root_alias="c",
            fields=CONVERSATION_FIELDS,
            relations=_mapping({"latest_status": LATEST_STATUS}),
            required_objects=_mapping(
                {
                    "dbo.WebChat_Conversations": (
                        "Id",
                        "CustomerId",
                        "Source",
                        "LastMessageAt",
                        "LastCustomerMessageAt",
                        "LastHostMessageAt",
                    )
                }
            ),
            default_date_field="last_message_at",
            default_dimension="channel",
            default_metric="conversation_id",
        ),
        "messages": DatasetDefinition(
            id="messages",
            label="Tin nhắn",
            description="Lưu lượng tin nhắn theo thời gian, kênh, loại người gửi và nhân viên.",
            root_sql="dbo.WebChat_MessageLogs m",
            root_alias="m",
            fields=MESSAGE_FIELDS,
            relations=_mapping({}),
            required_objects=_mapping(
                {
                    "dbo.WebChat_MessageLogs": (
                        "id_webchat_messageLogs",
                        "SentAt",
                        "Source",
                        "FromHost",
                        "HostDisplayName",
                    )
                }
            ),
            default_date_field="sent_at",
            default_dimension="sent_at",
            default_metric="message_id",
        ),
        "message_analytics": DatasetDefinition(
            id="message_analytics",
            label="Phân tích tin nhắn",
            description="Cảm xúc, mức hài lòng, yêu cầu kiểm tra và vấn đề được AI phân tích.",
            root_sql="dbo.WebChat_MessageAnalytics a",
            root_alias="a",
            fields=ANALYTICS_FIELDS,
            relations=_mapping({}),
            required_objects=_mapping(
                {
                    "dbo.WebChat_MessageAnalytics": (
                        "id",
                        "conversationId",
                        "messageAt",
                        "analyzedAt",
                        "source",
                        "sentimentLabel",
                        "sentimentScore",
                        "satisfactionScore",
                        "satisfactionLevel",
                        "needStaffReview",
                        "issueFlag",
                        "issueType",
                        "issueConfidence",
                        "analyzerVersion",
                        "detectedTopics",
                        "detectedKeywords",
                    )
                }
            ),
            default_date_field="message_at",
            default_dimension="message_at",
            default_metric="record_id",
        ),
        "agent_performance": DatasetDefinition(
            id="agent_performance",
            label="Hiệu suất nhân viên",
            description="Hội thoại và thời gian phản hồi theo nhân viên/AI phản hồi gần nhất.",
            root_sql="dbo.WebChat_Conversations c",
            root_alias="c",
            fields=AGENT_FIELDS,
            relations=_mapping({"latest_agent": LATEST_AGENT}),
            required_objects=_mapping(
                {
                    "dbo.WebChat_Conversations": (
                        "Id",
                        "CustomerId",
                        "Source",
                        "LastMessageAt",
                        "LastCustomerMessageAt",
                        "LastHostMessageAt",
                    )
                }
            ),
            default_date_field="last_message_at",
            default_dimension="agent_name",
            default_metric="conversation_id",
            base_conditions=(
                "agent.HostDisplayName IS NOT NULL",
                "agent.HostDisplayName <> N'AI Assistant'",
            ),
            base_relation_ids=("latest_agent",),
        ),
    }
)


def get_dataset_catalog() -> Mapping[str, DatasetDefinition]:
    return DATASETS
