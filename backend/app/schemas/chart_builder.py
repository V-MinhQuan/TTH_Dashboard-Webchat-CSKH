from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Any, Dict, List, Literal, Optional, Union
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


SAFE_ID_PATTERN = r"^[A-Za-z][A-Za-z0-9_]{0,63}$"


class ChartType(str, Enum):
    line = "line"
    bar = "bar"
    stacked_bar = "stacked_bar"
    horizontal_bar = "horizontal_bar"
    pie = "pie"
    donut = "donut"
    area = "area"
    scatter = "scatter"
    combo = "combo"
    radar = "radar"


class Aggregation(str, Enum):
    count = "count"
    count_distinct = "count_distinct"
    sum = "sum"
    avg = "avg"
    min = "min"
    max = "max"


class FilterOperator(str, Enum):
    eq = "eq"
    neq = "neq"
    gt = "gt"
    gte = "gte"
    lt = "lt"
    lte = "lte"
    before = "before"
    after = "after"
    between = "between"
    contains = "contains"
    starts_with = "starts_with"
    in_ = "in"
    not_in = "not_in"
    is_null = "is_null"
    is_not_null = "is_not_null"


class DateGrain(str, Enum):
    day = "day"
    week = "week"
    month = "month"
    quarter = "quarter"
    year = "year"


class SortDirection(str, Enum):
    asc = "asc"
    desc = "desc"


class NullHandling(str, Enum):
    include = "include"
    exclude = "exclude"
    label = "label"


class AxisGroup(str, Enum):
    left = "left"
    right = "right"


class SeriesType(str, Enum):
    bar = "bar"
    line = "line"
    area = "area"


class ColumnMeta(BaseModel):
    id: str
    label: str
    data_type: str = Field(alias="dataType")

    model_config = ConfigDict(populate_by_name=True)


class DataSourceInfo(BaseModel):
    id: str
    name: str
    description: str
    available: bool
    unavailable_reason: Optional[str] = Field(default=None, alias="unavailableReason")
    dimensions: List[ColumnMeta]
    metrics: List[ColumnMeta]
    supported_filters: List[str] = Field(default_factory=list, alias="supportedFilters")

    model_config = ConfigDict(populate_by_name=True)


class CatalogFieldMeta(BaseModel):
    id: str
    label: str
    data_type: str = Field(alias="dataType")
    semantic_type: str = Field(alias="semanticType")
    roles: List[str]
    aggregations: List[str] = Field(default_factory=list)
    filter_operators: List[str] = Field(default_factory=list, alias="filterOperators")
    date_grains: List[str] = Field(default_factory=list, alias="dateGrains")
    default_aggregation: Optional[str] = Field(default=None, alias="defaultAggregation")
    nullable: bool
    available: bool = True
    unavailable_reason: Optional[str] = Field(default=None, alias="unavailableReason")

    model_config = ConfigDict(populate_by_name=True)


class CatalogRelationMeta(BaseModel):
    id: str
    label: str
    cardinality: str
    available: bool
    unavailable_reason: Optional[str] = Field(default=None, alias="unavailableReason")

    model_config = ConfigDict(populate_by_name=True)


class CatalogDatasetMeta(BaseModel):
    id: str
    label: str
    description: str
    available: bool
    unavailable_reason: Optional[str] = Field(default=None, alias="unavailableReason")
    fields: List[CatalogFieldMeta]
    relations: List[CatalogRelationMeta]
    default_date_field: Optional[str] = Field(default=None, alias="defaultDateField")
    default_dimension: str = Field(alias="defaultDimension")
    default_metric: str = Field(alias="defaultMetric")
    default_limit: int = Field(alias="defaultLimit")
    max_limit: int = Field(alias="maxLimit")

    model_config = ConfigDict(populate_by_name=True)


class ChartCatalogResponse(BaseModel):
    version: Literal[2] = 2
    datasets: List[CatalogDatasetMeta]
    aggregations: List[str]
    date_grains: List[str] = Field(alias="dateGrains")
    filter_operators: List[str] = Field(alias="filterOperators")
    default_limit: int = Field(alias="defaultLimit")
    max_limit: int = Field(alias="maxLimit")
    cached_at: datetime = Field(alias="cachedAt")

    model_config = ConfigDict(populate_by_name=True)


class ChartDataFilters(BaseModel):
    from_date: Optional[date] = Field(default=None, alias="fromDate")
    to_date: Optional[date] = Field(default=None, alias="toDate")
    channel: Optional[str] = Field(default=None, max_length=50)
    topic: Optional[str] = Field(default=None, max_length=100)

    model_config = ConfigDict(populate_by_name=True)


class YAxisConfig(BaseModel):
    column: str = Field(min_length=1, max_length=80)
    label: Optional[str] = Field(default=None, max_length=100)
    color: Optional[str] = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    stack_id: Optional[str] = Field(default=None, alias="stackId", max_length=40)
    axis_group: AxisGroup = Field(default=AxisGroup.left, alias="axisGroup")
    series_type: Optional[SeriesType] = Field(default=None, alias="seriesType")
    number_format: Optional[str] = Field(default=None, alias="numberFormat", max_length=40)

    model_config = ConfigDict(populate_by_name=True)


class ChartDataRequest(BaseModel):
    version: Literal[1] = 1
    mode: Literal["predefined"] = "predefined"
    source_id: str = Field(alias="sourceId", min_length=1, max_length=80)
    chart_type: ChartType = Field(alias="chartType")
    group_by: str = Field(alias="groupBy", min_length=1, max_length=80)
    y_axes: List[YAxisConfig] = Field(alias="yAxes", min_length=1, max_length=6)
    filters: ChartDataFilters = Field(default_factory=ChartDataFilters)
    limit: int = Field(default=100, ge=1, le=500)

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("y_axes")
    @classmethod
    def unique_metrics(cls, value: List[YAxisConfig]) -> List[YAxisConfig]:
        columns = [item.column for item in value]
        if len(columns) != len(set(columns)):
            raise ValueError("yAxes must not contain duplicate columns")
        return value


class DimensionSelection(BaseModel):
    field_id: str = Field(alias="fieldId", pattern=SAFE_ID_PATTERN)
    alias: Optional[str] = Field(default=None, pattern=SAFE_ID_PATTERN)
    date_grain: Optional[DateGrain] = Field(default=None, alias="dateGrain")
    null_handling: NullHandling = Field(default=NullHandling.include, alias="nullHandling")
    label: Optional[str] = Field(default=None, max_length=100)

    model_config = ConfigDict(populate_by_name=True)


class MetricSelection(BaseModel):
    field_id: str = Field(alias="fieldId", pattern=SAFE_ID_PATTERN)
    aggregation: Aggregation
    alias: Optional[str] = Field(default=None, pattern=SAFE_ID_PATTERN)
    label: Optional[str] = Field(default=None, max_length=100)
    color: Optional[str] = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    axis_group: AxisGroup = Field(default=AxisGroup.left, alias="axisGroup")
    series_type: Optional[SeriesType] = Field(default=None, alias="seriesType")
    number_format: Optional[str] = Field(default=None, alias="numberFormat", max_length=40)

    model_config = ConfigDict(populate_by_name=True)


class FilterSelection(BaseModel):
    field_id: str = Field(alias="fieldId", pattern=SAFE_ID_PATTERN)
    operator: FilterOperator
    value: Any = None
    values: List[Any] = Field(default_factory=list, max_length=100)
    value_to: Any = Field(default=None, alias="valueTo")

    model_config = ConfigDict(populate_by_name=True)


class SortSelection(BaseModel):
    field_id: str = Field(alias="fieldId", pattern=SAFE_ID_PATTERN)
    direction: SortDirection = SortDirection.asc

    model_config = ConfigDict(populate_by_name=True)


class ChartSettings(BaseModel):
    show_legend: bool = Field(default=True, alias="showLegend")
    show_data_labels: bool = Field(default=False, alias="showDataLabels")
    show_grid: bool = Field(default=True, alias="showGrid")
    show_tooltip: bool = Field(default=True, alias="showTooltip")
    theme: str = Field(default="flic", max_length=40)

    model_config = ConfigDict(populate_by_name=True)


class CustomChartRequest(BaseModel):
    version: Literal[2] = 2
    mode: Literal["custom"] = "custom"
    dataset_id: str = Field(alias="datasetId", pattern=SAFE_ID_PATTERN)
    chart_type: ChartType = Field(default=ChartType.bar, alias="chartType")
    dimensions: List[DimensionSelection] = Field(default_factory=list, max_length=3)
    metrics: List[MetricSelection] = Field(min_length=1, max_length=6)
    series: Optional[DimensionSelection] = None
    tooltip_fields: List[str] = Field(default_factory=list, alias="tooltipFields", max_length=6)
    filters: List[FilterSelection] = Field(default_factory=list, max_length=20)
    sort: List[SortSelection] = Field(default_factory=list, max_length=3)
    top_n: Optional[int] = Field(default=None, alias="topN", ge=1, le=500)
    limit: int = Field(default=500, ge=1, le=5000)

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="after")
    def unique_output_aliases(self):
        aliases = [
            item.alias or item.field_id
            for item in [*self.dimensions, *self.metrics, *([self.series] if self.series else [])]
        ]
        if len(aliases) != len(set(aliases)):
            raise ValueError(
                "Bí danh của chiều phân tích, chỉ số và chuỗi dữ liệu không được trùng nhau"
            )

        chart_type = self.chart_type.value
        if chart_type in {
            "bar",
            "stacked_bar",
            "horizontal_bar",
            "line",
            "area",
            "pie",
            "donut",
            "combo",
            "radar",
        } and not self.dimensions:
            raise ValueError(
                "Loại biểu đồ đã chọn cần ít nhất một chiều phân tích"
            )
        if chart_type in {"pie", "donut"} and len(self.metrics) != 1:
            raise ValueError(
                "Biểu đồ hình tròn hoặc hình khuyên chỉ dùng một chỉ số"
            )
        if chart_type == "scatter" and len(self.metrics) < 2:
            raise ValueError(
                "Biểu đồ phân tán cần ít nhất hai chỉ số"
            )
        if chart_type == "combo" and len(self.metrics) < 2:
            raise ValueError(
                "Biểu đồ kết hợp cần ít nhất hai chỉ số"
            )
        return self


class CustomChartConfig(CustomChartRequest):
    title: str = Field(default="", max_length=200)
    chart_settings: ChartSettings = Field(default_factory=ChartSettings, alias="chartSettings")


class ChartSeries(BaseModel):
    key: str
    label: str
    color: str
    axis_group: AxisGroup = Field(default=AxisGroup.left, alias="axisGroup")
    series_type: Optional[SeriesType] = Field(default=None, alias="seriesType")
    number_format: Optional[str] = Field(default=None, alias="numberFormat")

    model_config = ConfigDict(populate_by_name=True)


class QueryExecutionMeta(BaseModel):
    row_count: int = Field(alias="rowCount")
    execution_time_ms: int = Field(alias="executionTimeMs")
    limit: int
    truncated: bool

    model_config = ConfigDict(populate_by_name=True)


class ChartDataResponse(BaseModel):
    mode: Literal["predefined", "custom"] = "predefined"
    source_id: Optional[str] = Field(default=None, alias="sourceId")
    dataset_id: Optional[str] = Field(default=None, alias="datasetId")
    rows: List[Dict[str, Any]]
    series: List[ChartSeries]
    dimension_keys: List[str] = Field(default_factory=list, alias="dimensionKeys")
    generated_at: datetime = Field(alias="generatedAt")
    execution: Optional[QueryExecutionMeta] = None

    model_config = ConfigDict(populate_by_name=True)


class ChartBuilderConfig(BaseModel):
    version: Literal[1] = 1
    mode: Literal["predefined"] = "predefined"
    source_id: str = Field(alias="sourceId", min_length=1, max_length=80)
    chart_type: ChartType = Field(alias="chartType")
    group_by: str = Field(alias="groupBy", min_length=1, max_length=80)
    y_axes: List[YAxisConfig] = Field(alias="yAxes", min_length=1, max_length=6)
    title: str = Field(default="", max_length=200)
    filters: ChartDataFilters = Field(default_factory=ChartDataFilters)

    model_config = ConfigDict(populate_by_name=True)


ChartConfig = Union[CustomChartConfig, ChartBuilderConfig]
ChartRequest = Union[CustomChartRequest, ChartDataRequest]


class SavedChartConfigCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=500)
    config: ChartConfig


class SavedChartConfig(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    config: ChartConfig
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    is_active: bool = Field(alias="isActive")

    model_config = ConfigDict(populate_by_name=True)
