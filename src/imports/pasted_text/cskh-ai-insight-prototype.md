Hãy rà soát và chỉnh lại prototype hiện tại để bám sát hơn phần “Phân tích Insight khách hàng” của dự án FLIC WebChat CSKH AI Insight.

Lưu ý:
Prototype hiện tại đã có giao diện hiện đại và Chart Builder, nhưng đang hơi lệch sang hướng BI/SaaS quá rộng. Cần chỉnh lại trọng tâm về vận hành CSKH, ưu tiên xử lý hội thoại, kiểm soát lỗi chatbot AI và phân tích insight khách hàng.

1. SỬA LẠI TRỌNG TÂM SẢN PHẨM

Không để prototype giống một công cụ BI tổng quát đơn thuần. 
Hãy thể hiện rõ đây là:

“Dashboard trực quan hóa dữ liệu WebChat CSKH kết hợp AI Insight tại FLIC”

Trọng tâm chính:
- Theo dõi trạng thái xử lý hội thoại.
- Cảnh báo nội dung cần ưu tiên xử lý.
- Kiểm soát chất lượng chatbot AI.
- Phát hiện câu hỏi AI không xử lý được.
- Phân tích keyword/chủ đề khách hàng hỏi nhiều.
- Phân tích cảm xúc và mức độ hài lòng.
- Hỗ trợ dự đoán xu hướng câu hỏi để chuẩn bị nhân lực.
- Chart Builder chỉ là module hỗ trợ phân tích linh hoạt, không phải chức năng trung tâm nhất.

2. SỬA KPI Ở DASHBOARD TỔNG QUAN

Trong màn hình Tổng quan, bắt buộc có các KPI đúng yêu cầu:

- Tổng hội thoại
- Tin nhắn / hội thoại chưa xử lý
- Tin nhắn / hội thoại đã xử lý
- Hội thoại chờ admin xác nhận
- Hội thoại chờ quá 10 giờ
- Tỷ lệ AI trả lời thành công
- Số câu hỏi AI thất bại
- Tỷ lệ hài lòng khách hàng

Các KPI quan trọng nhất cần làm nổi bật:
- Chưa xử lý
- Chờ quá 10 giờ
- AI thất bại
- Chờ admin xác nhận

Không thay thế “đã xử lý” bằng “AI thành công”. Đây là hai chỉ số khác nhau.

3. BỔ SUNG CẢNH BÁO ƯU TIÊN XỬ LÝ

Thêm khu vực “Cần xử lý ngay” ở Dashboard tổng quan.

Nội dung gồm:
- Hội thoại chờ quá 10 giờ
- Câu hỏi AI không chắc chắn
- Câu hỏi AI không tìm thấy dữ liệu
- Chủ đề có lượng hỏi tăng bất thường
- Hội thoại có cảm xúc tiêu cực
- Hội thoại chờ admin xác nhận

Mỗi cảnh báo cần có:
- Mức độ ưu tiên: Cao / Trung bình / Thấp
- Kênh
- Chủ đề
- Thời gian chờ
- Nút “Xem hội thoại”
- Nút “Đánh dấu cần xử lý”
- Nút “Gửi admin kiểm duyệt”

Không dùng nút “Tạo task” vì prototype hiện tại đã bỏ Quản lý Task.

4. BỔ SUNG BẢNG “CÂU HỎI NỔI BẬT” VÀ “CÂU HỎI AI CHƯA XỬ LÝ ĐƯỢC”

Trong Overview hoặc AI Insights, thêm 2 bảng rõ ràng:

Bảng 1: Câu hỏi nổi bật
Cột gồm:
- Câu hỏi
- Chủ đề
- Số lần xuất hiện
- Kênh phổ biến
- Xu hướng tăng/giảm
- Hành động: Xem chi tiết / Thêm vào FAQ đề xuất

Ví dụ câu hỏi:
- “Lịch thi VSTEP tháng này khi nào?”
- “Lệ phí thi TOEIC là bao nhiêu?”
- “Chuẩn đầu ra ngoại ngữ cần chứng chỉ gì?”
- “Có tài liệu ôn tập MOS không?”
- “Bao lâu có kết quả thi?”

Bảng 2: Câu hỏi AI chưa xử lý được
Cột gồm:
- Câu hỏi khách hàng
- Chủ đề
- Kênh
- Lý do thất bại
- Mức độ ảnh hưởng
- Gợi ý bổ sung dữ liệu
- Hành động: Gửi admin kiểm duyệt / Thêm vào FAQ đề xuất

Lý do thất bại gồm:
- Thiếu dữ liệu
- Không hiểu intent
- Thông tin không chắc chắn
- Câu hỏi ngoài phạm vi
- Có nguy cơ hallucination

5. SỬA PHẦN PHÂN TÍCH THEO KÊNH

Tạo hoặc chỉnh rõ màn hình “Phân tích theo kênh”.

Bắt buộc thống kê theo 4 nguồn:
- Zalo Business
- Facebook
- Zalo OA
- Chat Widget

Nội dung cần có:
- Số lượng tin nhắn theo từng kênh
- Số hội thoại chưa xử lý theo kênh
- Thời gian phản hồi trung bình theo kênh
- Tỷ lệ AI thất bại theo kênh
- Cảm xúc tiêu cực theo kênh
- Chủ đề phổ biến theo từng kênh

Thêm biểu đồ:
- Column chart: số hội thoại theo kênh
- Stacked chart: trạng thái xử lý theo kênh
- Heatmap: AI thất bại theo kênh và chủ đề
- Table drill-down theo kênh

6. SỬA SEARCH VÀ FILTER CHO QUẢN LÝ HỘI THOẠI

Trong màn hình “Chi tiết hội thoại” hoặc “Quản lý hội thoại”, search phải thể hiện rõ tìm được theo:

- Nội dung tin nhắn
- Keyword
- Chủ đề
- Tên khách hàng
- Kênh
- Trạng thái xử lý
- Trạng thái AI

Khi search:
- Highlight keyword trong kết quả.
- Hiển thị số kết quả tìm thấy.
- Có filter nhanh theo Ngày / Tuần / Tháng.
- Có filter theo kênh, chủ đề, trạng thái hội thoại, trạng thái AI.

Các trạng thái hội thoại cần dùng:
- Chưa xử lý
- Đang xử lý
- Chờ admin xác nhận
- Hoàn thành

7. BỔ SUNG PHẦN DỰ ĐOÁN XU HƯỚNG VÀ QUÁ TẢI

Trong Dashboard Overview hoặc AI Insights, thêm khu vực:

“Dự đoán xu hướng câu hỏi”

Nội dung:
- Dự báo lượng câu hỏi 7 ngày tới
- Chủ đề có khả năng tăng mạnh
- Kênh có nguy cơ quá tải
- Khung giờ thường tăng tin nhắn
- Gợi ý chuẩn bị nhân lực

Biểu đồ:
- Line chart: xu hướng câu hỏi theo thời gian
- Forecast line: dự đoán 7 ngày tới
- Bar chart: chủ đề tăng mạnh
- Alert card: nguy cơ quá tải

Ví dụ insight:
- “VSTEP có xu hướng tăng 28% trong tuần tới do gần lịch thi.”
- “Chat Widget có nguy cơ quá tải vào 19:00–21:00.”
- “Cần chuẩn bị admin kiểm duyệt thêm cho nhóm câu hỏi TOEIC.”

8. SỬA AI INSIGHTS ĐỂ ĐÚNG TRỌNG TÂM KIỂM SOÁT CHATBOT

AI Insights không chỉ là biểu đồ AI chung chung. 
Hãy thiết kế thành trung tâm kiểm soát chất lượng chatbot.

Nội dung bắt buộc:
- Tỷ lệ AI trả lời thành công
- Số câu hỏi AI thất bại
- Số câu hỏi AI không tìm thấy dữ liệu
- Số câu trả lời cần admin kiểm duyệt
- Cảnh báo hallucination
- Mức độ tin cậy AI
- Gợi ý bổ sung dữ liệu AI

Bảng “AI failed conversations” cần có:
- Câu hỏi khách hàng
- Câu trả lời AI
- Chủ đề
- Lý do lỗi
- Confidence score
- Mức ảnh hưởng
- Gợi ý cập nhật knowledge base
- Hành động: Gửi admin kiểm duyệt / Thêm vào FAQ đề xuất

Không nhấn mạnh AI Chat Assistant quá nhiều. AI Chat chỉ là công cụ phụ để hỏi nhanh insight, không phải chức năng chính thay thế dashboard.

9. SỬA PHẦN PHÂN TÍCH CẢM XÚC

Sentiment Analysis cần gắn trực tiếp với xử lý CSKH.

Bổ sung:
- Tỷ lệ tích cực
- Tỷ lệ trung lập
- Tỷ lệ tiêu cực
- Mức độ hài lòng khách hàng
- Hội thoại có cảm xúc tiêu cực cần xử lý

Danh sách hội thoại tiêu cực gồm:
- Khách hàng
- Nội dung phàn nàn
- Chủ đề
- Kênh
- Mức độ tiêu cực
- Thời gian chờ
- Trạng thái xử lý
- Hành động: Xem hội thoại / Gửi admin kiểm duyệt

Ví dụ nội dung:
- “Em hỏi lịch thi VSTEP mà chatbot trả lời không rõ.”
- “Thông tin lệ phí TOEIC bị khác nhau giữa các lần hỏi.”
- “Không tìm thấy hướng dẫn đăng ký thi MOS.”
- “Chờ phản hồi quá lâu.”

10. SỬA CHART BUILDER ĐỂ KHÔNG LẤN ÁT CHỨC NĂNG CHÍNH

Giữ Chart Builder vì đây là yêu cầu bổ sung về biểu đồ linh hoạt giống Excel Pivot Chart/PowerBI.

Tuy nhiên cần định vị lại:
- Chart Builder là công cụ phụ để admin tự tạo biểu đồ phân tích.
- Không để Chart Builder chiếm toàn bộ trọng tâm của sản phẩm.
- Các template trong Chart Builder phải gắn với nghiệp vụ CSKH FLIC.

Template gợi ý:
- Số hội thoại theo kênh trong 30 ngày
- Hội thoại chưa xử lý theo chủ đề
- AI thất bại theo chủ đề
- Cảm xúc tiêu cực theo kênh
- Xu hướng câu hỏi VSTEP theo tuần
- Top keyword TOEIC trong tháng
- Thời gian phản hồi trung bình theo ngày
- Hội thoại chờ admin xác nhận theo kênh

11. XÓA HOẶC ĐỔI CÁC NÚT KHÔNG PHÙ HỢP

Vì prototype đã bỏ Reports và Task Management, không dùng các nút:
- Export báo cáo
- Tải báo cáo
- Tạo task

Nếu hiện còn nút “Export” trong filter panel, hãy đổi thành:
- “Xem dữ liệu”
hoặc
- “Lưu cấu hình”
hoặc
- “Mở trong Chart Builder”

Nếu cần hành động xử lý, dùng:
- Xem hội thoại
- Đánh dấu cần xử lý
- Gửi admin kiểm duyệt
- Thêm vào FAQ đề xuất
- Bổ sung dữ liệu AI

12. THÊM REAL-TIME DEMO STATE

Vì yêu cầu có gần real-time, hãy thêm trạng thái demo:

- “Đang cập nhật dữ liệu...”
- “Cập nhật gần nhất: 09:45 hôm nay”
- Auto-refresh 30 giây
- Live indicator màu cam/xanh
- Khi bấm Refresh, KPI/chart/table chuyển sang loading skeleton rồi cập nhật lại

Không cần backend thật, chỉ cần thể hiện bằng prototype interaction.

13. GIỮ ĐÚNG DOMAIN FLIC

Chỉ dùng dữ liệu:
- TOEIC
- VSTEP
- Chuẩn đầu ra ngoại ngữ
- Tin học cơ sở
- MOS/IC3
- Lịch thi
- Lệ phí thi
- Đăng ký khóa học
- Tài liệu ôn tập
- Cấp chứng chỉ
- Tra cứu điểm
- Chatbot không tìm thấy dữ liệu
- AI trả lời không chắc chắn
- Hội thoại chờ admin xác nhận

Không dùng:
- Giao hàng
- Đổi trả
- Bảo hành
- Sản phẩm lỗi
- Thanh toán đơn hàng
- Ecommerce

14. MỤC TIÊU SAU KHI SỬA

Sau khi chỉnh, prototype phải cho người xem hiểu ngay rằng hệ thống giúp FLIC:

- Biết hội thoại nào cần xử lý trước
- Giảm thời gian phản hồi khách hàng
- Theo dõi hội thoại chưa xử lý và đã xử lý
- Kiểm soát chất lượng chatbot AI
- Phát hiện câu hỏi AI không trả lời được
- Gợi ý dữ liệu cần bổ sung cho chatbot
- Phân tích khách hàng hỏi gì nhiều nhất
- Đánh giá cảm xúc và mức độ hài lòng
- Dự đoán xu hướng câu hỏi để chuẩn bị nhân lực
- Cho phép admin tự tạo biểu đồ linh hoạt bằng Chart Builder khi cần phân tích sâu hơn