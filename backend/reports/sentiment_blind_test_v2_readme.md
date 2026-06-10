# HƯỚNG DẪN GÁN NHÃN BLIND TEST V2 (BLIND TEST V2 ANNOTATION README)

Tệp dữ liệu kiểm thử mù v2 `sentiment_blind_test_v2_template.csv` chứa 250 câu tương tác mới của khách hàng, được trích xuất ngẫu nhiên để rà soát hệ thống Phân tích Cảm xúc & Phát hiện Sự cố.

## 1. Cấu trúc các cột cần gán nhãn thủ công
Người đánh giá (Reviewer) cần điền thông tin vào 4 cột cuối:
*   `manualSentimentLabel`: Nhãn cảm xúc của khách hàng.
*   `manualIssueFlag`: Trạng thái chứa sự cố nghiệp vụ cần xử lý.
*   `manualNeedStaffReview`: Xác nhận hội thoại cần chuyển tiếp nhân viên hỗ trợ.
*   `reviewerNote`: Ghi chú lý giải lựa chọn (nếu có).

---

## 2. Quy tắc gán nhãn chi tiết (Annotation Rules)

### A. Cột `manualSentimentLabel`
Chọn một trong ba giá trị sau:
1.  **`positive`**: Tin nhắn cảm ơn, khen ngợi trung tâm, thể hiện sự hài lòng.
    *   *Ví dụ:* "Dạ em cảm ơn chị nhiều ạ", "Tốt quá, cảm ơn trung tâm nhé"
2.  **`negative`**: Tin nhắn phàn nàn, cáu gắt, bức xúc, hỏi đi hỏi lại do lỗi hệ thống hoặc do bot trả lời sai.
    *   *Ví dụ:* "sao lại trả lời 2 ý khác nhau thế", "web bị sao vào không được", "huhu thi trượt rồi"
3.  **`neutral`**: Tin nhắn hỏi thông tin thông thường hoặc từ chào hỏi, xác nhận ngắn.
    *   *Ví dụ:* "lịch thi toeic coi ở đâu ạ", "Dạ", "Vâng ạ", "Ok", "hồ sơ cần những gì ạ"

### B. Cột `manualIssueFlag` (Độc lập với Cảm xúc)
*   Điền **`true`** nếu tin nhắn phản ánh một sự cố vận hành nghiệp vụ thực tế hoặc vấn đề kỹ thuật khách hàng gặp phải cần can thiệp.
    *   *Các lỗi thuộc nhóm sự cố:* chưa nhận được mail/tin nhắn, lỗi mã QR/thanh toán, không đăng ký thi được, file ôn tập bị lỗi/cần mật khẩu, sắp trễ hạn nộp, thi rượt/thi lại, lỗi đăng nhập/hệ thống, không gọi được hotline.
*   Điền **`false`** nếu tin nhắn chỉ là câu hỏi thông tin thông thường (hỏi lịch thi, học phí, thủ tục), từ đệm chào hỏi hoặc cảm ơn.

### C. Cột `manualNeedStaffReview` (Cực kỳ quan trọng)
*   Điền **`true`** cho tất cả các ca:
    1.  Khách hàng có sắc thái cảm xúc tiêu cực (`manualSentimentLabel = negative`).
    2.  Hội thoại phát hiện có sự cố cần xử lý (`manualIssueFlag = true`).
    3.  Tin nhắn mơ hồ nhưng mang dấu hiệu muốn kết nối hỗ trợ, bot trả lời sai, hoặc nghi ngờ chatbot tự động (`manualNeedStaffReview = true`).
*   Điền **`false`** cho các câu hỏi thông tin chung đã có sẵn FAQs chuẩn, từ đệm chào hỏi xã giao hoặc lời cảm ơn.

---

## 3. Một số lưu ý đặc biệt cho Blind Test v2
*   **Mơ hồ nghiệp vụ:** Nếu câu hỏi không chứa từ lỗi kỹ thuật nhưng có thái độ bức xúc hoặc giục ("trả lời em với") -> gán `manualNeedStaffReview = true`.
*   **Không tự sử dụng kết quả đoán của mô hình làm Ground Truth:** Ground Truth bắt buộc phải được đánh giá khách quan bằng mắt của chuyên viên vận hành.
*   **Quy định định dạng:** Vui lòng nhập đúng các giá trị viết thường (`positive`, `neutral`, `negative`) và viết thường boolean (`true`, `false`) để tránh lỗi khi chạy script tự động đánh giá.
