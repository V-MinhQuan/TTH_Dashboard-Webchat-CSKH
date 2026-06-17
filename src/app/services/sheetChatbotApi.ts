import { buildApiUrl, fetchApiJson } from "./dashboardApi";

export type SheetChatbotStatus =
  | "Chờ xử lý"
  | "Đã duyệt"
  | "Cần chỉnh sửa"
  | "Từ chối";

export type SheetChatbotRiskLevel = "Thấp" | "Trung bình" | "Cao";

export type SheetChatbotSource =
  | "AI trả lời sai"
  | "Không tìm thấy dữ liệu"
  | "AI không chắc chắn"
  | "Câu hỏi lặp lại nhiều lần"
  | "Nhân viên đề xuất"
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

export function getSheetChatbotRows(params?: {
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
  return fetchApiJson<SheetChatbotListResponse>(url, { cache: false });
}

export async function createSheetChatbotRow(payload: SheetChatbotCreatePayload) {
  const response = await fetchApiJson<SheetChatbotRowResponse>(buildApiUrl("/api/admin/sheet-chatbot"), {
    method: "POST",
    cache: false,
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function updateSheetChatbotRow(id: string, payload: SheetChatbotUpdatePayload) {
  const response = await fetchApiJson<SheetChatbotRowResponse>(buildApiUrl(`/api/admin/sheet-chatbot/${id}`), {
    method: "PUT",
    cache: false,
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function updateSheetChatbotStatus(id: string, status: SheetChatbotStatus, reviewer?: string) {
  const response = await fetchApiJson<SheetChatbotRowResponse>(buildApiUrl(`/api/admin/sheet-chatbot/${id}/status`), {
    method: "PATCH",
    cache: false,
    body: JSON.stringify({ status, reviewer }),
  });
  return response.data;
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

  return response.data;
}
