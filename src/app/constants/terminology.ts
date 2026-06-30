import type { SemanticTone } from "../styles/semanticTokens";
import { STATUS_TONES } from "../styles/semanticTokens";

export const TERMINOLOGY = {
  PAGE_NAMES: {
    // Admin page titles
    overview: "Tổng quan hệ thống",
    channel: "Phân tích theo kênh",
    aiinsights: "Phân tích AI",
    keyword: "Phân tích Keywords",
    sentiment: "Phân tích cảm xúc",
    chartbuilder: "Trình tạo biểu đồ",
    chatbot_sheet: "Quản lý thư viện phản hồi",
    settings: "Cài đặt hệ thống",

    // Staff page titles
    chatbot_sheet_staff: "Thư viện phản hồi của tôi",
    profile_staff: "Hồ sơ cá nhân",
  },
  MENU_LABELS: {
    overview: "Tổng quan",
    channel: "Kênh",
    aiinsights: "Phân tích AI",
    keyword: "Keywords",
    sentiment: "Cảm xúc",
    chartbuilder: "Biểu đồ",
    chatbot_sheet: "Thư viện phản hồi",
    settings: "Cài đặt",

    // Staff extra
    profile: "Hồ sơ",
  },
  ROLES: {
    manager: "Quản lý CSKH",
    staff: "Nhân viên CSKH",
    customer: "Khách hàng",
    student: "Sinh viên",
  },
  STATUS: {
    pending: "Chờ xử lý",
    processing: "Đang tư vấn / Chờ phản hồi",
    completed: "Hoàn thành",
    waiting_manager: "Chờ quản lý xác nhận",
    waiting_approval: "Chờ duyệt",
    approved: "Đã duyệt",
    rejected: "Bị từ chối",
    need_edit: "Cần chỉnh sửa",
    success: "Thành công",
    failed: "Thất bại",
    active: "Đang hoạt động",
    inactive: "Tạm khóa",
    no_permission: "Không có quyền truy cập",
    priority_low: "Ưu tiên thấp",
    priority_medium: "Ưu tiên trung bình",
    priority_high: "Ưu tiên cao",
  },
  BUTTONS: {
    apply: "Áp dụng",
    reset: "Đặt lại",
    refresh: "Làm mới",
    save: "Lưu",
    save_changes: "Lưu thay đổi",
    cancel: "Hủy",
    close: "Đóng",
    confirm: "Xác nhận",
    view_details: "Xem chi tiết",
    edit: "Chỉnh sửa",
    delete: "Xóa",
    approve: "Duyệt",
    reject: "Từ chối",
    request_edit: "Yêu cầu chỉnh sửa",
    add: "Thêm",
    add_faq: "Thêm vào FAQ",
    add_sheet: "Thêm phản hồi",
    resolve: "Đánh dấu đã xử lý",
    mark_ai_wrong: "Đánh dấu AI sai",
    send_corrected: "Gửi lại câu trả lời",
    send_manager: "Chuyển quản lý kiểm duyệt",
    back: "Quay lại",
    logout: "Đăng xuất",
  },
  AI: {
    success: "AI trả lời thành công",
    failed: "AI trả lời thất bại",
    wrong: "AI trả lời sai",
    uncertain: "AI không chắc chắn",
    missing_data: "Không tìm thấy dữ liệu",
    incorrect_answer: "Câu trả lời sai",
    inaccurate_info: "Thông tin không chính xác",
    not_understood: "Không hiểu câu hỏi",
    missing_info: "Thiếu thông tin",
    kb_issue: "Lỗi nguồn tri thức",
    system_issue: "Lỗi hệ thống",
    other: "Khác",
    need_review: "Cần kiểm duyệt",
    confidence: "Mức độ tin cậy",
    error_reason: "Lý do lỗi AI",
    intervention: "Can thiệp AI",
    kb: "Cơ sở tri thức",
    add_kb: "Bổ sung vào cơ sở tri thức",
    suggested_faq: "FAQ đề xuất",
    missing_faq: "FAQ cần bổ sung",
  },
  /** Taxonomy thống nhất cho lỗi AI – dùng trên tất cả màn hình */
  AI_FAILURE_TAXONOMY: [
    "Không tìm thấy dữ liệu",
    "Câu trả lời sai",
    "Thông tin không chính xác",
    "Không hiểu câu hỏi",
    "Thiếu thông tin",
    "Lỗi nguồn tri thức",
    "Lỗi hệ thống",
    "Khác",
  ] as const,
} as const;

export type StatusKey = keyof typeof TERMINOLOGY.STATUS;

export interface StatusDefinition {
  readonly key: StatusKey;
  readonly label: (typeof TERMINOLOGY.STATUS)[StatusKey];
  readonly tone: SemanticTone;
}

export const STATUS_DEFINITIONS: Readonly<Record<StatusKey, StatusDefinition>> = Object.freeze(
  Object.fromEntries(
    Object.entries(TERMINOLOGY.STATUS).map(([key, label]) => [
      key,
      Object.freeze({
        key: key as StatusKey,
        label,
        tone: STATUS_TONES[key as StatusKey],
      }),
    ]),
  ) as unknown as Record<StatusKey, StatusDefinition>,
);

export function getStatusDefinition(value: string): StatusDefinition | null {
  const direct = STATUS_DEFINITIONS[value as StatusKey];
  if (direct) return direct;
  return Object.values(STATUS_DEFINITIONS).find((item) => item.label === value) ?? null;
}

/**
 * Chuyển đổi giá trị trạng thái raw (từ DB/API) sang label hiển thị chuẩn.
 * Backward compatible: "Đang xử lý" → "Đang tư vấn / Chờ phản hồi"
 * "Đã xử lý" → "Hoàn thành"
 */
export function getDisplayStatus(raw: string): string {
  const legacyMap: Record<string, string> = {
    "Đang xử lý": "Đang tư vấn / Chờ phản hồi",
    "Đã xử lý": "Hoàn thành",
    open: "Đang tư vấn / Chờ phản hồi",
    processing: "Đang tư vấn / Chờ phản hồi",
    completed: "Hoàn thành",
    pending: "Chờ xử lý",
    done: "Hoàn thành",
  };
  return legacyMap[raw] ?? raw;
}
