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
