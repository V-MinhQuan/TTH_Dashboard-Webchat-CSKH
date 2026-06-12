# Hướng dẫn dán nhãn bộ dữ liệu Blind Test (Sentiment Manual Labeling Guidelines)

Bộ dữ liệu này được sử dụng để đánh giá độc lập hiệu năng và kiểm tra mức độ quá khớp (overfitting) của các mô hình phân tích cảm xúc trong dự án FLIC WebChat.

Để đảm bảo tính khách quan và chính xác, người dán nhãn **không được cung cấp** bất kỳ nhãn dự đoán tự động nào từ mô hình. Bạn chỉ cần đọc cột `TextContent` và điền nhãn phù hợp vào cột `manualLabel`.

---

## 1. Danh sách các nhãn hợp lệ
Bạn chỉ được phép sử dụng **chính xác** một trong ba nhãn sau (viết thường hoặc tiếng Việt tương ứng):
- `positive` (hoặc `tích cực`)
- `neutral` (hoặc `trung tính`)
- `negative` (hoặc `tiêu cực`)

---

## 2. Tiêu chí dán nhãn cảm xúc

### Lớp Tích cực (positive / tích cực)
Điền nhãn này khi khách hàng bày tỏ sự cảm ơn, hài lòng, đã hiểu rõ thông tin, hoặc vấn đề được giải quyết thành công.
*   **Từ khóa nhận diện phổ biến**: *cảm ơn*, *cám ơn*, *em hiểu rồi*, *tư vấn rõ quá*, *ok rồi ạ*, *được rồi ạ*, *hỗ trợ rất tốt*, *hu hữu ích*.
*   **Ví dụ**:
    - *"Dạ em cảm ơn chị nhiều ạ"* → `positive`
    - *"ok rồi ạ em hiểu rồi"* → `positive`

### Lớp Trung tính (neutral / trung tính)
Điền nhãn này khi khách hàng đặt câu hỏi hỏi thông tin, hỏi quy trình, xác nhận tin nhắn ngắn gọn hoặc không thể hiện cảm xúc rõ ràng nào.
*   **Từ khóa nhận diện phổ biến**: *lịch thi*, *lệ phí*, *học phí*, *hồ sơ gồm gì*, *dạ*, *vâng*, *ok*, *chào*.
*   **Các lưu ý đặc biệt**:
    1.  **Hỏi thông tin thông thường**: Các câu hỏi như *"lịch thi tháng 6 có chưa ạ"* hoặc *"hồ sơ thi tin học cơ bản gồm những gì"* phải là `neutral`, không được dán thành `negative`.
    2.  **Từ đệm / Chat ngắn gọn**: Các câu trả lời chỉ chứa từ đệm hoặc xác nhận ngắn (ví dụ: *"Dạ"*, *"Vâng"*, *"Ok"*, *"Dạ chị"*) phải là `neutral`.
*   **Ví dụ**:
    - *"lịch thi tin học cơ bản ngày nào thi vậy ạ"* → `neutral`
    - *"CCCD có cần công chứng không ạ"* → `neutral`
    - *"Dạ"* → `neutral`

### Lớp Tiêu cực (negative / tiêu cực)
Điền nhãn này khi khách hàng báo cáo sự cố (lỗi hệ thống, sập web, lỗi giải nén), bị chặn/không thực hiện được hành động, chậm trễ, trượt môn, mất giấy tờ, hoặc cần hỗ trợ khẩn cấp do rủi ro ảnh hưởng đến học tập/tốt nghiệp.
*   **Từ khóa nhận diện phổ biến**: *chưa nhận mail*, *chưa có email*, *không đăng nhập được*, *không mở được file*, *extract lỗi*, *lỗi giải nén*, *không gọi được*, *không nghe máy*, *không hợp lệ*, *sợ không kịp*, *trễ hạn*, *mất cccd*, *mất thẻ sinh viên*, *rớt thực hành*, *thi lại*.
*   **Các lưu ý đặc biệt**:
    1.  **Lịch sự nhưng có sự cố**: Các câu có kính ngữ lịch sự nhưng nội dung cốt lõi báo sự cố (ví dụ: *"Dạ em chưa nhận được email xác nhận ạ"*) vẫn phải dán là `negative`.
    2.  **Hỗn hợp Tích cực + Tiêu cực**: Nếu câu chứa cả lời cảm ơn lẫn nội dung sự cố/khiếu nại, bạn **phải ưu tiên dán nhãn sự cố** là `negative`.
*   **Ví dụ**:
    - *"em bị mất thẻ sinh viên rồi thì có thi được không ạ"* → `negative`
    - *"Em sợ không kịp nộp bằng tốt nghiệp"* → `negative`
    - *"Em đăng ký hôm qua nhưng đến giờ vẫn chưa nhận được email xác nhận"* → `negative`
    - *"Dạ em cảm ơn nhưng web bị lỗi em không nộp học phí được"* → `negative` (mặc dù có "cảm ơn" nhưng có sự cố nghẽn).

---

## 3. Định dạng tệp kết quả
- Hãy mở tệp `backend/reports/sentiment_blind_test_template.csv` bằng các trình biên tập CSV hoặc Excel.
- Điền cột `manualLabel` theo đúng quy tắc trên.
- Bạn có thể ghi chú thêm lý do dán nhãn tại cột `reviewerNote` nếu gặp câu mơ hồ.
- Đảm bảo lưu tệp dưới định dạng **UTF-8 with BOM** (nếu dùng Excel) để giữ nguyên hiển thị tiếng Việt có dấu.
