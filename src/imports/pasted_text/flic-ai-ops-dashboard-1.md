Please refine the current “FLIC AI Operations Dashboard” prototype according to the screen-by-screen requirements below.

General notes:

* This is still a Figma demo prototype. No real backend is required.
* Keep all UI labels, menu names, buttons, cards, tables, notifications, and demo content in Vietnamese.
* Do not add extra features outside the scope below.
* The interface must be clean, professional, and suitable for a real FLIC customer support WebChat system.
* Clearly separate permissions between Admin/Manager and Staff.
* Remove Dark Mode from the entire system.
* If a screen has been removed from the sidebar, there must be no notification, CTA, link, or navigation pointing to that removed screen.

====================================================
0. GLOBAL DESIGN SYSTEM
=======================

Main color palette:

* Primary orange: #D73C01
* CTA / active orange: #ED5206
* Navy blue: #003865
* White: #FFFFFF
* Sidebar background: #EBF2FF

Color usage:

* Use #003865 for header, main titles, important text, and primary navigation icons.
* Use #ED5206 for primary buttons, active tabs, CTA actions, and important badges.
* Use #D73C01 for alerts, AI errors, and attention-required states.
* Use #FFFFFF for main background, cards, modals, and tables.
* Use #EBF2FF for the sidebar background.
* Do not use purple, dark gray, or off-brand colors for charts and heatmaps.

Charts:

* Use chart colors around these approved tones:

  * #228A61
  * #F59E0B
  * #D73C01
  * #003BB9
  * #1565C0
  * #42A5F5
* Do not use purple.
* Do not use gray as a main chart color.
* All heatmaps across the system must use an ocean-blue tone.
* Do not use hot heatmap colors such as red, orange, or yellow.

Icons:

* Review and update all icons.
* Icons must match the meaning of the content they represent.
* Do not reuse the same icon for different meanings.
* Examples:

  * Hội thoại: chat/message icon
  * AI Insights: bot/brain icon
  * FAQ: question/document icon
  * Sheet Chatbot: spreadsheet/table icon
  * Cài đặt: gear icon
  * Người dùng: users icon
  * Cảm xúc: sentiment/face icon
  * Keywords: tag/hash icon
* Icons inside the same group of cards must have consistent colors, but different meanings must use different icons.

====================================================

1. LOGIN / ROLE SELECTION SCREEN
   ====================================================

Create or refine a Login / Role Switch screen for permission-based demo.

There are 2 demo accounts:

1. Admin FLIC

   * Role: Quản lý CSKH

2. Nhân viên CSKH

   * Role: Nhân viên

UI requirements:

* White background #FFFFFF.
* Centered login card.
* System name: “FLIC AI Operations Dashboard”.
* Subtitle: “Dashboard trực quan hóa dữ liệu WebChat CSKH kết hợp AI Insight”.
* Two role selection buttons:

  * “Đăng nhập với vai trò Admin”
  * “Đăng nhập với vai trò Nhân viên”
* Primary button uses #ED5206.
* Selecting Admin opens the Admin dashboard.
* Selecting Staff opens the Staff workspace.

====================================================
2. GLOBAL LAYOUT AFTER LOGIN
============================

Header:

* Use white or a very light navy style.
* Include breadcrumb.
* Include screen title.
* Include search bar if relevant.
* Include notification bell.
* Include user avatar.
* Completely remove the Dark Mode toggle.

Sidebar:

* Background color: #EBF2FF.
* Text and icons use #003865.
* Active item uses #ED5206.
* Keep the sidebar clean and short.
* Do not show features that are not available for the current actor.

Admin sidebar:

* Tổng quan
* Kênh
* Hội thoại
* AI Insights
* Keywords
* Cảm xúc
* Biểu đồ
* Sheet Chatbot
* Cài đặt

Important:

* Remove “Người dùng” from the Admin sidebar because user management already exists inside Settings.

Staff sidebar:

* Hội thoại
* FAQ
* Sheet Chatbot
* Hiệu suất
* Hồ sơ

Important:

* Remove “Cần xử lý” from the Staff sidebar.
* Remove “AI cần can thiệp” from the Staff sidebar.
* Conversations that need action or AI intervention must be handled inside the “Hội thoại” page.

====================================================
3. ADMIN SCREEN – OVERVIEW
==========================

Goal:
The Admin Overview screen must be cleaner and focus only on the most important metrics.

Only keep 5 KPI cards:

1. Tổng hội thoại
2. Tổng tin nhắn
3. Chưa xử lý
4. Đã xử lý
5. Câu hỏi AI thất bại

Remove secondary KPI cards:

* Tỷ lệ hài lòng
* Chờ admin xác nhận
* Chờ quá 10 giờ
* Tỷ lệ AI thành công
* Any other non-essential KPI cards

KPI design:

* Make the cards smaller and more compact.
* Use white card backgrounds.
* Main numbers use #003865.
* Icons use a consistent color style.
* Cards “Chưa xử lý” and “Câu hỏi AI thất bại” should use a badge or left border in #D73C01 / #ED5206.
* Do not fill the full card background with orange.

Sample data:

* Tổng hội thoại: 2.907
* Tổng tin nhắn: 44.545
* Chưa xử lý: 1.469
* Đã xử lý: 1.438
* Câu hỏi AI thất bại: 215

Data refresh status:

* Remove “Tự động cập nhật mỗi 30 giây”.
* Replace it with:
  “Live · Cập nhật gần nhất: 09:38 hôm nay · Tự động cập nhật mỗi 30 phút”

Filter bar:

* Include filters for time, channel, topic, and status.
* Add an “Áp dụng” button.
* The “Áp dụng” button uses #ED5206.
* Include a “Làm mới” button if needed.

Admin notifications:

* Only show notifications related to Admin features.
* Do not show notifications for removed screens or features that are not in the Admin sidebar.

====================================================
4. ADMIN SCREEN – CHANNELS
==========================

Goal:
Analyze WebChat data by support channel.

Channels:

* Zalo Business
* Facebook
* Zalo OA
* Chat Widget

Required content:

* Chart showing number of conversations by channel.
* Chart showing number of messages by channel.
* AI failed question rate by channel.
* Channel detail table.

Sample data:

* Zalo Business: 1.321 conversations, 22.931 messages.
* Facebook: 1.143 conversations, 16.845 messages.
* Zalo OA: 404 conversations, 4.085 messages.
* Chat Widget: 38 conversations, 193 messages.

Chart colors:

* Use #003BB9, #1565C0, #42A5F5, #D73C01, or nearby shades.
* Do not use purple or gray as main chart colors.

Filter bar:

* Include an “Áp dụng” button.
* Include filters for time, channel, and topic.

====================================================
5. ADMIN SCREEN – CONVERSATIONS
===============================

Goal:
Admin can view all conversations in the system.

Layout:

* Left column: conversation list.
* Right column: conversation detail as a chat timeline.

Filters:

* Channel
* Topic
* Conversation status
* AI status
* Time
* “Áp dụng” button

Conversation statuses:

* Chưa xử lý
* Đang xử lý
* Chờ quản lý xác nhận
* Hoàn thành
* Không cần phản hồi

AI statuses:

* Thành công
* Không chắc chắn
* AI trả lời sai
* Không tìm thấy dữ liệu
* Có nguy cơ hallucination

Important:
In the Admin interface, do not show these buttons:

* “Gửi admin”
* “Gửi quản lý”
* “Chuyển quản lý kiểm duyệt”

Reason:
The current user is already Admin.

Replace them with suitable Admin actions:

* Xem chi tiết
* Xử lý
* Duyệt
* Từ chối
* Yêu cầu chỉnh sửa
* Cập nhật Sheet Chatbot
* Thêm vào FAQ
* Ghi nhận lỗi AI
* Đánh dấu đã xử lý

====================================================
6. ADMIN SCREEN – AI INSIGHTS / AI ANALYSIS
===========================================

Goal:
This screen monitors chatbot AI quality.

KPI cards should include:

* AI thất bại
* AI thành công
* Cần kiểm duyệt
* FAQ cần bổ sung
* Sheet Chatbot updates

Icon requirements:

* Each card must use a different icon.
* Icons must match the card meaning.
* Icon colors must be consistent.
* Do not reuse the same icon for cards with different meanings.

Chart: “Xu hướng AI thất bại”

* Use a line chart.
* Use 3 different colored lines.
* Do not use dashed lines.
* Only use these colors or nearby shades:

  * #228A61
  * #F59E0B
  * #D73C01
  * #003BB9
  * #1565C0
  * #42A5F5
* Do not use purple, gray, or off-brand colors.
* Lines must be solid, clear, and professional.

Heatmap:

* All heatmaps inside AI Insights must use ocean-blue tones.
* Do not use hot heatmap colors.

AI error table:

* Câu hỏi khách hàng
* Câu trả lời AI
* Chủ đề
* Kênh
* Lý do lỗi
* Mức độ ảnh hưởng
* Trạng thái
* Hành động

Admin actions:

* Xem chi tiết
* Duyệt
* Từ chối
* Yêu cầu chỉnh sửa
* Cập nhật Sheet Chatbot
* Thêm vào FAQ

Do not include “Gửi admin” on this screen.

====================================================
7. ADMIN SCREEN – CREATE FAQ
============================

When Admin clicks “Tạo FAQ” or “Thêm vào FAQ” from a selected question or wrong AI answer, open a “Tạo FAQ” form.

Form fields:

* Câu hỏi
* Câu trả lời
* Chủ đề
* Nguồn dữ liệu
* Ghi chú nội bộ
* Trạng thái

Important:

* The “Câu hỏi” field is automatically pre-filled from the selected question.
* The “Câu trả lời” field must be empty so Admin can enter the official answer manually.
* Do not automatically use the AI answer as the official FAQ answer if it has not been verified.

Topic options:

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

After saving:

* Show toast: “Đã tạo FAQ thành công”.
* The new FAQ appears in the FAQ / Sheet Chatbot list.

====================================================
8. ADMIN SCREEN – KEYWORDS
==========================

Goal:
Analyze keywords by 4 main topic groups.

4 groups:

1. TOEIC
2. VSTEP
3. Tin học / MOS / IC3
4. Chuẩn đầu ra / Chứng chỉ

Each group displays:

* Total number of questions
* Top keywords
* Increase/decrease rate
* Number of AI failed questions
* Number of FAQs that need to be added

Required charts:

* Bar chart: number of questions by 4 groups.
* Line chart: question trend over time.
* Donut chart: share of the 4 groups.
* Heatmap: AI error level by topic group.

Heatmap:

* Use ocean-blue tones.
* Do not use hot colors.

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

====================================================
9. ADMIN SCREEN – SENTIMENT
===========================

Goal:
Analyze customer sentiment in conversations.

Content:

* Positive / neutral / negative overview.
* Sentiment trend over time.
* List of conversations with negative sentiment.
* Topics with high negative sentiment.

Color requirements:

* Sentiment heatmap uses ocean-blue tones.
* Do not use red/orange/yellow heatmap colors.
* If negative sentiment needs attention, use a small #D73C01 badge only.
* Do not make the entire chart use hot colors.

Icons:

* Use relevant sentiment icons.
* Do not reuse icons from AI, Keywords, or Conversations.

====================================================
10. ADMIN SCREEN – CHART BUILDER
================================

Goal:
Allow Admin to create flexible charts.

Sidebar label:

* “Biểu đồ”

Page title can be:

* “Trình tạo biểu đồ”

Requirements:

* Data field panel.
* Drop zones for X-axis, Values, Legend, and Filter.
* Chart preview.
* “Áp dụng” button.
* “Lưu vào Dashboard” button.
* Chart colors follow the main palette.
* Heatmaps, if present, must use ocean-blue tones.

Do not make the layout too cramped.
The chart preview area must be large enough.

====================================================
11. ADMIN SCREEN – SHEET CHATBOT
================================

Goal:
Admin can view and manage FAQ / Sheet Chatbot data.

Table columns:

* Thời gian thêm
* Người thêm
* Câu hỏi
* Câu trả lời
* Chủ đề
* Nguồn bổ sung
* Mức rủi ro
* Trạng thái
* Hành động

Statuses:

* Có thể sử dụng
* Chờ kiểm tra
* Chờ quản lý duyệt
* Đã duyệt
* Cần chỉnh sửa
* Bị từ chối

Admin actions:

* Xem chi tiết
* Duyệt
* Từ chối
* Yêu cầu chỉnh sửa
* Gộp với FAQ có sẵn
* Cập nhật Sheet Chatbot

Do not show “Gửi admin”.

====================================================
12. ADMIN SCREEN – SETTINGS
===========================

The Admin Settings page should only keep necessary items.

Allowed sections:

* Thông tin người dùng
* Nguồn dữ liệu
* Cấu hình kênh
* Ngưỡng cảnh báo
* Người dùng & phân quyền
* Thông báo

Remove:

* Cấu hình AI
* Bảo mật
* Dark mode / light-dark appearance settings

Reason:

* AI configuration is not required in the current demo.
* Security is already handled inside user information.
* Dark mode is removed from the whole system.

Password change flow:

* When clicking “Đổi mật khẩu”, open an email OTP dialog first.
* Flow:

  1. Click “Đổi mật khẩu”
  2. Open dialog “Nhập mã OTP”
  3. Text: “Mã OTP đã được gửi đến email của bạn”
  4. User enters OTP
  5. Click “Xác nhận”
  6. Then open the new password form

Do not allow direct password change before OTP verification.

User & permissions:

* Keep user management inside Settings.
* Do not show it as a separate sidebar item.

====================================================
13. PERSONAL INFORMATION SCREEN
===============================

When clicking “Thông tin cá nhân” from the avatar:

* Navigate to the “Thông tin cá nhân” page.
* Do not open a modal.

This page includes:

* Avatar
* Full name
* Role
* Email
* Assigned channels
* Account status
* Last login
* Basic performance information if the user is Staff
* Access permissions if the user is Admin

Buttons:

* Cập nhật thông tin
* Đổi mật khẩu
* Quay lại

Password change still requires email OTP.

====================================================
14. STAFF SCREEN – CONVERSATIONS
================================

This is the main Staff screen.

Staff sidebar only includes:

* Hội thoại
* FAQ
* Sheet Chatbot
* Hiệu suất
* Hồ sơ

Inside the “Hội thoại” page, include tabs/filters:

* Tất cả
* Chưa xử lý
* AI trả lời sai
* Chờ phản hồi
* Đã xử lý

Staff can:

* View assigned conversations.
* View AI responses.
* Edit AI responses.
* Send corrected answers to customers.
* Mark AI answers as wrong.
* Add data to Sheet Chatbot.
* Mark conversations as resolved.

Do not separate “Cần xử lý” and “AI cần can thiệp” as standalone sidebar menus.

Conversation detail:

* Include an “Can thiệp AI” section.
* Buttons:

  * Sửa câu trả lời
  * Gửi lại cho khách hàng
  * Đánh dấu AI sai
  * Thêm vào Sheet Chatbot
  * Thêm ghi chú
  * Đánh dấu đã xử lý
  * Chuyển quản lý kiểm duyệt nếu cần

Important:

* “Chuyển quản lý kiểm duyệt” is only available in the Staff interface.
* It must not appear in the Admin interface.

====================================================
15. STAFF SCREEN – FAQ
======================

When Staff clicks “Xem chi tiết” in FAQ:

* Open a detail form, not a complicated table.

Form fields:

* Câu hỏi
* Câu trả lời của AI
* Chủ đề
* Trạng thái
* Nguồn hội thoại
* Ghi chú của nhân viên nếu có

Buttons:

* Đóng
* Đề xuất chỉnh sửa
* Thêm vào Sheet Chatbot nếu phù hợp

Staff must not see these Admin-only permissions:

* Duyệt chính thức
* Từ chối chính thức
* Cập nhật Knowledge Base chính thức

====================================================
16. STAFF SCREEN – SHEET CHATBOT
================================

Staff can only view rows they added or rows they are allowed to access.

Table columns:

* Thời gian thêm
* Câu hỏi
* Câu trả lời
* Chủ đề
* Nguồn bổ sung
* Trạng thái
* Ghi chú

Statuses:

* Có thể sử dụng
* Chờ kiểm tra
* Chờ quản lý duyệt
* Đã duyệt
* Cần chỉnh sửa
* Bị từ chối

Staff can:

* Xem chi tiết
* Edit if the status is “Cần chỉnh sửa”
* Add new data to Sheet Chatbot

Staff cannot:

* Officially approve
* Officially reject
* View all rows from all staff unless permission is granted

====================================================
17. STAFF SCREEN – PERFORMANCE
==============================

Goal:
Show personal Staff performance.

Performance cards:

* Hội thoại đã xử lý
* Hội thoại đang chờ
* Thời gian phản hồi trung bình
* Tỷ lệ xử lý đúng hạn
* Số lỗi AI đã ghi nhận
* Số FAQ đã thêm vào Sheet Chatbot

Icon requirements:

* Icons inside cards must have consistent colors.
* Do not use random icon colors.
* Positive / plus / increasing values use green.
* Negative / minus / decreasing values use red.
* Icons must be different if the content meaning is different.

Charts:

* Performance chart by day/week.
* Colors follow the main palette.
* Do not use purple or gray as the main chart color.

====================================================
18. STAFF SCREEN – PROFILE / PERSONAL SETTINGS
==============================================

Staff Profile / Personal Settings should only keep:

* Thông tin cá nhân
* Thông báo
* Kênh phụ trách
* Tùy chọn hiển thị hội thoại

Remove:

* Cấu hình AI
* Cài đặt giao diện
* Bảo mật
* Cài đặt hệ thống
* Dark mode

Staff must not be able to edit:

* AI settings
* System settings
* Security settings
* Data source settings
* Theme / dark mode settings

If Staff tries to access a system-only feature:

* Show “Không có quyền truy cập” screen.
* Text:
  “Bạn không có quyền truy cập chức năng này. Vui lòng liên hệ Quản lý CSKH nếu cần hỗ trợ.”
* Button:
  “Quay lại”

====================================================
19. AVATAR DROPDOWN
===================

Admin dropdown:

* Thông tin cá nhân
* Đổi mật khẩu
* Cài đặt
* Trợ giúp
* Đăng xuất

Important:

* “Người dùng” is inside Settings, not in the sidebar.
* Clicking “Thông tin cá nhân” navigates to the Personal Information page.
* Clicking “Đổi mật khẩu” opens email OTP first.
* No Dark Mode option.

Staff dropdown:

* Thông tin cá nhân
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
* Dark mode

====================================================
20. NOTIFICATIONS
=================

Notifications must match the current actor.

Rules:

* Admin only sees Admin-related notifications.
* Staff only sees Staff-related notifications.
* If a screen or feature has been removed, there must be no notification for that feature.
* Notification checklist items must be clickable.
* Notifications must not link to pages that do not exist in the current actor’s sidebar.

Admin notification examples:

* “Có 12 lỗi AI mới cần xem xét”
* “5 FAQ đang chờ duyệt”
* “3 dữ liệu Sheet Chatbot cần kiểm tra”
* “Có cập nhật người dùng mới trong Cài đặt”

Staff notification examples:

* “Bạn có 4 hội thoại mới được phân công”
* “2 FAQ của bạn cần chỉnh sửa”
* “1 dòng Sheet Chatbot của bạn đã được duyệt”
* “Có hội thoại AI trả lời sai cần bạn kiểm tra”

If Staff sidebar no longer includes “Cần xử lý” and “AI cần can thiệp”:

* Do not create notifications linking to these two removed pages.

====================================================
21. REQUIRED PROTOTYPE INTERACTIONS
===================================

Create prototype interactions for:

* Login Admin → opens Admin dashboard.
* Login Staff → opens Staff workspace.
* Avatar → opens dropdown.
* Thông tin cá nhân → navigates to Personal Information page.
* Đổi mật khẩu → opens email OTP dialog.
* Filter → user clicks “Áp dụng”.
* Notification checklist → items are clickable.
* Admin creates FAQ → opens a form with the question pre-filled and the answer empty.
* Admin approves/rejects Sheet Chatbot data.
* Staff views FAQ detail → opens form with question + AI answer.
* Staff edits AI answer → sends corrected answer to customer.
* Staff adds data to Sheet Chatbot.
* Staff tries to access unauthorized feature → shows “Không có quyền truy cập”.

====================================================
22. FINAL GOAL
==============

After refinement, the prototype must achieve:

* Consistent colors using #003865, #D73C01, #ED5206, #FFFFFF, and sidebar #EBF2FF.
* Admin Overview is cleaner and only has 5 KPI cards.
* No “Gửi admin” action appears in the Admin account.
* Admin creates FAQ using a form where the question is pre-filled and the answer is empty.
* Dark Mode is fully removed.
* Menu names are short and professional.
* Overview shows auto-refresh every 30 minutes.
* AI Insights has a 3-color solid line chart for AI failure trend.
* All heatmaps use ocean-blue tones.
* Keywords analyzes 4 main topic groups.
* Staff sidebar no longer includes “Cần xử lý” and “AI cần can thiệp”.
* Staff Settings do not include AI configuration, appearance, security, or system settings.
* Personal Information opens as a full page, not a modal.
* Notifications are role-based and checklist items are clickable.
* Icons are relevant, consistent, and not incorrectly duplicated.
* Admin and Staff permissions are clearly separated and aligned with the real workflow.
