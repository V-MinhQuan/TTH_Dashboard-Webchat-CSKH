# CHƯƠNG 4. XÂY DỰNG, KIỂM THỬ VÀ ĐÁNH GIÁ HỆ THỐNG

Chương này trình bày quá trình hiện thực hệ thống TTH Dashboard WebChat CSKH từ thiết kế đến triển khai. Nội dung tập trung vào kiến trúc xử lý dữ liệu, môi trường phát triển, cách tổ chức các thành phần phần mềm và các cơ chế xử lý nền đang được sử dụng. Bên cạnh đó, chương mô tả cách hệ thống tổ chức dữ liệu phân tích trong SQL Server, khai thác dịch vụ Hugging Face và sử dụng dữ liệu tổng hợp để giảm thời gian phản hồi của Dashboard.

## 4.1. Kiến trúc và luồng hoạt động của hệ thống

### 4.1.1. Luồng hoạt động tổng thể

Hệ thống được xây dựng theo kiến trúc nhiều tầng, gồm giao diện người dùng, dịch vụ Backend và cơ sở dữ liệu. Cách tổ chức này tách biệt phần trình bày, xử lý nghiệp vụ và truy xuất dữ liệu, qua đó hỗ trợ bảo trì, kiểm thử và mở rộng hệ thống.

Ở luồng xử lý trực tiếp, người dùng thao tác trên Dashboard được xây dựng bằng React. Giao diện gửi yêu cầu HTTP đến các API của FastAPI. Tại Backend, Router tiếp nhận và kiểm tra tham số; Service thực hiện nghiệp vụ, tổng hợp và chuẩn hóa kết quả; Repository xây dựng truy vấn và làm việc với Microsoft SQL Server. Kết quả sau đó được trả về giao diện dưới dạng JSON để hiển thị thành KPI, biểu đồ, bảng dữ liệu và danh sách chi tiết. Các điều kiện về thời gian, kênh, chủ đề và trạng thái được truyền xuyên suốt các tầng nhằm bảo đảm dữ liệu tổng hợp và dữ liệu chi tiết tuân theo cùng một bộ lọc.

Dữ liệu tin nhắn gốc được lưu trong bảng `WebChat_MessageLogs`. Bảng này chỉ chứa các thuộc tính của tin nhắn như mã tin nhắn, người gửi, người nhận, thời gian gửi, nội dung, nguồn, chiều gửi và tên hiển thị của phía hệ thống. Các kết quả phát sinh từ quá trình phân tích, chẳng hạn chủ đề chính, danh sách chủ đề, từ khóa, độ tin cậy, nguồn xác định chủ đề, thông tin ngữ cảnh, cảm xúc và trạng thái lỗi AI, được quản lý tại bảng `WebChat_MessageAnalytics`. Việc tách dữ liệu gốc khỏi dữ liệu phân tích giúp hạn chế trùng lặp, làm rõ trách nhiệm của từng bảng và cho phép cập nhật thuật toán mà không làm thay đổi bản ghi tin nhắn ban đầu.

Bên cạnh luồng yêu cầu trực tiếp, Backend có thể vận hành các tác vụ nền bằng `asyncio` trong vòng đời của ứng dụng FastAPI. Hệ thống hiện tại không phụ thuộc Redis hoặc Celery. Worker phân tích cảm xúc lấy các công việc chờ xử lý từ SQL Server, gọi Hugging Face Inference Providers và ghi kết quả trở lại `WebChat_MessageAnalytics`. Một worker khác thực hiện tính trước một số dữ liệu Dashboard, đồng thời tổng hợp câu hỏi nổi bật theo ngày vào bảng `WebChat_AiQuestionGroupCache`. Các tác vụ nền chỉ được khởi chạy khi cấu hình tương ứng được bật và được dừng an toàn cùng tiến trình Backend.

Nhờ cách tổ chức trên, các API có thể ưu tiên đọc dữ liệu đã phân tích hoặc đã tổng hợp thay vì lặp lại toàn bộ phép tính cho mỗi yêu cầu. Đối với bộ lọc đặc thù chưa có dữ liệu tổng hợp phù hợp, Backend vẫn có thể truy vấn dữ liệu nguồn để bảo đảm tính đúng đắn của kết quả.

## 4.2. Môi trường phát triển và triển khai hệ thống

### 4.2.1. Kiến trúc triển khai

Hệ thống gồm ba thành phần vận hành chính:

- Frontend được xây dựng bằng React, TypeScript và Vite, chịu trách nhiệm hiển thị Dashboard và tiếp nhận tương tác của người dùng.
- Backend được phát triển bằng Python 3.11 và FastAPI, cung cấp API, xác thực người dùng, xử lý nghiệp vụ, chạy các tác vụ nền và kết nối các dịch vụ bên ngoài.
- Microsoft SQL Server lưu dữ liệu nghiệp vụ, dữ liệu phân tích và dữ liệu tổng hợp phục vụ Dashboard.

Trong môi trường phát triển, Frontend và Backend có thể chạy trong các container riêng bằng Docker Compose. Backend sử dụng Uvicorn và được cấu hình mặc định tại cổng 5000; Frontend sử dụng Vite development server tại cổng 5173. SQL Server được kết nối qua `pyodbc` hoặc `pymssql`, với thông tin kết nối được quản lý bằng biến môi trường.

Hệ thống không triển khai một Machine Learning Service nội bộ độc lập. Chức năng phân tích cảm xúc được Backend gọi trực tiếp đến Hugging Face Inference Providers thông qua HTTP client bất đồng bộ. Khóa truy cập, tên mô hình, nhà cung cấp, thời gian chờ, số lần thử lại và giới hạn đồng thời được cấu hình ở phía Backend, không đưa vào mã nguồn hoặc biến môi trường của Frontend.

Khi triển khai bản phát hành, mã nguồn Frontend trong `src/` phải được đóng gói bằng lệnh `npm run build`; toàn bộ thư mục `dist/` được đưa lên Web Server. Các file Python thay đổi trong `backend/` được cập nhật đúng cấu trúc thư mục và dịch vụ Backend phải được khởi động lại. Không chỉnh sửa thủ công các file bundle trong `dist/`.

### 4.2.2. Môi trường phát triển giao diện

Giao diện được xây dựng bằng React 18 kết hợp TypeScript. Vite được sử dụng làm công cụ phát triển và đóng gói ứng dụng. TypeScript hỗ trợ kiểm tra kiểu dữ liệu giữa component, context và lớp gọi API, góp phần giảm lỗi khi cấu trúc dữ liệu thay đổi.

TanStack React Query được sử dụng tại các màn hình cần quản lý trạng thái truy vấn, bộ nhớ đệm và làm mới dữ liệu từ API. Trạng thái bộ lọc dùng chung được quản lý ở tầng giao diện để các KPI, biểu đồ, bảng và dữ liệu xuất sử dụng cùng điều kiện truy vấn.

Recharts được dùng để xây dựng biểu đồ. Tailwind CSS, Radix UI và Lucide React hỗ trợ xây dựng bố cục, thành phần giao diện và biểu tượng. Các màn hình được tổ chức thành component dùng chung, component biểu đồ và component theo từng chức năng như Tổng quan, Kênh, Hiệu suất AI, Từ khóa nổi bật, Phân tích cảm xúc và Biểu đồ tùy chỉnh.

Chức năng xuất dữ liệu sử dụng ExcelJS cho tệp XLSX và pdfmake cho báo cáo PDF có cấu trúc gồm tiêu đề, thông tin bộ lọc và bảng dữ liệu. Hệ thống cũng sử dụng jsPDF và html2canvas cho các trường hợp xuất nội dung trực quan hoặc ảnh chụp biểu đồ. Dữ liệu đưa vào bảng tính được xử lý để hạn chế nguy cơ thực thi công thức ngoài ý muốn.

### 4.2.3. Môi trường phát triển Backend

Backend được phát triển bằng Python 3.11 và FastAPI theo hướng RESTful. Pydantic được sử dụng để khai báo schema, kiểm tra dữ liệu đầu vào và chuẩn hóa dữ liệu đầu ra. Uvicorn vận hành ứng dụng ASGI và tiếp nhận các yêu cầu từ Frontend.

Mã nguồn Backend được phân chia theo Router, Service và Repository. Router định nghĩa endpoint và kiểm soát dữ liệu giao tiếp; Service thực hiện nghiệp vụ; Repository tập trung câu lệnh truy vấn SQL Server. Các truy vấn đồng bộ qua trình điều khiển cơ sở dữ liệu được đưa sang thread bằng `asyncio.to_thread` hoặc executor khi được gọi từ luồng bất đồng bộ, tránh chặn vòng lặp sự kiện của FastAPI.

Worker phân tích cảm xúc được tích hợp vào vòng đời FastAPI. Worker phát hiện bản ghi đủ điều kiện, chuyển trạng thái công việc trong một giao dịch ngắn, gọi Hugging Face ngoài giao dịch và sau đó ghi trạng thái hoàn thành, chờ thử lại hoặc thất bại. Cơ chế giới hạn lô, giới hạn đồng thời, số lần thử lại và phục hồi công việc bị treo được cấu hình bằng biến môi trường. Khi token Hugging Face chưa được cấu hình, Backend vẫn có thể khởi động nhưng trạng thái sẵn sàng sẽ phản ánh chế độ suy giảm và worker không gửi dữ liệu mới đến nhà cung cấp.

Hệ thống vẫn duy trì một số endpoint và service tương thích với phiên bản trước để tránh gián đoạn các chức năng đang hoạt động. Tuy nhiên, toàn bộ Backend đang vận hành trên FastAPI; mã nguồn Node.js cũ được lưu trong thư mục `archive` và không thuộc runtime hiện tại.

### 4.2.4. Môi trường kiểm thử

Backend sử dụng Pytest cho kiểm thử đơn vị và kiểm thử tích hợp. Các nhóm kiểm thử bao phủ repository, service, router, xác thực, xử lý cảm xúc, phân loại lỗi AI, bộ lọc dữ liệu, truy vấn biểu đồ và trạng thái sức khỏe của hệ thống. Các bài kiểm thử đối với Hugging Face sử dụng mock hoặc dữ liệu kiểm thử, không phụ thuộc token thật và không gọi dịch vụ bên ngoài trong quá trình chạy kiểm thử tự động.

Frontend sử dụng Vitest kết hợp Testing Library để kiểm thử component, tiện ích xử lý ngày, API client, bộ lọc và các trạng thái giao diện. Playwright được sử dụng cho kiểm thử End-to-End, mô phỏng thao tác của người dùng trên Dashboard và kiểm tra các luồng như đăng nhập, lọc dữ liệu, hiển thị biểu đồ, xuất dữ liệu và xây dựng biểu đồ tùy chỉnh.

Ngoài kiểm thử tự động, hệ thống còn sử dụng endpoint liveness và readiness để kiểm tra tiến trình Backend, kết nối cơ sở dữ liệu, cấu hình Hugging Face và trạng thái worker. Sau các thay đổi liên quan đến cơ sở dữ liệu, cần kết hợp kiểm tra schema, chạy test hồi quy, build Frontend và gọi thử các API chính trước khi triển khai.

## 4.3. Xây dựng module truy xuất và xử lý dữ liệu

### 4.3.1. Chuẩn hóa danh mục chủ đề

Hệ thống định nghĩa tập chủ đề dùng chung tại Backend để các chức năng phân loại, lọc và hiển thị sử dụng cùng một quy ước. Sáu nhóm chủ đề hiện tại gồm:

- TOEIC;
- MOS;
- Sát hạch CNTT;
- Học Tiếng Anh;
- Học Tin học;
- Khác.

Mỗi chủ đề có mã định danh chuẩn, tên hiển thị, màu sắc và tập thuật ngữ liên quan. Các tên gọi tương đương được ánh xạ về cùng một mã chủ đề trước khi trả dữ liệu cho giao diện. Nhóm `Khác` được sử dụng khi nội dung không đủ điều kiện ánh xạ vào năm nhóm nghiệp vụ chính. Việc chuẩn hóa này giúp kết quả giữa KPI, biểu đồ, bảng chi tiết và bộ lọc nhất quán.

### 4.3.2. Tiền xử lý và phân tích từ khóa

Văn bản và tham số tìm kiếm được chuẩn hóa Unicode, loại bỏ khác biệt về dấu tiếng Việt khi cần đối sánh, chuyển về chữ thường, loại bỏ khoảng trắng dư và chuẩn hóa cách biểu diễn từ khóa. Việc chuẩn hóa giúp hệ thống nhận diện các biến thể cách viết nhưng vẫn giữ nội dung gốc trong bảng tin nhắn.

Danh mục từ khóa CRM được tổ chức theo nhóm chủ đề và trạng thái hoạt động. Khi thống kê, Repository thực hiện truy vấn theo lô để tính số lần xuất hiện của nhiều từ khóa, thay vì tạo một truy vấn riêng cho từng từ. Các điều kiện thời gian, kênh, trạng thái hội thoại và trạng thái AI được đưa vào truy vấn để kết quả tuân theo bộ lọc hiện hành. Kết quả thống kê từ khóa có thể được lưu tạm trong bộ nhớ của tiến trình với thời gian sống ngắn; đây là cache trong RAM, không phải Redis.

Trong luồng phân tích tin nhắn, hệ thống trích xuất các từ khóa thuộc taxonomy và lưu danh sách kết quả trong trường `detectedKeywords` của `WebChat_MessageAnalytics`. Bảng `WebChat_MessageLogs` chỉ giữ nội dung tin nhắn ban đầu và không lưu các trường kết quả phân loại.

### 4.3.3. Xác định chủ đề và ngữ cảnh hội thoại

Chủ đề được xác định từ nội dung tin nhắn của khách hàng và, khi có, nội dung phản hồi liên quan. Kết quả được chuẩn hóa theo taxonomy chung trước khi lưu vào `WebChat_MessageAnalytics`. Các trường chính gồm `primaryTopicId`, `detectedTopics`, `topicConfidence`, `topicSource`, `contextMessageId`, `contextDistance`, `classifierVersion` và `keywordAnalyzedAt`.

`primaryTopicId` biểu diễn chủ đề chính; `detectedTopics` và `detectedKeywords` lưu các nhãn được phát hiện; `topicConfidence` phản ánh độ tin cậy; `topicSource` cho biết kết quả đến từ nội dung trực tiếp hay ngữ cảnh; `contextMessageId` và `contextDistance` mô tả bản ghi ngữ cảnh được sử dụng; `classifierVersion` và `keywordAnalyzedAt` phục vụ truy vết phiên bản và thời điểm phân tích.

Hệ thống chỉ sử dụng dữ liệu ngữ cảnh khi quá trình phân loại thực tế cung cấp các thông tin tương ứng. Không nên mô tả cố định số lượng tin nhắn hoặc khoảng thời gian kế thừa nếu các giới hạn đó chưa được ràng buộc trong cấu hình và mã nguồn đang vận hành. Khi không xác định được chủ đề nghiệp vụ, dữ liệu hiển thị được chuẩn hóa về nhóm `Khác`; các giá trị rỗng hoặc chưa phân tích vẫn được giữ đúng trạng thái trong cơ sở dữ liệu để tránh tạo kết quả giả.

### 4.3.4. Xử lý dữ liệu nền và tính toán trước

Hệ thống sử dụng hai cơ chế xử lý nền chính. Thứ nhất, worker phân tích cảm xúc và chất lượng phản hồi lấy công việc từ trạng thái được lưu trong SQL Server, xử lý theo lô và gọi Hugging Face Inference Providers. Kết quả cảm xúc của khách hàng và kết quả đánh giá phản hồi AI được xem là hai nhóm chỉ số độc lập. Trường hợp không có phản hồi AI để đánh giá được lưu bằng giá trị chưa xác định thay vì mặc định thành công hoặc thất bại.

Thứ hai, `DashboardPrecomputeWorker` tính trước một số dữ liệu mặc định của Dashboard theo chu kỳ. Worker làm nóng dữ liệu KPI, câu hỏi nổi bật và cảnh báo ưu tiên cho khoảng thời gian mặc định. Mỗi ngày, tác vụ tổng hợp câu hỏi của ngày trước đó theo bốn kênh đang sử dụng gồm Chat Widget, Facebook, Zalo OA và Zalo Business, sau đó ghi kết quả vào `WebChat_AiQuestionGroupCache`.

Bảng AI cache được sử dụng thay cho Redis để lưu dữ liệu tổng hợp câu hỏi nổi bật có tính bền vững. Khi người dùng mở danh sách chi tiết, Backend truy xuất các bản ghi phù hợp với nhóm câu hỏi, áp dụng lại bộ lọc và phân trang ở phía máy chủ. Cơ chế này vừa hạn chế truy vấn nặng, vừa bảo đảm số lượng tổng hợp có thể đối chiếu với dữ liệu chi tiết.

Các script như `populate_daily_rollups.py`, `sync_top_questions.py` hoặc các script di trú chỉ phục vụ khởi tạo, đồng bộ lại dữ liệu lịch sử hoặc xử lý bảo trì có chủ đích. Chúng không phải thành phần bắt buộc phải chạy mỗi lần triển khai mã nguồn. Trong vận hành thông thường, worker và API sử dụng dữ liệu hiện có trong SQL Server; script chỉ được chạy khi có yêu cầu tái tạo cache, cập nhật dữ liệu cũ hoặc triển khai thay đổi schema tương ứng.

Nhờ việc tách dữ liệu gốc, dữ liệu phân tích và dữ liệu tổng hợp, Dashboard giảm được khối lượng tính toán lặp lại nhưng vẫn duy trì khả năng truy xuất dữ liệu nguồn khi cần. Cấu trúc này cũng hỗ trợ kiểm tra nguồn gốc kết quả, nâng cấp thuật toán và đồng bộ dữ liệu mà không làm thay đổi nội dung tin nhắn ban đầu.
