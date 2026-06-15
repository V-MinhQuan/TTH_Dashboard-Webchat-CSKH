import { Filter, Info, Layers3, ListPlus, X } from "lucide-react";

import {
  CatalogDatasetMeta,
  DimensionSelection,
  FilterSelection,
  MetricSelection,
} from "../../types/chartBuilder";
import { CHART_FIELD_MIME, ChartFieldDragData } from "./DataFieldsPanel";
import { CHART_BUILDER_LABELS } from "./chartBuilderLabels";

interface Props {
  dataset: CatalogDatasetMeta | null;
  dimensions: DimensionSelection[];
  metrics: MetricSelection[];
  series: DimensionSelection | null | undefined;
  filters: FilterSelection[];
  tooltipFields: string[];
  onDimensionField: (field: ChartFieldDragData) => void;
  onMetricField: (field: ChartFieldDragData) => void;
  onSeriesField: (field: ChartFieldDragData) => void;
  onFilterField: (field: ChartFieldDragData) => void;
  onTooltipField: (field: ChartFieldDragData) => void;
  onDimensionsChange: (value: DimensionSelection[]) => void;
  onMetricsChange: (value: MetricSelection[]) => void;
  onSeriesChange: (value: DimensionSelection | null) => void;
  onFiltersChange: (value: FilterSelection[]) => void;
  onTooltipFieldsChange: (value: string[]) => void;
}

export function DropZoneBar({
  dataset,
  dimensions,
  metrics,
  series,
  filters,
  tooltipFields,
  onDimensionField,
  onMetricField,
  onSeriesField,
  onFilterField,
  onTooltipField,
  onDimensionsChange,
  onMetricsChange,
  onSeriesChange,
  onFiltersChange,
  onTooltipFieldsChange,
}: Props) {
  const labels = new Map(
    dataset?.fields.map((field) => [field.id, field.label]) || [],
  );

  return (
    <div className="chart-builder-drop-zone-row is-dynamic">
      <DropZone
        label={CHART_BUILDER_LABELS.dimensionAxis}
        icon={<Layers3 size={14} />}
        accept={(field) => field.roles.includes("dimension")}
        onField={onDimensionField}
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
        label={CHART_BUILDER_LABELS.metricAxis}
        icon={<ListPlus size={14} />}
        accept={(field) => field.roles.includes("metric")}
        onField={onMetricField}
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
        label={CHART_BUILDER_LABELS.series}
        icon={<Layers3 size={14} />}
        accept={(field) => field.roles.includes("series")}
        onField={onSeriesField}
      >
        {series ? (
          <FieldChip
            label={labels.get(series.fieldId) || series.fieldId}
            onRemove={() => onSeriesChange(null)}
          />
        ) : <DropHint text="Kéo trường phân nhóm chuỗi dữ liệu" />}
      </DropZone>

      <DropZone
        label={CHART_BUILDER_LABELS.filters}
        icon={<Filter size={14} />}
        accept={(field) => field.roles.includes("filter")}
        onField={onFilterField}
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
        label={CHART_BUILDER_LABELS.tooltip}
        icon={<Info size={14} />}
        accept={(field) => (
          dimensions.some((item) => item.fieldId === field.fieldId)
          || metrics.some((item) => item.fieldId === field.fieldId)
          || series?.fieldId === field.fieldId
        )}
        onField={onTooltipField}
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
  label,
  icon,
  children,
  accept,
  onField,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  accept: (field: ChartFieldDragData) => boolean;
  onField: (field: ChartFieldDragData) => void;
}) {
  return (
    <div
      className="chart-builder-drop-zone"
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        event.currentTarget.classList.add("is-dragging-over");
      }}
      onDragLeave={(event) => {
        event.currentTarget.classList.remove("is-dragging-over");
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.currentTarget.classList.remove("is-dragging-over");
        const field = readDraggedField(event);
        if (field && accept(field)) onField(field);
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
      <span>{label}{detail ? ` · ${detail}` : ""}</span>
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
