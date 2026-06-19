import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleGauge,
  CircleHelp,
  GripVertical,
  Hash,
  MessageSquareText,
  Radio,
  Search,
  Sigma,
  Sparkles,
  Tags,
  UserRoundCog,
} from "lucide-react";

import {
  CatalogDatasetMeta,
  CatalogFieldMeta,
  ChartType,
  FieldRole,
  SavedChartConfig,
} from "../../types/chartBuilder";
import { SavedConfigsList } from "./SavedConfigsList";
import {
  CHART_BUILDER_LABELS,
  DIMENSION_GUIDANCE,
  METRIC_GUIDANCE,
} from "./chartBuilderLabels";
import {
  FIELD_SLOT_META,
  FIELD_SLOT_ORDER,
  getFieldSlotCapabilities,
  getFieldSlotSummary,
  type ChartBuilderFieldSlot,
  type FieldSlotContext,
  toSlotCapableField,
} from "./chartBuilderFieldSlots";

export const CHART_FIELD_MIME = "application/x-flic-chart-field";

export interface ChartFieldDragData {
  datasetId: string;
  fieldId: string;
  label: string;
  dataType: CatalogFieldMeta["dataType"];
  semanticType: string;
  roles: FieldRole[];
}

interface Props {
  datasets: CatalogDatasetMeta[];
  selectedDataset: CatalogDatasetMeta | null;
  datasetId: string;
  chartType: ChartType;
  loading: boolean;
  error: string;
  selectedFieldIds: string[];
  selectedOutputFieldIds: string[];
  configs: SavedChartConfig[];
  loadingConfigs: boolean;
  open: boolean;
  onDatasetChange: (datasetId: string) => void;
  onFieldSelect: (field: ChartFieldDragData) => void;
  onFieldSelectForSlot: (
    slot: ChartBuilderFieldSlot,
    field: ChartFieldDragData,
  ) => void;
  onFieldDragStart?: (field: ChartFieldDragData) => void;
  onFieldDragEnd?: () => void;
  onApplyConfig: (config: SavedChartConfig) => void;
  onDeleteConfig: (config: SavedChartConfig) => void;
  onClose?: () => void;
}

type FieldSlotFilter = "all" | ChartBuilderFieldSlot;

interface FieldGroup {
  id: string;
  label: string;
  icon: typeof CalendarDays;
  fields: CatalogFieldMeta[];
}

export function DataFieldsPanel({
  datasets,
  selectedDataset,
  datasetId,
  chartType,
  loading,
  error,
  selectedFieldIds,
  selectedOutputFieldIds,
  configs,
  loadingConfigs,
  open,
  onDatasetChange,
  onFieldSelect,
  onFieldSelectForSlot,
  onFieldDragStart,
  onFieldDragEnd,
  onApplyConfig,
  onDeleteConfig,
  onClose,
}: Props) {
  const [search, setSearch] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [slotFilter, setSlotFilter] = useState<FieldSlotFilter>("all");
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const slotContext = useMemo<FieldSlotContext>(
    () => ({ chartType, selectedOutputFieldIds }),
    [chartType, selectedOutputFieldIds],
  );
  const groups = useMemo(
    () => buildFieldGroups(selectedDataset, search, slotFilter, slotContext),
    [selectedDataset, search, slotFilter, slotContext],
  );
  const recentFields = useMemo(
    () => selectedDataset?.fields.filter(
      (field) => field.available && selectedFieldIds.includes(field.id),
    ).slice(0, 6) || [],
    [selectedDataset, selectedFieldIds],
  );

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((current) => (
      current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId]
    ));
  };

  return (
    <aside
      className={`chart-builder-data-panel${open ? " is-open" : ""}`}
      aria-label="Trường dữ liệu"
    >
      <div className="chart-builder-panel-header">
        <div>
          <h2>Trường dữ liệu</h2>
          <p>Kéo thả hoặc nhấn để chọn trường</p>
        </div>
        {onClose && (
          <button
            type="button"
            className="chart-builder-panel-close"
            onClick={onClose}
            aria-label="Đóng trường dữ liệu"
          >
            x
          </button>
        )}
      </div>

      <div className="chart-builder-data-content">
        {loading && <PanelState text={CHART_BUILDER_LABELS.loadingCatalog} />}
        {error && <PanelState text={error} error />}

        {!loading && datasets.length > 0 && (
          <div className="chart-builder-source-selector">
            <label>
              <span>{CHART_BUILDER_LABELS.datasets}</span>
              <select
                value={datasetId}
                onChange={(event) => onDatasetChange(event.target.value)}
              >
                {datasets.map((dataset) => (
                  <option
                    key={dataset.id}
                    value={dataset.id}
                    disabled={!dataset.available}
                  >
                    {dataset.label}
                    {dataset.available ? "" : " (không khả dụng)"}
                  </option>
                ))}
              </select>
            </label>
            <p>{selectedDataset?.description}</p>
            {selectedDataset?.unavailableReason && (
              <div className="chart-builder-source-warning">
                {selectedDataset.unavailableReason}
              </div>
            )}
          </div>
        )}

        {selectedDataset && (
          <>
            <label className="chart-builder-field-search">
              <Search size={14} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={CHART_BUILDER_LABELS.searchPlaceholder}
              />
            </label>

            <div className="chart-builder-field-legend">
              <span>
                <Hash size={11} />
                {CHART_BUILDER_LABELS.dimension}
                <HelpButton
                  label="Giải thích chiều phân tích"
                  description={DIMENSION_GUIDANCE}
                />
              </span>
              <span>
                <Sigma size={11} />
                {CHART_BUILDER_LABELS.metric}
                <HelpButton
                  label="Giải thích chỉ số đo lường"
                  description={METRIC_GUIDANCE}
                />
              </span>
            </div>

            <div
              className="chart-builder-slot-filter"
              aria-label="Lọc trường theo vị trí"
            >
              {fieldSlotFilters.map((filter) => (
                <button
                  type="button"
                  key={filter.id}
                  className={slotFilter === filter.id ? "is-active" : ""}
                  title={filter.description}
                  onClick={() => setSlotFilter(filter.id)}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {recentFields.length > 0 && (
              <section className="chart-builder-recent-fields">
                <div className="chart-builder-saved-configs-title">
                  Dùng gần đây
                </div>
                <div>
                  {recentFields.map((field) => (
                    <button
                      type="button"
                      key={field.id}
                      onClick={() => onFieldSelect(
                        toDragData(selectedDataset.id, field),
                      )}
                    >
                      {field.label}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <div className="chart-builder-field-groups">
              {groups.map((group) => {
                const Icon = group.icon;
                const collapsed = collapsedGroups.includes(group.id);
                return (
                  <section key={group.id} className="chart-builder-field-group">
                    <button
                      type="button"
                      className="chart-builder-field-group-toggle"
                      onClick={() => toggleGroup(group.id)}
                    >
                      <span className="chart-builder-field-group-title">
                        <Icon size={15} />
                        {group.label}
                      </span>
                      {collapsed
                        ? <ChevronRight size={15} />
                        : <ChevronDown size={15} />}
                    </button>
                    {!collapsed && (
                      <div className="chart-builder-field-list">
                        {group.fields.map((field) => {
                          const selected = selectedFieldIds.includes(field.id);
                          const dragData = toDragData(selectedDataset.id, field);
                          const isMetric = field.roles.includes("metric");
                          const slotField = toSlotCapableField(field);
                          const capabilities = getFieldSlotCapabilities(
                            slotField,
                            slotContext,
                          );
                          const slotSummary = getFieldSlotSummary(
                            slotField,
                            slotContext,
                          );
                          const active = activeFieldId === field.id;
                          return (
                            <div
                              key={field.id}
                              className={[
                                "chart-builder-field-card",
                                active ? "is-open" : "",
                              ].join(" ")}
                            >
                              <button
                                type="button"
                                draggable
                                title={`${field.label} - ${slotSummary}`}
                                aria-expanded={active}
                                className={[
                                  "chart-builder-field-item",
                                  selected ? "is-selected" : "",
                                ].join(" ")}
                                onClick={() => {
                                  onFieldSelect(dragData);
                                  setActiveFieldId(active ? null : field.id);
                                }}
                                onDragStart={(event) => {
                                  const payload = JSON.stringify(dragData);
                                  event.dataTransfer.effectAllowed = "copy";
                                  event.dataTransfer.setData(CHART_FIELD_MIME, payload);
                                  event.dataTransfer.setData("text/plain", payload);
                                  onFieldDragStart?.(dragData);
                                }}
                                onDragEnd={() => onFieldDragEnd?.()}
                              >
                                <GripVertical size={14} className="chart-builder-grip" />
                                <span
                                  className={`chart-builder-field-kind ${
                                    isMetric ? "metric" : "dimension"
                                  }`}
                                >
                                  {isMetric ? <Sigma size={12} /> : <Hash size={12} />}
                                </span>
                                <span className="chart-builder-field-copy">
                                  <strong>{field.label}</strong>
                                  <small>{dataTypeLabels[field.dataType]}</small>
                                </span>
                                <SlotBadges
                                  capabilities={capabilities}
                                  slotSummary={slotSummary}
                                />
                              </button>
                              {active && (
                                <div className="chart-builder-field-actions">
                                  <span>Thêm vào</span>
                                  {capabilities.length ? capabilities.map((slot) => (
                                    <button
                                      type="button"
                                      key={slot}
                                      title={FIELD_SLOT_META[slot].description}
                                      onClick={() => {
                                        onFieldSelectForSlot(slot, dragData);
                                        setActiveFieldId(null);
                                      }}
                                    >
                                      {FIELD_SLOT_META[slot].menuLabel}
                                    </button>
                                  )) : (
                                    <em>Chưa có vị trí phù hợp.</em>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}
              {!groups.length && (
                <PanelState text="Không tìm thấy trường phù hợp." />
              )}
            </div>
          </>
        )}

        <SavedConfigsList
          configs={configs}
          loading={loadingConfigs}
          onApply={onApplyConfig}
          onDelete={onDeleteConfig}
          embedded
        />
      </div>
    </aside>
  );
}

function PanelState({ text, error = false }: { text: string; error?: boolean }) {
  return (
    <div className={`chart-builder-panel-state${error ? " is-error" : ""}`}>
      {text}
    </div>
  );
}

function HelpButton({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      className="chart-builder-help-button"
      aria-label={label}
      title={description}
    >
      <CircleHelp size={12} />
    </button>
  );
}

function SlotBadges({
  capabilities,
  slotSummary,
}: {
  capabilities: ChartBuilderFieldSlot[];
  slotSummary: string;
}) {
  return (
    <span
      className="chart-builder-field-slot-badges"
      aria-label={`Có thể dùng cho: ${slotSummary}`}
    >
      {capabilities.map((slot) => (
        <span
          key={slot}
          className={`chart-builder-slot-badge is-${slot}`}
          title={`${FIELD_SLOT_META[slot].label}: ${FIELD_SLOT_META[slot].description}`}
        >
          {FIELD_SLOT_META[slot].shortLabel}
        </span>
      ))}
    </span>
  );
}

function toDragData(
  datasetId: string,
  field: CatalogFieldMeta,
): ChartFieldDragData {
  return {
    datasetId,
    fieldId: field.id,
    label: field.label,
    dataType: field.dataType,
    semanticType: field.semanticType,
    roles: field.roles,
  };
}

function buildFieldGroups(
  dataset: CatalogDatasetMeta | null,
  search: string,
  slotFilter: FieldSlotFilter,
  slotContext: FieldSlotContext,
): FieldGroup[] {
  if (!dataset) return [];
  const query = search.trim().toLocaleLowerCase("vi");
  const definitions = [
    { id: "time", label: "Thời gian", icon: CalendarDays },
    { id: "conversation", label: "Hội thoại và tin nhắn", icon: MessageSquareText },
    { id: "channel", label: "Kênh", icon: Radio },
    { id: "topic", label: "Chủ đề và từ khóa", icon: Tags },
    { id: "ai", label: "Hiệu suất AI", icon: Sparkles },
    { id: "sentiment", label: "Cảm xúc", icon: CircleGauge },
    { id: "agent", label: "Hiệu suất nhân viên", icon: UserRoundCog },
  ] as const;
  const buckets = new Map(
    definitions.map((group) => [group.id, [] as CatalogFieldMeta[]]),
  );

  dataset.fields
    .filter((field) => field.available)
    .filter((field) => (
      slotFilter === "all"
      || getFieldSlotCapabilities(toSlotCapableField(field), slotContext)
        .includes(slotFilter)
    ))
    .filter((field) => {
      if (!query) return true;
      return `${field.label} ${field.id} ${field.semanticType}`
        .toLocaleLowerCase("vi")
        .includes(query);
    })
    .forEach((field) => {
      buckets.get(classifyField(dataset, field))?.push(field);
    });

  return definitions
    .map((definition) => ({
      ...definition,
      fields: buckets.get(definition.id) || [],
    }))
    .filter((group) => group.fields.length > 0);
}

const dataTypeLabels: Record<CatalogFieldMeta["dataType"], string> = {
  string: "Văn bản",
  number: "Số",
  date: "Ngày giờ",
  boolean: "Có / Không",
};

function classifyField(
  dataset: CatalogDatasetMeta,
  field: CatalogFieldMeta,
): FieldGroup["id"] {
  const value = `${field.id} ${field.label} ${field.semanticType}`
    .toLocaleLowerCase("vi");
  if (/(agent|response|resolution|csat|nhan vien)/.test(value)) return "agent";
  if (/(date|time|day|week|month|quarter|year|datetime)/.test(value)) return "time";
  if (/(channel|source|kenh)/.test(value)) return "channel";
  if (/(topic|keyword|chu de|tu khoa|frequency)/.test(value)) return "topic";
  if (/(sentiment|satisfaction|positive|neutral|negative|cam xuc)/.test(value)) {
    return "sentiment";
  }
  if (/(ai|analyzer|confidence|review|issue)/.test(value)) return "ai";
  if (dataset.id === "agent_performance") return "agent";
  return "conversation";
}

const fieldSlotFilters: Array<{
  id: FieldSlotFilter;
  label: string;
  description: string;
}> = [
  {
    id: "all",
    label: "Tất cả",
    description: "Hiển thị tất cả trường khả dụng.",
  },
  ...FIELD_SLOT_ORDER.map((slot) => ({
    id: slot,
    label: FIELD_SLOT_META[slot].label,
    description: FIELD_SLOT_META[slot].description,
  })),
];
