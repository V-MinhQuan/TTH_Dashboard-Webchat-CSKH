import { Filter, Info, Layers3, ListPlus, X } from "lucide-react";

import {
  CatalogDatasetMeta,
  ChartType,
  DimensionSelection,
  FilterSelection,
  MetricSelection,
} from "../../types/chartBuilder";
import { CHART_FIELD_MIME, ChartFieldDragData } from "./DataFieldsPanel";
import { CHART_BUILDER_LABELS } from "./chartBuilderLabels";
import {
  canUseFieldInSlot,
  type ChartBuilderFieldSlot,
  type FieldSlotContext,
} from "./chartBuilderFieldSlots";

interface Props {
  dataset: CatalogDatasetMeta | null;
  chartType: ChartType;
  dimensions: DimensionSelection[];
  metrics: MetricSelection[];
  series: DimensionSelection | null | undefined;
  filters: FilterSelection[];
  tooltipFields: string[];
  draggedField: ChartFieldDragData | null;
  onDimensionField: (field: ChartFieldDragData) => void;
  onMetricField: (field: ChartFieldDragData) => void;
  onSeriesField: (field: ChartFieldDragData) => void;
  onFilterField: (field: ChartFieldDragData) => void;
  onTooltipField: (field: ChartFieldDragData) => void;
  onInvalidField: (
    slot: ChartBuilderFieldSlot,
    field: ChartFieldDragData,
  ) => void;
  onDimensionsChange: (value: DimensionSelection[]) => void;
  onMetricsChange: (value: MetricSelection[]) => void;
  onSeriesChange: (value: DimensionSelection | null) => void;
  onFiltersChange: (value: FilterSelection[]) => void;
  onTooltipFieldsChange: (value: string[]) => void;
}

export function DropZoneBar({
  dataset,
  chartType,
  dimensions,
  metrics,
  series,
  filters,
  tooltipFields,
  draggedField,
  onDimensionField,
  onMetricField,
  onSeriesField,
  onFilterField,
  onTooltipField,
  onInvalidField,
  onDimensionsChange,
  onMetricsChange,
  onSeriesChange,
  onFiltersChange,
  onTooltipFieldsChange,
}: Props) {
  const labels = new Map(
    dataset?.fields.map((field) => [field.id, field.label]) || [],
  );
  const selectedOutputFieldIds = [
    ...dimensions.map((item) => item.fieldId),
    ...metrics.map((item) => item.fieldId),
    ...(series ? [series.fieldId] : []),
  ];
  const slotContext: FieldSlotContext = {
    chartType,
    selectedOutputFieldIds,
  };

  return (
    <div className="chart-builder-drop-zone-row is-dynamic">
      <DropZone
        slot="dimension"
        label={CHART_BUILDER_LABELS.dimensionAxis}
        icon={<Layers3 size={14} />}
        draggedField={draggedField}
        accept={(field) => canUseFieldInSlot(field, "dimension", slotContext)}
        onField={onDimensionField}
        onInvalidField={onInvalidField}
      >
        {dimensions.length ? dimensions.map((dimension) => (
          <FieldChip
            key={dimension.alias || dimension.fieldId}
            label={labels.get(dimension.fieldId) || dimension.fieldId}
            detail={dimension.dateGrain || undefined}
            onRemove={() => onDimensionsChange(
              dimensions.filter((item) => item !== dimension),
            )}
          />
        )) : <DropHint text="Kéo chiều phân tích vào đây" />}
      </DropZone>

      <DropZone
        slot="metric"
        label={CHART_BUILDER_LABELS.metricAxis}
        icon={<ListPlus size={14} />}
        draggedField={draggedField}
        accept={(field) => canUseFieldInSlot(field, "metric", slotContext)}
        onField={onMetricField}
        onInvalidField={onInvalidField}
      >
        {metrics.length ? metrics.map((metric) => (
          <FieldChip
            key={metric.alias || `${metric.aggregation}_${metric.fieldId}`}
            label={metric.label || labels.get(metric.fieldId) || metric.fieldId}
            detail={metric.aggregation}
            color={metric.color || undefined}
            onRemove={() => onMetricsChange(
              metrics.filter((item) => item !== metric),
            )}
          />
        )) : <DropHint text="Kéo chỉ số vào đây" />}
      </DropZone>

      <DropZone
        slot="series"
        label={CHART_BUILDER_LABELS.series}
        icon={<Layers3 size={14} />}
        draggedField={draggedField}
        accept={(field) => canUseFieldInSlot(field, "series", slotContext)}
        onField={onSeriesField}
        onInvalidField={onInvalidField}
      >
        {series ? (
          <FieldChip
            label={labels.get(series.fieldId) || series.fieldId}
            onRemove={() => onSeriesChange(null)}
          />
        ) : <DropHint text="Kéo trường phân nhóm chuỗi dữ liệu" />}
      </DropZone>

      <DropZone
        slot="filter"
        label={CHART_BUILDER_LABELS.filters}
        icon={<Filter size={14} />}
        draggedField={draggedField}
        accept={(field) => canUseFieldInSlot(field, "filter", slotContext)}
        onField={onFilterField}
        onInvalidField={onInvalidField}
      >
        {filters.length ? filters.map((filter, index) => (
          <FieldChip
            key={`${filter.fieldId}-${index}`}
            label={labels.get(filter.fieldId) || filter.fieldId}
            detail={filter.operator}
            onRemove={() => onFiltersChange(
              filters.filter((_, itemIndex) => itemIndex !== index),
            )}
          />
        )) : <DropHint text="Kéo trường để tạo bộ lọc" />}
      </DropZone>

      <DropZone
        slot="tooltip"
        label={CHART_BUILDER_LABELS.tooltip}
        icon={<Info size={14} />}
        draggedField={draggedField}
        accept={(field) => canUseFieldInSlot(field, "tooltip", slotContext)}
        onField={onTooltipField}
        onInvalidField={onInvalidField}
      >
        {tooltipFields.length ? tooltipFields.map((fieldId) => (
          <FieldChip
            key={fieldId}
            label={labels.get(fieldId) || fieldId}
            onRemove={() => onTooltipFieldsChange(
              tooltipFields.filter((item) => item !== fieldId),
            )}
          />
        )) : <DropHint text="Chỉ nhận trường đã chọn" />}
      </DropZone>
    </div>
  );
}

function DropZone({
  slot,
  label,
  icon,
  children,
  draggedField,
  accept,
  onField,
  onInvalidField,
}: {
  slot: ChartBuilderFieldSlot;
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  draggedField: ChartFieldDragData | null;
  accept: (field: ChartFieldDragData) => boolean;
  onField: (field: ChartFieldDragData) => void;
  onInvalidField: (
    slot: ChartBuilderFieldSlot,
    field: ChartFieldDragData,
  ) => void;
}) {
  const dragAllowed = draggedField ? accept(draggedField) : null;
  return (
    <div
      className={[
        "chart-builder-drop-zone",
        dragAllowed === true ? "is-drop-allowed" : "",
        dragAllowed === false ? "is-drop-blocked" : "",
      ].join(" ")}
      onDragOver={(event) => {
        event.preventDefault();
        const field = draggedField || readDraggedField(event);
        const allowed = field ? accept(field) : true;
        event.dataTransfer.dropEffect = allowed ? "copy" : "none";
        event.currentTarget.classList.add("is-dragging-over");
      }}
      onDragLeave={(event) => {
        event.currentTarget.classList.remove("is-dragging-over");
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.currentTarget.classList.remove("is-dragging-over");
        const field = readDraggedField(event);
        if (!field) return;
        if (accept(field)) {
          onField(field);
          return;
        }
        onInvalidField(slot, field);
      }}
    >
      <div className="chart-builder-drop-zone-label">{icon}{label}</div>
      <div className="chart-builder-drop-zone-content">{children}</div>
    </div>
  );
}

function FieldChip({
  label,
  detail,
  color,
  onRemove,
}: {
  label: string;
  detail?: string;
  color?: string;
  onRemove: () => void;
}) {
  return (
    <span className="chart-builder-field-chip">
      {color && (
        <span
          className="chart-builder-chip-color"
          style={{ backgroundColor: color }}
        />
      )}
      <span>{label}{detail ? ` - ${detail}` : ""}</span>
      <button type="button" aria-label={`Xóa ${label}`} onClick={onRemove}>
        <X size={12} />
      </button>
    </span>
  );
}

function DropHint({ text }: { text: string }) {
  return <span className="chart-builder-drop-hint">{text}</span>;
}

function readDraggedField(
  event: React.DragEvent,
): ChartFieldDragData | null {
  const raw = (
    event.dataTransfer.getData(CHART_FIELD_MIME)
    || event.dataTransfer.getData("text/plain")
  );
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as ChartFieldDragData;
    if (
      typeof value.datasetId === "string"
      && typeof value.fieldId === "string"
      && Array.isArray(value.roles)
    ) {
      return value;
    }
  } catch {
    return null;
  }
  return null;
}
