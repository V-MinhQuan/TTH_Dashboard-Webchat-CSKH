import type {
  CatalogDatasetMeta,
  ChartBuilderState,
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
  if (state.chartType === "scatter" && metricCount < 2) {
    messages.push("Biểu đồ phân tán cần ít nhất hai chỉ số đo lường.");
  }
  if (state.chartType === "combo" && metricCount < 2) {
    messages.push("Biểu đồ kết hợp cần ít nhất hai chỉ số đo lường.");
  }

  return {
    valid: messages.length === 0,
    messages: [...new Set(messages)],
  };
}
