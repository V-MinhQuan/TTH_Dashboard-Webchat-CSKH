Hãy chỉnh lại prototype “FLIC AI Operations Dashboard” để dữ liệu demo gần giống tình huống thật hơn, đồng bộ giao diện hơn và bổ sung phân quyền rõ ràng giữa Quản lý CSKH và Nhân viên CSKH.

Đây vẫn là demo Figma, chưa cần backend thật, nhưng dữ liệu mẫu, hành vi người dùng và luồng xử lý phải bám sát hệ thống WebChat CSKH thực tế của FLIC.

====================================================
1. ĐỒNG BỘ MÀU SẮC KPI VÀ CARD
====================================================

Hiện tại các KPI card đang dùng quá nhiều card nền cam, gây nặng giao diện và thiếu đồng bộ.

Hãy chỉnh lại theo nguyên tắc:

- Chọn Xanh #003E9A làm màu chủ đạo chính.
- Cam #D73C01 chỉ dùng làm màu nhấn cho cảnh báo, trạng thái nguy cấp, badge ưu tiên cao.
- Trắng #FFFFFF làm nền chính.

Yêu cầu cụ thể:
- Tất cả KPI card dùng nền trắng.
- Số liệu chính dùng màu xanh #003E9A.
- Icon KPI dùng xanh #003E9A hoặc nằm trong nền xanh nhạt.
- Không dùng nhiều card full nền cam như hiện tại.
- Các chỉ số cảnh báo như “Chưa xử lý”, “Chờ quá 10 giờ”, “AI thất bại” chỉ dùng cam ở:
  - badge cảnh báo,
  - icon cảnh báo,
  - viền trái của card,
  - hoặc chip trạng thái.
- Không tô toàn bộ card màu cam trừ trường hợp cần cảnh báo cực kỳ nghiêm trọng.
- Các card phải thống nhất style: nền trắng, bo góc, shadow nhẹ, spacing đều.

Thiết kế lại KPI section để nhìn chuyên nghiệp hơn:
- Tổng hội thoại
- Tổng tin nhắn
- Chưa xử lý
- Đã xử lý
- Chờ admin xác nhận
- Chờ quá 10 giờ
- Tỷ lệ AI thành công
- Câu hỏi AI thất bại
- Tỷ lệ hài lòng

====================================================
2. DÙNG DỮ LIỆU DEMO GẦN VỚI SCRIPT WEBCHAT THẬT
====================================================

Hãy thay số liệu demo hiện tại bằng dữ liệu mẫu gần với script SQL WebChat.

Dữ liệu tổng quan:
- Tổng hội thoại: 2.907
- Tổng tin nhắn: 44.545
- Khách hàng/user info: 2.848
- Tin nhắn khách hàng: 22.705
- Tin nhắn từ host/admin/AI: 21.349
- Message read status: 3.431
- Conversation status: 1.469
- Image content: 2.068
- File content: 24

Phân bổ hội thoại theo kênh:
- Zalo Business: 1.321
- Facebook: 1.143
- Zalo OA: 404
- Chat Widget: 38

Phân bổ tin nhắn theo kênh:
- Zalo Business: 22.931
- Facebook: 16.845
- Zalo OA: 4.085
- Chat Widget: 193

Khoảng thời gian dữ liệu:
- Từ 12/10/2025 đến 17/05/2026

Hiển thị trạng thái gần real-time:
- “Live · Cập nhật gần nhất: 16:11 hôm nay · Tự động cập nhật mỗi 30 giây”
- Có nút “Làm mới”
- Khi click “Làm mới”, KPI/chart/table hiển thị loading skeleton rồi cập nhật lại.

====================================================
3. CHỈNH NỘI DUNG DEMO ĐÚNG DOMAIN FLIC
====================================================

Dữ liệu nội dung hội thoại phải xoay quanh các chủ đề thật của FLIC:

- Đăng ký thi CNTT Cơ bản
- Đăng ký thi CNTT Nâng cao
- TOEIC
- VSTEP
- Chuẩn đầu ra ngoại ngữ
- MOS/IC3
- Lịch thi
- Lệ phí thi
- Hồ sơ đăng ký
- Tài liệu ôn tập
- Tra cứu điểm
- Cấp chứng chỉ
- Quên mật khẩu khóa học
- Chatbot không tìm thấy dữ liệu
- AI trả lời không chắc chắn
- AI trả lời sai
- Hội thoại chờ admin xác nhận

Không dùng dữ liệu ecommerce:
- Giao hàng
- Đổi trả
- Bảo hành
- Sản phẩm lỗi
- Thanh toán đơn hàng

Ví dụ câu hỏi khách hàng:
- “Em muốn đăng ký nhóm trên 3 bạn thì đăng ký thi như thế nào ạ?”
- “Thi xong CNTT Cơ bản thì bao lâu được thi Nâng cao?”
- “Em quên mật khẩu khóa học Tin học Cơ bản thì lấy lại thế nào?”
- “Lịch thi VSTEP tháng này có chưa ạ?”
- “Lệ phí TOEIC hiện tại là bao nhiêu?”
- “Chuẩn đầu ra ngoại ngữ cần chứng chỉ gì?”
- “Bao lâu có kết quả thi?”
- “Hồ sơ đăng ký thi CNTT cần những gì?”

====================================================
4. NGUYÊN TẮC PHÂN QUYỀN CHÍNH
====================================================

Thiết kế prototype có 2 vai trò chính:

1. Quản lý CSKH / Manager
2. Nhân viên CSKH / Staff

Nguyên tắc quan trọng:
Nhân viên CSKH vẫn có quyền can thiệp trực tiếp khi AI trả lời sai, AI không chắc chắn hoặc khách hàng cần hỗ trợ thêm.

Không thiết kế theo hướng chỉ Quản lý mới được can thiệp AI.

Trong thực tế vận hành:
- Nhân viên là tuyến xử lý trực tiếp từng hội thoại.
- Nhân viên có quyền sửa câu trả lời khi AI sai.
- Nhân viên có quyền trả lời lại khách hàng.
- Nhân viên có quyền đánh dấu AI sai.
- Nhân viên có quyền gửi quản lý kiểm duyệt nếu lỗi nghiêm trọng.
- Quản lý là tuyến giám sát, kiểm duyệt, phân quyền, duyệt FAQ/Knowledge Base và xử lý các trường hợp nghiêm trọng.

====================================================
5. QUYỀN CỦA QUẢN LÝ CSKH
====================================================

Tài khoản demo:
- Tên: Admin FLIC
- Role: Quản lý CSKH

Quản lý được phép:
- Xem toàn bộ Dashboard tổng quan.
- Xem dữ liệu tất cả kênh: Zalo Business, Facebook, Zalo OA, Chat Widget.
- Xem toàn bộ hội thoại của tất cả nhân viên.
- Theo dõi KPI toàn hệ thống.
- Theo dõi hội thoại chưa xử lý.
- Theo dõi hội thoại chờ quá 10 giờ.
- Theo dõi hội thoại chờ admin xác nhận.
- Xem AI Insights và lỗi AI.
- Xem danh sách câu hỏi AI chưa xử lý được.
- Xem danh sách lỗi AI do nhân viên ghi nhận.
- Xem phân tích keyword/chủ đề/cảm xúc.
- Xem biểu đồ xu hướng và dự báo quá tải.
- Mở Chart Builder.
- Cấu hình dashboard.
- Cấu hình nguồn dữ liệu.
- Quản lý người dùng và phân quyền.
- Gán hội thoại cho nhân viên.
- Đánh dấu hội thoại cần xử lý.
- Gửi hội thoại cho nhân viên xử lý.
- Duyệt hoặc từ chối FAQ đề xuất.
- Duyệt nội dung bổ sung vào Knowledge Base.
- Theo dõi hiệu suất xử lý của từng nhân viên.
- Cấu hình AI và ngưỡng cảnh báo.

Quản lý có quyền can thiệp vào hội thoại khi:
- Hội thoại chờ quá 10 giờ.
- AI có nguy cơ hallucination nghiêm trọng.
- Nhân viên gửi lên cần kiểm duyệt.
- Khách hàng có cảm xúc tiêu cực cao.
- Nội dung liên quan đến chính sách/chứng chỉ/lệ phí cần xác nhận chính thức.

====================================================
6. QUYỀN CỦA NHÂN VIÊN CSKH
====================================================

Tài khoản demo:
- Tên: Nhân viên CSKH
- Role: Nhân viên

Nhân viên được phép:
- Xem hội thoại được phân công hoặc theo kênh mình phụ trách.
- Tìm kiếm hội thoại theo nội dung, keyword, chủ đề.
- Xem chi tiết hội thoại dạng chat timeline.
- Xem câu trả lời AI trong hội thoại.
- Trả lời khách hàng.
- Can thiệp khi AI trả lời sai.
- Sửa nội dung phản hồi trước khi gửi cho khách hàng.
- Gửi lại câu trả lời đúng cho khách hàng.
- Đánh dấu “AI trả lời sai”.
- Đánh dấu “AI không chắc chắn”.
- Đánh dấu “Không tìm thấy dữ liệu”.
- Thêm ghi chú nội bộ về lỗi AI.
- Chuyển hội thoại sang trạng thái “Cần admin kiểm duyệt” nếu lỗi nghiêm trọng.
- Gửi hội thoại cho quản lý kiểm duyệt.
- Đề xuất câu hỏi vào FAQ.
- Đề xuất bổ sung dữ liệu cho Knowledge Base.
- Đánh dấu hội thoại đã xử lý sau khi đã can thiệp.
- Xem KPI cá nhân:
  - Số hội thoại đã xử lý
  - Số hội thoại đang chờ
  - Thời gian phản hồi trung bình
  - Tỷ lệ xử lý đúng hạn
  - Số lỗi AI đã ghi nhận

Nhân viên không được phép:
- Xem toàn bộ dữ liệu hệ thống nếu không được cấp quyền.
- Xem toàn bộ dữ liệu tất cả nhân viên.
- Quản lý người dùng.
- Thay đổi cấu hình AI toàn hệ thống.
- Duyệt chính thức Knowledge Base.
- Duyệt chính thức FAQ.
- Thay đổi ngưỡng cảnh báo hệ thống.
- Xóa dữ liệu hội thoại.
- Cấu hình nguồn dữ liệu.
- Truy cập dashboard quản lý toàn hệ thống nếu chưa được cấp quyền.

====================================================
7. CẬP NHẬT SIDEBAR THEO PHÂN QUYỀN
====================================================

Sidebar của Quản lý:
- Tổng quan
- Phân tích theo kênh
- Quản lý hội thoại
- AI Insights
- Phân tích Keywords
- Phân tích cảm xúc
- Trình tạo biểu đồ
- Cài đặt
- Quản lý người dùng

Sidebar của Nhân viên:
- Hội thoại của tôi
- Cần xử lý
- AI cần can thiệp
- FAQ đề xuất
- Hiệu suất cá nhân
- Hồ sơ cá nhân

Không để Nhân viên thấy quá nhiều module phân tích cấp quản lý.

Mục “AI cần can thiệp” của Nhân viên hiển thị các hội thoại mà AI:
- Không chắc chắn
- Không tìm thấy dữ liệu
- Có dấu hiệu trả lời sai
- Bị khách hàng phản hồi tiêu cực
- Chờ nhân viên sửa phản hồi

====================================================
8. THIẾT KẾ LẠI AVATAR DROPDOWN THEO PHÂN QUYỀN
====================================================

Hiện dropdown có các mục:
- Hồ sơ
- Đổi mật khẩu
- Cài đặt
- Trợ giúp
- Đăng xuất

Hãy làm các mục này có interaction rõ ràng và khác nhau theo role.

----------------------------------------------------
A. Với tài khoản Quản lý
----------------------------------------------------

Dropdown hiển thị:
- Hồ sơ quản lý
- Đổi mật khẩu
- Cài đặt hệ thống
- Quản lý người dùng & phân quyền
- Trợ giúp
- Đăng xuất

Khi click “Hồ sơ quản lý”:
- Mở modal/panel Hồ sơ.
- Hiển thị:
  - Tên: Admin FLIC
  - Vai trò: Quản lý CSKH
  - Email
  - Kênh quản lý: Tất cả kênh
  - Quyền truy cập: Toàn hệ thống
  - Trạng thái: Đang hoạt động

Khi click “Đổi mật khẩu”:
- Mở modal đổi mật khẩu.
- Fields:
  - Mật khẩu hiện tại
  - Mật khẩu mới
  - Xác nhận mật khẩu mới
- Button:
  - Hủy
  - Cập nhật mật khẩu
- Sau khi cập nhật hiển thị toast:
  “Đã cập nhật mật khẩu thành công”

Khi click “Cài đặt hệ thống”:
- Mở màn hình Settings dành cho Quản lý.
- Có các tab:
  - Nguồn dữ liệu
  - Cấu hình kênh
  - Ngưỡng cảnh báo
  - Cấu hình AI
  - Phân quyền
  - Thông báo

Khi click “Quản lý người dùng & phân quyền”:
- Mở màn hình User Management.
- Hiển thị bảng người dùng:
  - Tên
  - Email
  - Vai trò
  - Kênh phụ trách
  - Trạng thái
  - Lần đăng nhập gần nhất
  - Hành động
- Có nút:
  - Thêm người dùng
  - Sửa quyền
  - Khóa tài khoản
  - Reset mật khẩu

Khi click “Trợ giúp”:
- Mở Help Center.
- Nội dung:
  - Hướng dẫn sử dụng Dashboard
  - Hướng dẫn xem AI Insight
  - Hướng dẫn xử lý hội thoại AI thất bại
  - Hướng dẫn tạo biểu đồ trong Chart Builder

Khi click “Đăng xuất”:
- Mở confirm modal:
  “Bạn có chắc muốn đăng xuất?”
- Button:
  - Hủy
  - Đăng xuất
- Sau khi xác nhận, chuyển về màn hình Login.

----------------------------------------------------
B. Với tài khoản Nhân viên
----------------------------------------------------

Dropdown hiển thị:
- Hồ sơ cá nhân
- Đổi mật khẩu
- Cài đặt cá nhân
- Trợ giúp
- Đăng xuất

Không hiển thị:
- Cài đặt hệ thống
- Quản lý người dùng & phân quyền
- Cấu hình AI
- Cấu hình nguồn dữ liệu

Khi click “Hồ sơ cá nhân”:
- Mở modal/panel Hồ sơ.
- Hiển thị:
  - Tên: Nhân viên CSKH
  - Vai trò: Nhân viên
  - Email
  - Kênh phụ trách: ví dụ Zalo OA, Facebook
  - Số hội thoại đã xử lý hôm nay
  - Số lỗi AI đã can thiệp hôm nay
  - Thời gian phản hồi trung bình
  - Trạng thái: Đang hoạt động

Khi click “Đổi mật khẩu”:
- Mở modal đổi mật khẩu giống quản lý.

Khi click “Cài đặt cá nhân”:
- Mở Personal Settings.
- Chỉ cho phép:
  - Bật/tắt thông báo
  - Chọn giao diện sáng/tối nếu có
  - Cài đặt âm báo hội thoại mới
  - Cài đặt hiển thị danh sách hội thoại
- Không cho phép chỉnh cấu hình hệ thống.

Khi click “Trợ giúp”:
- Mở Help Center dành cho Nhân viên.
- Nội dung:
  - Hướng dẫn xử lý hội thoại
  - Hướng dẫn can thiệp khi AI trả lời sai
  - Hướng dẫn gửi quản lý kiểm duyệt
  - Hướng dẫn đề xuất FAQ

Khi click “Đăng xuất”:
- Mở confirm modal rồi chuyển về Login.

Nếu Nhân viên cố truy cập trang chỉ dành cho Quản lý:
- Hiển thị màn hình “Không có quyền truy cập”.
- Text:
  “Bạn không có quyền truy cập chức năng này. Vui lòng liên hệ Quản lý CSKH nếu cần hỗ trợ.”
- Button:
  “Quay lại Dashboard”

====================================================
9. THÊM MÀN HÌNH LOGIN / ROLE SWITCH DEMO
====================================================

Để demo phân quyền dễ hơn, hãy thêm màn hình Login hoặc Role Switch.

Có 2 tài khoản mẫu:
- Admin FLIC — Quản lý CSKH
- Nhân viên CSKH — Staff

Khi chọn Admin FLIC:
- Sidebar hiển thị đầy đủ chức năng.
- Dashboard hiển thị toàn hệ thống.
- Avatar dropdown hiển thị mục Quản lý người dùng, Cài đặt hệ thống.
- AI Insights hiển thị lỗi AI toàn hệ thống và lỗi AI do nhân viên ghi nhận.

Khi chọn Nhân viên CSKH:
- Sidebar chỉ hiển thị chức năng nhân viên.
- Dashboard chỉ hiển thị KPI cá nhân.
- Không hiển thị User Management.
- Không hiển thị Settings hệ thống.
- Không hiển thị dữ liệu toàn bộ nhân viên.
- Có quyền mở hội thoại, sửa câu trả lời AI, đánh dấu AI sai và gửi quản lý kiểm duyệt.

====================================================
10. CHỨC NĂNG QUẢN LÝ NGƯỜI DÙNG & PHÂN QUYỀN
====================================================

Thêm màn hình “Quản lý người dùng & phân quyền” dành riêng cho Quản lý.

Bảng user mẫu:

1. Admin FLIC
- Vai trò: Quản lý
- Kênh: Tất cả
- Quyền: Toàn hệ thống
- Trạng thái: Active

2. Thu Trang
- Vai trò: Nhân viên
- Kênh: Zalo Business, Facebook
- Quyền: Xử lý hội thoại, can thiệp AI, đề xuất FAQ
- Trạng thái: Active

3. Thùy NT
- Vai trò: Nhân viên
- Kênh: Zalo OA, Chat Widget
- Quyền: Xử lý hội thoại, đánh dấu AI sai, gửi admin kiểm duyệt
- Trạng thái: Active

4. Test User
- Vai trò: Nhân viên
- Kênh: Test
- Quyền: Giới hạn
- Trạng thái: Inactive

Thêm modal “Sửa quyền người dùng”:
- Chọn vai trò:
  - Quản lý
  - Nhân viên
- Chọn kênh phụ trách:
  - Zalo Business
  - Facebook
  - Zalo OA
  - Chat Widget
- Chọn quyền:
  - Xem hội thoại
  - Trả lời hội thoại
  - Sửa phản hồi AI
  - Đánh dấu đã xử lý
  - Đánh dấu AI sai
  - Thêm ghi chú lỗi AI
  - Gửi admin kiểm duyệt
  - Đề xuất FAQ
  - Xem phân tích tổng quan
  - Quản lý người dùng
  - Cài đặt hệ thống
- Button:
  - Hủy
  - Lưu phân quyền
- Sau khi lưu hiển thị toast:
  “Đã cập nhật phân quyền người dùng”

====================================================
11. CẬP NHẬT MÀN HÌNH QUẢN LÝ HỘI THOẠI
====================================================

Trong màn hình Quản lý hội thoại, tạo danh sách hội thoại mẫu như sau:

Hội thoại 1:
- Khách hàng: Sinh viên A
- Kênh: Zalo OA
- Chủ đề: Đăng ký thi CNTT Cơ bản
- Nội dung: “Em muốn đăng ký nhóm trên 3 bạn thì đăng ký thi như thế nào ạ?”
- Trạng thái: Chưa xử lý
- Thời gian chờ: 2 giờ 15 phút
- AI status: Không chắc chắn
- Priority: Cao

Hội thoại 2:
- Khách hàng: Sinh viên B
- Kênh: Facebook
- Chủ đề: Chuẩn đầu ra ngoại ngữ
- Nội dung: “Chuẩn đầu ra ngoại ngữ cần chứng chỉ gì ạ?”
- Trạng thái: Chờ admin xác nhận
- Thời gian chờ: 11 giờ 20 phút
- AI status: Cần kiểm duyệt
- Priority: Cao

Hội thoại 3:
- Khách hàng: Sinh viên C
- Kênh: Zalo Business
- Chủ đề: Lịch thi VSTEP
- Nội dung: “Lịch thi VSTEP tháng này có chưa ạ?”
- Trạng thái: Đang xử lý
- Thời gian chờ: 45 phút
- AI status: Thành công
- Priority: Trung bình

Hội thoại 4:
- Khách hàng: Sinh viên D
- Kênh: Chat Widget
- Chủ đề: Quên mật khẩu khóa học
- Nội dung: “Em quên mật khẩu khóa học Tin học Cơ bản thì lấy lại thế nào?”
- Trạng thái: Hoàn thành
- Thời gian chờ: 8 phút
- AI status: Thành công
- Priority: Thấp

Trạng thái hội thoại:
- Chưa xử lý
- Đang xử lý
- Chờ admin xác nhận
- Hoàn thành
- Không cần phản hồi

Trạng thái AI:
- Thành công
- Không chắc chắn
- Không tìm thấy dữ liệu
- Cần admin kiểm duyệt
- AI trả lời sai
- Có nguy cơ hallucination

Trạng thái ưu tiên:
- Cao
- Trung bình
- Thấp

====================================================
12. CẬP NHẬT CHI TIẾT HỘI THOẠI CHO NHÂN VIÊN
====================================================

Trong màn hình chi tiết hội thoại của Nhân viên, thêm cụm “Can thiệp AI” ngay dưới câu trả lời của AI.

Cụm này gồm:

Badge trạng thái AI:
- AI thành công
- AI không chắc chắn
- AI trả lời sai
- Không tìm thấy dữ liệu
- Cần admin kiểm duyệt
- Có nguy cơ hallucination

Các nút hành động:
- “Sửa câu trả lời”
- “Gửi lại cho khách hàng”
- “Đánh dấu AI sai”
- “Thêm ghi chú lỗi AI”
- “Gửi quản lý kiểm duyệt”
- “Đề xuất FAQ”
- “Bổ sung dữ liệu AI”
- “Đánh dấu đã xử lý”

Khi click “Sửa câu trả lời”:
- Mở editor nhỏ để nhân viên chỉnh nội dung phản hồi.
- Có gợi ý nội dung từ AI nhưng nhân viên được quyền sửa.
- Có nút “Lưu nháp” và “Gửi cho khách hàng”.
- Sau khi gửi, trạng thái hội thoại chuyển thành “Đã xử lý bởi nhân viên”.
- Hiển thị toast:
  “Đã gửi phản hồi đã chỉnh sửa cho khách hàng”

Khi click “Đánh dấu AI sai”:
- Mở modal chọn lý do:
  - Sai thông tin
  - Thiếu dữ liệu
  - Không hiểu câu hỏi
  - Trả lời quá chung chung
  - Có nguy cơ hallucination
- Có ô ghi chú.
- Button “Xác nhận”.
- Sau khi xác nhận:
  - Hội thoại được gắn nhãn “AI trả lời sai”.
  - Hội thoại xuất hiện trong AI Insights cho Quản lý theo dõi.
  - Hiển thị toast:
    “Đã ghi nhận lỗi AI”

Khi click “Thêm ghi chú lỗi AI”:
- Mở modal ghi chú nội bộ.
- Ghi chú chỉ hiển thị nội bộ cho nhân viên/quản lý.

Khi click “Gửi quản lý kiểm duyệt”:
- Hội thoại chuyển sang trạng thái “Chờ admin xác nhận”.
- Hiển thị toast:
  “Đã gửi hội thoại cho quản lý kiểm duyệt”

Khi click “Đề xuất FAQ”:
- Mở modal đề xuất FAQ.
- Fields:
  - Câu hỏi đề xuất
  - Câu trả lời đề xuất
  - Chủ đề
  - Ghi chú
- Sau khi gửi, trạng thái FAQ là “Chờ quản lý duyệt”.

====================================================
13. CẬP NHẬT MÀN HÌNH AI INSIGHTS
====================================================

Trong AI Insights, thêm bảng:

“Lỗi AI do nhân viên ghi nhận”

Các cột:
- Thời gian
- Nhân viên ghi nhận
- Kênh
- Chủ đề
- Câu hỏi khách hàng
- Câu trả lời AI
- Lý do đánh dấu sai
- Mức độ ảnh hưởng
- Trạng thái kiểm duyệt
- Hành động

Trạng thái kiểm duyệt:
- Chờ quản lý xem xét
- Đã xác nhận lỗi AI
- Không phải lỗi AI
- Đã bổ sung FAQ
- Đã cập nhật Knowledge Base

Hành động của Quản lý:
- Xem hội thoại
- Xác nhận lỗi AI
- Từ chối ghi nhận
- Duyệt FAQ
- Gửi bổ sung Knowledge Base

AI Insights cũng cần có các KPI:
- Tỷ lệ AI trả lời thành công
- Số câu hỏi AI thất bại
- Số câu hỏi AI không tìm thấy dữ liệu
- Số câu trả lời cần admin kiểm duyệt
- Số lỗi AI do nhân viên ghi nhận
- Cảnh báo hallucination
- Mức độ tin cậy AI
- Gợi ý bổ sung dữ liệu AI

====================================================
14. CẬP NHẬT FAQ ĐỀ XUẤT
====================================================

Thêm màn hình hoặc section “FAQ đề xuất”.

Với Nhân viên:
- Xem FAQ mình đã đề xuất.
- Tạo đề xuất FAQ mới từ hội thoại.
- Trạng thái FAQ:
  - Chờ duyệt
  - Đã duyệt
  - Bị từ chối
  - Cần chỉnh sửa

Với Quản lý:
- Xem toàn bộ FAQ đề xuất.
- Duyệt FAQ.
- Từ chối FAQ.
- Yêu cầu chỉnh sửa.
- Gửi sang Knowledge Base.

Bảng FAQ gồm:
- Câu hỏi
- Câu trả lời đề xuất
- Chủ đề
- Người đề xuất
- Nguồn hội thoại
- Trạng thái
- Hành động

====================================================
15. INTERACTION CHO PHÂN QUYỀN
====================================================

Tạo interaction demo:

- Chọn role Admin FLIC → vào dashboard quản lý.
- Chọn role Nhân viên CSKH → vào dashboard nhân viên.
- Click avatar → mở dropdown đúng theo vai trò.
- Click Hồ sơ → mở modal hồ sơ.
- Click Đổi mật khẩu → mở modal đổi mật khẩu.
- Click Cài đặt:
  - Admin mở Cài đặt hệ thống.
  - Nhân viên mở Cài đặt cá nhân.
- Click Quản lý người dùng → mở màn hình phân quyền, chỉ Admin thấy.
- Nhân viên click vào chức năng bị giới hạn → hiện No Permission screen.
- Click Đăng xuất → mở confirm modal rồi quay về Login.

Interaction cho Nhân viên can thiệp AI:
- Nhân viên mở hội thoại có AI không chắc chắn.
- Click “Sửa câu trả lời”.
- Editor mở ra với câu trả lời AI ban đầu.
- Nhân viên chỉnh sửa câu trả lời.
- Click “Gửi lại cho khách hàng”.
- Hội thoại chuyển trạng thái “Đã xử lý bởi nhân viên”.
- Click “Đánh dấu AI sai”.
- Modal lý do lỗi AI mở ra.
- Nhân viên chọn lý do và xác nhận.
- Lỗi AI xuất hiện trong AI Insights của Quản lý.
- Nhân viên click “Gửi quản lý kiểm duyệt”.
- Hội thoại chuyển trạng thái “Chờ admin xác nhận”.

Interaction cho Quản lý xử lý lỗi AI:
- Quản lý mở AI Insights.
- Xem bảng “Lỗi AI do nhân viên ghi nhận”.
- Click “Xem hội thoại”.
- Click “Xác nhận lỗi AI”.
- Click “Duyệt FAQ” hoặc “Gửi bổ sung Knowledge Base”.
- Hiển thị toast:
  “Đã cập nhật trạng thái lỗi AI”

====================================================
16. MỤC TIÊU DEMO
====================================================

Sau khi chỉnh, prototype phải cho người xem hiểu rõ:

- Dữ liệu demo bám sát hệ thống WebChat thật của FLIC.
- Dashboard không chỉ là UI đẹp mà phản ánh tình huống vận hành thật.
- Quản lý dùng dashboard để giám sát toàn hệ thống, xem AI Insight, kiểm soát chất lượng chatbot, duyệt FAQ/Knowledge Base, phân quyền và ra quyết định.
- Nhân viên dùng dashboard để xử lý hội thoại, phản hồi khách hàng, can thiệp khi AI trả lời sai, đánh dấu lỗi AI và gửi quản lý kiểm duyệt.
- AI không thay thế hoàn toàn nhân viên CSKH.
- AI là công cụ hỗ trợ trả lời nhanh, còn Nhân viên có quyền can thiệp khi AI sai hoặc không chắc chắn.
- Quản lý giữ vai trò giám sát, kiểm duyệt, cải thiện dữ liệu AI và kiểm soát chất lượng toàn hệ thống.
- Màu sắc KPI/card đồng bộ, không bị lạm dụng màu cam.
- Dropdown tài khoản ở góc phải không chỉ là menu tĩnh mà có đầy đủ interaction theo phân quyền.