import { CircleHelp, Plus, Trash2, X } from "lucide-react";

import {
  CatalogDatasetMeta,
  ChartBuilderState,
  ChartSettings,
  ChartTheme,
  DateGrain,
  FilterOperator,
  FilterSelection,
} from "../../types/chartBuilder";
import { ChartTypeSelector } from "./ChartTypeSelector";
import { SeriesSettings } from "./SeriesSettings";
import { ToggleSetting } from "./ToggleSetting";
import {
  CHART_BUILDER_LABELS,
  DATE_GRAIN_LABELS,
  DIMENSION_GUIDANCE,
  FILTER_OPERATOR_LABELS,
} from "./chartBuilderLabels";

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
    (field) => field.available && field.roles.includes("dimension"),
  ) || [];
  const seriesFields = dataset?.fields.filter(
    (field) => field.available && field.roles.includes("series"),
  ) || [];
  const filterFields = dataset?.fields.filter(
    (field) => field.available && field.roles.includes("filter"),
  ) || [];
  const primaryDimension = state.dimensions[0];
  const primaryField = dimensionFields.find(
    (field) => field.id === primaryDimension?.fieldId,
  );
  const selectedAliases = [
    ...state.dimensions.map((item) => item.alias || item.fieldId),
    ...state.metrics.map(
      (item) => item.alias || `${item.aggregation}_${item.fieldId}`,
    ),
  ];

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
                  onChange({
                    dimensions: fieldId
                      ? [{
                        fieldId,
                        alias: fieldId,
                        nullHandling: "include",
                      }]
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
                    <option value="label">Gán nhãn “Không xác định”</option>
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
              onChange={(metrics) => onChange({ metrics })}
            />
          </SettingsSection>

          <SettingsSection title={CHART_BUILDER_LABELS.series}>
            <label className="chart-builder-control">
              <span>Phân nhóm chuỗi dữ liệu</span>
              <select
                value={state.series?.fieldId || ""}
                onChange={(event) => onChange({
                  series: event.target.value
                    ? {
                      fieldId: event.target.value,
                      alias: event.target.value,
                      nullHandling: "label",
                    }
                    : null,
                })}
              >
                <option value="">Không phân nhóm</option>
                {seriesFields.map((field) => (
                  <option key={field.id} value={field.id}>{field.label}</option>
                ))}
              </select>
            </label>
          </SettingsSection>

          <SettingsSection title={CHART_BUILDER_LABELS.filters}>
            <FilterEditor
              fields={filterFields}
              filters={state.filters}
              onChange={(filters) => onChange({ filters })}
            />
          </SettingsSection>

          <SettingsSection title="Sắp xếp và giới hạn">
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
                  {selectedAliases.map((alias) => (
                    <option key={alias} value={alias}>{alias}</option>
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
              <label className="chart-builder-control">
                <span>Top N</span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={state.topN || ""}
                  placeholder="Không giới hạn"
                  onChange={(event) => onChange({
                    topN: event.target.value
                      ? Number(event.target.value)
                      : null,
                  })}
                />
              </label>
              <label className="chart-builder-control">
                <span>Giới hạn dòng</span>
                <input
                  type="number"
                  min={1}
                  max={dataset?.maxLimit || 5000}
                  value={state.limit}
                  onChange={(event) => onChange({
                    limit: Math.max(
                      1,
                      Math.min(
                        Number(event.target.value) || 1,
                        dataset?.maxLimit || 5000,
                      ),
                    ),
                  })}
                />
              </label>
            </div>
          </SettingsSection>

          <SettingsSection title="Giao diện">
            <label className="chart-builder-control">
              <span>Bảng màu</span>
              <select
                value={state.chartSettings.theme}
                onChange={(event) => updateSettings({
                  theme: event.target.value as ChartTheme,
                })}
              >
                <option value="flic">FLIC Brand</option>
                <option value="navy">Xanh Navy</option>
                <option value="warm">Gam màu ấm</option>
                <option value="monochrome">Đơn sắc</option>
              </select>
            </label>
            <div className="chart-builder-theme-swatches">
              {themePalettes[state.chartSettings.theme].map((color) => (
                <span key={color} style={{ backgroundColor: color }} />
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

function FilterEditor({
  fields,
  filters,
  onChange,
}: {
  fields: CatalogDatasetMeta["fields"];
  filters: FilterSelection[];
  onChange: (filters: FilterSelection[]) => void;
}) {
  const update = (index: number, changes: Partial<FilterSelection>) => {
    onChange(filters.map((filter, itemIndex) => (
      itemIndex === index ? { ...filter, ...changes } : filter
    )));
  };

  return (
    <div className="chart-builder-filter-editor">
      {filters.map((filter, index) => {
        const field = fields.find((item) => item.id === filter.fieldId);
        const noValue = filter.operator === "is_null"
          || filter.operator === "is_not_null";
        const between = filter.operator === "between";
        const isList = filter.operator === "in"
          || filter.operator === "not_in";
        return (
          <div key={`${filter.fieldId}-${index}`} className="chart-builder-filter-row">
            <div className="chart-builder-series-heading">
              <span>{field?.label || filter.fieldId}</span>
              <button
                type="button"
                onClick={() => onChange(
                  filters.filter((_, itemIndex) => itemIndex !== index),
                )}
                aria-label="Xóa bộ lọc"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <label className="chart-builder-control">
              <span>Toán tử</span>
              <select
                value={filter.operator}
                onChange={(event) => update(index, {
                  operator: event.target.value as FilterOperator,
                  value: null,
                  valueTo: null,
                  values: [],
                })}
              >
                {field?.filterOperators.map((operator) => (
                  <option key={operator} value={operator}>
                    {FILTER_OPERATOR_LABELS[operator]}
                  </option>
                ))}
              </select>
            </label>
            {!noValue && (
              <label className="chart-builder-control">
                <span>{isList ? "Danh sách, cách nhau bởi dấu phẩy" : "Giá trị"}</span>
                <input
                  type={field?.dataType === "date" ? "date" : "text"}
                  value={
                    isList
                      ? (filter.values || []).join(", ")
                      : String(filter.value ?? "")
                  }
                  onChange={(event) => {
                    if (isList) {
                      update(index, {
                        values: event.target.value
                          .split(",")
                          .map((value) => value.trim())
                          .filter(Boolean),
                      });
                    } else {
                      update(index, { value: event.target.value });
                    }
                  }}
                />
              </label>
            )}
            {between && (
              <label className="chart-builder-control">
                <span>Đến giá trị</span>
                <input
                  type={field?.dataType === "date" ? "date" : "text"}
                  value={String(filter.valueTo ?? "")}
                  onChange={(event) => update(index, {
                    valueTo: event.target.value,
                  })}
                />
              </label>
            )}
          </div>
        );
      })}
      <label className="chart-builder-add-series">
        <Plus size={14} />
        <select
          value=""
          aria-label="Thêm bộ lọc"
          onChange={(event) => {
            const field = fields.find(
              (item) => item.id === event.target.value,
            );
            if (!field) return;
            onChange([
              ...filters,
              {
                fieldId: field.id,
                operator: field.filterOperators[0] || "eq",
                value: null,
                values: [],
              },
            ]);
          }}
        >
          <option value="">Thêm bộ lọc</option>
          {fields.map((field) => (
            <option key={field.id} value={field.id}>{field.label}</option>
          ))}
        </select>
      </label>
    </div>
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

export const themePalettes: Record<ChartTheme, string[]> = {
  flic: [
    "#003865",
    "#ED5206",
    "#D73C01",
    "#1565C0",
    "#228A61",
    "#F59E0B",
    "#42A5F5",
  ],
  navy: ["#003865", "#1565C0", "#42A5F5", "#0F6C8D", "#5B8DB8", "#8BB9D9"],
  warm: ["#D73C01", "#ED5206", "#F59E0B", "#C24173", "#E76F51", "#F4A261"],
  monochrome: ["#0F172A", "#334155", "#475569", "#64748B", "#94A3B8", "#CBD5E1"],
};
