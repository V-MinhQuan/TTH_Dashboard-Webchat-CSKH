Please refine the current “FLIC AI Operations Dashboard” prototype according to the requirements below.

Important:

* This is still a Figma demo prototype, no real backend is required.
* The prompt is written in English, but keep all UI labels, menus, buttons, tables, cards, and demo content in Vietnamese.
* The interface must be clean, professional, and clearly separated between Admin and Staff roles.
* Do not add extra features beyond the requirements below.

====================================================

1. UPDATE THE SYSTEM COLOR PALETTE
   ====================================================

Update the entire system color palette using the following brand colors:

* Primary orange: #D73C01
* CTA / accent orange: #ED5206
* Navy blue: #003865
* White: #FFFFFF

Color usage rules:

Use #003865 for:

* Sidebar
* Header
* Main titles
* Important text
* Main navigation icons

Use #ED5206 for:

* Primary buttons
* Key highlights
* Important states
* Active tabs
* Alert badges

Use #D73C01 for:

* Critical alerts
* Warning card accent borders
* Error states
* Items that require attention

Use #FFFFFF for:

* Main background
* Card background
* Modal background
* Data table background

Chart colors:

* Do not use too many unrelated colors outside the brand palette.
* Charts should use light and dark variations around:

  * #003865
  * #D73C01
  * #ED5206
  * light navy
  * light orange
  * neutral gray
* Charts must look professional, clean, and easy to read, not overly colorful.

Remove dark mode from the entire system:

* Remove the dark mode toggle from the header.
* Remove any light/dark theme options from Settings.
* Keep only one light-mode interface with a white background.

====================================================
2. REFINE THE ADMIN OVERVIEW PAGE
=================================

The current Admin Overview page has too many KPI cards. Please simplify it.

Only keep these 5 main KPI cards:

1. Tổng hội thoại
2. Tổng tin nhắn
3. Chưa xử lý
4. Đã xử lý
5. Câu hỏi AI thất bại

Design requirements:

* Make the cards smaller and more compact.
* Do not let the KPI section take up too much vertical space.
* Use white card backgrounds.
* Main numbers should use #003865.
* Warning cards such as “Chưa xử lý” and “Câu hỏi AI thất bại” should use a left border or badge in #D73C01 / #ED5206.
* Do not fill the entire card with orange.
* All cards must have consistent size, spacing, icon style, and typography.

Remove unnecessary KPI cards if they currently exist:

* Tỷ lệ hài lòng
* Chờ admin xác nhận
* Chờ quá 10 giờ
* Tỷ lệ AI thành công
* Any other non-essential KPI cards

Data refresh status:

* Remove the text “Tự động cập nhật mỗi 30 giây”.
* Replace it with: “Tự động cập nhật mỗi 30 phút”.
* Example display:
  “Live · Cập nhật gần nhất: 09:38 hôm nay · Tự động cập nhật mỗi 30 phút”

====================================================
3. FIX ADMIN FLOW: REMOVE “SEND TO ADMIN”
=========================================

In the Admin account interface, do not show any button or action named:

* “Gửi admin”
* “Gửi quản lý”
* “Chuyển quản lý kiểm duyệt”

Reason:

* The current user is already Admin / Manager.
* Admin should not send something back to themselves.

In the Admin interface, replace those actions with more appropriate actions:

* Xử lý
* Xem chi tiết
* Duyệt
* Từ chối
* Yêu cầu chỉnh sửa
* Cập nhật Sheet Chatbot
* Thêm vào FAQ
* Ghi nhận lỗi AI
* Đánh dấu đã xử lý

Only keep “Chuyển quản lý kiểm duyệt” in the Staff interface if needed.

====================================================
4. ADMIN FAQ CREATION FLOW
==========================

In the Admin interface, when Admin creates a new FAQ or creates an FAQ from a conversation / wrong AI answer, open a form called:

“Tạo FAQ”

The form includes:

* Câu hỏi
* Câu trả lời
* Chủ đề
* Nguồn dữ liệu
* Ghi chú nội bộ
* Trạng thái

Important requirements:

* The “Câu hỏi” field must be automatically pre-filled from the selected customer question.
* The “Câu trả lời” field must be empty so Admin can manually enter the official answer.
* Topic options:

  * TOEIC
  * VSTEP
  * CNTT Cơ bản
  * CNTT Nâng cao
  * Chuẩn đầu ra ngoại ngữ
  * MOS/IC3
  * Lịch thi
  * Lệ phí
  * Hồ sơ đăng ký
  * Tra cứu điểm
  * Cấp chứng chỉ

Buttons:

* Hủy
* Lưu FAQ

After clicking “Lưu FAQ”:

* Show toast: “Đã tạo FAQ thành công”
* The new FAQ appears in the FAQ / Sheet Chatbot list.

Do not auto-fill the answer field if there is no official verified answer.

====================================================
5. RENAME FEATURES TO BE SHORTER AND MORE PROFESSIONAL
======================================================

Shorten sidebar/menu names to make them more professional.

Suggested Admin sidebar:

* Tổng quan
* Kênh
* Hội thoại
* AI Insights
* Keywords
* Cảm xúc
* Biểu đồ
* Sheet Chatbot
* Người dùng
* Cài đặt

Suggested Staff sidebar:

* Hội thoại
* FAQ
* Sheet Chatbot
* Hiệu suất
* Hồ sơ

Avoid long sidebar labels such as:

* “Quản lý hội thoại khách hàng chi tiết”
* “Trình tạo biểu đồ linh hoạt”
* “Phân tích Keywords chuyên sâu”
* “Quản lý người dùng & phân quyền”

If a full name is needed, show it in the page title, not in the sidebar.

====================================================
6. KEYWORD ANALYSIS BY 4 MAIN TOPIC GROUPS
==========================================

Refine the Keywords page to analyze data by 4 main topic groups.

The 4 topic groups are:

1. TOEIC
2. VSTEP
3. Tin học / MOS / IC3
4. Chuẩn đầu ra / Chứng chỉ

Each topic group should show:

* Total number of questions
* Top keywords
* Increase/decrease rate
* Number of AI failed questions
* Number of FAQs that need to be added

Create charts for these 4 topic groups:

Required charts:

* Bar chart: number of questions by 4 topic groups
* Line chart: question trend over time
* Donut chart: topic share across 4 groups
* Heatmap: AI error level by topic group

Sample data:

TOEIC:

* lệ phí
* lịch thi
* điểm thi
* chứng chỉ
* đăng ký thi

VSTEP:

* lịch thi
* hồ sơ
* cấp chứng chỉ
* ôn tập
* kết quả thi

Tin học / MOS / IC3:

* CNTT Cơ bản
* CNTT Nâng cao
* MOS
* IC3
* quên mật khẩu khóa học

Chuẩn đầu ra / Chứng chỉ:

* điều kiện chuẩn đầu ra
* chứng chỉ hợp lệ
* thời hạn chứng chỉ
* quy đổi điểm

Goal:
The Keywords page should help Admin understand which topics students ask about the most and which topic groups are missing chatbot data.

====================================================
7. REFINE STAFF FUNCTION PAGES
==============================

In the Staff interface, remove these 2 sidebar functions:

* Cần xử lý
* AI cần can thiệp

Reason:

* The Staff sidebar should be simpler and less crowded.
* Conversations that need action or AI intervention should be handled inside the “Hội thoại” page.

The Staff sidebar should only include:

* Hội thoại
* FAQ
* Sheet Chatbot
* Hiệu suất
* Hồ sơ

Inside the Staff “Hội thoại” page, it is still acceptable to include filters or tabs such as:

* Tất cả
* Chưa xử lý
* AI trả lời sai
* Chờ phản hồi
* Đã xử lý

Staff still has permission to:

* View assigned conversations
* Edit AI responses
* Send corrected answers to customers
* Mark AI answers as wrong
* Add FAQs to Sheet Chatbot
* Mark conversations as resolved

But do not separate these into standalone sidebar menus named “Cần xử lý” and “AI cần can thiệp”.

====================================================
8. REFINE FAQ DETAIL IN STAFF INTERFACE
=======================================

In the Staff interface, when clicking “Xem chi tiết” in FAQ, open a detail form with:

* Câu hỏi
* Câu trả lời của AI
* Chủ đề
* Trạng thái
* Nguồn hội thoại
* Ghi chú của nhân viên nếu có

Requirements:

* The “Câu hỏi” field displays the question content.
* The “Câu trả lời của AI” field displays the current AI answer.
* Do not open a complicated data table.
* Do not show official approval permissions like Admin.
* Staff can suggest edits if needed.

Buttons:

* Đóng
* Đề xuất chỉnh sửa
* Thêm vào Sheet Chatbot nếu phù hợp

====================================================
9. REFINE STAFF PERSONAL SETTINGS
=================================

In the Staff account, simplify “Cài đặt cá nhân”.

Remove these sections:

* Cấu hình AI
* Cài đặt giao diện
* Bảo mật
* Cài đặt hệ thống

Only keep Staff-appropriate settings:

* Thông tin cá nhân
* Thông báo
* Kênh phụ trách
* Tùy chọn hiển thị hội thoại

Staff must not be allowed to edit:

* AI settings
* System settings
* Security settings
* Data source settings
* Theme / dark mode settings

====================================================
10. REMOVE SYSTEM SETTINGS FROM STAFF INTERFACE
===============================================

In the Staff interface:

* Completely remove “Cài đặt hệ thống”.
* Do not show the “Cấu hình AI” tab.
* Do not show the “Nguồn dữ liệu” tab.
* Do not show the “Ngưỡng cảnh báo” tab.
* Do not show the “Phân quyền” tab.

If Staff tries to access a system-only feature:

* Show a “Không có quyền truy cập” screen.
* Text:
  “Bạn không có quyền truy cập chức năng này. Vui lòng liên hệ Quản lý CSKH nếu cần hỗ trợ.”
* Button:
  “Quay lại”

====================================================
11. UPDATE ACCOUNT DROPDOWN
===========================

Admin account dropdown:

* Hồ sơ
* Đổi mật khẩu
* Cài đặt
* Người dùng
* Trợ giúp
* Đăng xuất

Staff account dropdown:

* Hồ sơ
* Đổi mật khẩu
* Cài đặt cá nhân
* Trợ giúp
* Đăng xuất

Remove from Staff dropdown:

* Cài đặt hệ thống
* Quản lý người dùng
* Cấu hình AI
* Cấu hình nguồn dữ liệu
* Cài đặt giao diện
* Bảo mật

Remove the dark mode toggle from:

* Header
* Dropdown
* Settings

====================================================
12. FINAL GOAL
==============

After refinement, the prototype must achieve the following:

* The color system is consistent with #003865, #D73C01, #ED5206, and #FFFFFF.
* The Admin Overview dashboard is cleaner, with fewer KPI cards, focusing only on 5 important metrics.
* There is no “Gửi admin” action in the Admin interface.
* Admin creates FAQ using a form where the question is pre-filled and the answer is left empty.
* Dark mode is completely removed.
* Menu names are short, clean, and professional.
* Overview page shows auto-refresh every 30 minutes, not every 30 seconds.
* Keywords page includes charts based on 4 main topic groups.
* Staff interface is simpler and no longer has “Cần xử lý” and “AI cần can thiệp” in the sidebar.
* Staff personal settings are simple and do not include AI configuration, appearance settings, security settings, or system settings.
* Staff FAQ detail opens a form showing the question and AI answer.
* Admin and Staff permissions are clearly separated and aligned with the actual workflow.
