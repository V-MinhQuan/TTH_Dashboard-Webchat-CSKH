# PENDING REQUIREMENT: “Research handling”

Status: **PENDING CUSTOMER DECISION — DO NOT IMPLEMENT**

Không tạo trạng thái database, API, KPI hoặc UI workflow cho yêu cầu này cho đến khi khách hàng phê duyệt các điểm sau:

1. “Research” là loại hội thoại, loại công việc hay một nhánh xử lý của AI failure?
2. Vai trò nào được tạo, nhận, chuyển giao, đóng hoặc mở lại yêu cầu research?
3. Các trạng thái hợp lệ và điều kiện chuyển trạng thái là gì?
4. SLA bắt đầu/dừng/tạm dừng khi nào; có phân mức ưu tiên không?
5. Ghi chú nào là nội bộ, ghi chú nào có thể gửi cho khách hàng?
6. Có cho phép tệp đính kèm không; loại tệp, kích thước và chính sách lưu trữ/quét malware là gì?
7. Audit log cần lưu actor, timestamp, dữ liệu trước/sau và thời hạn bao lâu?
8. Bộ lọc bắt buộc gồm những trường nào (người phụ trách, trạng thái, SLA, topic, kênh, ngày)?
9. KPI chính thức là gì và mẫu số được định nghĩa ra sao?
10. Research có liên kết một hay nhiều hội thoại/khách hàng không?
11. Quy tắc bảo vệ dữ liệu cá nhân và quyền export đối với research là gì?
12. Có cần thông báo, escalation hoặc tích hợp ticketing bên ngoài không?

Chỉ sau khi có câu trả lời và acceptance criteria được duyệt mới lập migration/API contract.
