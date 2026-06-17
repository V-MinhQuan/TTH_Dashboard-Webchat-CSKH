from __future__ import annotations

import json
from datetime import datetime, timezone
from decimal import Decimal
from threading import Lock
from time import perf_counter
from time import monotonic
from typing import Any, Dict, List, Mapping
from uuid import UUID

from app.config.chart_builder_catalog import (
    COUNT_AGGREGATIONS,
    DATE_GRAINS,
    NUMBER_AGGREGATIONS,
    DatasetDefinition,
    get_dataset_catalog,
)
from app.repositories.chart_builder_repository import ChartBuilderRepository
from app.schemas.chart_builder import (
    CatalogDatasetMeta,
    CatalogFieldMeta,
    CatalogRelationMeta,
    ChartBuilderConfig,
    ChartCatalogResponse,
    ChartDataRequest,
    ChartRequest,
    CustomChartConfig,
    CustomChartRequest,
    DataSourceInfo,
    SavedChartConfig,
    SavedChartConfigCreate,
)
from app.services.chart_query_builder import ChartQueryCompiler, CompiledChartQuery


DEFAULT_COLORS = (
    "#003865",
    "#ED5206",
    "#D73C01",
    "#1565C0",
    "#228A61",
    "#F59E0B",
    "#42A5F5",
)
ALL_FILTER_OPERATORS = (
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "before",
    "after",
    "between",
    "contains",
    "starts_with",
    "in",
    "not_in",
    "is_null",
    "is_not_null",
)
CATALOG_CACHE_TTL_SECONDS = 60
_catalog_cache: Dict[
    int,
    tuple[float, datetime, Dict[str, set[str]]],
] = {}
_catalog_cache_lock = Lock()


class ChartBuilderService:
    def __init__(
        self,
        repository: ChartBuilderRepository | None = None,
        catalog: Mapping[str, DatasetDefinition] | None = None,
    ):
        self.repository = repository or ChartBuilderRepository()
        self.catalog = catalog or get_dataset_catalog()
        self.compiler = ChartQueryCompiler(self.catalog)

    def get_available_sources(self) -> List[Dict[str, Any]]:
        return [
            DataSourceInfo.model_validate(item).model_dump(by_alias=True, mode="json")
            for item in self.repository.get_available_sources()
        ]

    def get_catalog(self) -> Dict[str, Any]:
        capabilities, cached_at = self._get_cached_catalog_capabilities()
        datasets = [
            self._catalog_dataset(dataset, capabilities)
            for dataset in self.catalog.values()
        ]
        payload = ChartCatalogResponse(
            datasets=datasets,
            aggregations=[*COUNT_AGGREGATIONS, *NUMBER_AGGREGATIONS],
            dateGrains=list(DATE_GRAINS),
            filterOperators=list(ALL_FILTER_OPERATORS),
            defaultLimit=500,
            maxLimit=5000,
            cachedAt=cached_at,
        )
        return payload.model_dump(by_alias=True, mode="json")

    def _get_cached_catalog_capabilities(
        self,
    ) -> tuple[Dict[str, set[str]], datetime]:
        connection_factory = getattr(
            self.repository,
            "_connection_factory",
            self.repository,
        )
        cache_key = id(connection_factory)
        now = monotonic()
        with _catalog_cache_lock:
            cached = _catalog_cache.get(cache_key)
            if cached and now - cached[0] < CATALOG_CACHE_TTL_SECONDS:
                return (
                    {
                        name: set(columns)
                        for name, columns in cached[2].items()
                    },
                    cached[1],
                )

        capabilities = self.repository.get_catalog_capabilities()
        snapshot = {
            name: set(columns)
            for name, columns in capabilities.items()
        }
        cached_at = datetime.now(timezone.utc)
        with _catalog_cache_lock:
            _catalog_cache[cache_key] = (now, cached_at, snapshot)
        return (
            {
                name: set(columns)
                for name, columns in snapshot.items()
            },
            cached_at,
        )

    def preview_chart_data(self, request: CustomChartRequest) -> Dict[str, Any]:
        preview_limit = min(request.limit, 200)
        preview_top_n = min(request.top_n, 200) if request.top_n else None
        preview_request = request.model_copy(
            update={"limit": preview_limit, "top_n": preview_top_n}
        )
        return self._get_custom_chart_data(preview_request)

    def get_chart_data(self, request: ChartRequest) -> Dict[str, Any]:
        if isinstance(request, CustomChartRequest):
            return self._get_custom_chart_data(request)
        return self._get_predefined_chart_data(request)

    def _get_predefined_chart_data(
        self,
        request: ChartDataRequest,
    ) -> Dict[str, Any]:
        metric_by_id = self._validate_predefined_request(request)
        rows = [
            self._serialize_row(row)
            for row in self.repository.get_chart_data(request)
        ]
        series = []
        for index, y_axis in enumerate(request.y_axes):
            meta = metric_by_id[y_axis.column]
            series.append(
                {
                    "key": y_axis.column,
                    "label": y_axis.label or meta["label"],
                    "color": y_axis.color
                    or DEFAULT_COLORS[index % len(DEFAULT_COLORS)],
                    "axisGroup": y_axis.axis_group.value,
                    "seriesType": (
                        y_axis.series_type.value if y_axis.series_type else None
                    ),
                    "numberFormat": y_axis.number_format,
                }
            )
        return {
            "mode": "predefined",
            "sourceId": request.source_id,
            "rows": rows,
            "series": series,
            "dimensionKeys": [request.group_by],
            "generatedAt": datetime.now(timezone.utc).isoformat(),
        }

    def _get_custom_chart_data(
        self,
        request: CustomChartRequest,
    ) -> Dict[str, Any]:
        self._validate_tooltip_fields(request)
        compiled = self.compiler.compile(request)
        started_at = perf_counter()
        raw_rows = self.repository.execute_custom_query(
            compiled.sql,
            compiled.params,
        )
        execution_time_ms = max(0, round((perf_counter() - started_at) * 1000))
        serialized_rows = [self._serialize_row(row) for row in raw_rows]
        rows, series = self._format_custom_rows(
            request,
            compiled,
            serialized_rows,
        )
        return {
            "mode": "custom",
            "datasetId": request.dataset_id,
            "rows": rows,
            "series": series,
            "dimensionKeys": list(compiled.dimension_aliases),
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "execution": {
                "rowCount": len(rows),
                "executionTimeMs": execution_time_ms,
                "limit": compiled.limit,
                "truncated": len(raw_rows) >= compiled.limit,
            },
        }

    def _format_custom_rows(
        self,
        request: CustomChartRequest,
        compiled: CompiledChartQuery,
        rows: List[Dict[str, Any]],
    ) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        metric_selections = {
            metric.alias or f"{metric.aggregation.value}_{metric.field_id}": metric
            for metric in request.metrics
        }
        if not compiled.series_alias:
            series = []
            for index, metric_alias in enumerate(compiled.metric_aliases):
                selection = metric_selections[metric_alias]
                series.append(
                    self._series_payload(
                        metric_alias,
                        selection.label or metric_alias,
                        selection,
                        index,
                    )
                )
            return rows, series

        series_field = self.catalog[request.dataset_id].fields.get(
            request.series.field_id
        ) if request.series else None
        grouped_rows: Dict[tuple[Any, ...], Dict[str, Any]] = {}
        dynamic_series: Dict[str, Dict[str, Any]] = {}
        for row in rows:
            dimension_values = tuple(
                row.get(alias) for alias in compiled.dimension_aliases
            )
            output_row = grouped_rows.setdefault(
                dimension_values,
                {
                    alias: row.get(alias)
                    for alias in compiled.dimension_aliases
                },
            )
            raw_series_value = row.get(compiled.series_alias)
            series_key_value = self._series_display_key(raw_series_value)
            series_label_value = self._dimension_display_value(
                raw_series_value,
                series_field.data_type if series_field else None,
            )
            for metric_index, metric_alias in enumerate(compiled.metric_aliases):
                selection = metric_selections[metric_alias]
                output_key = self._series_key(metric_alias, series_key_value)
                output_row[output_key] = row.get(metric_alias)
                if output_key not in dynamic_series:
                    label = selection.label or metric_alias
                    dynamic_series[output_key] = self._series_payload(
                        output_key,
                        f"{label} - {series_label_value}",
                        selection,
                        len(dynamic_series) + metric_index,
                    )

        return list(grouped_rows.values()), list(dynamic_series.values())

    def _validate_predefined_request(
        self,
        request: ChartDataRequest,
    ) -> Dict[str, Dict[str, Any]]:
        if request.filters.from_date and request.filters.to_date:
            if request.filters.from_date > request.filters.to_date:
                raise ValueError(
                    "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc"
                )

        source = self._source_for_request(request)
        dimension_ids = {item["id"] for item in source.get("dimensions", [])}
        metric_by_id = {
            item["id"]: item for item in source.get("metrics", [])
        }
        if request.group_by not in dimension_ids:
            raise ValueError(
                f"Chiều phân tích '{request.group_by}' không được hỗ trợ "
                f"cho nguồn '{request.source_id}'"
            )
        for y_axis in request.y_axes:
            if y_axis.column not in metric_by_id:
                raise ValueError(
                    f"Chỉ số '{y_axis.column}' không được hỗ trợ "
                    f"cho nguồn '{request.source_id}'"
                )
        return metric_by_id

    def save_chart_config(
        self,
        config: SavedChartConfigCreate,
    ) -> Dict[str, Any]:
        if isinstance(config.config, CustomChartConfig):
            self._validate_tooltip_fields(config.config)
            self.compiler.compile(config.config)
        else:
            chart_request = ChartDataRequest(
                sourceId=config.config.source_id,
                chartType=config.config.chart_type,
                groupBy=config.config.group_by,
                yAxes=config.config.y_axes,
                filters=config.config.filters,
            )
            self._validate_predefined_request(chart_request)
        return self._format_saved_config(
            self.repository.save_chart_config(config)
        )

    def get_saved_configs(self, limit: int = 50) -> List[Dict[str, Any]]:
        return [
            self._format_saved_config(row)
            for row in self.repository.get_saved_configs(limit)
        ]

    def delete_chart_config(self, config_id: UUID) -> bool:
        return self.repository.delete_chart_config(config_id)

    def _source_for_request(
        self,
        request: ChartDataRequest,
    ) -> Dict[str, Any]:
        sources = self.repository.get_available_sources()
        source = next(
            (item for item in sources if item["id"] == request.source_id),
            None,
        )
        if source is None:
            raise ValueError(
                f"Nguồn dữ liệu '{request.source_id}' không hợp lệ"
            )
        if not source.get("available"):
            reason = (
                source.get("unavailableReason")
                or "Nguồn dữ liệu hiện không khả dụng."
            )
            raise ValueError(reason)
        return source

    def _catalog_dataset(
        self,
        dataset: DatasetDefinition,
        capabilities: Mapping[str, set[str]],
    ) -> CatalogDatasetMeta:
        dataset_missing = self._missing_requirements(
            dataset.required_objects,
            capabilities,
        )
        relation_meta: List[CatalogRelationMeta] = []
        relation_availability: Dict[str, bool] = {}
        for relation in dataset.relations.values():
            missing = self._missing_requirements(
                relation.required_objects,
                capabilities,
            )
            available = not missing
            relation_availability[relation.id] = available
            relation_meta.append(
                CatalogRelationMeta(
                    id=relation.id,
                    label=relation.label,
                    cardinality=relation.cardinality,
                    available=available,
                    unavailableReason=self._missing_message(missing),
                )
            )

        base_relation_missing = [
            relation_id
            for relation_id in dataset.base_relation_ids
            if not relation_availability.get(relation_id, False)
        ]
        dataset_available = not dataset_missing and not base_relation_missing
        unavailable_reason = self._missing_message(dataset_missing)
        if base_relation_missing:
            unavailable_reason = (
                "Thiếu quan hệ dữ liệu được phép: "
                + ", ".join(base_relation_missing)
            )

        fields = []
        for field in dataset.fields.values():
            relation_available = (
                not field.relation_id
                or relation_availability.get(field.relation_id, False)
            )
            available = (
                dataset_available
                and field.available
                and relation_available
            )
            reason = field.unavailable_reason
            if field.relation_id and not relation_available:
                reason = (
                    f"Quan hệ '{field.relation_id}' thiếu cột dữ liệu bắt buộc."
                )
            fields.append(
                CatalogFieldMeta(
                    id=field.id,
                    label=field.label,
                    dataType=field.data_type,
                    semanticType=field.semantic_type,
                    roles=list(field.roles),
                    aggregations=list(field.aggregations),
                    filterOperators=list(field.filter_operators),
                    dateGrains=list(field.date_grains),
                    defaultAggregation=field.default_aggregation,
                    nullable=field.nullable,
                    available=available,
                    unavailableReason=reason if not available else None,
                )
            )

        return CatalogDatasetMeta(
            id=dataset.id,
            label=dataset.label,
            description=dataset.description,
            available=dataset_available,
            unavailableReason=unavailable_reason,
            fields=fields,
            relations=relation_meta,
            defaultDateField=dataset.default_date_field,
            defaultDimension=dataset.default_dimension,
            defaultMetric=dataset.default_metric,
            defaultLimit=dataset.default_limit,
            maxLimit=dataset.max_limit,
        )

    @staticmethod
    def _missing_requirements(
        requirements: Mapping[str, tuple[str, ...]],
        capabilities: Mapping[str, set[str]],
    ) -> Dict[str, List[str]]:
        missing: Dict[str, List[str]] = {}
        for object_name, required_columns in requirements.items():
            actual_columns = capabilities.get(object_name, set())
            absent = [
                column
                for column in required_columns
                if column not in actual_columns
            ]
            if absent:
                missing[object_name] = absent
        return missing

    @staticmethod
    def _missing_message(
        missing: Mapping[str, List[str]],
    ) -> str | None:
        if not missing:
            return None
        details = "; ".join(
            f"{object_name}: {', '.join(columns)}"
            for object_name, columns in missing.items()
        )
        return f"Thiếu bảng hoặc cột dữ liệu bắt buộc: {details}"

    @staticmethod
    def _validate_tooltip_fields(request: CustomChartRequest) -> None:
        selected_fields = {
            item.field_id for item in request.dimensions
        } | {
            item.field_id for item in request.metrics
        }
        if request.series:
            selected_fields.add(request.series.field_id)
        invalid = [
            field_id
            for field_id in request.tooltip_fields
            if field_id not in selected_fields
        ]
        if invalid:
            raise ValueError(
                "Trường chú thích khi di chuột phải nằm trong các trường đã chọn: "
                + ", ".join(invalid)
            )

    @staticmethod
    def _series_payload(
        key: str,
        label: str,
        selection,
        color_index: int,
    ) -> Dict[str, Any]:
        return {
            "key": key,
            "label": label,
            "color": selection.color
            or DEFAULT_COLORS[color_index % len(DEFAULT_COLORS)],
            "axisGroup": selection.axis_group.value,
            "seriesType": (
                selection.series_type.value
                if selection.series_type
                else None
            ),
            "numberFormat": selection.number_format,
        }

    @staticmethod
    def _series_key(metric_alias: str, series_value: str) -> str:
        normalized = "".join(
            character if character.isalnum() else "_"
            for character in series_value.lower()
        ).strip("_")
        return f"{metric_alias}__{normalized or 'unknown'}"[:120]

    @staticmethod
    def _dimension_display_value(
        value: Any,
        data_type: str | None = None,
    ) -> str:
        if data_type == "boolean":
            if value is True:
                return "Không cần phản hồi"
            if value is False:
                return "Cần phản hồi"
        if value is None or value == "":
            return "Không xác định"
        return str(value)

    @staticmethod
    def _series_display_key(value: Any) -> str:
        if value is None or value == "":
            return "unknown"
        return str(value)

    @staticmethod
    def _format_saved_config(row: Dict[str, Any]) -> Dict[str, Any]:
        config_value = row.get("configJson")
        config = (
            json.loads(config_value)
            if isinstance(config_value, str)
            else config_value
        )
        if not isinstance(config, dict):
            raise ValueError("Cấu hình biểu đồ đã lưu không hợp lệ.")
        normalized_config = dict(config)
        if "version" not in normalized_config:
            normalized_config["version"] = 1
        if "mode" not in normalized_config:
            normalized_config["mode"] = "predefined"
        payload = {
            "id": row.get("id"),
            "name": row.get("name"),
            "description": row.get("description"),
            "config": normalized_config,
            "createdAt": row.get("createdAt"),
            "updatedAt": row.get("updatedAt"),
            "isActive": bool(row.get("isActive")),
        }
        return SavedChartConfig.model_validate(payload).model_dump(
            by_alias=True,
            mode="json",
        )

    @staticmethod
    def _serialize_row(row: Dict[str, Any]) -> Dict[str, Any]:
        return {
            key: (
                float(value)
                if isinstance(value, Decimal)
                else value.isoformat()
                if hasattr(value, "isoformat")
                else value
            )
            for key, value in row.items()
        }
