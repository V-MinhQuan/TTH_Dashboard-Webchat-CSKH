Please refine the current FLIC AI Operations Dashboard prototype again. The previous prompt did not fully fix the heatmap colors, Vietnamese UI consistency, and icon consistency. Apply the following corrections across the entire prototype.

Important:

* Keep the prompt in English, but all UI text in the Figma prototype must be in Vietnamese.
* Do not mix English UI labels with Vietnamese labels.
* Apply these corrections globally across both Admin/Quản lý and Nhân viên roles.

====================================================

1. STANDARDIZE ALL UI TEXT INTO VIETNAMESE
   ====================================================

Please review the entire prototype and convert all UI labels, menu items, buttons, tabs, cards, tables, dropdowns, modals, notifications, tooltips, chart titles, and empty states into Vietnamese.

Do not leave mixed English labels such as:

* Dashboard
* Overview
* Channel Analysis
* Conversation Detail
* AI Insights
* Keyword Analysis
* Sentiment Analysis
* Chart Builder
* Settings
* User Management
* Performance
* Profile
* Apply
* Reset
* Refresh
* Export
* View details
* Edit
* Delete
* Save
* Cancel
* No permission
* Notifications
* Personal Information

Use these Vietnamese replacements consistently:

Menu / page names:

* Dashboard / Overview → Tổng quan
* Channel Analysis → Kênh
* Conversation Detail / Conversation Management → Hội thoại
* AI Insights / AI Analysis → Phân tích AI
* Keyword Analysis → Keywords
* Sentiment Analysis → Cảm xúc
* Chart Builder → Biểu đồ
* Settings → Cài đặt
* User Management → Người dùng & phân quyền
* Performance → Hiệu suất
* Profile / Personal Information → Thông tin cá nhân
* FAQ Detail → Chi tiết FAQ
* Sheet Chatbot Updates → Cập nhật Sheet Chatbot

Buttons:

* Apply → Áp dụng
* Reset → Đặt lại
* Refresh → Làm mới
* Save → Lưu
* Cancel → Hủy
* Close → Đóng
* Edit → Chỉnh sửa
* Delete → Xóa
* View details → Xem chi tiết
* Update → Cập nhật
* Confirm → Xác nhận
* Approve → Duyệt
* Reject → Từ chối
* Request edit → Yêu cầu chỉnh sửa
* Add to FAQ → Thêm vào FAQ
* Add to Sheet Chatbot → Thêm vào Sheet Chatbot
* Mark as resolved → Đánh dấu đã xử lý

Status labels:

* Pending → Chờ xử lý
* Processing → Đang xử lý
* Completed → Hoàn thành
* Failed → Thất bại
* Success → Thành công
* Waiting for review → Chờ duyệt
* Need review → Cần kiểm duyệt
* No permission → Không có quyền truy cập
* Active → Đang hoạt động
* Inactive → Tạm khóa

Role labels:

* Admin / Manager → Quản lý
* Staff → Nhân viên

Important:

* Acronyms such as AI, FAQ, TOEIC, VSTEP, MOS, IC3 can remain as acronyms.
* “Sheet Chatbot” can remain as a product/data source name, but all surrounding actions and descriptions must be Vietnamese.
* Make the UI language consistent and professional, suitable for a Vietnamese FLIC internal system.

====================================================
2. FIX ALL HEATMAPS WITH OCEAN-BLUE COLOR TONE
==============================================

The current heatmaps are still not fully aligned with the required color style. Please update every heatmap in all pages to use an ocean-blue tone only.

Apply this rule to all heatmaps in:

* Phân tích AI
* Keywords
* Cảm xúc
* Kênh
* Biểu đồ / Chart Builder if heatmap is selected
* Any other page that contains a heatmap

Heatmap color palette:
Use only blue / ocean-blue shades such as:

* #EBF2FF
* #D6E8FF
* #B9DCFF
* #8EC9FF
* #42A5F5
* #1565C0
* #003BB9
* #003865

Do not use these colors in heatmaps:

* Red
* Orange
* Yellow
* Purple
* Gray as main heatmap color
* Any hot-color heatmap palette

Heatmap design rules:

* Low value cells should use very light blue, for example #EBF2FF.
* Medium value cells should use medium blue, for example #42A5F5 or #1565C0.
* High value cells should use deep navy blue, for example #003BB9 or #003865.
* Text inside cells must remain readable.
* Add a small legend showing value intensity:

  * Thấp
  * Trung bình
  * Cao
* The legend must also use the same ocean-blue gradient.
* Do not use red/orange to represent high values in heatmaps. High values should be dark blue, not hot colors.

Goal:
All heatmaps must look analytical, calm, professional, and consistent with the FLIC dashboard color system.

====================================================
3. AI ANALYSIS PAGE – CARD ICON CONSISTENCY
===========================================

On the “Phân tích AI” page, review all KPI / metric cards.

The card icons must be:

* Consistent in color style
* Different from each other if they represent different metrics
* Relevant to the meaning of each card
* Not randomly colored
* Not duplicated incorrectly

Use one consistent icon color system:

* Main icon color: #003865
* Icon background: #EBF2FF or a very light blue tone
* Warning accent only when needed: #D73C01 or #ED5206, used as a small badge or small indicator, not as a full icon color replacement

Each card must have a different icon:

Suggested mapping:

* AI thất bại → warning bot / bot error icon
* AI thành công → check-circle / verified bot icon
* Cần kiểm duyệt → shield / review / approval icon
* FAQ cần bổ sung → question document / document-plus icon
* Sheet Chatbot updates → spreadsheet / table update icon
* Không tìm thấy dữ liệu → database warning / file search icon
* Có nguy cơ hallucination → alert triangle / brain warning icon

Rules:

* Do not use the same bot icon for every AI card.
* Do not use the same warning icon for different meanings.
* Do not use different random colors for each card icon.
* Use consistent size, stroke width, icon container, and alignment.
* Card design must look unified and professional.

====================================================
4. STAFF PERFORMANCE PAGE – ICON COLOR CONSISTENCY
==================================================

On the Nhân viên role “Hiệu suất” page, update all performance cards.

The icons inside performance cards must be visually consistent:

* Same icon size
* Same stroke style
* Same icon container style
* Same base icon color system

Use:

* Base icon color: #003865
* Icon container background: #EBF2FF or light blue
* Positive / plus / increasing indicators: green
* Negative / minus / decreasing indicators: red

Important distinction:

* The main card icon should be consistent and mostly navy blue.
* The increase/decrease indicator should use green or red.
* Do not randomly color the main icon itself.

Examples:

* “Hội thoại đã xử lý” → main icon navy, positive indicator green if increasing.
* “Tỷ lệ xử lý đúng hạn” → main icon navy, positive indicator green if increasing.
* “Thời gian phản hồi trung bình” → main icon navy, negative indicator red if response time increases.
* “Hội thoại đang chờ” → main icon navy, negative indicator red if waiting count increases.
* “Số lỗi AI đã ghi nhận” → main icon navy, red indicator if increasing.
* “Số FAQ đã thêm vào Sheet Chatbot” → main icon navy, green indicator if increasing.

Rules:

* Plus / increase / better result = green.
* Minus / decrease / worse result = red.
* Do not use random orange, purple, or gray icons.
* Do not reuse the same icon for all performance cards.
* Each performance metric needs a relevant icon:

  * Processed conversations: check chat icon
  * Waiting conversations: clock chat icon
  * Average response time: timer icon
  * On-time rate: target/check icon
  * AI errors recorded: bot warning icon
  * FAQ added: document-plus icon

====================================================
5. FINAL CHECKLIST AFTER REFINEMENT
===================================

After applying the changes, check the prototype again and make sure:

* All UI text is Vietnamese.
* There are no remaining English UI labels except acronyms such as AI, FAQ, TOEIC, VSTEP, MOS, IC3.
* All heatmaps use ocean-blue tones only.
* No heatmap uses red, orange, yellow, purple, or gray as the main color.
* AI Analysis cards use consistent icon colors.
* AI Analysis cards use different icons for different meanings.
* Staff Performance cards use consistent main icon color.
* Positive/plus indicators are green.
* Negative/minus indicators are red.
* No removed function appears again in notifications, sidebar, buttons, or links.
* The overall interface remains clean, professional, and consistent with the FLIC brand.
