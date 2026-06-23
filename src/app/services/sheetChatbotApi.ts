import { buildApiUrl, fetchApiJson } from "./dashboardApi";
import { getAiFailureDefinition } from "../constants/aiFailureTaxonomy";

export const SHEET_CHATBOT_SOURCE_OPTIONS = [
  "Không tìm thấy dữ liệu",
  "AI trả lời không chắc chắn",
  "Lỗi hệ thống",
  "Khác",
] as const;

export type SheetChatbotStatus =
  | "Chờ xử lý"
  | "Đã duyệt"
  | "Cần chỉnh sửa"
  | "Từ chối";

export type SheetChatbotRiskLevel = "Thấp" | "Trung bình" | "Cao";

export type SheetChatbotSource =
  | "Không tìm thấy dữ liệu"
  | "AI trả lời không chắc chắn"
  | "Lỗi hệ thống"
  | "Khác"
  | (string & {});

export interface SheetChatbotRow {
  id: string;
  addedAt: string;
  addedBy: string;
  question: string;
  correctAnswer: string;
  topic: string;
  source: SheetChatbotSource;
  risk: SheetChatbotRiskLevel;
  status: SheetChatbotStatus;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface SheetChatbotStats {
  total: number;
  pending?: number;
  pendingManager?: number;
  approved: number;
  usable?: number;
  needsEdit: number;
  rejected: number;
}

export type SheetChatbotCreatePayload = Omit<SheetChatbotRow, "id" | "addedAt" | "addedBy"> & {
  addedBy?: string;
};

export type SheetChatbotUpdatePayload = Partial<
  Pick<SheetChatbotRow, "question" | "correctAnswer" | "topic" | "source" | "risk" | "status" | "notes" | "addedBy">
>;

interface SheetChatbotListResponse {
  success: boolean;
  message?: string;
  data: SheetChatbotRow[];
  total: number;
  page: number;
  pageSize: number;
  stats: SheetChatbotStats;
}

interface SheetChatbotRowResponse {
  success: boolean;
  message?: string;
  data: SheetChatbotRow;
}

export interface SheetChatbotFaq {
  id: string;
  question: string;
  answer: string;
  topic: string;
  proposer: string;
  source: string;
  status: string;
  riskLevel: string;
  date: string;
  notes: string;
}

interface SheetChatbotFaqResponse {
  success: boolean;
  message?: string;
  data: SheetChatbotFaq;
}

export interface SheetChatbotDuplicateResponse {
  success: boolean;
  message?: string;
  data: Array<SheetChatbotRow & { similarity: number }>;
}

export async function getSheetChatbotRows(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  risk?: string;
  addedBy?: string;
  role?: string | null;
}) {
  const url = buildApiUrl("/api/admin/sheet-chatbot", {
    page: params?.page ?? 1,
    pageSize: params?.pageSize ?? 500,
    search: params?.search,
    status: params?.status,
    risk: params?.risk,
    addedBy: params?.addedBy,
    role: params?.role || undefined,
  });
  const response = await fetchApiJson<SheetChatbotListResponse>(url, { cache: false });
  return {
    ...response,
    data: response.data.map(normalizeSheetChatbotRow),
  };
}

export async function createSheetChatbotRow(payload: SheetChatbotCreatePayload) {
  const normalizedPayload = normalizeCreatePayload(payload);
  const response = await fetchApiJson<SheetChatbotRowResponse>(buildApiUrl("/api/admin/sheet-chatbot"), {
    method: "POST",
    cache: false,
    body: JSON.stringify(normalizedPayload),
  });
  return normalizeSheetChatbotRow(response.data);
}

export async function updateSheetChatbotRow(id: string, payload: SheetChatbotUpdatePayload) {
  const normalizedPayload = normalizeUpdatePayload(payload);
  const response = await fetchApiJson<SheetChatbotRowResponse>(buildApiUrl(`/api/admin/sheet-chatbot/${id}`), {
    method: "PUT",
    cache: false,
    body: JSON.stringify(normalizedPayload),
  });
  return normalizeSheetChatbotRow(response.data);
}

export async function updateSheetChatbotStatus(id: string, status: SheetChatbotStatus, reviewer?: string) {
  const response = await fetchApiJson<SheetChatbotRowResponse>(buildApiUrl(`/api/admin/sheet-chatbot/${id}/status`), {
    method: "PATCH",
    cache: false,
    body: JSON.stringify({ status, reviewer }),
  });
  return normalizeSheetChatbotRow(response.data);
}

export async function mergeSheetChatbotToFaq(id: string, reviewer?: string) {
  const response = await fetchApiJson<SheetChatbotFaqResponse>(buildApiUrl(`/api/admin/sheet-chatbot/${id}/merge-faq`), {
    method: "POST",
    cache: false,
    body: JSON.stringify({ reviewer }),
  });
  return response.data;
}

export async function getSheetChatbotDuplicates(question: string, minSimilarity = 0.75, limit = 5) {
  const response = await fetchApiJson<SheetChatbotDuplicateResponse>(
    buildApiUrl("/api/admin/sheet-chatbot/duplicates", {
      question,
      minSimilarity,
      limit,
    }),
    { cache: false },
  );

  if (!response.success) {
    throw new Error(response.message || "Không thể kiểm tra FAQ tương tự.");
  }

  return response.data.map((row) => ({
    ...normalizeSheetChatbotRow(row),
    similarity: row.similarity,
  }));
}

function normalizeCreatePayload(payload: SheetChatbotCreatePayload): SheetChatbotCreatePayload {
  const question = requiredText(payload.question, "Câu hỏi khách hàng");
  const correctAnswer = requiredText(payload.correctAnswer, "Câu trả lời đúng");
  const topic = requiredText(payload.topic, "Chủ đề");

  return {
    ...payload,
    question,
    correctAnswer,
    topic,
    source: normalizeSheetChatbotSource(payload.source),
    notes: payload.notes.trim(),
    addedBy: payload.addedBy?.trim() || undefined,
  };
}

function normalizeUpdatePayload(payload: SheetChatbotUpdatePayload): SheetChatbotUpdatePayload {
  return {
    ...payload,
    question: payload.question === undefined ? undefined : requiredText(payload.question, "Câu hỏi khách hàng"),
    correctAnswer: payload.correctAnswer === undefined ? undefined : requiredText(payload.correctAnswer, "Câu trả lời đúng"),
    topic: payload.topic === undefined ? undefined : requiredText(payload.topic, "Chủ đề"),
    source: payload.source === undefined ? undefined : normalizeSheetChatbotSource(payload.source),
    notes: payload.notes?.trim(),
    addedBy: payload.addedBy?.trim(),
  };
}

function normalizeSheetChatbotRow(row: SheetChatbotRow): SheetChatbotRow {
  const source = getAiFailureDefinition(row.source)?.apiValue ?? row.source;
  return { ...row, source };
}

function requiredText(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} không được để trống.`);
  return normalized;
}

function normalizeSheetChatbotSource(value: string): SheetChatbotSource {
  const raw = (value || "").trim();
  if ((SHEET_CHATBOT_SOURCE_OPTIONS as readonly string[]).includes(raw)) {
    return raw as SheetChatbotSource;
  }

  const sourceDefinition = getAiFailureDefinition(raw);
  const canonical = sourceDefinition?.apiValue ?? raw;

  if (canonical === "Không tìm thấy dữ liệu") return "Không tìm thấy dữ liệu";
  if (canonical === "AI không chắc chắn" || canonical === "AI trả lời không chắc chắn") {
    return "AI trả lời không chắc chắn";
  }
  if (canonical === "Lỗi hệ thống") return "Lỗi hệ thống";
  return "Khác";
}
