import { buildApiUrl, fetchApiBlob, fetchApiJson } from "./dashboardApi";
import { AI_FAILURE_TAXONOMY } from "../constants/aiFailureTaxonomy";

/** Dynamically built from taxonomy so it stays in sync automatically */
export type TopicFailureRecord = {
  topic: string;
  // all analyticsKeys from taxonomy
  thieuDL: number;
  saiCauTra: number;
  khongChinhXac: number;
  khongHieu: number;
  thieuThongTin: number;
  loiTriThuc: number;
  loiHeThong: number;
  khac: number;
  // legacy compat keys
  khongChac: number;
  ngoaiPhamVi: number;
  hallucination: number;
  [key: string]: string | number;
};

export interface FailedConversationRecord {
  id: string | number;
  messageId?: string | number | null;
  conversationId?: number | string | null;
  customerId?: string | null;
  customerName?: string | null;
  customer_name?: string | null;
  source?: string | null;
  textContent?: string | null;
  aiAnswer?: string | null;
  detectedTopics?: string[] | string | null;
  issueType?: string | null;
  issueReason?: string | null;
  issueConfidence?: number | null;
  needStaffReview?: boolean | number | null;
  messageAt?: string | null;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

interface FailedConversationPage {
  records: FailedConversationRecord[];
  pagination: { page: number; pageSize: number; total: number };
}

function filenameFromDisposition(value: string | null) {
  if (!value) return null;
  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);
  const asciiMatch = value.match(/filename="?([^";]+)"?/i);
  return asciiMatch?.[1] || null;
}

export async function getTopicFailures(params: URLSearchParams) {
  const response = await fetchApiJson<ApiResponse<unknown>>(
    buildApiUrl("/api/analytics/ai/failure-by-topic", new URLSearchParams(params)),
    { cache: false },
  );
  if (!response.success) {
    throw new Error(response.message || "Không thể tải lỗi AI theo chủ đề.");
  }

  const rows = Array.isArray(response.data) ? response.data : [];
  return rows.map(normalizeTopicFailure);
}

export async function getFailedConversations(params: URLSearchParams) {
  const query = new URLSearchParams(params);
  if (!query.has("page")) query.set("page", "1");
  if (!query.has("pageSize")) query.set("pageSize", "100");

  const response = await fetchApiJson<ApiResponse<FailedConversationPage>>(
    buildApiUrl("/api/analytics/ai/failed-conversations", query),
    { cache: false },
  );
  if (!response.success) {
    throw new Error(response.message || "Không thể tải hội thoại có lỗi AI.");
  }

  return {
    records: Array.isArray(response.data?.records) ? response.data.records : [],
    pagination: response.data?.pagination ?? { page: 1, pageSize: 100, total: 0 },
  };
}

export async function getAllFailedConversations(
  params: URLSearchParams,
  options: { pageSize?: number; maxPages?: number } = {},
) {
  const pageSize = options.pageSize ?? 100;
  const maxPages = options.maxPages;
  const seen = new Set<string>();
  const records: FailedConversationRecord[] = [];

  let page = 1;
  let total = 0;
  let totalPages = 1;

  while (page <= totalPages) {
    if (maxPages && page > maxPages) {
      throw new Error(`Export vượt quá giới hạn an toàn ${maxPages} trang.`);
    }

    const query = new URLSearchParams(params);
    query.set("page", String(page));
    query.set("pageSize", String(pageSize));
    const result = await getFailedConversations(query);
    total = Number(result.pagination.total || 0);
    totalPages = Math.max(1, Math.ceil(total / pageSize));

    for (const record of result.records) {
      const key = String(record.id ?? record.messageId ?? `${record.conversationId}:${record.messageAt ?? ""}`);
      if (!seen.has(key)) {
        seen.add(key);
        records.push(record);
      }
    }

    if (result.records.length === 0) break;
    page += 1;
  }

  return {
    records,
    total,
    pageSize,
    totalPages,
  };
}

export async function exportFailedConversationsCsv(
  params: URLSearchParams,
  options: { signal?: AbortSignal } = {},
) {
  const response = await fetchApiBlob(
    buildApiUrl("/api/analytics/ai/failed-conversations/export", new URLSearchParams(params)),
    { signal: options.signal, timeoutMs: 60000 },
  );
  if (response.blob.size === 0 && response.status !== 204) {
    throw new Error("File export rỗng dù request đã trả thành công.");
  }
  return {
    blob: response.blob,
    filename: filenameFromDisposition(response.headers.get("Content-Disposition")) || `cau-hoi-ai-chua-xu-ly-${new Date().toISOString().slice(0, 10)}.csv`,
    totalRecords: Number(response.headers.get("X-Total-Records") || 0),
  };
}

function normalizeTopicFailure(value: unknown): TopicFailureRecord {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  
  // Build base record with all taxonomy analytics keys set to 0
  const base: Record<string, string | number> = {
    topic: cleanText(row.topic, "Không phân loại trong database"),
  };
  
  // Populate all current taxonomy keys
  for (const def of AI_FAILURE_TAXONOMY) {
    base[def.analyticsKey] = nonNegativeNumber(row[def.analyticsKey]);
  }
  
  // Legacy compat: also preserve old keys if API still returns them
  const legacyKeys = ["thieuDL", "khongChac", "ngoaiPhamVi", "hallucination", "khongHieu"];
  for (const key of legacyKeys) {
    if (!(key in base)) {
      base[key] = nonNegativeNumber(row[key]);
    }
  }
  
  return base as TopicFailureRecord;
}

function nonNegativeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function cleanText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export async function createAiErrorKeyword(payload: {
  keyword: string;
  error_group: string;
  topic: string;
  care_hub: null;
  description: string;
  status: "active";
}) {
  const response = await fetchApiJson<ApiResponse<unknown>>(
    buildApiUrl("/api/ai-error-keywords"),
    { method: "POST", cache: false, body: JSON.stringify(payload) }
  );
  if (!response.success) {
    throw new Error(response.message || "Không thể lưu từ khóa lỗi AI.");
  }
  return response.data;
}
