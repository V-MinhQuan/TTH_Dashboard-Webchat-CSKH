Please refine the current FLIC AI Operations Dashboard prototype.

Important:
The prompt is written in English, but keep all UI labels, buttons, menus, tables, cards, and demo content in Vietnamese because the final product is for FLIC users in Vietnam.

The current screen has improved, but several parts still need to be fixed:

* KPI cards still look too heavy and inconsistent.
* Some warning cards still use too much orange.
* Number formatting is confusing, for example “44.545” should be shown as “44,545” or “44.545 tin nhắn” consistently as a Vietnamese thousands separator.
* The dashboard should look closer to a real WebChat customer support operation system.
* Role-based access for Manager and Staff must be clearer.
* Staff must be able to intervene when AI gives a wrong answer.
* Staff can add corrected FAQ / wrong AI answers into the existing Chatbot Sheet.
* Manager supervises, approves high-risk chatbot data, manages users, and monitors system-wide AI quality.

====================================================

1. VISUAL STYLE AND KPI CARD CONSISTENCY
   ====================================================

Please redesign the KPI card section to make it cleaner, more consistent, and less visually heavy.

Use the existing brand colors:

* Main blue: #003E9A
* Orange accent: #D73C01
* White: #FFFFFF

Rules:

* Use white background for all KPI cards.
* Use #003E9A for main numbers, titles, icons, and primary data emphasis.
* Use #D73C01 only for warning states, high-priority badges, left border indicators, small alert icons, or critical chips.
* Do not use large full-orange KPI cards unless the alert is extremely critical.
* Keep all KPI cards visually consistent: same corner radius, same shadow, same padding, same icon size, same typography.
* Use a thin orange left border only for warning cards such as “Chưa xử lý”, “Chờ quá 10 giờ”, “AI thất bại”, and “Chờ admin xác nhận”.
* Avoid overusing orange because it makes the dashboard look too aggressive.

Fix number formatting:

* Tổng hội thoại: 2.907
* Tổng tin nhắn: 44.545
* Chưa xử lý: 1.469
* Đã xử lý: 1.438
* Chờ admin xác nhận: 124
* Chờ quá 10 giờ: 84
* Tỷ lệ AI thành công: 86.5%
* Câu hỏi AI thất bại: 215
* Tỷ lệ hài lòng: 88.2%

Make sure the numbers are displayed as operational metrics, not random decorative data.

====================================================
2. MAKE DEMO DATA LOOK REALISTIC FOR FLIC WEBCHAT
=================================================

Use realistic demo data based on the WebChat system:

Overview data:

* Tổng hội thoại: 2.907
* Tổng tin nhắn: 44.545
* Khách hàng/User info: 2.848
* Tin nhắn khách hàng: 22.705
* Tin nhắn từ host/admin/AI: 21.349
* Message read status: 3.431
* Conversation status: 1.469
* Image content: 2.068
* File content: 24

Channel distribution by conversations:

* Zalo Business: 1.321
* Facebook: 1.143
* Zalo OA: 404
* Chat Widget: 38

Channel distribution by messages:

* Zalo Business: 22.931
* Facebook: 16.845
* Zalo OA: 4.085
* Chat Widget: 193

Data period:

* 12/10/2025 to 17/05/2026

Near real-time demo state:

* Show: “Live · Cập nhật gần nhất: 09:38 hôm nay · Tự động cập nhật mỗi 30 giây”
* Add a “Làm mới” button.
* When clicking “Làm mới”, show skeleton loading on KPI cards, charts, and tables, then return to the updated state.

====================================================
3. KEEP THE FLIC DOMAIN ONLY
============================

All sample conversations, topics, FAQ, AI errors, and dashboard insights must use FLIC-related content.

Use topics such as:

* Đăng ký thi CNTT Cơ bản
* Đăng ký thi CNTT Nâng cao
* TOEIC
* VSTEP
* Chuẩn đầu ra ngoại ngữ
* MOS/IC3
* Lịch thi
* Lệ phí thi
* Hồ sơ đăng ký
* Tài liệu ôn tập
* Tra cứu điểm
* Cấp chứng chỉ
* Quên mật khẩu khóa học
* Chatbot không tìm thấy dữ liệu
* AI trả lời không chắc chắn
* AI trả lời sai
* Hội thoại chờ admin xác nhận

Do not use e-commerce content:

* Shipping
* Delivery
* Refund
* Warranty
* Product defect
* Online order payment
* Product return

Sample customer questions:

* “Em muốn đăng ký nhóm trên 3 bạn thì đăng ký thi như thế nào ạ?”
* “Thi xong CNTT Cơ bản thì bao lâu được thi Nâng cao?”
* “Em quên mật khẩu khóa học Tin học Cơ bản thì lấy lại thế nào?”
* “Lịch thi VSTEP tháng này có chưa ạ?”
* “Lệ phí TOEIC hiện tại là bao nhiêu?”
* “Chuẩn đầu ra ngoại ngữ cần chứng chỉ gì?”
* “Bao lâu có kết quả thi?”
* “Hồ sơ đăng ký thi CNTT cần những gì?”

====================================================
4. ROLE-BASED ACCESS: MANAGER VS STAFF
======================================

Create two user roles in the prototype:

A. Manager account:

* Name: Admin FLIC
* Role: Quản lý CSKH

B. Staff account:

* Name: Nhân viên CSKH
* Role: Nhân viên

Add a Login / Role Switch screen so the demo can switch between:

* Admin FLIC — Quản lý CSKH
* Nhân viên CSKH — Staff

When selecting Admin FLIC:

* Show the full management dashboard.
* Show system-wide KPI data.
* Show all channels.
* Show all staff activity.
* Show AI Insights, User Management, Settings, and Chart Builder.

When selecting Nhân viên CSKH:

* Show only staff-level workspace.
* Show assigned conversations or channels handled by that staff member.
* Show personal KPI.
* Hide system-wide User Management.
* Hide system-level Settings.
* Hide full management analytics unless permission is granted.

====================================================
5. MANAGER PERMISSIONS
======================

The Manager can:

* View the full dashboard overview.
* View all channels: Zalo Business, Facebook, Zalo OA, Chat Widget.
* View all conversations from all staff.
* Monitor system-wide KPIs.
* Monitor unprocessed conversations.
* Monitor conversations waiting more than 10 hours.
* Monitor conversations waiting for manager confirmation.
* View AI Insights and AI quality issues.
* View AI errors reported by staff.
* View keyword, topic, sentiment, and trend analysis.
* View overload prediction.
* Open Chart Builder.
* Configure dashboard.
* Configure data sources.
* Configure AI thresholds.
* Manage users and permissions.
* Assign conversations to staff.
* Review high-risk chatbot data.
* Approve or reject FAQ suggestions.
* Approve high-risk data before it is officially used by the chatbot.
* Monitor individual staff performance.

The Manager should intervene when:

* A conversation waits more than 10 hours.
* AI has a serious hallucination risk.
* A staff member sends a case for confirmation.
* A customer has strong negative sentiment.
* The answer involves official information such as exam fees, exam schedules, certificates, or graduation requirements.

====================================================
6. STAFF PERMISSIONS
====================

The Staff can:

* View assigned conversations.
* Search conversations by message content, keyword, topic, channel, or status.
* Open conversation detail.
* View AI responses.
* Reply to customers.
* Intervene when AI gives a wrong answer.
* Edit the AI response before sending it to the customer.
* Send the corrected answer to the customer.
* Mark “AI trả lời sai”.
* Mark “AI không chắc chắn”.
* Mark “Không tìm thấy dữ liệu”.
* Add internal notes about AI errors.
* Add FAQ / corrected answer into the existing Chatbot Sheet.
* Suggest FAQ from a conversation.
* Suggest additional chatbot data.
* Mark the conversation as resolved after intervention.
* View personal KPIs:

  * Số hội thoại đã xử lý
  * Số hội thoại đang chờ
  * Thời gian phản hồi trung bình
  * Tỷ lệ xử lý đúng hạn
  * Số lỗi AI đã ghi nhận
  * Số FAQ đã thêm vào Sheet Chatbot

The Staff cannot:

* View all system-wide data unless granted.
* View all staff data.
* Manage users.
* Change system-level AI configuration.
* Approve official Knowledge Base updates.
* Delete conversation data.
* Configure data sources.
* Change system warning thresholds.

====================================================
7. SIDEBAR BY ROLE
==================

Manager sidebar:

* Tổng quan
* Phân tích theo kênh
* Quản lý hội thoại
* AI Insights
* Phân tích Keywords
* Phân tích cảm xúc
* Trình tạo biểu đồ
* Sheet Chatbot Updates
* Quản lý người dùng
* Cài đặt

Staff sidebar:

* Hội thoại của tôi
* Cần xử lý
* AI cần can thiệp
* FAQ / Sheet Chatbot
* Hiệu suất cá nhân
* Hồ sơ cá nhân

The Staff should not see too many management-level analytics modules.

The “AI cần can thiệp” page should list conversations where AI:

* Is uncertain
* Cannot find data
* Gives a wrong answer
* Has possible hallucination risk
* Receives negative customer feedback
* Needs staff correction before replying

====================================================
8. ACCOUNT DROPDOWN INTERACTIONS
================================

Redesign the account dropdown shown in the top-right avatar area.

For Manager account, show:

* Hồ sơ quản lý
* Đổi mật khẩu
* Cài đặt hệ thống
* Quản lý người dùng & phân quyền
* Trợ giúp
* Đăng xuất

For Staff account, show:

* Hồ sơ cá nhân
* Đổi mật khẩu
* Cài đặt cá nhân
* Trợ giúp
* Đăng xuất

Do not show these items to Staff:

* Cài đặt hệ thống
* Quản lý người dùng & phân quyền
* Cấu hình AI
* Cấu hình nguồn dữ liệu

Dropdown interactions:

* Click “Hồ sơ” → open profile modal.
* Click “Đổi mật khẩu” → open password change modal.
* Click “Cài đặt hệ thống” as Manager → open system settings.
* Click “Cài đặt cá nhân” as Staff → open personal settings.
* Click “Quản lý người dùng & phân quyền” as Manager → open User Management screen.
* Click “Trợ giúp” → open Help Center.
* Click “Đăng xuất” → open confirmation modal, then return to Login.

If Staff tries to access a Manager-only feature:

* Show “Không có quyền truy cập”
* Text: “Bạn không có quyền truy cập chức năng này. Vui lòng liên hệ Quản lý CSKH nếu cần hỗ trợ.”
* Button: “Quay lại Dashboard”

====================================================
9. STAFF AI INTERVENTION FLOW
=============================

In the conversation detail screen, add an “Can thiệp AI” section directly below the AI response.

Show AI status badges:

* AI thành công
* AI không chắc chắn
* AI trả lời sai
* Không tìm thấy dữ liệu
* Cần quản lý xác nhận
* Có nguy cơ hallucination

Add action buttons:

* Sửa câu trả lời
* Gửi lại cho khách hàng
* Đánh dấu AI sai
* Thêm ghi chú lỗi AI
* Thêm vào Sheet Chatbot
* Đề xuất FAQ
* Chuyển quản lý kiểm duyệt
* Đánh dấu đã xử lý

Important:
Staff should not always need to send the case to the Manager.
If the error is simple and the staff is confident, the staff can edit the answer, send it to the customer, add the corrected FAQ into the Chatbot Sheet, and close the conversation.

Use “Chuyển quản lý kiểm duyệt” only when:

* AI has a serious hallucination risk.
* The answer involves official information such as fees, schedules, certificates, or graduation requirements.
* Staff is not confident.
* Customer sentiment is highly negative.
* The FAQ / chatbot data has high risk and needs official approval.

====================================================
10. ADD TO CHATBOT SHEET FLOW
=============================

Staff can add corrected questions and answers into the existing Chatbot Sheet.

Add a button:

* “Thêm vào Sheet Chatbot”

When clicked, open a modal:
“Thêm dữ liệu vào Sheet Chatbot”

Auto-fill:

* Câu hỏi khách hàng from the current conversation.
* Câu trả lời đúng from the staff-edited answer if available.
* Nguồn bổ sung: AI trả lời sai / AI thiếu dữ liệu / AI không chắc chắn / Câu hỏi lặp lại nhiều lần / Nhân viên đề xuất.

Form fields:

* Câu hỏi khách hàng
* Câu trả lời đúng
* Chủ đề
* Nguồn bổ sung
* Mức rủi ro
* Trạng thái
* Ghi chú nội bộ

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

Risk level:

* Thấp
* Trung bình
* Cao

Status logic:

* If risk is low: “Có thể sử dụng”
* If risk is medium: “Chờ kiểm tra”
* If risk is high: “Chờ quản lý duyệt”

After saving:

* Show toast: “Đã thêm dữ liệu vào Sheet Chatbot”
* If risk is high, show toast: “Đã thêm vào Sheet Chatbot và chờ quản lý duyệt”
* The new row appears in “Sheet Chatbot Updates”

====================================================
11. DUPLICATE FAQ CHECK MODAL
=============================

When Staff adds a question into the Chatbot Sheet, simulate duplicate checking.

If similar FAQ exists, open a modal:
“Phát hiện FAQ tương tự”

Show:

* Câu hỏi tương tự
* Chủ đề
* Độ giống nhau
* Trạng thái hiện tại

Actions:

* Thêm mới
* Gộp vào FAQ có sẵn
* Cập nhật câu trả lời cũ

This is important to make the workflow realistic and avoid duplicated chatbot data.

====================================================
12. SHEET CHATBOT UPDATES SCREEN
================================

Add a screen or tab called:
“Sheet Chatbot Updates”

For Staff:

* See only rows they added.
* See status:

  * Có thể sử dụng
  * Chờ kiểm tra
  * Chờ quản lý duyệt
  * Đã duyệt
  * Cần chỉnh sửa
  * Bị từ chối
* Edit again if status is “Cần chỉnh sửa”.

For Manager:

* See all rows added by all staff.
* Filter by staff, topic, status, and risk level.
* Approve data.
* Reject data.
* Request edits.
* Merge with existing FAQ.
* Mark as updated in Knowledge Base.

Table columns:

* Thời gian thêm
* Người thêm
* Câu hỏi
* Câu trả lời đúng
* Chủ đề
* Nguồn bổ sung
* Mức rủi ro
* Trạng thái
* Hành động

====================================================
13. AI INSIGHTS UPDATES
=======================

In AI Insights, add KPIs:

* Số lỗi AI do nhân viên ghi nhận
* Số FAQ nhân viên đã thêm
* Số dữ liệu chờ quản lý duyệt
* Số dữ liệu đã cập nhật vào Sheet Chatbot
* Top chủ đề cần bổ sung dữ liệu

Add table:
“AI sai đã được bổ sung vào Sheet Chatbot”

Columns:

* Câu hỏi khách hàng
* Câu trả lời AI sai
* Câu trả lời đúng đã bổ sung
* Người bổ sung
* Chủ đề
* Trạng thái
* Ngày cập nhật

Manager should also see:
“Lỗi AI do nhân viên ghi nhận”

Columns:

* Thời gian
* Nhân viên ghi nhận
* Kênh
* Chủ đề
* Câu hỏi khách hàng
* Câu trả lời AI
* Lý do đánh dấu sai
* Mức độ ảnh hưởng
* Trạng thái kiểm duyệt
* Hành động

====================================================
14. SAMPLE REALISTIC CONVERSATIONS
==================================

Conversation 1:

* Khách hàng: Sinh viên A
* Kênh: Zalo OA
* Chủ đề: Đăng ký thi CNTT Cơ bản
* Nội dung: “Em muốn đăng ký nhóm trên 3 bạn thì đăng ký thi như thế nào ạ?”
* Trạng thái: Chưa xử lý
* Thời gian chờ: 2 giờ 15 phút
* AI status: Không chắc chắn
* Priority: Cao

Conversation 2:

* Khách hàng: Sinh viên B
* Kênh: Facebook
* Chủ đề: Chuẩn đầu ra ngoại ngữ
* Nội dung: “Chuẩn đầu ra ngoại ngữ cần chứng chỉ gì ạ?”
* Trạng thái: Chờ quản lý xác nhận
* Thời gian chờ: 11 giờ 20 phút
* AI status: Cần kiểm duyệt
* Priority: Cao

Conversation 3:

* Khách hàng: Sinh viên C
* Kênh: Zalo Business
* Chủ đề: Lịch thi VSTEP
* Nội dung: “Lịch thi VSTEP tháng này có chưa ạ?”
* Trạng thái: Đang xử lý
* Thời gian chờ: 45 phút
* AI status: Thành công
* Priority: Trung bình

Conversation 4:

* Khách hàng: Sinh viên D
* Kênh: Chat Widget
* Chủ đề: Quên mật khẩu khóa học
* Nội dung: “Em quên mật khẩu khóa học Tin học Cơ bản thì lấy lại thế nào?”
* Trạng thái: Hoàn thành
* Thời gian chờ: 8 phút
* AI status: Thành công
* Priority: Thấp

====================================================
15. INTERACTION REQUIREMENTS
============================

Create prototype interactions:

Role interactions:

* Select Admin FLIC → open Manager dashboard.
* Select Nhân viên CSKH → open Staff dashboard.
* Click avatar → open role-specific dropdown.
* Click profile → open profile modal.
* Click password → open change password modal.
* Click settings:

  * Manager opens system settings.
  * Staff opens personal settings.
* Click User Management → Manager-only user permission screen.
* Staff clicks restricted feature → show No Permission screen.
* Click logout → confirmation modal → return to Login.

Staff AI intervention interactions:

* Staff opens a conversation where AI is uncertain.
* Click “Sửa câu trả lời”.
* Editor opens with original AI response.
* Staff edits the answer.
* Click “Gửi lại cho khách hàng”.
* Conversation status becomes “Đã xử lý bởi nhân viên”.
* Click “Đánh dấu AI sai”.
* Error reason modal opens.
* Staff selects reason and confirms.
* Error appears in Manager AI Insights.
* Click “Thêm vào Sheet Chatbot”.
* Sheet Chatbot modal opens.
* Staff saves the corrected FAQ.
* If low risk, status becomes “Có thể sử dụng”.
* If high risk, status becomes “Chờ quản lý duyệt”.

Manager review interactions:

* Manager opens AI Insights.
* Manager views “Lỗi AI do nhân viên ghi nhận”.
* Manager opens “Sheet Chatbot Updates”.
* Manager clicks “Duyệt”.
* Manager clicks “Yêu cầu chỉnh sửa”.
* Manager clicks “Gộp với FAQ có sẵn”.
* Toast: “Đã cập nhật trạng thái dữ liệu chatbot”

====================================================
16. FINAL DEMO GOAL
===================

After refinement, the prototype must clearly communicate:

* The dashboard uses realistic WebChat data from FLIC.
* The interface is clean, consistent, and not overloaded with orange.
* Manager monitors the whole system, AI quality, staff performance, chatbot data quality, and user permissions.
* Staff handles real conversations directly.
* Staff can intervene when AI is wrong.
* Staff can edit AI answers and reply to customers.
* Staff can add corrected FAQ / wrong AI answers into the existing Chatbot Sheet.
* High-risk chatbot data still requires Manager approval.
* AI is not replacing customer support staff; AI supports them, while staff and managers control quality.
* The account dropdown is not static; it has real role-based interactions.
* The prototype feels like a real FLIC WebChat CSKH operations dashboard.
