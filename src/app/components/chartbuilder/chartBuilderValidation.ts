import type {
  CatalogDatasetMeta,
  CatalogFieldMeta,
  ChartBuilderState,
  DimensionSelection,
  NullHandling,
} from "../../types/chartBuilder";

export interface ChartValidationResult {
  valid: boolean;
  messages: string[];
}

export function validateChartConfiguration(
  state: ChartBuilderState,
  dataset: CatalogDatasetMeta | null,
): ChartValidationResult {
  const messages: string[] = [];

  if (!dataset || !dataset.available || dataset.id !== state.datasetId) {
    messages.push("Hãy chọn một bộ dữ liệu khả dụng.");
    return { valid: false, messages };
  }

  const fields = new Map(dataset.fields.map((field) => [field.id, field]));
  const selections = [
    ...state.dimensions.map((item) => ({
      fieldId: item.fieldId,
      role: "dimension" as const,
    })),
    ...state.metrics.map((item) => ({
      fieldId: item.fieldId,
      role: "metric" as const,
      aggregation: item.aggregation,
    })),
    ...(state.series
      ? [{ fieldId: state.series.fieldId, role: "series" as const }]
      : []),
    ...state.filters.map((item) => ({
      fieldId: item.fieldId,
      role: "filter" as const,
    })),
  ];

  for (const selection of selections) {
    const field = fields.get(selection.fieldId);
    if (!field?.available) {
      messages.push("Cấu hình có trường dữ liệu chưa được hỗ trợ.");
      continue;
    }
    if (!field.roles.includes(selection.role)) {
      messages.push(`Trường “${field.label}” không phù hợp với vị trí đã chọn.`);
    }
    if (
      selection.role === "metric"
      && selection.aggregation
      && !field.aggregations.includes(selection.aggregation)
    ) {
      messages.push(`Phép tính của chỉ số “${field.label}” không được hỗ trợ.`);
    }
  }

  const dimensionCount = state.dimensions.length;
  const metricCount = state.metrics.length;
  const metricFields = state.metrics
    .map((metric) => fields.get(metric.fieldId))
    .filter((field): field is CatalogFieldMeta => Boolean(field));
  const numericMetricCount = metricFields.filter(
    (field) => field.dataType === "number",
  ).length;
  const requiresDimension = [
    "bar",
    "stacked_bar",
    "horizontal_bar",
    "line",
    "area",
    "pie",
    "donut",
    "combo",
    "radar",
  ].includes(state.chartType);

  if (requiresDimension && dimensionCount < 1) {
    messages.push("Hãy chọn ít nhất một chiều phân tích.");
  }
  if (metricCount < 1) {
    messages.push("Hãy chọn ít nhất một chỉ số đo lường.");
  }
  if (["pie", "donut"].includes(state.chartType) && metricCount > 1) {
    messages.push("Biểu đồ hình tròn hoặc hình khuyên chỉ dùng một chỉ số.");
  }
  if (state.chartType === "scatter" && numericMetricCount < 2) {
    messages.push("Biểu đồ phân tán cần ít nhất hai chỉ số số.");
  }
  if (state.chartType === "combo" && metricCount < 2) {
    messages.push("Biểu đồ kết hợp cần ít nhất hai chỉ số đo lường.");
  }

  for (const dimension of [
    ...state.dimensions,
    ...(state.series ? [state.series] : []),
  ]) {
    const field = fields.get(dimension.fieldId);
    if (
      field
      && dimension.nullHandling === "label"
      && !canUseNullLabel(field)
    ) {
      messages.push("Chỉ trường văn bản mới được gán nhãn cho giá trị rỗng.");
    }
  }

  return {
    valid: messages.length === 0,
    messages: [...new Set(messages)],
  };
}

export function canUseNullLabel(
  field: Pick<CatalogFieldMeta, "dataType"> | null | undefined,
) {
  return field?.dataType === "string";
}

export function defaultNullHandlingForField(
  field: Pick<CatalogFieldMeta, "dataType"> | null | undefined,
): NullHandling {
  return canUseNullLabel(field) ? "label" : "include";
}

export function normalizeDimensionSelectionForField(
  selection: DimensionSelection,
  field: Pick<CatalogFieldMeta, "dataType" | "dateGrains"> | null | undefined,
): DimensionSelection {
  const nextNullHandling = (
    selection.nullHandling === "label" && !canUseNullLabel(field)
      ? "include"
      : selection.nullHandling || defaultNullHandlingForField(field)
  );
  return {
    ...selection,
    dateGrain: field?.dataType === "date"
      ? selection.dateGrain || null
      : null,
    nullHandling: nextNullHandling,
  };
}

export function buildDimensionSelectionForField(
  field: Pick<CatalogFieldMeta, "id" | "dataType" | "dateGrains">,
): DimensionSelection {
  return normalizeDimensionSelectionForField(
    {
      fieldId: field.id,
      alias: field.id,
      dateGrain: field.dataType === "date" ? "month" : null,
      nullHandling: defaultNullHandlingForField(field),
    },
    field,
  );
}

export function normalizeChartBuilderState(
  state: ChartBuilderState,
  dataset: CatalogDatasetMeta | null,
): ChartBuilderState {
  if (!dataset) return state;
  const fields = new Map(dataset.fields.map((field) => [field.id, field]));
  return {
    ...state,
    dimensions: state.dimensions.map((dimension) => (
      normalizeDimensionSelectionForField(
        dimension,
        fields.get(dimension.fieldId),
      )
    )),
    series: state.series
      ? normalizeDimensionSelectionForField(
        state.series,
        fields.get(state.series.fieldId),
      )
      : null,
  };
}
