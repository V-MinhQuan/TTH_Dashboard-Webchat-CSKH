from __future__ import annotations

import json
from typing import Any, Callable, Dict, Iterable, List, Sequence, Tuple
from uuid import UUID

from app.config.chart_builder_catalog import get_dataset_catalog
from app.core.config import get_settings
from app.db.session import execute_all, execute_one, get_connection
from app.schemas.chart_builder import ChartDataRequest, SavedChartConfigCreate


SOURCE_CATALOG: Tuple[Dict[str, Any], ...] = (
    {
        "id": "sentiment_by_date",
        "name": "Cảm xúc theo ngày",
        "description": "Số lượng tin nhắn tích cực, trung tính và tiêu cực theo ngày.",
        "dimensions": [{"id": "date", "label": "Ngày", "dataType": "date"}],
        "metrics": [
            {"id": "positive_count", "label": "Tích cực", "dataType": "number"},
            {"id": "neutral_count", "label": "Trung tính", "dataType": "number"},
            {"id": "negative_count", "label": "Tiêu cực", "dataType": "number"},
        ],
        "supportedFilters": ["fromDate", "toDate", "channel", "topic"],
        "requirements": ("analytics",),
    },
    {
        "id": "sentiment_by_topic",
        "name": "Cảm xúc theo chủ đề",
        "description": "Tỷ lệ cảm xúc trên từng chủ đề được phân tích.",
        "dimensions": [{"id": "topic", "label": "Chủ đề", "dataType": "string"}],
        "metrics": [
            {"id": "positive_pct", "label": "Tích cực (%)", "dataType": "number"},
            {"id": "neutral_pct", "label": "Trung tính (%)", "dataType": "number"},
            {"id": "negative_pct", "label": "Tiêu cực (%)", "dataType": "number"},
        ],
        "supportedFilters": ["fromDate", "toDate", "channel", "topic"],
        "requirements": ("analytics", "json"),
    },
    {
        "id": "satisfaction_trend",
        "name": "Xu hướng hài lòng",
        "description": "Điểm hài lòng trung bình và số hội thoại được phân tích theo ngày.",
        "dimensions": [{"id": "date", "label": "Ngày", "dataType": "date"}],
        "metrics": [
            {"id": "avg_score", "label": "Điểm trung bình", "dataType": "number"},
            {"id": "conversation_count", "label": "Số hội thoại", "dataType": "number"},
        ],
        "supportedFilters": ["fromDate", "toDate", "channel", "topic"],
        "requirements": ("analytics",),
    },
    {
        "id": "conversation_volume",
        "name": "Lưu lượng hội thoại",
        "description": "Số hội thoại theo ngày hoặc theo kênh.",
        "dimensions": [
            {"id": "date", "label": "Ngày", "dataType": "date"},
            {"id": "channel", "label": "Kênh", "dataType": "string"},
        ],
        "metrics": [{"id": "total_conversations", "label": "Tổng hội thoại", "dataType": "number"}],
        "supportedFilters": ["fromDate", "toDate", "channel"],
        "requirements": ("conversations",),
    },
    {
        "id": "keyword_frequency",
        "name": "Tần suất từ khóa",
        "description": "Tần suất từ khóa được trích xuất từ nội dung hội thoại.",
        "dimensions": [
            {"id": "keyword", "label": "Từ khóa", "dataType": "string"},
            {"id": "sentiment", "label": "Cảm xúc", "dataType": "string"},
            {"id": "topic", "label": "Chủ đề", "dataType": "string"},
        ],
        "metrics": [{"id": "frequency", "label": "Tần suất", "dataType": "number"}],
        "supportedFilters": ["fromDate", "toDate", "channel", "topic"],
        "requirements": ("analytics", "json"),
    },
    {
        "id": "agent_performance",
        "name": "Hiệu suất nhân viên",
        "description": "Thời gian phản hồi, tỷ lệ xử lý và CSAT theo nhân viên.",
        "dimensions": [],
        "metrics": [],
        "supportedFilters": [],
        "requirements": ("agent_performance",),
    },
    {
        "id": "topic_distribution",
        "name": "Phân bố chủ đề",
        "description": "Số lượng và tỷ lệ tin nhắn theo chủ đề.",
        "dimensions": [{"id": "topic", "label": "Chủ đề", "dataType": "string"}],
        "metrics": [
            {"id": "count", "label": "Số lượng", "dataType": "number"},
            {"id": "percentage", "label": "Tỷ lệ (%)", "dataType": "number"},
        ],
        "supportedFilters": ["fromDate", "toDate", "channel", "topic"],
        "requirements": ("analytics", "json"),
    },
)


class ChartBuilderRepository:
    def __init__(
        self,
        connection_factory: Callable = get_connection,
        query_timeout_seconds: int | None = None,
    ):
        self._connection_factory = connection_factory
        self._query_timeout_seconds = (
            query_timeout_seconds
            if query_timeout_seconds is not None
            else get_settings().chart_query_timeout_seconds
        )

    def execute_custom_query(
        self,
        query: str,
        params: Sequence[Any] = (),
    ) -> List[Dict[str, Any]]:
        with self._connection_factory() as conn:
            cursor = conn.cursor()
            self._set_query_timeout(conn, cursor)
            cursor.execute(query, tuple(params))
            columns = [column[0] for column in cursor.description or []]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]

    def get_catalog_capabilities(self) -> Dict[str, set[str]]:
        object_names: set[str] = set()
        for dataset in get_dataset_catalog().values():
            object_names.update(dataset.required_objects)
            for relation in dataset.relations.values():
                object_names.update(relation.required_objects)

        ordered_names = sorted(object_names)
        placeholders = ", ".join("?" for _ in ordered_names)
        query = f"""
            SELECT
              s.name + '.' + o.name AS objectName,
              c.name AS columnName
            FROM sys.objects o
            INNER JOIN sys.schemas s ON s.schema_id = o.schema_id
            INNER JOIN sys.columns c ON c.object_id = o.object_id
            WHERE o.type IN ('U', 'V')
              AND s.name + '.' + o.name IN ({placeholders})
        """
        with self._connection_factory() as conn:
            cursor = conn.cursor()
            self._set_query_timeout(conn, cursor)
            cursor.execute(query, tuple(ordered_names))
            columns = [column[0] for column in cursor.description or []]
            rows = [dict(zip(columns, row)) for row in cursor.fetchall()]

        capabilities: Dict[str, set[str]] = {}
        for row in rows:
            object_name = str(row["objectName"])
            capabilities.setdefault(object_name, set()).add(str(row["columnName"]))
        return capabilities

    def _set_query_timeout(self, connection, cursor) -> None:
        try:
            cursor.timeout = self._query_timeout_seconds
        except AttributeError:
            connection.timeout = self._query_timeout_seconds

    def get_available_sources(self) -> List[Dict[str, Any]]:
        with self._connection_factory() as conn:
            schema = execute_one(
                conn,
                """
                SELECT
                  CASE WHEN OBJECT_ID(N'dbo.WebChat_MessageAnalytics', N'U') IS NOT NULL
                    AND COL_LENGTH('dbo.WebChat_MessageAnalytics', 'messageAt') IS NOT NULL
                    AND COL_LENGTH('dbo.WebChat_MessageAnalytics', 'sentimentLabel') IS NOT NULL
                    AND COL_LENGTH('dbo.WebChat_MessageAnalytics', 'detectedTopics') IS NOT NULL
                    AND COL_LENGTH('dbo.WebChat_MessageAnalytics', 'detectedKeywords') IS NOT NULL
                    AND COL_LENGTH('dbo.WebChat_MessageAnalytics', 'satisfactionScore') IS NOT NULL
                    THEN 1 ELSE 0 END AS analytics,
                  CASE WHEN OBJECT_ID(N'dbo.WebChat_MessageLogs', N'U') IS NOT NULL
                    AND COL_LENGTH('dbo.WebChat_MessageLogs', 'SentAt') IS NOT NULL
                    AND COL_LENGTH('dbo.WebChat_MessageLogs', 'Source') IS NOT NULL
                    THEN 1 ELSE 0 END AS conversations
                """,
            )

        capabilities = {
            "analytics": bool(schema.get("analytics")),
            "conversations": bool(schema.get("conversations")),
            # JSON được parse ở Python vì SQL Server hiện tại không hỗ trợ OPENJSON.
            "json": bool(schema.get("analytics")),
            "agent_performance": False,
        }
        sources: List[Dict[str, Any]] = []
        for item in SOURCE_CATALOG:
            missing = [name for name in item["requirements"] if not capabilities.get(name, False)]
            available = not missing
            reason = None
            if missing:
                reason = (
                    "Chưa xác minh được bảng/cột dữ liệu hiệu suất nhân viên."
                    if "agent_performance" in missing
                    else f"Thiếu khả năng dữ liệu bắt buộc: {', '.join(missing)}."
                )
            sources.append(
                {
                    key: value
                    for key, value in item.items()
                    if key != "requirements"
                }
                | {"available": available, "unavailableReason": reason}
            )
        return sources

    def get_chart_data(self, request: ChartDataRequest) -> List[Dict[str, Any]]:
        query, params = self._build_query(request)
        with self._connection_factory() as conn:
            rows = execute_all(conn, query, params)
        if request.source_id == "sentiment_by_topic":
            return self._aggregate_sentiment_topics(rows, request)
        if request.source_id == "keyword_frequency":
            return self._aggregate_keywords(rows, request)
        if request.source_id == "topic_distribution":
            return self._aggregate_topic_distribution(rows, request)
        return rows

    def save_chart_config(self, config: SavedChartConfigCreate) -> Dict[str, Any]:
        config_json = json.dumps(
            config.config.model_dump(by_alias=True, mode="json"),
            ensure_ascii=False,
            separators=(",", ":"),
        )
        with self._connection_factory() as conn:
            row = execute_one(
                conn,
                """
                INSERT INTO dbo.ChartConfigs (Name, Description, ConfigJson)
                OUTPUT
                  INSERTED.Id AS id,
                  INSERTED.Name AS name,
                  INSERTED.Description AS description,
                  INSERTED.ConfigJson AS configJson,
                  INSERTED.CreatedAt AS createdAt,
                  INSERTED.UpdatedAt AS updatedAt,
                  INSERTED.IsActive AS isActive
                VALUES (?, ?, ?)
                """,
                (config.name.strip(), config.description, config_json),
            )
            conn.commit()
            return row

    def get_saved_configs(self, limit: int) -> List[Dict[str, Any]]:
        with self._connection_factory() as conn:
            return execute_all(
                conn,
                f"""
                SELECT TOP {int(limit)}
                  Id AS id,
                  Name AS name,
                  Description AS description,
                  ConfigJson AS configJson,
                  CreatedAt AS createdAt,
                  UpdatedAt AS updatedAt,
                  IsActive AS isActive
                FROM dbo.ChartConfigs
                WHERE IsActive = 1
                ORDER BY UpdatedAt DESC, CreatedAt DESC
                """,
            )

    def delete_chart_config(self, config_id: UUID) -> bool:
        with self._connection_factory() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE dbo.ChartConfigs
                SET IsActive = 0, UpdatedAt = SYSUTCDATETIME()
                WHERE Id = ? AND IsActive = 1
                """,
                (str(config_id),),
            )
            changed = cursor.rowcount > 0
            conn.commit()
            return changed

    def _build_query(self, request: ChartDataRequest) -> Tuple[str, Sequence[Any]]:
        builders = {
            "sentiment_by_date": self._sentiment_by_date_query,
            "sentiment_by_topic": self._sentiment_by_topic_query,
            "satisfaction_trend": self._satisfaction_trend_query,
            "conversation_volume": self._conversation_volume_query,
            "keyword_frequency": self._keyword_frequency_query,
            "topic_distribution": self._topic_distribution_query,
        }
        builder = builders.get(request.source_id)
        if builder is None:
            raise ValueError(f"Unsupported source_id: {request.source_id}")
        return builder(request)

    def _sentiment_by_date_query(self, request: ChartDataRequest) -> Tuple[str, Sequence[Any]]:
        where, params = self._analytics_filters(request, include_topic=True)
        return (
            f"""
            SELECT
              CONVERT(varchar(10), CONVERT(date, a.messageAt), 23) AS [date],
              SUM(CASE WHEN a.sentimentLabel = 'positive' THEN 1 ELSE 0 END) AS positive_count,
              SUM(CASE WHEN a.sentimentLabel = 'neutral' THEN 1 ELSE 0 END) AS neutral_count,
              SUM(CASE WHEN a.sentimentLabel = 'negative' THEN 1 ELSE 0 END) AS negative_count
            FROM dbo.WebChat_MessageAnalytics a
            {where}
            GROUP BY CONVERT(date, a.messageAt)
            ORDER BY CONVERT(date, a.messageAt)
            """,
            params,
        )

    def _sentiment_by_topic_query(self, request: ChartDataRequest) -> Tuple[str, Sequence[Any]]:
        where, params = self._analytics_filters(request, include_topic=True)
        return (
            f"""
            SELECT a.detectedTopics, a.sentimentLabel
            FROM dbo.WebChat_MessageAnalytics a
            {self._append_conditions(where, ["a.detectedTopics IS NOT NULL", "a.detectedTopics <> '[]'"])}
            """,
            params,
        )

    def _satisfaction_trend_query(self, request: ChartDataRequest) -> Tuple[str, Sequence[Any]]:
        where, params = self._analytics_filters(request, include_topic=True)
        return (
            f"""
            SELECT
              CONVERT(varchar(10), CONVERT(date, a.messageAt), 23) AS [date],
              CAST(AVG(CAST(a.satisfactionScore AS float)) AS decimal(8,2)) AS avg_score,
              COUNT(DISTINCT a.conversationId) AS conversation_count
            FROM dbo.WebChat_MessageAnalytics a
            {self._append_conditions(where, ["a.satisfactionScore IS NOT NULL"])}
            GROUP BY CONVERT(date, a.messageAt)
            ORDER BY CONVERT(date, a.messageAt)
            """,
            params,
        )

    def _conversation_volume_query(self, request: ChartDataRequest) -> Tuple[str, Sequence[Any]]:
        where, params = self._conversation_filters(request)
        if request.group_by == "date":
            select_dimension = "CONVERT(varchar(10), CONVERT(date, m.SentAt), 23) AS [date]"
        else:
            select_dimension = "COALESCE(NULLIF(LTRIM(RTRIM(m.Source)), ''), N'Không xác định') AS channel"
        return (
            f"""
            WITH scoped AS (
              SELECT DISTINCT
                CAST(CASE WHEN m.FromHost = 1 THEN m.ReceiverId ELSE m.SenderId END AS NVARCHAR(255)) AS customer_id,
                m.Source AS source_key,
                {select_dimension}
              FROM dbo.WebChat_MessageLogs m
              {where}
            )
            SELECT {request.group_by if request.group_by == 'date' else 'channel'}, COUNT(*) AS total_conversations
            FROM scoped
            GROUP BY {request.group_by if request.group_by == 'date' else 'channel'}
            ORDER BY {request.group_by if request.group_by == 'date' else 'channel'}
            """,
            params,
        )

    def _keyword_frequency_query(self, request: ChartDataRequest) -> Tuple[str, Sequence[Any]]:
        where, params = self._analytics_filters(request, include_topic=True)
        return (
            f"""
            SELECT a.detectedKeywords, a.detectedTopics, a.sentimentLabel
            FROM dbo.WebChat_MessageAnalytics a
            {self._append_conditions(where, ["a.detectedKeywords IS NOT NULL", "a.detectedKeywords <> '[]'"])}
            """,
            params,
        )

    def _topic_distribution_query(self, request: ChartDataRequest) -> Tuple[str, Sequence[Any]]:
        where, params = self._analytics_filters(request, include_topic=True)
        return (
            f"""
            SELECT a.detectedTopics
            FROM dbo.WebChat_MessageAnalytics a
            {self._append_conditions(where, ["a.detectedTopics IS NOT NULL", "a.detectedTopics <> '[]'"])}
            """,
            params,
        )

    @staticmethod
    def _analytics_filters(
        request: ChartDataRequest,
        *,
        include_topic: bool,
    ) -> Tuple[str, Sequence[Any]]:
        conditions: List[str] = []
        params: List[Any] = []
        filters = request.filters
        if filters.from_date:
            conditions.append("a.messageAt >= ?")
            params.append(filters.from_date)
        if filters.to_date:
            conditions.append("a.messageAt < DATEADD(day, 1, ?)")
            params.append(filters.to_date)
        if filters.channel:
            conditions.append("a.source = ?")
            params.append(filters.channel)
        if include_topic and filters.topic:
            conditions.append("a.detectedTopics LIKE ?")
            params.append(f'%"{filters.topic}"%')
        return ChartBuilderRepository._where(conditions), tuple(params)

    @staticmethod
    def _conversation_filters(request: ChartDataRequest) -> Tuple[str, Sequence[Any]]:
        conditions: List[str] = []
        params: List[Any] = []
        filters = request.filters
        if filters.from_date:
            conditions.append("m.SentAt >= ?")
            params.append(filters.from_date)
        if filters.to_date:
            conditions.append("m.SentAt < DATEADD(day, 1, ?)")
            params.append(filters.to_date)
        if filters.channel:
            conditions.append("m.Source = ?")
            params.append(filters.channel)
        return ChartBuilderRepository._where(conditions), tuple(params)

    @staticmethod
    def _where(conditions: Iterable[str]) -> str:
        values = [condition for condition in conditions if condition]
        return f"WHERE {' AND '.join(values)}" if values else ""

    @staticmethod
    def _append_conditions(where: str, conditions: Iterable[str]) -> str:
        values = [condition for condition in conditions if condition]
        if not values:
            return where
        return f"{where} AND {' AND '.join(values)}" if where else ChartBuilderRepository._where(values)

    @staticmethod
    def _json_array(value: Any) -> List[str]:
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]
        if not value:
            return []
        try:
            parsed = json.loads(str(value))
        except (TypeError, ValueError, json.JSONDecodeError):
            return []
        return [str(item).strip() for item in parsed if str(item).strip()] if isinstance(parsed, list) else []

    def _aggregate_sentiment_topics(
        self,
        rows: List[Dict[str, Any]],
        request: ChartDataRequest,
    ) -> List[Dict[str, Any]]:
        stats: Dict[str, Dict[str, int]] = {}
        for row in rows:
            sentiment = str(row.get("sentimentLabel") or "neutral")
            for topic in self._json_array(row.get("detectedTopics")):
                item = stats.setdefault(topic, {"positive": 0, "neutral": 0, "negative": 0, "total": 0})
                item[sentiment if sentiment in item else "neutral"] += 1
                item["total"] += 1
        sorted_topics = sorted(stats.items(), key=lambda item: (-item[1]["total"], item[0]))
        return [
            {
                "topic": topic,
                "positive_pct": round(100 * item["positive"] / item["total"], 2),
                "neutral_pct": round(100 * item["neutral"] / item["total"], 2),
                "negative_pct": round(100 * item["negative"] / item["total"], 2),
            }
            for topic, item in sorted_topics[: request.limit]
            if item["total"]
        ]

    def _aggregate_keywords(
        self,
        rows: List[Dict[str, Any]],
        request: ChartDataRequest,
    ) -> List[Dict[str, Any]]:
        counts: Dict[str, int] = {}
        for row in rows:
            keywords = self._json_array(row.get("detectedKeywords"))
            if request.group_by == "keyword":
                values = keywords
            elif request.group_by == "sentiment":
                values = [str(row.get("sentimentLabel") or "neutral")] if keywords else []
            else:
                values = self._json_array(row.get("detectedTopics")) if keywords else []
            for value in values:
                counts[value] = counts.get(value, 0) + 1
        return [
            {request.group_by: key, "frequency": count}
            for key, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))[: request.limit]
        ]

    def _aggregate_topic_distribution(
        self,
        rows: List[Dict[str, Any]],
        request: ChartDataRequest,
    ) -> List[Dict[str, Any]]:
        counts: Dict[str, int] = {}
        for row in rows:
            for topic in self._json_array(row.get("detectedTopics")):
                counts[topic] = counts.get(topic, 0) + 1
        total = sum(counts.values())
        return [
            {
                "topic": topic,
                "count": count,
                "percentage": round(100 * count / total, 2) if total else 0,
            }
            for topic, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))[: request.limit]
        ]
