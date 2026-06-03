CẬP NHẬT & CHỈNH SỬA TOÀN BỘ FLIC AI OPERATIONS DASHBOARD

Hãy redesign và chỉnh sửa lại toàn bộ prototype dashboard theo các yêu cầu dưới đây. Giữ nguyên phong cách HIGH-FIDELITY INTERACTIVE PROTOTYPE, AI-centric SaaS Dashboard, hiện đại giống Tableau + PowerBI + Gemini UI.

====================================================
CẬP NHẬT BỘ LỌC
===============

Tất cả bộ lọc trong toàn hệ thống CHỈ sử dụng đúng 4 kênh dữ liệu sau:

* Zalo OA
* Zalo Business
* Chat Widget
* Facebook

Không hiển thị thêm bất kỳ kênh nào khác.

Áp dụng cho:

* Global filter
* Filter chart
* Filter popup
* Filter AI
* Chart Builder
* Table filter
* Conversation filter

====================================================
ĐỔI TÊN MODULE CHUYÊN NGHIỆP HƠN
================================

Đổi toàn bộ sidebar thành naming chuyên nghiệp hơn theo chuẩn enterprise analytics dashboard.

Tên mới:

* Tổng quan vận hành
* Phân tích đa kênh
* Phân tích chủ đề & FAQ
* Phân tích keyword
* Hiệu suất xử lý CSKH
* Trung tâm hội thoại
* Phân tích cảm xúc khách hàng
* AI QA & Insights
* Trình tạo Dashboard
* Cài đặt hệ thống

Không dùng các tên quá đơn giản hoặc mang cảm giác demo/student project.

====================================================
QUẢN LÝ NGƯỜI DÙNG
==================

KHÔNG tạo module riêng “Quản lý người dùng”.

Toàn bộ quản lý user phải được gộp vào:
“Cài đặt hệ thống”

Trong phần “Cài đặt hệ thống” thêm tab mới:

* Người dùng & phân quyền

Tab này gồm:

1. DANH SÁCH NGƯỜI DÙNG
   Hiển thị table:

* Họ tên
* Email
* Vai trò
* Trạng thái
* Ngày tạo
* Quyền truy cập
* Action

Vai trò:

* Admin
* Quản lý CSKH
* Nhân viên CSKH
* QA AI
* Viewer

Action:

* Xem
* Chỉnh sửa
* Khóa tài khoản
* Reset mật khẩu

Có:

* Search user
* Filter role
* Filter trạng thái
* Pagination
* Empty state
* Loading state

====================================================
FORM THÊM NGƯỜI DÙNG
====================

Thêm nút:
“+ Thêm người dùng”

Khi click:
Mở modal hoặc side panel:
“Thêm người dùng mới”

Form gồm:

* Họ tên
* Email
* Số điện thoại
* Vai trò
* Phòng ban
* Mật khẩu tạm thời
* Quyền truy cập dashboard
* Kênh được quản lý
* Trạng thái tài khoản

Checkbox:

* Gửi email kích hoạt
* Bắt đổi mật khẩu lần đầu

Buttons:

* Tạo tài khoản
* Hủy

Khi submit:

* Toast success:
  “Đã tạo người dùng mới”
* User xuất hiện trong table.

====================================================
PHÂN BIỆT GIAO DIỆN NHÂN VIÊN
=============================

Trong tài khoản nhân viên CSKH:
Các section:

* Hội thoại của tôi
* Cần xử lý
* AI cần can thiệp

HIỆN ĐANG GIỐNG NHAU → HÃY THIẾT KẾ KHÁC RÕ RÀNG.

---

1. HỘI THOẠI CỦA TÔI

---

Mục đích:
Hiển thị hội thoại nhân viên đang phụ trách.

Style:

* Card mềm
* Màu xanh navy chủ đạo
* Focus productivity
* Layout clean

Hiển thị:

* Số hội thoại assigned
* SLA cá nhân
* Tỷ lệ phản hồi
* Danh sách hội thoại đang xử lý

Tone:
Professional
Calm
Operational

---

2. CẦN XỬ LÝ

---

Mục đích:
Hiển thị các hội thoại overdue hoặc chưa xử lý.

Style:

* Alert-focused
* Có màu cam nổi bật
* Border warning
* Priority indicator
* Badge cảnh báo

Hiển thị:

* Hội thoại quá hạn
* Hội thoại chờ lâu
* SLA sắp vi phạm
* Escalation

Tone:
Urgent
Attention required

---

3. AI CẦN CAN THIỆP

---

Mục đích:
Hiển thị các case AI không chắc chắn hoặc AI hallucination.

Style:

* AI-centric
* Glow effect
* Gradient navy + orange
* Có AI confidence bar
* Confidence score
* AI warning badge

Hiển thị:

* AI confidence thấp
* AI trả lời sai
* Chatbot không tìm thấy dữ liệu
* AI cần admin review

Tone:
AI monitoring center
Modern
Technical

Mỗi section phải có:

* Layout khác nhau
* Màu nhấn khác nhau
* Card style khác nhau
* Icon khác nhau
* Empty state khác nhau
* KPI khác nhau

Không được reuse cùng một UI layout.

====================================================
HỒ SƠ CÁ NHÂN
=============

ĐỔI “Hồ sơ cá nhân” thành:
“Cài đặt cá nhân”

Quan trọng:
“Cài đặt cá nhân” PHẢI KHÁC hoàn toàn với:
“Cài đặt hệ thống” của admin.

---

## CÀI ĐẶT CÁ NHÂN

Dành cho user account.

Chỉ gồm:

* Avatar
* Tên hiển thị
* Email
* Số điện thoại
* Đổi mật khẩu
* Ngôn ngữ
* Dark mode
* Notification setting
* Trạng thái online
* Timezone

Không chứa:

* User management
* System configuration
* Permission
* AI setup
* Data source

Style:

* Personal profile UI
* Modern settings page
* Card layout
* Friendly but professional

====================================================
CÀI ĐẶT HỆ THỐNG (ADMIN)
========================

Dành cho admin.

Bao gồm:

* Nguồn dữ liệu
* KPI & Dashboard
* AI Configuration
* Notification
* User & Permission
* API & Integration
* Security
* Audit Log

Tone:
Enterprise admin panel
Technical
Professional

====================================================
UI/UX YÊU CẦU
=============

* Prototype phải click được
* Có hover state
* Có active state
* Có loading state
* Có empty state
* Có toast
* Có transition animation
* Có skeleton loading

Thiết kế:

* Modern SaaS
* AI-centric
* Enterprise analytics dashboard
* Không giống student project

====================================================
MÀU SẮC
=======

Chỉ sử dụng:

* #003865
* #D73C01
* #ED5206
* #FFFFFF

và các sắc độ nhạt của chúng.
