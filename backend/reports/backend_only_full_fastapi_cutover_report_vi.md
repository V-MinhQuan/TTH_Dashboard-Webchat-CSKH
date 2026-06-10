# Báo Cáo Chuyển Đổi FastAPI (Backend-Only Cutover Report)

* **Thời gian thực hiện**: 10/06/2026 17:22:00
* **Người thực hiện**: Senior Backend/DevOps Engineer
* **Trạng thái cuối cùng**: `BACKEND_FASTAPI_ONLY_READY_FOR_FRONTEND_CUTOVER`

---

## 1. Thời gian thực hiện chuyển đổi
Chuyển đổi được thực hiện hoàn tất vào chiều ngày **10/06/2026**.

## 2. Nhánh Rollback & Archive
* Đã tạo nhánh backup an toàn: `backup/node-backend-before-backend-only-fastapi-cutover` từ nhánh `main` trước khi di chuyển các tệp tin.
* Đã tạo thư mục lưu trữ `/backend_legacy_node/` để chứa toàn bộ mã nguồn Express cũ nhằm phục vụ tham chiếu/rollback.

## 3. Các tệp Node.js còn lại trong `backend/`
* Không còn tệp mã nguồn runtime Node.js nào trong `backend/`.
* Thư mục `backend/node_modules/` cục bộ được giữ lại (được ignore bởi Git) và không bị xóa để tránh ảnh hưởng môi trường cục bộ.

## 4. Các tệp tin đã di chuyển/lưu trữ (Moved/Archived)
Các tệp tin sau đã được di chuyển từ `backend/` sang `backend_legacy_node/`:
* `backend/server.js` → `backend_legacy_node/server.js`
* `backend/routes/` → `backend_legacy_node/routes/`
* `backend/controllers/` → `backend_legacy_node/controllers/`
* `backend/services/*.js` → `backend_legacy_node/services/`
* `backend/repositories/*.js` → `backend_legacy_node/repositories/`
* `backend/tests/*.js` → `backend_legacy_node/tests/`
* `backend/config/db.js` → `backend_legacy_node/config/db.js`
* `backend/middlewares/error.middleware.js` → `backend_legacy_node/middlewares/error.middleware.js`
* `backend/package.json` → `backend_legacy_node/package.json`
* `backend/package-lock.json` → `backend_legacy_node/package-lock.json`

## 5. Xử lý `POST /api/analytics/run`
* Endpoint `/api/analytics/run` được giữ nguyên trả về lỗi **501 Not Implemented** có kiểm soát trên FastAPI backend.
* Phản hồi JSON trả về đúng cấu trúc:
  ```json
  {
    "success": false,
    "message": "FastAPI migration stage does not run analytics reprocess. This write/reprocess flow requires separate approval.",
    "data": null
  }
  ```
* Không chạy bất kỳ tác vụ reprocess hay ghi đè DB nào trong quá trình chuyển đổi này.

## 6. Danh sách Endpoint FastAPI cuối cùng
* `GET /api/health` — Trạng thái sức khỏe hệ thống (DB, ML Service).
* `GET /api/health/ml` — Sức khỏe riêng của ml-service.
* `GET /api/dashboard/kpi` — Thống kê các chỉ số KPI Dashboard.
* `GET /api/analytics/sentiment-summary` — Phân bổ cảm xúc hội thoại.
* `GET /api/analytics/sentiment-trend` — Xu hướng cảm xúc theo thời gian.
* `GET /api/analytics/satisfaction-summary` — Điểm CSAT/thỏa mãn trung bình.
* `GET /api/analytics/satisfaction-trend` — Xu hướng CSAT theo ngày.
* `GET /api/analytics/topics` — Thống kê các chủ đề nổi bật.
* `GET /api/analytics/need-review-conversations` — Danh sách hội thoại cần nhân viên xem xét.
* `GET /api/analytics/negative-conversations` — Danh sách hội thoại có cảm xúc tiêu cực.
* `GET /api/analytics/need-review-keywords` — Từ khóa trong hội thoại cần review.
* `GET /api/analytics/negative-keywords` — Từ khóa trong hội thoại tiêu cực.
* `GET /api/conversations` — Danh sách hội thoại phân trang.
* `GET /api/conversations/{conversation_id}` — Chi tiết hội thoại (lịch sử tin nhắn).
* `GET /api/conversations/by-message/{message_id}` — Tìm hội thoại bằng ID tin nhắn.
* `POST /api/sentiment/predict` — Phân tích cảm xúc văn bản real-time.

## 7. Cấu hình biến môi trường Frontend (Frontend API Env)
* Kế hoạch này là **backend-only**, do đó không sửa bất kỳ mã nguồn frontend nào (không sửa `src/` hay `VITE_API_URL` fallback trong mã nguồn React).
* Khi chạy frontend thực tế, cần truyền tham số môi trường: `VITE_API_URL=http://localhost:8000/api` để trỏ trực tiếp đến cổng FastAPI mới.

## 8. Cập nhật tài liệu hướng dẫn (README Updates)
* Đã cập nhật tệp [README.md](file:///d:/FLIC/Project_FLIC/TTH_Dashboard-Webchat-CSKH/README.md) gốc để:
  * Giảm số lượng terminal khởi chạy từ 4 xuống 3 (ML Service, FastAPI Backend, Frontend).
  * Loại bỏ hướng dẫn cài đặt dependencies Node.js cho backend.
  * Chỉ rõ Node.js backend cũ nằm trong `backend_legacy_node/` và chỉ dùng để rollback.
* Đã cập nhật tệp [README.md](file:///d:/FLIC/Project_FLIC/TTH_Dashboard-Webchat-CSKH/backend/README.md) trong thư mục backend để mô tả cấu trúc và cách vận hành mới của FastAPI backend.
* Đã tạo tệp hướng dẫn lưu trữ [README_LEGACY.md](file:///d:/FLIC/Project_FLIC/TTH_Dashboard-Webchat-CSKH/backend_legacy_node/README_LEGACY.md).

## 9. Kết quả kiểm thử tự động (Test Results)
* **FastAPI Backend pytest**: `18 passed` (Thành công 100%)
* **ML Service pytest**: `56 passed` (Thành công 100%)
* **Frontend build (`npm run build`)**: Đã chạy thành công từ trước.

## 10. Kết quả xác minh API thủ công (Manual API Validation)
Các API được gọi thành công bằng PowerShell:
* `GET /api/health` → Trả về trạng thái `ok`, DB và ML Service đều `connected`.
* `GET /api/dashboard/kpi` → Trả về đúng các thông số KPI thực tế từ SQL Server.
* `POST /api/sentiment/predict` → Dự đoán chính xác cảm xúc tiêu cực (`negative`), nhận biết đúng issue pattern và trả về `needStaffReview = true`.
* `POST /api/analytics/run` → Trả về đúng mã lỗi `501 NotImplemented` với thông điệp từ chối phân tích của FastAPI.

## 11. Kết quả Frontend Smoke Test
* Khi chạy Frontend trỏ sang FastAPI cổng 8000, các API đọc hoạt động trơn tru, hiển thị đầy đủ thông tin trên Dashboard, danh sách hội thoại và phân tích cảm xúc.

## 12. Kiểm tra tiến trình trên cổng Node.js 5000
* Đã xác minh cổng `5000` không có tiến trình nào đang lắng nghe sau khi dừng Node.js backend. Các yêu cầu gọi API từ frontend chỉ trỏ tới FastAPI (:8000).

## 13. Các rủi ro còn lại
* **Nút bấm trên UI Frontend**: Nút bấm "Chạy phân tích mới" trên màn hình Dashboard vẫn hiển thị do mã nguồn frontend không bị thay đổi trong đợt cutover này. Khi người dùng bấm nút này sẽ nhận về mã lỗi 501 có kiểm soát từ FastAPI. Cần có task cập nhật frontend sau đó để ẩn nút này.
* **Cấu hình Fallback**: Nếu chạy frontend không truyền biến môi trường `VITE_API_URL`, nó sẽ tự động fallback về `http://localhost:5000/api` trong mã nguồn. Cần thay đổi cấu hình fallback trong frontend ở task tiếp theo.

## 14. Kế hoạch Rollback
Nếu có sự cố nghiêm trọng xảy ra với FastAPI backend:
1. Di chuyển toàn bộ tệp tin trong thư mục `backend_legacy_node/` trở lại `backend/`.
2. Khởi chạy lại Node.js backend ở cổng `5000` (`npm install && npm run dev`).
3. Trỏ cấu hình `VITE_API_URL` của frontend về `http://localhost:5000/api`.

## 15. Trạng thái cuối cùng
`BACKEND_FASTAPI_ONLY_READY_FOR_FRONTEND_CUTOVER`
Môi trường backend hiện tại đã hoàn toàn tách biệt khỏi runtime Node.js, sẵn sàng cho việc chuyển đổi hoàn toàn cấu hình frontend ở giai đoạn tiếp theo.
