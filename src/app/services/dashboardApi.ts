import { DashboardKpiData, APIResponse } from "../types/dashboard";

// Lấy Base URL từ biến môi trường (Vite sử dụng import.meta.env)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000";

/**
 * Gọi API lấy dữ liệu KPI của Dashboard
 * @param params Bộ lọc thời gian startDate và endDate (định dạng YYYY-MM-DD)
 * @returns Trả về đối tượng dữ liệu KPI Dashboard
 */
export async function getDashboardKpi(params?: {
  startDate?: string;
  endDate?: string;
  channel?: string;
  topic?: string;
  conversationStatus?: string;
  aiStatus?: string;
}): Promise<DashboardKpiData> {
  const url = new URL(`${API_BASE_URL}/api/dashboard/kpi`);

  if (params?.startDate) {
    url.searchParams.append("startDate", params.startDate);
  }
  if (params?.endDate) {
    url.searchParams.append("endDate", params.endDate);
  }
  if (params?.channel) {
    url.searchParams.append("channel", params.channel);
  }
  if (params?.topic) {
    url.searchParams.append("topic", params.topic);
  }
  if (params?.conversationStatus) {
    url.searchParams.append("conversationStatus", params.conversationStatus);
  }
  if (params?.aiStatus) {
    url.searchParams.append("aiStatus", params.aiStatus);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    }
  });

  const resJson: APIResponse<DashboardKpiData> = await response.json();

  if (!response.ok || !resJson.success) {
    throw new Error(resJson.message || "Không thể tải dữ liệu Dashboard. Vui lòng kiểm tra lại cấu hình hoặc kết nối.");
  }

  return resJson.data;
}

/**
 * Gọi API đóng cuộc hội thoại (đánh dấu là đã xử lý)
 * @param customerId ID của khách hàng
 * @param source Nguồn kênh của cuộc hội thoại
 */
export async function closeConversation(customerId: string, source: string): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}/api/conversations/close`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ customerId, source })
  });

  const resJson: { success: boolean; message?: string } = await response.json();

  if (!response.ok || !resJson.success) {
    throw new Error(resJson.message || "Không thể cập nhật trạng thái cuộc hội thoại.");
  }

  return true;
}
