export type ChartType =
  | "line"
  | "bar"
  | "stacked_bar"
  | "horizontal_bar"
  | "pie"
  | "donut"
  | "area"
  | "scatter"
  | "combo"
  | "radar";

export type ChartTheme = "flic" | "navy" | "warm" | "monochrome";
export type DataType = "string" | "number" | "date" | "boolean";
export type FieldRole = "dimension" | "metric" | "filter" | "series";
export type Aggregation = "count" | "count_distinct" | "sum" | "avg" | "min" | "max";
export type FilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "before"
  | "after"
  | "between"
  | "contains"
  | "starts_with"
  | "in"
  | "not_in"
  | "is_null"
  | "is_not_null";
export type DateGrain = "day" | "week" | "month" | "quarter" | "year";
export type SortDirection = "asc" | "desc";
export type NullHandling = "include" | "exclude" | "label";
export type AxisGroup = "left" | "right";
export type SeriesType = "bar" | "line" | "area";

export interface ColumnMeta {
  id: string;
  label: string;
  dataType: "string" | "number" | "date";
}

export interface DataSourceInfo {
  id: string;
  name: string;
  description: string;
  available: boolean;
  unavailableReason: string | null;
  dimensions: ColumnMeta[];
  metrics: ColumnMeta[];
  supportedFilters: Array<"fromDate" | "toDate" | "channel" | "topic">;
}

export interface CatalogFieldMeta {
  id: string;
  label: string;
  dataType: DataType;
  semanticType: string;
  roles: FieldRole[];
  aggregations: Aggregation[];
  filterOperators: FilterOperator[];
  dateGrains: DateGrain[];
  defaultAggregation: Aggregation | null;
  nullable: boolean;
  available: boolean;
  unavailableReason: string | null;
}

export interface CatalogRelationMeta {
  id: string;
  label: string;
  cardinality: string;
  available: boolean;
  unavailableReason: string | null;
}

export interface CatalogDatasetMeta {
  id: string;
  label: string;
  description: string;
  available: boolean;
  unavailableReason: string | null;
  fields: CatalogFieldMeta[];
  relations: CatalogRelationMeta[];
  defaultDateField: string | null;
  defaultDimension: string;
  defaultMetric: string;
  defaultLimit: number;
  maxLimit: number;
}

export interface ChartCatalogResponse {
  version: 2;
  datasets: CatalogDatasetMeta[];
  aggregations: Aggregation[];
  dateGrains: DateGrain[];
  filterOperators: FilterOperator[];
  defaultLimit: number;
  maxLimit: number;
  cachedAt: string;
}

export interface ChartDataFilters {
  fromDate?: string;
  toDate?: string;
  channel?: string;
  topic?: string;
}

export interface YAxisConfig {
  column: string;
  label?: string | null;
  color?: string | null;
  stackId?: string | null;
  axisGroup?: AxisGroup;
  seriesType?: SeriesType | null;
  numberFormat?: string | null;
}

export interface ChartDataRequest {
  version?: 1;
  mode?: "predefined";
  sourceId: string;
  chartType: ChartType;
  groupBy: string;
  yAxes: YAxisConfig[];
  filters: ChartDataFilters;
  limit?: number;
}

export interface DimensionSelection {
  fieldId: string;
  alias?: string | null;
  dateGrain?: DateGrain | null;
  nullHandling?: NullHandling;
  label?: string | null;
}

export interface MetricSelection {
  fieldId: string;
  aggregation: Aggregation;
  alias?: string | null;
  label?: string | null;
  color?: string | null;
  axisGroup?: AxisGroup;
  seriesType?: SeriesType | null;
  numberFormat?: string | null;
}

export interface FilterSelection {
  fieldId: string;
  operator: FilterOperator;
  value?: string | number | boolean | null;
  values?: Array<string | number | boolean>;
  valueTo?: string | number | boolean | null;
}

export interface SortSelection {
  fieldId: string;
  direction: SortDirection;
}

export interface ChartSettings {
  showLegend: boolean;
  showDataLabels: boolean;
  showGrid: boolean;
  showTooltip: boolean;
  theme: ChartTheme;
}

export interface CustomChartRequest {
  version: 2;
  mode: "custom";
  datasetId: string;
  chartType: ChartType;
  dimensions: DimensionSelection[];
  metrics: MetricSelection[];
  series?: DimensionSelection | null;
  tooltipFields: string[];
  filters: FilterSelection[];
  sort: SortSelection[];
  topN?: number | null;
  limit: number;
}

export interface CustomChartConfig extends CustomChartRequest {
  title: string;
  chartSettings: ChartSettings;
}

export type ChartBuilderState = CustomChartConfig;

export type ChartDataRow = Record<string, string | number | boolean | null>;

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  axisGroup?: AxisGroup;
  seriesType?: SeriesType | null;
  numberFormat?: string | null;
}

export interface QueryExecutionMeta {
  rowCount: number;
  executionTimeMs: number;
  limit: number;
  truncated: boolean;
}

export interface ChartDataResponse {
  mode: "predefined" | "custom";
  sourceId?: string | null;
  datasetId?: string | null;
  rows: ChartDataRow[];
  series: ChartSeries[];
  dimensionKeys: string[];
  generatedAt: string;
  execution?: QueryExecutionMeta | null;
}

export interface ChartConfigPayload {
  version?: 1;
  mode?: "predefined";
  sourceId: string;
  chartType: ChartType;
  groupBy: string;
  yAxes: YAxisConfig[];
  title: string;
  filters: ChartDataFilters;
}

export type SavedChartConfigPayload = ChartConfigPayload | CustomChartConfig;

export interface SavedChartConfigCreate {
  name: string;
  description?: string | null;
  config: SavedChartConfigPayload;
}

export interface SavedChartConfig extends SavedChartConfigCreate {
  id: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export function isCustomChartConfig(
  config: SavedChartConfigPayload,
): config is CustomChartConfig {
  return config.version === 2 && config.mode === "custom";
}
