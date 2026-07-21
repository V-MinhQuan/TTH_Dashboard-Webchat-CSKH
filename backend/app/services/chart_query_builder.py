from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Mapping, Sequence, Tuple

from app.config.chart_builder_catalog import (
    DatasetDefinition,
    FieldDefinition,
    canonical_channel_sql,
)
from app.schemas.chart_builder import (
    CustomChartRequest,
    DimensionSelection,
    FilterSelection,
    MetricSelection,
)


AGGREGATION_SQL = {
    "count": "COUNT({expression})",
    "count_distinct": "COUNT(DISTINCT {expression})",
    "sum": "SUM({expression})",
    "avg": "AVG(CAST({expression} AS float))",
    "min": "MIN({expression})",
    "max": "MAX({expression})",
}


DATE_GRAIN_SQL = {
    "day": "CONVERT(date, {expression})",
    "week": (
        "DATEADD(day, -(DATEDIFF(day, 0, {expression}) % 7), "
        "CONVERT(date, {expression}))"
    ),
    "month": "DATEFROMPARTS(YEAR({expression}), MONTH({expression}), 1)",
    "quarter": (
        "DATEFROMPARTS(YEAR({expression}), "
        "((DATEPART(quarter, {expression}) - 1) * 3) + 1, 1)"
    ),
    "year": "DATEFROMPARTS(YEAR({expression}), 1, 1)",
}

TEXT_FILTER_MAX_LENGTH = 500


@dataclass(frozen=True)
class CompiledChartQuery:
    sql: str
    params: Tuple[Any, ...]
    dataset_id: str
    dimension_aliases: Tuple[str, ...]
    metric_aliases: Tuple[str, ...]
    series_alias: str | None
    limit: int


class ChartQueryCompiler:
    def __init__(self, catalog: Mapping[str, DatasetDefinition]):
        self.catalog = catalog

    def compile(self, request: CustomChartRequest) -> CompiledChartQuery:
        dataset = self.catalog.get(request.dataset_id)
        if dataset is None:
            raise ValueError(
                f"Bộ dữ liệu '{request.dataset_id}' không hợp lệ"
            )

        selected_field_ids = {
            item.field_id for item in request.dimensions
        } | {
            item.field_id for item in request.metrics
        }
        if request.series:
            selected_field_ids.add(request.series.field_id)
        invalid_tooltip_fields = [
            field_id
            for field_id in request.tooltip_fields
            if field_id not in selected_field_ids
        ]
        if invalid_tooltip_fields:
            raise ValueError(
                "Trường chú thích khi di chuột phải nằm trong các trường đã chọn: "
                + ", ".join(invalid_tooltip_fields)
            )

        dimensions = [self._compile_dimension(dataset, item) for item in request.dimensions]
        series = self._compile_dimension(dataset, request.series, required_role="series") if request.series else None
        metrics = [self._compile_metric(dataset, item) for item in request.metrics]
        if request.chart_type.value == "scatter":
            numeric_metric_count = sum(
                1 for _, field, _ in metrics if field.data_type == "number"
            )
            if numeric_metric_count < 2:
                raise ValueError(
                    "Biểu đồ phân tán cần ít nhất hai chỉ số số"
                )

        relation_ids = set(dataset.base_relation_ids)
        for _, field, _ in [*dimensions, *metrics, *([series] if series else [])]:
            if field.relation_id:
                relation_ids.add(field.relation_id)

        scoped_root_sql, scoped_root_params, remaining_filters = (
            self._conversation_period_root(dataset, request.filters)
        )
        where_parts = list(dataset.base_conditions)
        if scoped_root_sql:
            # The period-scoped MessageLogs root already guarantees a customer
            # message/activity scope. Keeping this outer condition would drop
            # host-only activity that the Channel KPI intentionally counts.
            where_parts = [
                item for item in where_parts
                if item != "c.LastCustomerMessageAt IS NOT NULL"
            ]
        where_params: list[Any] = []
        for item in remaining_filters:
            filter_sql, filter_params, field = self._compile_filter(dataset, item)
            where_parts.append(filter_sql)
            where_params.extend(filter_params)
            if field.relation_id:
                relation_ids.add(field.relation_id)

        for expression, field, selection in dimensions:
            if selection.null_handling.value == "exclude":
                where_parts.append(f"{field.expression} IS NOT NULL")
        if series and series[2].null_handling.value == "exclude":
            where_parts.append(f"{series[1].expression} IS NOT NULL")

        joins = []
        relation_params: list[Any] = []
        staff_name_filter = self._staff_name_filter(remaining_filters)
        for relation_id in sorted(relation_ids):
            relation = dataset.relations.get(relation_id)
            if relation is None:
                raise ValueError(
                    f"Không có quan hệ dữ liệu hợp lệ '{relation_id}' "
                    f"cho bộ dữ liệu '{dataset.id}'"
                )
            relation_sql = relation.sql
            if relation_id == "customer_message_count":
                if staff_name_filter is not None:
                    relation_sql = relation_sql.replace(
                        "/*STAFF_MESSAGE_FILTER*/",
                        "AND (NULLIF(LTRIM(RTRIM(customer_message.HostDisplayName)), N'') = ? "
                        "OR (? LIKE N'% ' + NULLIF(LTRIM(RTRIM(customer_message.HostDisplayName)), N'') "
                        "AND NULLIF(LTRIM(RTRIM(customer_message.HostDisplayName)), N'') LIKE N'% %'))",
                    )
                    relation_params.extend((staff_name_filter, staff_name_filter))
                else:
                    relation_sql = relation_sql.replace("/*STAFF_MESSAGE_FILTER*/", "")
            joins.append(relation_sql)

        select_parts = [
            f"{expression} AS [{self._dimension_alias(selection)}]"
            for expression, _, selection in dimensions
        ]
        if series:
            select_parts.append(
                f"{series[0]} AS [{self._dimension_alias(series[2])}]"
            )
        select_parts.extend(
            f"{expression} AS [{self._metric_alias(selection)}]"
            for expression, _, selection in metrics
        )

        group_expressions = [item[0] for item in dimensions]
        if series:
            group_expressions.append(series[0])

        effective_limit = min(request.top_n or request.limit, request.limit, dataset.max_limit)
        output_aliases = self._output_alias_map(dimensions, metrics, series)
        order_parts = self._compile_sort(request, output_aliases, dimensions, metrics)

        sql_parts = [
            f"SELECT TOP {effective_limit}",
            "    " + ",\n    ".join(select_parts),
            f"FROM {scoped_root_sql or dataset.root_sql}",
        ]
        sql_parts.extend(joins)
        if where_parts:
            sql_parts.append("WHERE " + "\n  AND ".join(f"({item})" for item in where_parts))
        if group_expressions:
            sql_parts.append("GROUP BY " + ", ".join(group_expressions))
        sql_parts.append("ORDER BY " + ", ".join(order_parts))

        return CompiledChartQuery(
            sql="\n".join(sql_parts),
            params=tuple([*scoped_root_params, *relation_params, *where_params]),
            dataset_id=dataset.id,
            dimension_aliases=tuple(
                self._dimension_alias(selection) for _, _, selection in dimensions
            ),
            metric_aliases=tuple(
                self._metric_alias(selection) for _, _, selection in metrics
            ),
            series_alias=self._dimension_alias(series[2]) if series else None,
            limit=effective_limit,
        )

    def _conversation_period_root(
        self,
        dataset: DatasetDefinition,
        filters: Sequence[FilterSelection],
    ) -> tuple[str | None, tuple[Any, ...], list[FilterSelection]]:
        """Build the same period-scoped conversation population as Channel KPI."""
        if dataset.id != "conversations":
            return None, (), list(filters)

        period_filter = next(
            (
                item for item in filters
                if item.field_id == "activity_at"
                and item.operator.value == "between"
            ),
            None,
        )
        if period_filter is None:
            return None, (), list(filters)

        field = dataset.fields["activity_at"]
        start_value = self._coerce_value(field, period_filter.value)
        end_value = self._coerce_value(field, period_filter.value_to)
        if start_value > end_value:
            raise ValueError("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc")

        customer_expr = (
            "CAST(CASE WHEN period_message.FromHost = 1 "
            "THEN period_message.ReceiverId ELSE period_message.SenderId END "
            "AS NVARCHAR(255))"
        )
        source_expr = canonical_channel_sql("period_message")
        root_sql = f"""(
            SELECT
              CONCAT({source_expr}, N':', {customer_expr}) AS Id,
              {customer_expr} AS CustomerId,
              {source_expr} AS Source,
              MAX(period_message.SentAt) AS LastMessageAt,
              MAX(CASE WHEN period_message.FromHost = 0 THEN period_message.SentAt END) AS LastCustomerMessageAt,
              MAX(CASE WHEN period_message.FromHost = 1 THEN period_message.SentAt END) AS LastHostMessageAt
            FROM dbo.WebChat_MessageLogs period_message
            WHERE period_message.SentAt >= ?
              AND period_message.SentAt < DATEADD(day, 1, ?)
              AND {source_expr} IS NOT NULL
              AND {customer_expr} IS NOT NULL
            GROUP BY {customer_expr}, {source_expr}
        ) c"""
        remaining = [item for item in filters if item is not period_filter]
        return root_sql, (start_value, end_value), remaining

    def _compile_dimension(
        self,
        dataset: DatasetDefinition,
        selection: DimensionSelection,
        *,
        required_role: str = "dimension",
    ):
        field = self._field(dataset, selection.field_id, required_role)
        expression = field.expression
        if selection.date_grain:
            if selection.date_grain.value not in field.date_grains:
                raise ValueError(
                    f"Độ chi tiết thời gian '{selection.date_grain.value}' "
                    f"không được hỗ trợ cho trường '{field.id}'"
                )
            expression = DATE_GRAIN_SQL[selection.date_grain.value].format(
                expression=expression
            )
        if selection.null_handling.value == "label":
            if field.data_type != "string":
                raise ValueError(
                    f"Chỉ trường văn bản mới có thể gán nhãn cho giá trị rỗng: "
                    f"'{field.id}'"
                )
            expression = (
                f"COALESCE(NULLIF(LTRIM(RTRIM({field.expression})), N''), "
                "N'Không xác định')"
            )
        return expression, field, selection

    def _compile_metric(
        self,
        dataset: DatasetDefinition,
        selection: MetricSelection,
    ):
        field = self._field(dataset, selection.field_id, "metric")
        aggregation = selection.aggregation.value
        if aggregation not in field.aggregations:
            raise ValueError(
                f"Phép tổng hợp '{aggregation}' không được hỗ trợ "
                f"cho trường '{field.id}'"
            )
        expression = AGGREGATION_SQL[aggregation].format(
            expression=field.expression
        )
        return expression, field, selection

    def _compile_filter(
        self,
        dataset: DatasetDefinition,
        selection: FilterSelection,
    ) -> tuple[str, Sequence[Any], FieldDefinition]:
        field = self._field(dataset, selection.field_id, "filter")
        operator = selection.operator.value
        if operator not in field.filter_operators:
            raise ValueError(
                f"Toán tử lọc '{operator}' không được hỗ trợ "
                f"cho trường '{field.id}'"
            )

        if field.semantic_type == "staff_message_count":
            value = self._coerce_staff_name(selection.value)
            if dataset.id == "conversations":
                expression = (
                    "EXISTS (SELECT 1 FROM dbo.WebChat_MessageLogs staff_filter "
                    "WHERE staff_filter.Source = c.Source "
                    "AND staff_filter.ReceiverId = c.CustomerId "
                    "AND staff_filter.FromHost = 1 "
                    "AND (NULLIF(LTRIM(RTRIM(staff_filter.HostDisplayName)), N'') = ? "
                    "OR (? LIKE N'% ' + NULLIF(LTRIM(RTRIM(staff_filter.HostDisplayName)), N'') "
                    "AND NULLIF(LTRIM(RTRIM(staff_filter.HostDisplayName)), N'') LIKE N'% %')))"
                )
                return expression, (value, value), field
            if dataset.id == "messages":
                expression = "NULLIF(LTRIM(RTRIM(m.HostDisplayName)), N'')"
                return (
                    f"({expression} = ? OR (? LIKE N'% ' + {expression} AND {expression} LIKE N'% %'))",
                    (value, value),
                    field,
                )

        expression = field.expression
        if operator == "is_null":
            return f"{expression} IS NULL", (), field
        if operator == "is_not_null":
            return f"{expression} IS NOT NULL", (), field
        if operator in ("in", "not_in"):
            if not selection.values:
                raise ValueError(f"Bộ lọc '{operator}' cần ít nhất một giá trị")
            values = [self._coerce_value(field, value) for value in selection.values]
            placeholders = ", ".join("?" for _ in values)
            keyword = "IN" if operator == "in" else "NOT IN"
            return f"{expression} {keyword} ({placeholders})", tuple(values), field
        if operator == "between":
            if selection.value is None or selection.value_to is None:
                raise ValueError("Bộ lọc 'between' cần giá trị bắt đầu và kết thúc")
            start_value = self._coerce_value(field, selection.value)
            end_value = self._coerce_value(field, selection.value_to)
            if start_value > end_value:
                if field.data_type == "date":
                    raise ValueError(
                        "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc"
                    )
                raise ValueError(
                    "Giá trị bắt đầu phải nhỏ hơn hoặc bằng giá trị kết thúc"
                )
            if (
                field.data_type == "date"
                and isinstance(start_value, date)
                and not isinstance(start_value, datetime)
                and isinstance(end_value, date)
                and not isinstance(end_value, datetime)
            ):
                return (
                    f"{expression} >= ? AND {expression} < DATEADD(day, 1, ?)",
                    (start_value, end_value),
                    field,
                )
            return (
                f"{expression} BETWEEN ? AND ?",
                (start_value, end_value),
                field,
            )
        if operator in ("contains", "starts_with"):
            value = self._coerce_value(field, selection.value)
            if not value:
                raise ValueError(f"Bộ lọc '{operator}' cần một giá trị")
            escaped = self._escape_like(value)
            pattern = f"%{escaped}%" if operator == "contains" else f"{escaped}%"
            return f"{expression} LIKE ? ESCAPE '\\'", (pattern,), field

        operator_sql = {
            "eq": "=",
            "neq": "<>",
            "gt": ">",
            "gte": ">=",
            "lt": "<",
            "lte": "<=",
            "before": "<",
            "after": ">",
        }[operator]
        if selection.value is None:
            raise ValueError(f"Bộ lọc '{operator}' cần một giá trị")
        coerced_value = self._coerce_value(field, selection.value)
        if (
            operator == "eq"
            and field.data_type == "date"
            and isinstance(coerced_value, date)
            and not isinstance(coerced_value, datetime)
        ):
            return (
                f"{expression} >= ? AND {expression} < DATEADD(day, 1, ?)",
                (coerced_value, coerced_value),
                field,
            )
        return (
            f"{expression} {operator_sql} ?",
            (coerced_value,),
            field,
        )

    @staticmethod
    def _staff_name_filter(filters: Sequence[FilterSelection]) -> str | None:
        for item in filters:
            if item.field_id == "staff_message_count" and item.operator.value == "eq":
                return ChartQueryCompiler._coerce_staff_name(item.value)
        return None

    @staticmethod
    def _coerce_staff_name(value: Any) -> str:
        if value is None:
            raise ValueError("Bộ lọc nhân viên cần chọn một nhân viên")
        normalized = str(value).strip()
        if not normalized:
            raise ValueError("Bộ lọc nhân viên cần chọn một nhân viên")
        if len(normalized) > TEXT_FILTER_MAX_LENGTH:
            raise ValueError("Tên nhân viên vượt quá độ dài cho phép")
        if normalized.casefold() == "ai assistant":
            raise ValueError("AI Assistant không thuộc danh sách nhân viên")
        return normalized

    def _field(
        self,
        dataset: DatasetDefinition,
        field_id: str,
        required_role: str,
    ) -> FieldDefinition:
        field = dataset.fields.get(field_id)
        if field is None:
            raise ValueError(
                f"Trường '{field_id}' không thuộc bộ dữ liệu '{dataset.id}'"
            )
        if not field.available:
            raise ValueError(
                field.unavailable_reason
                or f"Trường '{field_id}' chưa được hỗ trợ"
            )
        if required_role not in field.roles:
            raise ValueError(
                f"Trường '{field_id}' không thể dùng ở vai trò '{required_role}'"
            )
        return field

    @staticmethod
    def _coerce_value(field: FieldDefinition, value: Any) -> Any:
        if field.data_type == "number":
            try:
                return Decimal(str(value))
            except (InvalidOperation, TypeError, ValueError) as exc:
                raise ValueError(
                    f"Giá trị lọc số không hợp lệ cho trường '{field.id}'"
                ) from exc
        if field.data_type == "boolean":
            if isinstance(value, bool):
                return value
            normalized = str(value).strip().lower()
            if normalized in ("true", "1", "yes"):
                return True
            if normalized in ("false", "0", "no"):
                return False
            raise ValueError(
                f"Giá trị Có/Không không hợp lệ cho trường '{field.id}'"
            )
        if field.data_type == "date":
            if isinstance(value, (date, datetime)):
                return value
            raw = str(value).strip()
            if len(raw) == 10:
                try:
                    return date.fromisoformat(raw)
                except ValueError:
                    pass
            try:
                return datetime.fromisoformat(raw.replace("Z", "+00:00"))
            except ValueError:
                try:
                    return date.fromisoformat(raw)
                except ValueError as exc:
                    raise ValueError(
                        f"Giá trị ngày không hợp lệ cho trường '{field.id}'"
                    ) from exc
        coerced = str(value)
        if len(coerced) > TEXT_FILTER_MAX_LENGTH:
            raise ValueError(
                f"Giá trị lọc văn bản quá dài cho trường '{field.id}'"
            )
        return coerced

    @staticmethod
    def _escape_like(value: str) -> str:
        return (
            value.replace("\\", "\\\\")
            .replace("%", "\\%")
            .replace("_", "\\_")
            .replace("[", "\\[")
        )

    @staticmethod
    def _dimension_alias(selection: DimensionSelection) -> str:
        return selection.alias or selection.field_id

    @staticmethod
    def _metric_alias(selection: MetricSelection) -> str:
        return selection.alias or f"{selection.aggregation.value}_{selection.field_id}"

    def _output_alias_map(self, dimensions, metrics, series):
        aliases: dict[str, str] = {}
        for _, field, selection in dimensions:
            alias = self._dimension_alias(selection)
            aliases[field.id] = alias
            aliases[alias] = alias
        if series:
            alias = self._dimension_alias(series[2])
            aliases[series[1].id] = alias
            aliases[alias] = alias
        for _, field, selection in metrics:
            alias = self._metric_alias(selection)
            aliases[field.id] = alias
            aliases[alias] = alias
        return aliases

    def _compile_sort(self, request, aliases, dimensions, metrics):
        if request.sort:
            order_parts = []
            for item in request.sort:
                alias = aliases.get(item.field_id)
                if alias is None:
                    raise ValueError(
                        f"Trường sắp xếp '{item.field_id}' phải là trường đã chọn"
                    )
                order_parts.append(f"[{alias}] {item.direction.value.upper()}")
            return order_parts
        if dimensions:
            first_expression, first_field, first_selection = dimensions[0]
            first_alias = self._dimension_alias(first_selection)
            if first_field.semantic_type == "channel":
                return [
                    "CASE "
                    f"WHEN {first_expression} = N'ZaloBusiness' THEN 1 "
                    f"WHEN {first_expression} = N'Facebook' THEN 2 "
                    f"WHEN {first_expression} = N'ZaloOA' THEN 3 "
                    f"WHEN {first_expression} = N'ChatWidget' THEN 4 "
                    "ELSE 5 END ASC"
                ]
            return [f"[{first_alias}] ASC"]
        return [f"[{self._metric_alias(metrics[0][2])}] DESC"]
