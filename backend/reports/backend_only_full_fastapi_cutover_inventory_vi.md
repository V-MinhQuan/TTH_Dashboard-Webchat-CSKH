# Báo cáo Kiểm kê Chuyển đổi FastAPI (Backend-only Cutover Inventory)

* **Ngày thực hiện**: 10/06/2026
* **Người thực hiện**: Senior Backend/DevOps Engineer
* **Phạm vi**: Chỉ kiểm kê và phân loại các tệp backend trong dự án FLIC WebChat Customer Support Dashboard. Không thay đổi frontend.

---

## 1. Danh sách tệp Node.js backend hiện tại (Sẽ chuyển sang `backend_legacy_node/`)

Các tệp/thư mục sau là thành phần chạy chính của Node.js/Express backend cũ:
* `backend/server.js` (Điểm khởi chạy ứng dụng Express)
* `backend/package.json` & `backend/package-lock.json` (Dependencies của Node.js)
* Thư mục `backend/routes/` (Các route định nghĩa API cho Express)
* Thư mục `backend/controllers/` (Logic điều hướng HTTP cho Express)
* Thư mục `backend/services/` (Các service nghiệp vụ viết bằng JavaScript)
* Thư mục `backend/repositories/` (Tương tác database viết bằng JavaScript)
* Thư mục `backend/tests/` (Các bài kiểm thử Jest dành cho Node.js)
* Thư mục `backend/config/db.js` (Cấu hình kết nối DB SQL Server của Node.js)
* Thư mục `backend/middlewares/error.middleware.js` (Bộ lọc xử lý lỗi Express)

## 2. Danh sách tệp FastAPI backend hiện tại (Giữ lại trong `backend/`)

Các tệp/thư mục phục vụ cho FastAPI backend mới hoạt động trên cổng `8000`:
* Thư mục `backend/app/` (Chứa toàn bộ mã nguồn FastAPI)
  * `backend/app/main.py`
  * `backend/app/core/`
  * `backend/app/db/`
  * `backend/app/repositories/`
  * `backend/app/routers/`
  * `backend/app/schemas/`
  * `backend/app/services/`
  * `backend/app/utils/`
* Thư mục `backend/tests_fastapi/` (Kiểm thử tự động bằng pytest dành cho FastAPI)
* `backend/requirements.txt` (Khai báo dependencies của Python)
* `backend/.env` & `backend/.env.example` (Cấu hình môi trường backend)
* `backend/.venv/` (Môi trường ảo Python - ignore trong git)
* Thư mục `backend/db/` (Các module hỗ trợ kết nối DB)
* Thư mục `backend/database/` (Các script SQL migration)
* Thư mục `backend/reports/` (Các báo cáo phân tích/chuyển đổi)
* Thư mục `backend/scripts/` (Các script hỗ trợ kiểm tra, đồng bộ)
* Thư mục `backend/docs/` (Tài liệu API của backend)

---

## 3. Các API đã được triển khai hoàn tất trên FastAPI

FastAPI đã triển khai đầy đủ các endpoint đọc dữ liệu và dự đoán cảm xúc (port 8000), thay thế hoàn toàn Node.js:
1. `GET /api/health` — Kiểm tra sức khỏe hệ thống (DB, ML Service).
2. `GET /api/health/ml` — Kiểm tra kết nối riêng tới ml-service.
3. `GET /api/dashboard/kpi` — Thống kê các chỉ số KPI trên Dashboard.
4. `GET /api/analytics/sentiment-summary` — Tổng hợp tỉ lệ phân bổ cảm xúc.
5. `GET /api/analytics/sentiment-trend` — Biểu đồ xu hướng cảm xúc theo thời gian.
6. `GET /api/analytics/satisfaction-summary` — Điểm CSAT/satisfaction trung bình.
7. `GET /api/analytics/satisfaction-trend` — Xu hướng CSAT theo thời gian.
8. `GET /api/analytics/topics` — Thống kê các chủ đề hội thoại phổ biến.
9. `GET /api/analytics/need-review-conversations` — Danh sách các hội thoại cần nhân viên xem xét.
10. `GET /api/analytics/negative-conversations` — Danh sách các hội thoại có cảm xúc tiêu cực.
11. `GET /api/analytics/need-review-keywords` — Từ khóa nổi bật trong các cuộc gọi cần xem xét.
12. `GET /api/analytics/negative-keywords` — Từ khóa tiêu biểu trong hội thoại tiêu cực.
13. `GET /api/conversations` — Danh sách hội thoại phân trang, hỗ trợ lọc và tìm kiếm.
14. `GET /api/conversations/{conversation_id}` — Chi tiết hội thoại (lịch sử tin nhắn).
15. `GET /api/conversations/by-message/{message_id}` — Tra cứu hội thoại chứa tin nhắn cụ thể.
16. `POST /api/sentiment/predict` — Dự đoán cảm xúc của văn bản (chuyển tiếp tới ml-service).

---

## 4. Các luồng chỉ có ở Node.js backend

* **Luồng chạy lại phân tích hàng loạt (Reprocess write flow - `POST /api/analytics/run`)**: Node.js có chứa logic kết nối database để quét qua tất cả tin nhắn chưa được phân tích hoặc phân tích lỗi, gửi sang ml-service và lưu kết quả cập nhật lại database.
* Do đây là luồng ghi và cập nhật dữ liệu hàng loạt (Write-flow), nó chưa được tích hợp hoàn toàn hoặc chưa được phê duyệt chạy tự động trên FastAPI trong môi trường sản xuất để tránh xung đột dữ liệu.

---

## 5. Tình trạng của endpoint `POST /api/analytics/run` trên FastAPI

* Endpoint `/api/analytics/run` trên FastAPI hiện đã được định nghĩa nhưng trả về mã lỗi **501 Not Implemented** có kiểm soát.
* Luồng reprocess ghi dữ liệu này sẽ được giữ nguyên ở trạng thái 501 trên FastAPI cho đến khi có yêu cầu nghiệp vụ và phê duyệt cụ thể để di chuyển phần ghi này.
* Giao diện người dùng trên dashboard (nút bấm "Chạy phân tích mới") vẫn sẽ hiển thị bình thường do yêu cầu không thay đổi mã nguồn frontend, tuy nhiên khi bấm vào sẽ nhận về lỗi 501 có kiểm soát từ FastAPI backend.

---

## 6. Phân loại tệp để di chuyển và giữ lại

### Các tệp/thư mục AN TOÀN để di chuyển sang `backend_legacy_node/`:
* `backend/server.js`
* `backend/routes/`
* `backend/controllers/`
* `backend/services/*.js`
* `backend/repositories/*.js`
* `backend/tests/*.js`
* `backend/config/db.js`
* `backend/middlewares/error.middleware.js`
* `backend/package.json`
* `backend/package-lock.json`

### Các tệp/thư mục BẮT BUỘC giữ lại trong `backend/`:
* Thư mục `backend/app/`
* Thư mục `backend/tests_fastapi/`
* Thư mục `backend/db/` (Chứa các tiện ích Python kết nối DB dùng chung)
* Thư mục `backend/database/` (Migrations SQL)
* Thư mục `backend/reports/`
* Thư mục `backend/scripts/`
* Thư mục `backend/docs/`
* `backend/requirements.txt`
* `backend/.env` & `backend/.env.example`
* `backend/.venv/` (Nếu có)
