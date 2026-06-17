import type {
  CatalogFieldMeta,
  ChartType,
  DataType,
  FieldRole,
} from "../../types/chartBuilder";

export type ChartBuilderFieldSlot =
  | "dimension"
  | "metric"
  | "series"
  | "filter"
  | "tooltip";

export interface FieldSlotContext {
  chartType: ChartType;
  selectedOutputFieldIds: string[];
}

export interface SlotCapableField {
  id?: string;
  fieldId?: string;
  label: string;
  dataType: DataType;
  roles: FieldRole[];
  available?: boolean;
}

export const FIELD_SLOT_ORDER: ChartBuilderFieldSlot[] = [
  "dimension",
  "metric",
  "series",
  "filter",
  "tooltip",
];

export const FIELD_SLOT_META: Record<
  ChartBuilderFieldSlot,
  {
    shortLabel: string;
    label: string;
    menuLabel: string;
    description: string;
  }
> = {
  dimension: {
    shortLabel: "X",
    label: "Trục X",
    menuLabel: "Trục X",
    description: "Dùng làm chiều phân tích hoặc nhóm dữ liệu.",
  },
  metric: {
    shortLabel: "Y",
    label: "Giá trị Y",
    menuLabel: "Giá trị Y",
    description: "Dùng làm chỉ số đo lường.",
  },
  series: {
    shortLabel: "S",
    label: "Chú giải",
    menuLabel: "Chú giải",
    description: "Dùng để phân nhóm chuỗi dữ liệu.",
  },
  filter: {
    shortLabel: "F",
    label: "Bộ lọc",
    menuLabel: "Bộ lọc",
    description: "Dùng để lọc dữ liệu truy vấn.",
  },
  tooltip: {
    shortLabel: "T",
    label: "Tooltip",
    menuLabel: "Tooltip",
    description: "Dùng trong chú thích khi di chuột sau khi đã chọn vào biểu đồ.",
  },
};

export function getFieldSlotCapabilities(
  field: SlotCapableField,
  context: FieldSlotContext,
): ChartBuilderFieldSlot[] {
  return FIELD_SLOT_ORDER.filter((slot) => canUseFieldInSlot(
    field,
    slot,
    context,
  ));
}

export function canUseFieldInSlot(
  field: SlotCapableField,
  slot: ChartBuilderFieldSlot,
  context: FieldSlotContext,
): boolean {
  if (field.available === false) return false;

  if (slot === "tooltip") {
    return context.selectedOutputFieldIds.includes(getFieldId(field));
  }

  if (slot === "metric") {
    if (!field.roles.includes("metric")) return false;
    return context.chartType !== "scatter" || field.dataType === "number";
  }

  return field.roles.includes(slot);
}

export function getFieldSlotSummary(
  field: SlotCapableField,
  context: FieldSlotContext,
): string {
  const capabilities = getFieldSlotCapabilities(field, context);
  if (!capabilities.length) {
    return "Chưa có vị trí phù hợp với cấu hình hiện tại.";
  }
  return capabilities
    .map((slot) => FIELD_SLOT_META[slot].label)
    .join(", ");
}

export function describeFieldSlotRejection(
  field: SlotCapableField,
  slot: ChartBuilderFieldSlot,
  context: FieldSlotContext,
): string {
  if (slot === "tooltip") {
    return `Trường “${field.label}” chỉ thêm vào Tooltip sau khi đã nằm trong Trục X, Giá trị Y hoặc Chú giải.`;
  }
  if (
    slot === "metric"
    && context.chartType === "scatter"
    && field.roles.includes("metric")
    && field.dataType !== "number"
  ) {
    return `Biểu đồ phân tán chỉ nhận chỉ số số ở Giá trị Y.`;
  }
  return `Trường “${field.label}” không phù hợp với vị trí ${FIELD_SLOT_META[slot].label}.`;
}

export function toSlotCapableField(field: CatalogFieldMeta): SlotCapableField {
  return {
    id: field.id,
    label: field.label,
    dataType: field.dataType,
    roles: field.roles,
    available: field.available,
  };
}

function getFieldId(field: SlotCapableField): string {
  return field.id || field.fieldId || "";
}
