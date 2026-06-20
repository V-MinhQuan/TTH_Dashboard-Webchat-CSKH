# PENDING REQUIREMENT – Research Handling (Nghiên cứu hỗ trợ)

> **Trạng thái: CHƯA TRIỂN KHAI – Cần quyết định từ khách hàng**  
> Ngày tạo: 2026-06-20  
> Người tạo: Antigravity (AI Engineer)

---

## Bối cảnh

Yêu cầu "Research handling" được nhắc đến trong customer interview round 3 nhưng **chưa được định nghĩa rõ ràng** về phạm vi và nghiệp vụ. Theo nguyên tắc an toàn trong prompt, yêu cầu này **không được triển khai** cho đến khi nhận được phản hồi từ khách hàng.

---

## Câu hỏi cần làm rõ

### 1. Phạm vi (Scope)
- "Research handling" là gì? Một loại trạng thái hội thoại mới? Một tính năng riêng?
- Nó khác gì so với "Đang tư vấn", "Chờ xử lý"?

### 2. Quyền hạn (Permissions)
- Ai được phép đánh dấu hội thoại là "Research handling"?
- Nhân viên CSKH? Quản lý? Hệ thống tự động?

### 3. Chuyển trạng thái (Status Transitions)
- Từ trạng thái nào có thể chuyển sang "Research handling"?
- Trạng thái tiếp theo sau khi nghiên cứu xong là gì?

### 4. SLA
- Có thời hạn xử lý cho trạng thái này không?
- Cảnh báo khi vượt quá thời hạn?

### 5. Ghi chú (Notes) & Đính kèm (Attachments)
- Nhân viên có thể thêm ghi chú khi đánh dấu "research"?
- Cho phép đính kèm tài liệu?

### 6. Audit Log
- Lịch sử thay đổi trạng thái có được ghi lại?
- Ai nhìn thấy log?

### 7. Bộ lọc (Filters)
- Cần lọc hội thoại theo trạng thái "Research handling" không?

### 8. KPI
- Có KPI riêng cho hội thoại "research" không (ví dụ: số lượng, thời gian xử lý trung bình)?

---

## Hành động tiếp theo

- [ ] Khách hàng phản hồi và điền vào các câu hỏi trên
- [ ] Sau khi có câu trả lời, tạo database migration script với rollback instructions
- [ ] Thiết kế API mới theo chuẩn `routers → services → repositories → db`
- [ ] KHÔNG tạo bất kỳ database state hay API mới cho đến khi được phê duyệt

---

## Ghi chú kỹ thuật

- Nếu "Research handling" là một trạng thái mới, cần thêm vào:
  - `WebChat_Conversations` table (trường `status`)
  - Backend enum / whitelist trong `routers`
  - Frontend `TERMINOLOGY.STATUS` (thêm key mới)
  - `STATUS_COLORS` mapping
  - FilterPanel options
  - KPI counters
- Migration phải có rollback script (`ALTER TABLE ... DROP COLUMN` hoặc enum revert)
- **Không chạy migration trên production tự động**
