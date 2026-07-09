export const AI_TOPIC_FAILURE_TYPES = [
  { 
    id: "no_data", 
    label: "Không tìm thấy dữ liệu", 
    key: "thieuDL", 
    keywords: "Không tìm thấy, Chưa có, Chưa hỗ trợ, Không thể, Trợ lý AI, Không thể tiếp nhận thông tin, Không thể xác nhận trực tiếp, Không có dữ liệu, Chưa có dữ liệu, Không có thông tin, Không tìm được thông tin, Chưa cập nhật, Hiện chưa có, Không nằm trong dữ liệu, Không đủ dữ liệu, Ngoài phạm vi, Không thuộc phạm vi, Không hỗ trợ nội dung này, Không thể hỗ trợ vấn đề này, Vượt quá khả năng, Chuyển cho nhân viên tư vấn, Chuyển cho nhân viên, Kết nối với nhân viên, Đợi trong giây lát để nhân viên" 
  },
  { 
    id: "uncertain", 
    label: "AI không chắc chắn", 
    key: "khongChac", 
    keywords: "Suy đoán, Phỏng đoán, Ước đoán, Tự suy luận, Không có dữ liệu nhưng, Không chắc nhưng, Tôi tự suy luận, Mình tự suy luận, Chưa hiểu, Chưa rõ, Không chắc chắn, Chưa có thông tin cụ thể, Độ tin cậy, Chưa xác nhận, Có vẻ như, Chắc là, Có lẽ, Hình như, Tôi đoán, Mình đoán, Không rõ, Cần xác nhận, Cần kiểm tra lại, Có khả năng, Dường như, Theo tôi hiểu, Theo mình hiểu, Không hiểu câu hỏi, Không hiểu yêu cầu, Chưa hiểu ý bạn, Vui lòng diễn đạt lại, Vui lòng cung cấp thêm thông tin, Không xác định được yêu cầu, Tôi chưa hiểu, Tôi không hiểu, Không hiểu" 
  },
] as const;

export const TOPIC_FAILURE_NUMERIC_KEYS = [
  "thieuDL",
  "khongChac",
] as const;
