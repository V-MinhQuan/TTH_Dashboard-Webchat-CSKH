import { CircleHelp, X } from "lucide-react";

import {
  CatalogDatasetMeta,
  ChartBuilderState,
  ChartSettings,
  ChartTheme,
  DateGrain,
} from "../../types/chartBuilder";
import { ChartTypeSelector } from "./ChartTypeSelector";
import { SeriesSettings } from "./SeriesSettings";
import { ToggleSetting } from "./ToggleSetting";
import {
  CHART_BUILDER_PALETTE_LABELS,
  getChartBuilderPalette,
} from "./chartBuilderPalettes";
import {
  CHART_BUILDER_LABELS,
  DATE_GRAIN_LABELS,
  DIMENSION_GUIDANCE,
} from "./chartBuilderLabels";
import { buildDimensionSelectionForField } from "./chartBuilderValidation";

interface Props {
  dataset: CatalogDatasetMeta | null;
  state: ChartBuilderState;
  open: boolean;
  legacyMode?: boolean;
  onChange: (changes: Partial<ChartBuilderState>) => void;
  onClose?: () => void;
}

export function ChartSettingsPanel({
  dataset,
  state,
  open,
  legacyMode = false,
  onChange,
  onClose,
}: Props) {
  const dimensionFields = dataset?.fields.filter(
    (field) => (
      field.available
      && field.dataType !== "date"
      && field.roles.includes("dimension")
    ),
  ) || [];
  const seriesFields = dataset?.fields.filter(
    (field) => (
      field.available
      && field.dataType !== "date"
      && field.roles.includes("series")
    ),
  ) || [];
  const primaryDimension = state.dimensions[0];
  const primaryField = dimensionFields.find(
    (field) => field.id === primaryDimension?.fieldId,
  );
  const sortOptions = buildSortOptions(state, dataset);

  const updateSettings = (
    changes: Partial<ChartSettings>,
  ) => onChange({
    chartSettings: { ...state.chartSettings, ...changes },
  });

  return (
    <aside
      className={`chart-builder-settings-panel${open ? " is-open" : ""}`}
      aria-label={CHART_BUILDER_LABELS.settings}
    >
      <div className="chart-builder-panel-header">
        <div>
          <h2>{CHART_BUILDER_LABELS.settings}</h2>
          <p>Cấu hình truy vấn và hiển thị</p>
        </div>
        {onClose && (
          <button
            type="button"
            className="chart-builder-panel-close"
            onClick={onClose}
            aria-label="Đóng cài đặt"
          >
            <X size={17} />
          </button>
        )}
      </div>

      <div className="chart-builder-settings-content">
        {legacyMode && (
          <div className="chart-builder-legacy-notice">
            Đây là cấu hình cũ. Biểu đồ vẫn dùng nguồn dữ liệu tương thích để
            bảo toàn kết quả. Hãy chọn bộ dữ liệu mới để chỉnh sửa đầy đủ.
          </div>
        )}
        <fieldset className="chart-builder-settings-fieldset" disabled={legacyMode}>
          <SettingsSection title={CHART_BUILDER_LABELS.chartType}>
            <ChartTypeSelector
              value={state.chartType}
              onChange={(chartType) => onChange({ chartType })}
            />
            <p className="chart-builder-recommendation">
              Gợi ý: {recommendChart(state, dataset)}
            </p>
          </SettingsSection>

          <SettingsSection title={CHART_BUILDER_LABELS.dimensionAxis}>
            <label className="chart-builder-control">
              <span className="chart-builder-control-label">
                {CHART_BUILDER_LABELS.dimension}
                <button
                  type="button"
                  className="chart-builder-help-button"
                  aria-label="Giải thích chiều phân tích"
                  title={DIMENSION_GUIDANCE}
                >
                  <CircleHelp size={12} />
                </button>
              </span>
              <select
                value={primaryDimension?.fieldId || ""}
                onChange={(event) => {
                  const fieldId = event.target.value;
                  const field = dimensionFields.find(
                    (item) => item.id === fieldId,
                  );
                  onChange({
                    dimensions: field
                      ? [buildDimensionSelectionForField(field)]
                      : [],
                  });
                }}
                disabled={!dataset}
              >
                <option value="">Chọn chiều phân tích</option>
                {dimensionFields.map((field) => (
                  <option key={field.id} value={field.id}>{field.label}</option>
                ))}
              </select>
            </label>
            {primaryField?.dateGrains.length ? (
              <label className="chart-builder-control">
                <span>Độ chi tiết thời gian</span>
                <select
                  value={primaryDimension?.dateGrain || ""}
                  onChange={(event) => onChange({
                    dimensions: state.dimensions.map((item, index) => (
                      index === 0
                        ? {
                          ...item,
                          dateGrain: (
                            event.target.value as DateGrain
                          ) || null,
                        }
                        : item
                    )),
                  })}
                >
                  <option value="">Giá trị gốc</option>
                  {primaryField.dateGrains.map((grain) => (
                    <option key={grain} value={grain}>
                      {DATE_GRAIN_LABELS[grain]}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {primaryDimension && (
              <label className="chart-builder-control">
                <span>Giá trị rỗng</span>
                <select
                  value={primaryDimension.nullHandling || "include"}
                  onChange={(event) => onChange({
                    dimensions: state.dimensions.map((item, index) => (
                      index === 0
                        ? {
                          ...item,
                          nullHandling: event.target.value as
                            | "include"
                            | "exclude"
                            | "label",
                        }
                        : item
                    )),
                  })}
                >
                  <option value="include">Giữ lại</option>
                  <option value="exclude">Loại bỏ</option>
                  {primaryField?.dataType === "string" && (
                    <option value="label">Gắn nhãn "Không xác định"</option>
                  )}
                </select>
              </label>
            )}
          </SettingsSection>

          <SettingsSection title={CHART_BUILDER_LABELS.metricAxis}>
            <SeriesSettings
              fields={dataset?.fields || []}
              metrics={state.metrics}
              chartType={state.chartType}
              theme={state.chartSettings.theme}
              onChange={(metrics) => onChange({ metrics })}
            />
          </SettingsSection>

          <SettingsSection title={CHART_BUILDER_LABELS.series}>
            <label className="chart-builder-control">
              <span>Phân nhóm chuỗi dữ liệu</span>
              <select
                value={state.series?.fieldId || ""}
                onChange={(event) => {
                  const field = seriesFields.find(
                    (item) => item.id === event.target.value,
                  );
                  onChange({
                    series: field
                      ? buildDimensionSelectionForField(field)
                      : null,
                  });
                }}
              >
                <option value="">Không phân nhóm</option>
                {seriesFields.map((field) => (
                  <option key={field.id} value={field.id}>{field.label}</option>
                ))}
              </select>
            </label>
          </SettingsSection>

          <SettingsSection title="Sắp xếp">
            <div className="chart-builder-query-grid">
              <label className="chart-builder-control">
                <span>Sắp xếp theo</span>
                <select
                  value={state.sort[0]?.fieldId || ""}
                  onChange={(event) => onChange({
                    sort: event.target.value
                      ? [{
                        fieldId: event.target.value,
                        direction: state.sort[0]?.direction || "desc",
                      }]
                      : [],
                  })}
                >
                  <option value="">Mặc định</option>
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="chart-builder-control">
                <span>Thứ tự</span>
                <select
                  value={state.sort[0]?.direction || "desc"}
                  disabled={!state.sort.length}
                  onChange={(event) => onChange({
                    sort: state.sort.map((item, index) => (
                      index === 0
                        ? {
                          ...item,
                          direction: event.target.value as "asc" | "desc",
                        }
                        : item
                    )),
                  })}
                >
                  <option value="desc">Giảm dần</option>
                  <option value="asc">Tăng dần</option>
                </select>
              </label>
            </div>
          </SettingsSection>

          <SettingsSection title="Giao diện">
            <label className="chart-builder-control">
              <span>Bảng màu</span>
              <select
                value={state.chartSettings.theme}
                onChange={(event) => {
                  const theme = event.target.value as ChartTheme;
                  onChange({
                    chartSettings: { ...state.chartSettings, theme },
                    metrics: state.metrics.map((metric) => ({
                      ...metric,
                      color: null,
                    })),
                  });
                }}
              >
                {Object.entries(CHART_BUILDER_PALETTE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <div className="chart-builder-theme-swatches">
              {getChartBuilderPalette(state.chartSettings.theme).map((color, index) => (
                <span key={`${color}-${index}`} style={{ backgroundColor: color }} />
              ))}
            </div>
          </SettingsSection>

          <SettingsSection title="Hiển thị">
            <div className="chart-builder-toggle-list">
              <ToggleSetting
                label="Hiển thị chú giải"
                checked={state.chartSettings.showLegend}
                onChange={(showLegend) => updateSettings({ showLegend })}
              />
              <ToggleSetting
                label="Hiển thị nhãn dữ liệu"
                checked={state.chartSettings.showDataLabels}
                onChange={(showDataLabels) => updateSettings({ showDataLabels })}
              />
              <ToggleSetting
                label="Hiển thị lưới"
                checked={state.chartSettings.showGrid}
                onChange={(showGrid) => updateSettings({ showGrid })}
              />
              <ToggleSetting
                label="Hiển thị chú thích khi di chuột"
                checked={state.chartSettings.showTooltip}
                onChange={(showTooltip) => updateSettings({ showTooltip })}
              />
            </div>
          </SettingsSection>
        </fieldset>
      </div>
    </aside>
  );
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="chart-builder-settings-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function recommendChart(
  state: ChartBuilderState,
  dataset: CatalogDatasetMeta | null,
) {
  const dimension = dataset?.fields.find(
    (field) => field.id === state.dimensions[0]?.fieldId,
  );
  if (state.metrics.length >= 2 && state.dimensions.length === 0) {
    return "Biểu đồ phân tán cho hai chỉ số số.";
  }
  if (dimension?.dataType === "date") {
    return "Biểu đồ đường hoặc vùng cho xu hướng thời gian.";
  }
  if (state.metrics.length > 1) {
    return "Biểu đồ cột nhóm, kết hợp hoặc radar.";
  }
  return "Biểu đồ cột cho nhóm dữ liệu; hình tròn khi cần xem tỷ trọng.";
}

function buildSortOptions(
  state: ChartBuilderState,
  dataset: CatalogDatasetMeta | null,
) {
  const fieldLabels = new Map(
    dataset?.fields.map((field) => [field.id, field.label]) || [],
  );

  return [
    ...state.dimensions.map((dimension) => ({
      value: dimension.alias || dimension.fieldId,
      label: dimension.label || fieldLabels.get(dimension.fieldId) || "Chiều phân tích",
    })),
    ...state.metrics.map((metric) => ({
      value: metric.alias || `${metric.aggregation}_${metric.fieldId}`,
      label: metric.label || fieldLabels.get(metric.fieldId) || "Chỉ số",
    })),
  ];
}
