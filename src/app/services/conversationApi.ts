import { buildApiUrl, fetchApiJson } from "./dashboardApi";

export interface ConversationListRecord {
  id: number;
  customer_id: string;
  customer_name?: string | null;
  status: "new" | "open" | "closed" | string;
  source: string;
  created_at?: string | null;
  first_response_at?: string | null;
  updated_at?: string | null;
}

export interface ConversationMessage {
  messageId: number;
  textContent?: string | null;
  fromHost: boolean | number;
  sentAt?: string | null;
  source?: string | null;
}

export interface ConversationDetailRecord extends ConversationListRecord {
  messages: ConversationMessage[];
}

interface ConversationListResponse {
  success: boolean;
  message?: string;
  data: {
    records: ConversationListRecord[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
    };
  };
}

interface ConversationDetailResponse {
  success: boolean;
  message?: string;
  data: ConversationDetailRecord;
}

export async function getConversations(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  channel?: string;
  startDate?: string;
  endDate?: string;
}) {
  const response = await fetchApiJson<ConversationListResponse>(
    buildApiUrl("/api/conversations", {
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 20,
      search: params?.search,
      channel: params?.channel && params.channel !== "Tất cả" ? params.channel : undefined,
      startDate: params?.startDate,
      endDate: params?.endDate,
    }),
    { cache: false },
  );

  if (!response.success) {
    throw new Error(response.message || "Không thể tải danh sách hội thoại.");
  }

  return response.data;
}

export async function getConversationDetail(conversationId: number) {
  const response = await fetchApiJson<ConversationDetailResponse>(
    buildApiUrl(`/api/conversations/${conversationId}`),
    { cache: false },
  );

  if (!response.success) {
    throw new Error(response.message || "Không thể tải chi tiết hội thoại.");
  }

  return response.data;
}

export async function bulkCloseConversations(
  conversationIds: readonly number[],
  idempotencyKey = crypto.randomUUID(),
) {
  const normalizedIds = conversationIds.filter(
    (id): id is number => Number.isInteger(id) && id > 0,
  );
  if (normalizedIds.length === 0) {
    throw new Error("Cần chọn ít nhất một hội thoại.");
  }
  if (normalizedIds.length !== conversationIds.length) {
    throw new Error("Danh sách hội thoại chứa mã không hợp lệ.");
  }
  if (new Set(normalizedIds).size !== normalizedIds.length) {
    throw new Error("Danh sách hội thoại không được chứa mã trùng lặp.");
  }
  if (normalizedIds.length > 100) {
    throw new Error("Chỉ có thể xử lý tối đa 100 hội thoại mỗi lần.");
  }

  const response = await fetchApiJson<{
    success: boolean;
    message?: string;
    data: { requested: number; affected: number; alreadyClosed?: number };
  }>(
    buildApiUrl("/api/conversations/bulk-close"),
    {
      method: "POST",
      cache: false,
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ conversationIds: normalizedIds }),
    },
  );

  if (!response.success) {
    throw new Error(response.message || "Không thể cập nhật hội thoại đã chọn.");
  }
  return response.data;
}

export function getCustomerPresentation(customerName: unknown, customerId: unknown) {
  const name = typeof customerName === "string" ? customerName.trim() : "";
  const reference = typeof customerId === "string" ? customerId.trim() : String(customerId || "").trim();
  const suffix = reference.slice(-4);
  const shortReference = suffix ? `KH ••••${suffix}` : "KH chưa có mã";

  return {
    primary: name || shortReference,
    secondary: name ? shortReference : null,
  } as const;
}
