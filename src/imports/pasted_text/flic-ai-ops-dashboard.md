Thiết kế lại từ đầu một HIGH-FIDELITY INTERACTIVE PROTOTYPE cho hệ thống:

“FLIC AI Operations Dashboard”

Mục tiêu:
Xây dựng một AI-powered Customer Support Analytics Dashboard dành cho hệ thống giáo dục FLIC.
Prototype phải có cảm giác như sản phẩm SaaS thật, hiện đại, tương tác mạnh, giống Tableau + PowerBI + Gemini AI UI.

QUAN TRỌNG:
- KHÔNG tạo ảnh tĩnh.
- Tất cả phải interactive prototype.
- Toàn bộ menu, popup, filter, chart, table, AI chat đều click được.
- Giao diện phải cực kỳ hiện đại, spacing thoáng, clean UI.
- Không dùng layout chật chội.
- Thiết kế theo chuẩn enterprise analytics dashboard.

====================================================
BRAND GUIDELINE
====================================================

Màu chính:
- Navy: #003865
- Orange: #D73C01
- Orange Accent: #ED5206
- White: #FFFFFF

Chỉ sử dụng:
- 3 màu trên
- và các sắc độ nhạt của chúng.

Quy tắc:
- #003865:
  Sidebar
  Header
  Navigation
  Analytics
  Text title

- #D73C01:
  Active state
  AI
  KPI nổi bật
  Badge
  Alert
  CTA button

- #FFFFFF:
  Background
  Card
  Modal
  Table

Style:
- Rounded 20px
- Soft shadow
- Minimal
- AI-centric
- Professional SaaS
- Modern enterprise dashboard
- Responsive desktop 1440px

====================================================
LAYOUT
====================================================

Layout gồm:

1. LEFT SIDEBAR
Fixed width 280px

Menu:
- Tổng quan
- Phân tích theo kênh
- Phân tích câu hỏi
- Phân tích Keywords
- Hiệu suất xử lý
- Chi tiết hội thoại
- Phân tích cảm xúc
- AI Insights
- Trình tạo biểu đồ
- Cài đặt

Sidebar:
- Hover state
- Active state màu cam
- Icon outline hiện đại
- Có collapse sidebar
- Footer sidebar:
  Version
  Logo
  Copyright

2. TOP HEADER
Height 72px

Bao gồm:
- Breadcrumb
- Tên màn hình
- Search global
- Notification bell
- Dark mode toggle
- Avatar account

Avatar dropdown:
- Hồ sơ
- Đổi mật khẩu
- Cài đặt
- Trợ giúp
- Đăng xuất

====================================================
FILTER PANEL
====================================================

Mỗi màn hình đều có filter panel riêng.

Filter style giống:
- Tableau
- PowerBI
- Metabase

Filter gồm:
- Khoảng thời gian
- Kênh
- Chủ đề
- Trạng thái hội thoại
- Trạng thái AI

Buttons:
- Áp dụng
- Reset
- Refresh
- Export

Khi filter thay đổi:
- KPI
- Chart
- Table
- AI suggestion
- Alert
đều cập nhật đồng bộ.

====================================================
AI CHAT ASSISTANT
====================================================

KHÔNG dùng AI popup đơn giản.

Tạo AI CHAT thật dạng floating widget giống Gemini.

Vị trí:
- Góc dưới bên phải

Style:
- Gradient navy + orange
- Glow effect
- Modern AI assistant

Khi click:
Mở AI chat window.

AI chat gồm:
- Header
- AI avatar
- Chat history
- Typing animation
- Input box
- Send button
- Timestamp

AI có thể trả lời:
- KPI summary
- FAQ analysis
- Keyword trends
- AI hallucination
- Sentiment analysis
- Prediction
- Recommendation
- Conversation anomalies

====================================================
DASHBOARD OVERVIEW
====================================================

Màn hình Overview gồm:

1. KPI CARDS
- Tổng hội thoại
- Hội thoại chưa xử lý
- AI thành công
- AI thất bại
- Hội thoại chờ admin
- Tỷ lệ hài lòng

KPI card:
- hover animation
- trend indicator
- icon
- shadow
- active color

2. ALERT SECTION
Hiển thị:
- AI thất bại tăng mạnh
- Hội thoại quá hạn
- AI không chắc chắn
- Chủ đề tăng bất thường

3. PRIORITY CONVERSATIONS TABLE
Columns:
- Khách hàng
- Kênh
- Chủ đề
- Thời gian chờ
- Trạng thái
- Priority
- Action

Buttons:
- Xem
- Đánh dấu ưu tiên

4. CUSTOM DASHBOARD AREA
Các chart card:
- Line chart
- Bar chart
- Donut chart
- Heatmap
- Stacked chart

====================================================
CHART CARD INTERACTION
====================================================

Mỗi chart card PHẢI có toolbar gồm:

- Filter icon
- Table icon
- Change chart icon
- Edit chart icon
- Button “Mở trong Chart Builder”

Tất cả icon PHẢI hoạt động.

----------------------------------------------------
1. FILTER ICON
----------------------------------------------------

Khi click:
Mở side panel “Bộ lọc biểu đồ”.

Có:
- Khoảng thời gian
- Kênh
- Chủ đề
- Trạng thái hội thoại
- Trạng thái AI

Buttons:
- Áp dụng
- Reset

Khi Apply:
- Đóng panel
- Toast:
  “Đã áp dụng bộ lọc”
- Chart đổi sang data khác
- Icon filter active màu cam

----------------------------------------------------
2. TABLE ICON
----------------------------------------------------

Khi click:
Mở modal:
“Dữ liệu nguồn của biểu đồ”

Hiển thị table gồm:
- Ngày
- Kênh
- Chủ đề
- Số hội thoại
- AI thành công
- AI thất bại
- Sentiment
- Trạng thái

Data demo:
- TOEIC
- VSTEP
- Chuẩn đầu ra
- MOS/IC3
- Tin học cơ sở
- Lệ phí
- Lịch thi
- Tra cứu điểm

Buttons:
- Đóng
- Mở trong Chart Builder

----------------------------------------------------
3. CHANGE CHART ICON
----------------------------------------------------

Khi click:
Mở popover:
“Chọn loại biểu đồ”

Options:
- Bar
- Column
- Line
- Area
- Donut
- Pie
- Heatmap
- Treemap
- Pivot table
- KPI card

Khi chọn:
- Preview chart đổi realtime
- Toast:
  “Đã đổi loại biểu đồ”

----------------------------------------------------
4. EDIT CHART ICON
----------------------------------------------------

Khi click:
Mở side panel:
“Cài đặt biểu đồ”

Fields:
- Tên biểu đồ
- Trục X
- Values
- Legend
- Sorting
- Data labels
- Tooltip
- Legend toggle

Button:
- Lưu thay đổi

Khi save:
- Toast:
  “Đã lưu cấu hình biểu đồ”
- Chart title thêm tag:
  “Đã chỉnh sửa”

----------------------------------------------------
5. OPEN IN CHART BUILDER
----------------------------------------------------

Khi click:
Đi tới màn hình:
“Trình tạo biểu đồ”

====================================================
CHART BUILDER SCREEN
====================================================

Thiết kế giống:
- PowerBI
- Tableau
- Excel Pivot Chart

Layout 3 vùng:

1. LEFT FIELD PANEL
Accordion:
- Thời gian
- Hội thoại
- Kênh
- Chủ đề
- AI
- Sentiment

Field dạng draggable pill.

2. CENTER WORKSPACE
Khu preview chart lớn.

Empty state:
- Xu hướng hội thoại
- AI thất bại theo chủ đề
- Keyword theo kênh

Có template suggestion cards.

3. RIGHT CONFIG PANEL
- Chọn chart type
- Legend
- Tooltip
- Data label
- Sort
- Theme

Dropzone:
- Trục X
- Values
- Legend
- Filter

Buttons:
- Lưu vào Dashboard
- Quay lại Dashboard
- Reset

====================================================
KEYWORD ANALYSIS
====================================================

Groups:
- TOEIC
- VSTEP
- Chuẩn đầu ra
- Tin học
- MOS/IC3

Mỗi group:
- Top 10 keywords
- Trend indicator
- Horizontal bar chart
- Keyword heatmap

AI section:
- FAQ suggestion
- Trend analysis
- AI recommendation

====================================================
SENTIMENT ANALYSIS
====================================================

KPI:
- Tích cực
- Trung lập
- Tiêu cực

Charts:
- Donut
- Heatmap
- Line trend
- Stacked sentiment

Hiển thị:
- Sentiment score
- Keywords ảnh hưởng
- AI prediction
- AI recommendation

====================================================
CONVERSATION DETAIL
====================================================

Layout 2 cột:

LEFT:
- Danh sách hội thoại
- Search
- Filter
- Status

RIGHT:
- Chat timeline
- Bot reply
- Admin reply
- AI warning
- Internal note

Buttons:
- Đánh dấu AI sai
- Chuyển admin
- Tạo FAQ

====================================================
AI INSIGHTS
====================================================

Trung tâm QA cho chatbot AI.

Bao gồm:
- AI success rate
- AI hallucination
- FAQ missing
- Unanswered topics
- AI confidence

Charts:
- Failure trend
- Failure reason donut
- Topic analysis

Table:
- AI failed conversations
- Suggested FAQ
- Recommended knowledge base update

====================================================
INTERACTION STATES
====================================================

Prototype PHẢI có:
- Hover
- Active
- Loading
- Empty
- Error
- No permission
- Success toast
- Smooth transition
- Skeleton loading

====================================================
TOOLTIP
====================================================

Tooltip cho mọi icon:

- Filter:
  “Lọc dữ liệu”

- Table:
  “Xem dữ liệu”

- Chart:
  “Đổi loại biểu đồ”

- Edit:
  “Chỉnh sửa biểu đồ”

- Open:
  “Mở trong Chart Builder”

====================================================
DEMO DATA DOMAIN
====================================================

Chỉ dùng dữ liệu thuộc FLIC domain:

- TOEIC
- VSTEP
- Chuẩn đầu ra
- Tin học cơ sở
- MOS/IC3
- Lịch thi
- Lệ phí thi
- Đăng ký khóa học
- Tra cứu điểm
- Tài liệu ôn tập
- Cấp chứng chỉ
- AI trả lời không chắc chắn
- Chatbot không tìm thấy dữ liệu
- Hội thoại chờ admin xác nhận

KHÔNG dùng:
- Ecommerce
- Shipping
- Product
- Delivery
- Refund
- Warranty

====================================================
MỤC TIÊU
====================================================

Prototype cuối cùng phải tạo cảm giác:
- SaaS analytics thật
- AI-powered BI dashboard
- Tableau + PowerBI + Gemini UI
- Interactive prototype hoàn chỉnh
- Có chiều sâu UX/UI
- Chuyên nghiệp để demo khách hàng