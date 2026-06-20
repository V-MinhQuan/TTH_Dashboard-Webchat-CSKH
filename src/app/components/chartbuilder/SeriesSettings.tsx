import { Plus, Trash2 } from "lucide-react";

import {
  CatalogFieldMeta,
  ChartTheme,
  ChartType,
  MetricSelection,
} from "../../types/chartBuilder";
import { AGGREGATION_LABELS } from "./chartBuilderLabels";
import { paletteColor } from "./chartBuilderPalettes";

interface Props {
  fields: CatalogFieldMeta[];
  metrics: MetricSelection[];
  chartType: ChartType;
  theme: ChartTheme;
  onChange: (metrics: MetricSelection[]) => void;
}

export function SeriesSettings({
  fields,
  metrics,
  chartType,
  theme,
  onChange,
}: Props) {
  const metricFields = fields.filter(
    (field) => field.available && field.roles.includes("metric"),
  );

  const updateMetric = (
    index: number,
    changes: Partial<MetricSelection>,
  ) => {
    onChange(metrics.map((metric, itemIndex) => (
      itemIndex === index ? { ...metric, ...changes } : metric
    )));
  };

  return (
    <div className="chart-builder-series-settings">
      {metrics.map((metric, index) => {
        const field = metricFields.find((item) => item.id === metric.fieldId);
        const resolvedColor = metric.color || paletteColor(theme, index);
        return (
          <div
            key={metric.alias || `${metric.fieldId}-${index}`}
            className="chart-builder-series-row"
          >
            <div className="chart-builder-series-heading">
              <span>{field?.label || metric.label || metric.fieldId}</span>
              <button
                type="button"
                aria-label={`Xóa ${field?.label || metric.label || metric.fieldId}`}
                onClick={() => onChange(
                  metrics.filter((_, itemIndex) => itemIndex !== index),
                )}
              >
                <Trash2 size={14} />
              </button>
            </div>

            <div className="chart-builder-series-grid">
              <label className="chart-builder-control">
                <span>Phép tính</span>
                <select
                  value={metric.aggregation}
                  onChange={(event) => updateMetric(index, {
                    aggregation: event.target.value as MetricSelection["aggregation"],
                  })}
                >
                  {field?.aggregations.map((aggregation) => (
                    <option key={aggregation} value={aggregation}>
                      {AGGREGATION_LABELS[aggregation]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="chart-builder-control">
                <span>Trục Y</span>
                <select
                  value={metric.axisGroup || "left"}
                  onChange={(event) => updateMetric(index, {
                    axisGroup: event.target.value as "left" | "right",
                  })}
                >
                  <option value="left">Bên trái</option>
                  <option value="right">Bên phải</option>
                </select>
              </label>

              {chartType === "combo" && (
                <label className="chart-builder-control">
                  <span>Kiểu chuỗi dữ liệu</span>
                  <select
                    value={metric.seriesType || (index === 0 ? "bar" : "line")}
                    onChange={(event) => updateMetric(index, {
                      seriesType: event.target.value as "bar" | "line" | "area",
                    })}
                  >
                    <option value="bar">Cột</option>
                    <option value="line">Đường</option>
                    <option value="area">Vùng</option>
                  </select>
                </label>
              )}

              <label className="chart-builder-control">
                <span>Định dạng số</span>
                <select
                  value={metric.numberFormat || "number"}
                  onChange={(event) => updateMetric(index, {
                    numberFormat: event.target.value,
                  })}
                >
                  <option value="number">Số</option>
                  <option value="percent">Phần trăm</option>
                  <option value="decimal">Thập phân</option>
                  <option value="minutes">Phút</option>
                </select>
              </label>
            </div>

            <label className="chart-builder-control chart-builder-metric-label">
              <span>Nhãn hiển thị</span>
              <input
                value={metric.label || ""}
                placeholder={field?.label || metric.fieldId}
                onChange={(event) => updateMetric(index, {
                  label: event.target.value || null,
                })}
              />
            </label>

            <label className="chart-builder-color-control">
              <input
                type="color"
                value={resolvedColor}
                onChange={(event) => updateMetric(index, {
                  color: event.target.value,
                })}
              />
              <span>
                {resolvedColor}
              </span>
            </label>
          </div>
        );
      })}

      {!metrics.length && (
        <div className="chart-builder-series-empty">
          Hãy chọn ít nhất một chỉ số để tạo biểu đồ.
        </div>
      )}

      {metricFields.length > 0 && (
        <label className="chart-builder-add-series">
          <Plus size={14} />
          <select
            value=""
            aria-label="Thêm chỉ số"
            onChange={(event) => {
              const field = metricFields.find(
                (item) => item.id === event.target.value,
              );
              if (!field) return;
              const aggregation = (
                field.defaultAggregation
                || field.aggregations[0]
                || "count"
              );
              onChange([
                ...metrics,
                {
                  fieldId: field.id,
                  aggregation,
                  alias: buildMetricAlias(field.id, metrics.length),
                  color: null,
                  axisGroup: "left",
                  seriesType: chartType === "combo"
                    ? (metrics.length ? "line" : "bar")
                    : null,
                },
              ]);
            }}
          >
            <option value="">Thêm chỉ số</option>
            {metricFields.map((field) => (
              <option key={field.id} value={field.id}>{field.label}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

function buildMetricAlias(
  fieldId: string,
  index: number,
) {
  return `metric_${fieldId}_${index + 1}`;
}
