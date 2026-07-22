const VIETNAMESE_TEXT = /[À-ỹ]/u;

export function chartBuilderErrorMessage(error: unknown, fallback: string) {
  const raw = error instanceof Error ? error.message.trim() : "";
  const normalized = raw
    .replace(/^value error\s*,?\s*/i, "")
    .replace(/^body(?:\.[\w.]+)?:\s*/i, "")
    .trim();

  if (/bí danh.*không được trùng|alias.*(?:duplicate|unique)/i.test(normalized)) {
    return "Một trường đang được chọn trùng ở nhiều vị trí không tương thích. Hãy kiểm tra các ô X, Y và G rồi xóa trường bị trùng.";
  }
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(raw)) {
    return "Không thể kết nối đến hệ thống dữ liệu. Hãy kiểm tra kết nối mạng và thử tải lại biểu đồ.";
  }
  if (/dynamically imported module|importing a module script/i.test(raw)) {
    return "Giao diện vừa được cập nhật nhưng trình duyệt đang dùng phiên bản cũ. Hãy tải lại trang và thử lại.";
  }
  if (/timeout|timed out|quá thời gian/i.test(raw)) {
    return "Hệ thống xử lý dữ liệu quá lâu. Hãy thu hẹp khoảng thời gian hoặc giảm số trường rồi thử lại.";
  }
  if (/401|unauthorized|chưa đăng nhập/i.test(raw)) {
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.";
  }
  if (/403|forbidden|không có quyền/i.test(raw)) {
    return "Bạn không có quyền thực hiện thao tác này.";
  }
  if (/500|internal server error|sql|database/i.test(raw)) {
    return "Hệ thống chưa thể xử lý dữ liệu biểu đồ lúc này. Vui lòng thử lại sau.";
  }
  if (normalized && VIETNAMESE_TEXT.test(normalized) && normalized.length <= 280) {
    return normalized
      .replace(/'channel'/gi, "'Kênh'")
      .replace(/'metric'/gi, "'Giá trị / Chỉ số - Y'")
      .replace(/'dimension'/gi, "'Trường phân tích - X'")
      .replace(/'series'/gi, "'Phân nhóm dữ liệu - G'")
      .replace(/'filter'/gi, "'Lọc dữ liệu - F'");
  }
  return `${fallback} Vui lòng kiểm tra các trường đã chọn và thử lại.`;
}
