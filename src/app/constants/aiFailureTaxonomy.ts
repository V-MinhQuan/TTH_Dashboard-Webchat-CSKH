import type { SemanticTone } from "../styles/semanticTokens";

/**
 * AI Failure Taxonomy – canonical 8-category system (Req #3, #14)
 * Maps raw DB/API strings to structured definitions.
 */
export type AiFailureId =
  | "no_data"
  | "wrong_answer"
  | "inaccurate"
  | "not_understood"
  | "missing_info"
  | "kb_error"
  | "system_error"
  | "other";

export interface AiFailureDefinition {
  readonly id: AiFailureId;
  /** Display label shown in UI */
  readonly label: string;
  /** Value sent to API filter params */
  readonly apiValue: string;
  /** Key used in analytics breakdown objects */
  readonly analyticsKey: string;
  readonly tone: SemanticTone;
  /** CSS modifier for .error-source-badge--* */
  readonly cssModifier: string;
  readonly aliases: readonly string[];
}

export const AI_FAILURE_TAXONOMY: readonly AiFailureDefinition[] = Object.freeze([
  Object.freeze({
    id: "no_data",
    label: "Không tìm thấy dữ liệu",
    apiValue: "Không tìm thấy dữ liệu",
    analyticsKey: "thieuDL",
    tone: "warning" as SemanticTone,
    cssModifier: "no-data",
    aliases: Object.freeze(["no_data", "missing_data", "thieuDL", "Không tìm thấy"]),
  }),
  Object.freeze({
    id: "wrong_answer",
    label: "AI có nguy cơ tự tạo thông tin",
    apiValue: "AI có nguy cơ tự tạo thông tin",
    analyticsKey: "saiCauTra",
    tone: "danger" as SemanticTone,
    cssModifier: "wrong",
    aliases: Object.freeze(["wrong_answer", "AI trả lời sai", "saiCauTra", "hallucination_risk", "hallucination", "Câu trả lời sai"]),
  }),
  Object.freeze({
    id: "inaccurate",
    label: "Thông tin không chính xác",
    apiValue: "Thông tin không chính xác",
    analyticsKey: "khongChinhXac",
    tone: "danger" as SemanticTone,
    cssModifier: "inaccurate",
    aliases: Object.freeze(["inaccurate", "Thông tin sai", "khongChinhXac"]),
  }),
  Object.freeze({
    id: "not_understood",
    label: "AI không chắc chắn",
    apiValue: "AI không chắc chắn",
    analyticsKey: "khongHieu",
    tone: "warning" as SemanticTone,
    cssModifier: "not-understood",
    aliases: Object.freeze(["not_understood", "Không hiểu câu hỏi", "uncertain", "khongChac", "khongHieu"]),
  }),
  Object.freeze({
    id: "missing_info",
    label: "Câu hỏi ngoài phạm vi",
    apiValue: "Câu hỏi ngoài phạm vi",
    analyticsKey: "thieuThongTin",
    tone: "warning" as SemanticTone,
    cssModifier: "missing",
    aliases: Object.freeze(["missing_info", "Thiếu thông tin", "out_of_scope", "ngoaiPhamVi", "thieuThongTin"]),
  }),
  Object.freeze({
    id: "kb_error",
    label: "Lỗi nguồn tri thức",
    apiValue: "Lỗi nguồn tri thức",
    analyticsKey: "loiTriThuc",
    tone: "danger" as SemanticTone,
    cssModifier: "kb",
    aliases: Object.freeze(["kb_error", "knowledge_base", "loiTriThuc", "Lỗi tri thức"]),
  }),
  Object.freeze({
    id: "system_error",
    label: "Lỗi hệ thống",
    apiValue: "Lỗi hệ thống",
    analyticsKey: "loiHeThong",
    tone: "danger" as SemanticTone,
    cssModifier: "system",
    aliases: Object.freeze(["system_error", "system", "loiHeThong"]),
  }),
  Object.freeze({
    id: "other",
    label: "Khác",
    apiValue: "Khác",
    analyticsKey: "khac",
    tone: "neutral" as SemanticTone,
    cssModifier: "other",
    aliases: Object.freeze(["other", "khac", "unknown"]),
  }),
]);

function normalizeLookupValue(value: string) {
  return value.trim().toLocaleLowerCase("vi-VN");
}

export function getAiFailureDefinition(value: string | null | undefined): AiFailureDefinition | null {
  if (!value) return null;
  const normalized = normalizeLookupValue(value);
  return AI_FAILURE_TAXONOMY.find((item) => (
    [item.id, item.label, item.apiValue, item.analyticsKey, ...item.aliases]
      .some((candidate) => normalizeLookupValue(candidate) === normalized)
  )) ?? null;
}

export function normalizeAiFailureType(value: string | null | undefined): AiFailureId | null {
  return getAiFailureDefinition(value)?.id ?? null;
}
