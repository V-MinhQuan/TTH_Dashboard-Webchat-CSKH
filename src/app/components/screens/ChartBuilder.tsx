import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { FilterValues } from "../FilterPanel";
import { ChartPreview } from "../chartbuilder/ChartPreview";
import { ChartSettingsPanel } from "../chartbuilder/ChartSettingsPanel";
import {
  getChartBuilderPalette,
  paletteColor,
} from "../chartbuilder/chartBuilderPalettes";
import { CHART_BUILDER_LABELS } from "../chartbuilder/chartBuilderLabels";
import {
  canUseFieldInSlot,
  describeFieldSlotRejection,
  type ChartBuilderFieldSlot,
  type FieldSlotContext,
} from "../chartbuilder/chartBuilderFieldSlots";
import {
  buildDimensionSelectionForField,
  normalizeChartBuilderState,
  validateChartConfiguration,
} from "../chartbuilder/chartBuilderValidation";
import { ChartToolbar } from "../chartbuilder/ChartToolbar";
import {
  ChartFieldDragData,
  DataFieldsPanel,
} from "../chartbuilder/DataFieldsPanel";
import { DropZoneBar } from "../chartbuilder/DropZoneBar";
import { SaveConfigModal } from "../chartbuilder/SaveConfigModal";
import {
  deleteConfig,
  fetchData,
  fetchPreview,
  getCatalog,
  getConfigs,
  saveConfig,
} from "../../services/chartBuilderService";
import {
  CatalogDatasetMeta,
  CatalogFieldMeta,
  ChartBuilderState,
  ChartConfigPayload,
  ChartDataResponse,
  CustomChartRequest,
  FilterSelection,
  isCustomChartConfig,
  MetricSelection,
  SavedChartConfig,
} from "../../types/chartBuilder";
import {
  exportChartAsPdf,
  exportChartAsPng,
} from "../../utils/chartExport";

import "./ChartBuilder.css";

const PREVIEW_ID = "chart-builder-export-area";

interface ChartBuilderProps {
  onNavigate: (screen: string) => void;
  filters: FilterValues;
  onFiltersChange: (filters: FilterValues) => void;
}

const emptyState: ChartBuilderState = {
  version: 2,
  mode: "custom",
  datasetId: "",
  chartType: "bar",
  dimensions: [],
  metrics: [],
  series: null,
  tooltipFields: [],
  filters: [],
  sort: [],
  topN: 20,
  limit: 500,
  title: CHART_BUILDER_LABELS.title,
  chartSettings: {
    showLegend: true,
    showDataLabels: false,
    showGrid: true,
    showTooltip: true,
    theme: "flic",
  },
};

export function ChartBuilder({
  onNavigate,
  filters: globalFilters,
  onFiltersChange,
}: ChartBuilderProps) {
  const viewportWidth = useViewportWidth();
  const [datasets, setDatasets] = useState<CatalogDatasetMeta[]>([]);
  const [state, setState] = useState<ChartBuilderState>(emptyState);
  const [legacyConfig, setLegacyConfig] = useState<ChartConfigPayload | null>(null);
  const [data, setData] = useState<ChartDataResponse | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [dataError, setDataError] = useState("");
  const [configs, setConfigs] = useState<SavedChartConfig[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dataPanelOpen, setDataPanelOpen] = useState(
    () => window.innerWidth > 1100,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draggedField, setDraggedField] = useState<ChartFieldDragData | null>(
    null,
  );

  const selectedDataset = useMemo(
    () => datasets.find((dataset) => dataset.id === state.datasetId) || null,
    [datasets, state.datasetId],
  );
  const activeChartType = legacyConfig?.chartType || state.chartType;
  const groupBy = legacyConfig?.groupBy
    || state.dimensions[0]?.alias
    || state.dimensions[0]?.fieldId
    || "";
  const palette = getChartBuilderPalette(state.chartSettings.theme);
  const isMobileBuilder = viewportWidth <= 1100;
  const drawerOpen = settingsOpen || (isMobileBuilder && dataPanelOpen);
  const customValidation = useMemo(
    () => validateChartConfiguration(state, selectedDataset),
    [state, selectedDataset],
  );
  const canSave = Boolean(
    state.title.trim()
    && (
      legacyConfig
      || customValidation.valid
    ),
  );
  const selectedFieldIds = useMemo(() => [
    ...state.dimensions.map((item) => item.fieldId),
    ...state.metrics.map((item) => item.fieldId),
    ...(state.series ? [state.series.fieldId] : []),
    ...state.filters.map((item) => item.fieldId),
  ], [state.dimensions, state.metrics, state.series, state.filters]);
  const selectedOutputFieldIds = useMemo(() => [
    ...state.dimensions.map((item) => item.fieldId),
    ...state.metrics.map((item) => item.fieldId),
    ...(state.series ? [state.series.fieldId] : []),
  ], [state.dimensions, state.metrics, state.series]);
  const fieldSlotContext = useMemo<FieldSlotContext>(() => ({
    chartType: state.chartType,
    selectedOutputFieldIds,
  }), [state.chartType, selectedOutputFieldIds]);
  const customRequest = useMemo(
    () => buildCustomRequest(state),
    [
      state.datasetId,
      state.chartType,
      state.dimensions,
      state.metrics,
      state.series,
      state.tooltipFields,
      state.filters,
      state.sort,
      state.topN,
      state.limit,
    ],
  );
  const seriesDisplayByKey = useMemo(
    () => buildSeriesDisplayMap(state, selectedDataset),
    [state.metrics, state.dimensions, state.series, state.chartSettings.theme, selectedDataset],
  );

  const loadConfigs = useCallback(async () => {
    setLoadingConfigs(true);
    try {
      setConfigs(await getConfigs());
    } catch (error) {
      toast.error(
        userFacingError(error, "Không thể tải cấu hình đã lưu."),
      );
    } finally {
      setLoadingConfigs(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([getCatalog(), getConfigs()])
      .then(([catalog, configItems]) => {
        if (!active) return;
        setDatasets(catalog.datasets);
        setConfigs(configItems);
        const firstAvailable = catalog.datasets.find(
          (dataset) => dataset.available,
        );
        if (firstAvailable) {
          setState((current) => configureForDataset(
            current,
            firstAvailable,
          ));
        }
      })
      .catch((error) => {
        if (!active) return;
        setCatalogError(
          userFacingError(error, "Không thể tải bộ dữ liệu."),
        );
      })
      .finally(() => {
        if (!active) return;
        setLoadingCatalog(false);
        setLoadingConfigs(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const ready = legacyConfig
      ? Boolean(legacyConfig.groupBy && legacyConfig.yAxes.length)
      : customValidation.valid;
    if (!ready) {
      setData(null);
      setDataError("");
      setLoadingData(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoadingData(true);
      setDataError("");
      try {
        const response = legacyConfig
          ? await fetchData(
            {
              ...legacyConfig,
              version: 1,
              mode: "predefined",
              limit: 500,
            },
            controller.signal,
          )
          : await fetchPreview(customRequest, controller.signal);
        setData(response);
      } catch (error) {
        if (controller.signal.aborted) return;
        setData(null);
        setDataError(
          userFacingError(error, CHART_BUILDER_LABELS.chartError),
        );
      } finally {
        if (!controller.signal.aborted) setLoadingData(false);
      }
    }, 500);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [customRequest, customValidation.valid, legacyConfig, refreshKey]);

  const updateState = (changes: Partial<ChartBuilderState>) => {
    setLegacyConfig(null);
    setState((current) => {
      const next = normalizeChartBuilderState(
        { ...current, ...changes },
        selectedDataset,
      );
      if (changes.metrics || changes.dimensions || changes.series !== undefined) {
        const nextMetrics = changes.metrics || next.metrics;
        const metricAliases = new Set(
          nextMetrics.map(
            (metric) => (
              metric.alias || `${metric.aggregation}_${metric.fieldId}`
            ),
          ),
        );
        const selectedFieldIds = new Set([
          ...next.dimensions.map((item) => item.fieldId),
          ...nextMetrics.map((item) => item.fieldId),
          ...(next.series ? [next.series.fieldId] : []),
        ]);
        next.sort = next.sort.filter(
          (item) => (
            metricAliases.has(item.fieldId)
            || next.dimensions.some(
              (dimension) => (
                dimension.fieldId === item.fieldId
                || dimension.alias === item.fieldId
              ),
            )
          ),
        );
        next.tooltipFields = next.tooltipFields.filter(
          (fieldId) => selectedFieldIds.has(fieldId),
        );
      }
      return next;
    });
  };

  const handleDatasetChange = (datasetId: string) => {
    const dataset = datasets.find((item) => item.id === datasetId);
    if (!dataset?.available) return;
    setLegacyConfig(null);
    setState((current) => configureForDataset(
      current,
      dataset,
    ));
    setDataError("");
  };

  const handleFieldSelectForSlot = (
    slot: ChartBuilderFieldSlot,
    field: ChartFieldDragData,
  ) => {
    if (!canUseFieldInSlot(field, slot, fieldSlotContext)) {
      toast.warning(describeFieldSlotRejection(field, slot, fieldSlotContext));
      return;
    }

    if (slot === "dimension") addDimensionField(field);
    else if (slot === "metric") addMetricField(field);
    else if (slot === "series") addSeriesField(field);
    else if (slot === "filter") addFilterField(field);
    else addTooltipField(field);
  };

  const handleFieldSelect = (field: ChartFieldDragData) => {
    setLegacyConfig(null);
    if (canUseFieldInSlot(field, "metric", fieldSlotContext)) {
      handleFieldSelectForSlot("metric", field);
      return;
    }
    if (canUseFieldInSlot(field, "dimension", fieldSlotContext)) {
      handleFieldSelectForSlot("dimension", field);
      return;
    }
    if (canUseFieldInSlot(field, "filter", fieldSlotContext)) {
      handleFieldSelectForSlot("filter", field);
      return;
    }
    toast.warning("Trường này chưa có vị trí phù hợp với cấu hình hiện tại.");
  };

  const addDimensionField = (field: ChartFieldDragData) => {
    if (!canUseFieldInSlot(field, "dimension", fieldSlotContext)) return;
    setLegacyConfig(null);
    setState((current) => reconcileSelectedOutputs({
      ...current,
      dimensions: [buildDimensionSelectionForField({
        id: field.fieldId,
        dataType: field.dataType,
        dateGrains: [],
      })],
      chartType: field.dataType === "date" ? "line" : current.chartType,
    }));
  };

  const addMetricField = (field: ChartFieldDragData) => {
    if (!canUseFieldInSlot(field, "metric", fieldSlotContext)) return;
    const fieldMeta = selectedDataset?.fields.find(
      (item) => item.id === field.fieldId,
    );
    if (!fieldMeta) return;
    setLegacyConfig(null);
    setState((current) => {
      const existingIndex = current.metrics.findIndex(
        (metric) => metric.fieldId === field.fieldId,
      );
      if (existingIndex >= 0) {
        return reconcileSelectedOutputs({
          ...current,
          metrics: current.metrics.filter(
            (_, index) => index !== existingIndex,
          ),
        });
      }
      const metric = createMetric(
        fieldMeta,
        current.metrics.length,
        current.chartType,
      );
      return {
        ...current,
        metrics: [...current.metrics, metric],
      };
    });
  };

  const addSeriesField = (field: ChartFieldDragData) => {
    if (!canUseFieldInSlot(field, "series", fieldSlotContext)) return;
    updateState({
      series: buildDimensionSelectionForField({
        id: field.fieldId,
        dataType: field.dataType,
        dateGrains: [],
      }),
    });
  };

  const addFilterField = (field: ChartFieldDragData) => {
    if (!canUseFieldInSlot(field, "filter", fieldSlotContext)) return;
    const fieldMeta = selectedDataset?.fields.find(
      (item) => item.id === field.fieldId,
    );
    if (!fieldMeta) return;
    const filter: FilterSelection = {
      fieldId: field.fieldId,
      operator: fieldMeta.filterOperators[0] || "eq",
      value: null,
      values: [],
    };
    updateState({ filters: [...state.filters, filter] });
  };

  const addTooltipField = (field: ChartFieldDragData) => {
    if (!canUseFieldInSlot(field, "tooltip", fieldSlotContext)) return;
    if (state.tooltipFields.includes(field.fieldId)) return;
    updateState({
      tooltipFields: [...state.tooltipFields, field.fieldId],
    });
  };

  const handleInvalidFieldDrop = (
    slot: ChartBuilderFieldSlot,
    field: ChartFieldDragData,
  ) => {
    toast.warning(describeFieldSlotRejection(field, slot, fieldSlotContext));
  };

  const handleFiltersChange = (filters: FilterSelection[]) => {
    updateState({ filters });
    onFiltersChange(dynamicFiltersToGlobal(globalFilters, filters, selectedDataset));
  };

  const handleSave = async (name: string, description: string) => {
    setSaving(true);
    try {
      await saveConfig({
        name,
        description: description || null,
        config: legacyConfig
          ? { ...legacyConfig, title: state.title }
          : state,
      });
      setSaveOpen(false);
      await loadConfigs();
      toast.success("Đã lưu biểu đồ.");
    } catch (error) {
      toast.error(
        userFacingError(error, "Không thể lưu biểu đồ."),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleApplyConfig = (saved: SavedChartConfig) => {
    if (isCustomChartConfig(saved.config)) {
      const dataset = datasets.find(
        (item) => item.id === saved.config.datasetId && item.available,
      );
      if (!dataset) {
        toast.error("Bộ dữ liệu của cấu hình này hiện không khả dụng.");
        return;
      }
      setLegacyConfig(null);
      setState(normalizeCustomConfig(saved.config, dataset));
    } else {
      setLegacyConfig({
        ...saved.config,
        version: 1,
        mode: "predefined",
      });
      setState((current) => ({
        ...current,
        title: saved.config.title || saved.name,
        chartType: saved.config.chartType,
      }));
    }
    setSettingsOpen(false);
    toast.success(`Đã áp dụng cấu hình “${saved.name}”.`);
  };

  const handleDeleteConfig = async (saved: SavedChartConfig) => {
    if (!window.confirm(`Xóa cấu hình “${saved.name}”?`)) return;
    try {
      await deleteConfig(saved.id);
      setConfigs((current) => current.filter((item) => item.id !== saved.id));
      toast.success("Đã xóa cấu hình biểu đồ.");
    } catch (error) {
      toast.error(
        userFacingError(error, "Không thể xóa cấu hình."),
      );
    }
  };

  const handleExport = async (format: "png" | "pdf") => {
    try {
      if (format === "png") {
        await exportChartAsPng(PREVIEW_ID, state.title);
      } else {
        await exportChartAsPdf(PREVIEW_ID, state.title);
      }
      toast.success(`Đã xuất biểu đồ ${format.toUpperCase()}.`);
    } catch (error) {
      toast.error(
        userFacingError(error, "Không thể xuất biểu đồ."),
      );
    }
  };

  const reset = () => {
    const firstAvailable = datasets.find((dataset) => dataset.available);
    setLegacyConfig(null);
    setState(
      firstAvailable
        ? configureForDataset(emptyState, firstAvailable)
        : emptyState,
    );
    setData(null);
    setDataError("");
    toast.info("Đã đặt lại Trình tạo biểu đồ.");
  };

  const closeDrawers = () => {
    setSettingsOpen(false);
    if (isMobileBuilder) setDataPanelOpen(false);
  };

  return (
    <div className="chart-builder-shell">
      <div
        className={`chart-builder-layout${
          dataPanelOpen ? "" : " is-data-collapsed"
        }`}
      >
        <DataFieldsPanel
          datasets={datasets}
          selectedDataset={selectedDataset}
          datasetId={state.datasetId}
          chartType={state.chartType}
          loading={loadingCatalog}
          error={catalogError}
          selectedFieldIds={selectedFieldIds}
          selectedOutputFieldIds={selectedOutputFieldIds}
          configs={configs}
          loadingConfigs={loadingConfigs}
          open={dataPanelOpen}
          onDatasetChange={handleDatasetChange}
          onFieldSelect={handleFieldSelect}
          onFieldSelectForSlot={handleFieldSelectForSlot}
          onFieldDragStart={setDraggedField}
          onFieldDragEnd={() => setDraggedField(null)}
          onApplyConfig={handleApplyConfig}
          onDeleteConfig={handleDeleteConfig}
          onClose={() => setDataPanelOpen(false)}
        />

        <main className="chart-builder-workspace">
          <ChartToolbar
            title={state.title}
            saveDisabled={!canSave}
            onTitleChange={(title) => setState((current) => ({
              ...current,
              title,
            }))}
            onBack={() => onNavigate("overview")}
            onReset={reset}
            onSave={() => setSaveOpen(true)}
            onToggleDataPanel={() => {
              setSettingsOpen(false);
              setDataPanelOpen((open) => !open);
            }}
            onToggleSettings={() => {
              if (isMobileBuilder) setDataPanelOpen(false);
              setSettingsOpen((open) => !open);
            }}
          />

          <div className="chart-builder-workspace-scroll">
            {legacyConfig && (
              <div className="chart-builder-legacy-banner">
                Đang xem cấu hình cũ ({legacyConfig.sourceId}). Nguồn dữ liệu
                tương thích được giữ nguyên để bảo toàn kết quả.
              </div>
            )}
            <DropZoneBar
              dataset={selectedDataset}
              chartType={state.chartType}
              dimensions={state.dimensions}
              metrics={state.metrics}
              series={state.series}
              filters={state.filters}
              tooltipFields={state.tooltipFields}
              draggedField={draggedField}
              onDimensionField={addDimensionField}
              onMetricField={addMetricField}
              onSeriesField={addSeriesField}
              onFilterField={addFilterField}
              onTooltipField={addTooltipField}
              onInvalidField={handleInvalidFieldDrop}
              onDimensionsChange={(dimensions) => updateState({ dimensions })}
              onMetricsChange={(metrics) => updateState({ metrics })}
              onSeriesChange={(series) => updateState({ series })}
              onFiltersChange={handleFiltersChange}
              onTooltipFieldsChange={(tooltipFields) => updateState({
                tooltipFields,
              })}
            />

            <section className="chart-builder-preview-card">
              <div className="chart-builder-preview-header">
                <div>
                  <h1>{state.title || CHART_BUILDER_LABELS.title}</h1>
                  <p>
                    {legacyConfig
                      ? `Nguồn dữ liệu cũ: ${legacyConfig.sourceId}`
                      : selectedDataset?.label || "Chưa chọn bộ dữ liệu"}
                    {data?.generatedAt
                      ? ` · Cập nhật ${new Date(data.generatedAt).toLocaleString("vi-VN")}`
                      : ""}
                    {data?.execution
                      ? ` · ${data.execution.rowCount} dòng · ${data.execution.executionTimeMs} ms`
                      : ""}
                  </p>
                  {data?.execution?.truncated && (
                    <p className="chart-builder-truncated-note">
                      Kết quả đã chạm giới hạn {data.execution.limit} dòng.
                    </p>
                  )}
                </div>
                <div className="chart-builder-export-actions">
                  <button
                    type="button"
                    className="chart-builder-secondary-button"
                    onClick={() => setRefreshKey((value) => value + 1)}
                    disabled={!legacyConfig && !customValidation.valid}
                    title="Làm mới biểu đồ"
                  >
                    <RefreshCw size={14} />
                  </button>
                  <button
                    type="button"
                    className="chart-builder-secondary-button"
                    disabled={!data?.rows.length}
                    onClick={() => handleExport("png")}
                  >
                    <Download size={14} /> PNG
                  </button>
                  <button
                    type="button"
                    className="chart-builder-secondary-button"
                    disabled={!data?.rows.length}
                    onClick={() => handleExport("pdf")}
                  >
                    <FileText size={14} /> PDF
                  </button>
                </div>
              </div>

              <div id={PREVIEW_ID} className="chart-builder-export-area">
                <div className="chart-builder-export-title">
                  {state.title || CHART_BUILDER_LABELS.title}
                </div>
                <ChartPreview
                  chartType={activeChartType}
                  groupBy={groupBy}
                  data={data}
                  loading={loadingData}
                  error={dataError}
                  configured={Boolean(legacyConfig || selectedDataset)}
                  invalidMessages={
                    legacyConfig || customValidation.valid
                      ? []
                      : customValidation.messages
                  }
                  showLegend={state.chartSettings.showLegend}
                  showDataLabels={state.chartSettings.showDataLabels}
                  showGrid={state.chartSettings.showGrid}
                  showTooltip={state.chartSettings.showTooltip}
                  palette={palette}
                  seriesDisplayByKey={seriesDisplayByKey}
                />
              </div>
            </section>
          </div>
        </main>

        <ChartSettingsPanel
          dataset={selectedDataset}
          state={state}
          open={settingsOpen}
          legacyMode={Boolean(legacyConfig)}
          onChange={updateState}
          onClose={() => setSettingsOpen(false)}
        />
      </div>

      <button
        type="button"
        className={`chart-builder-backdrop${drawerOpen ? " is-open" : ""}`}
        aria-label="Đóng bảng điều khiển"
        onClick={closeDrawers}
      />

      <SaveConfigModal
        open={saveOpen}
        defaultName={state.title || CHART_BUILDER_LABELS.title}
        saving={saving}
        onOpenChange={setSaveOpen}
        onSave={handleSave}
      />
    </div>
  );
}

function configureForDataset(
  current: ChartBuilderState,
  dataset: CatalogDatasetMeta,
): ChartBuilderState {
  const dimensionField = dataset.fields.find(
    (field) => field.id === dataset.defaultDimension && field.available,
  );
  const metricField = dataset.fields.find(
    (field) => field.id === dataset.defaultMetric && field.available,
  );
  const chartType = dimensionField?.dataType === "date" ? "line" : "bar";
  const metric = metricField
    ? createMetric(
      metricField,
      0,
      chartType,
    )
    : null;
  return {
    ...current,
    version: 2,
    mode: "custom",
    datasetId: dataset.id,
    chartType,
    dimensions: dimensionField
      ? [buildDimensionSelectionForField(dimensionField)]
      : [],
    metrics: metric ? [metric] : [],
    series: null,
    tooltipFields: [],
    filters: [],
    sort: metric?.alias
      ? [{ fieldId: metric.alias, direction: "desc" }]
      : [],
    topN: 20,
    limit: dataset.defaultLimit,
  };
}

function createMetric(
  field: CatalogFieldMeta,
  index: number,
  chartType: ChartBuilderState["chartType"],
): MetricSelection {
  const aggregation = (
    field.defaultAggregation
    || field.aggregations[0]
    || "count"
  );
  return {
    fieldId: field.id,
    aggregation,
    alias: `metric_${field.id}_${index + 1}`,
    label: field.label,
    color: null,
    axisGroup: "left",
    seriesType: chartType === "combo"
      ? (index === 0 ? "bar" : "line")
      : null,
    numberFormat: field.semanticType === "duration_minutes"
      ? "minutes"
      : "number",
  };
}

function buildCustomRequest(state: ChartBuilderState): CustomChartRequest {
  return {
    version: 2,
    mode: "custom",
    datasetId: state.datasetId,
    chartType: state.chartType,
    dimensions: state.dimensions,
    metrics: state.metrics,
    series: state.series,
    tooltipFields: state.tooltipFields,
    filters: state.filters.filter(isCompleteFilter),
    sort: state.sort,
    topN: state.topN,
    limit: state.limit,
  };
}

function buildSeriesDisplayMap(
  state: ChartBuilderState,
  dataset: CatalogDatasetMeta | null,
) {
  const fieldLabels = new Map(
    dataset?.fields.map((field) => [field.id, field.label]) || [],
  );
  const entries = state.metrics.map((metric, index) => {
    const key = metric.alias || `${metric.aggregation}_${metric.fieldId}`;
    return [
      key,
      {
        label: metric.label || fieldLabels.get(metric.fieldId) || "Chỉ số",
        color: metric.color || paletteColor(state.chartSettings.theme, index),
        axisGroup: metric.axisGroup,
        seriesType: metric.seriesType,
        numberFormat: metric.numberFormat,
      },
    ] as const;
  });

  for (const dimension of state.dimensions) {
    const key = dimension.alias || dimension.fieldId;
    entries.push([
      key,
      {
        label: dimension.label || fieldLabels.get(dimension.fieldId) || "Chiều phân tích",
        color: paletteColor(state.chartSettings.theme, entries.length),
      },
    ]);
  }

  if (state.series) {
    const key = state.series.alias || state.series.fieldId;
    entries.push([
      key,
      {
        label: state.series.label || fieldLabels.get(state.series.fieldId) || "Chuỗi dữ liệu",
        color: paletteColor(state.chartSettings.theme, entries.length),
      },
    ]);
  }

  return Object.fromEntries(entries);
}

function isCompleteFilter(filter: FilterSelection) {
  if (filter.operator === "is_null" || filter.operator === "is_not_null") {
    return true;
  }
  if (filter.operator === "in" || filter.operator === "not_in") {
    return Boolean(filter.values?.length);
  }
  if (filter.operator === "between") {
    return hasFilterValue(filter.value) && hasFilterValue(filter.valueTo);
  }
  return hasFilterValue(filter.value);
}

function hasFilterValue(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function normalizeCustomConfig(
  config: ChartBuilderState,
  dataset: CatalogDatasetMeta | null,
): ChartBuilderState {
  return normalizeChartBuilderState({
    ...emptyState,
    ...config,
    dimensions: config.dimensions || [],
    metrics: config.metrics || [],
    series: config.series || null,
    tooltipFields: config.tooltipFields || [],
    filters: config.filters || [],
    sort: config.sort || [],
    chartSettings: {
      ...emptyState.chartSettings,
      ...(config.chartSettings || {}),
    },
  }, dataset);
}

function dynamicFiltersToGlobal(
  current: FilterValues,
  filters: FilterSelection[],
  dataset: CatalogDatasetMeta | null,
): FilterValues {
  const next = { ...current };
  for (const filter of filters) {
    const field = dataset?.fields.find((item) => item.id === filter.fieldId);
    if (field?.semanticType === "channel" && filter.operator === "eq") {
      next.channel = dbChannelToGlobal(String(filter.value || ""));
    }
    if (
      field?.dataType === "date"
      && filter.operator === "between"
    ) {
      next.dateRange = "Tùy chỉnh";
      next.customDateFrom = String(filter.value || "");
      next.customDateTo = String(filter.valueTo || "");
    }
  }
  return next;
}

function reconcileSelectedOutputs(
  state: ChartBuilderState,
): ChartBuilderState {
  const outputAliases = new Set([
    ...state.dimensions.flatMap((item) => [
      item.fieldId,
      item.alias || item.fieldId,
    ]),
    ...state.metrics.flatMap((item) => [
      item.fieldId,
      item.alias || `${item.aggregation}_${item.fieldId}`,
    ]),
    ...(state.series
      ? [state.series.fieldId, state.series.alias || state.series.fieldId]
      : []),
  ]);
  const outputFieldIds = new Set([
    ...state.dimensions.map((item) => item.fieldId),
    ...state.metrics.map((item) => item.fieldId),
    ...(state.series ? [state.series.fieldId] : []),
  ]);
  return {
    ...state,
    sort: state.sort.filter((item) => outputAliases.has(item.fieldId)),
    tooltipFields: state.tooltipFields.filter(
      (fieldId) => outputFieldIds.has(fieldId),
    ),
  };
}

function dbChannelToGlobal(value: string) {
  const channels: Record<string, string> = {
    ZaloBusiness: "Zalo Business",
    ZaloOA: "Zalo OA",
    ChatWidget: "Chat Widget",
    Facebook: "Facebook",
  };
  return channels[value] || "Tất cả";
}

function userFacingError(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  return /[À-ỹ]/u.test(error.message) ? error.message : fallback;
}

function useViewportWidth() {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return width;
}
