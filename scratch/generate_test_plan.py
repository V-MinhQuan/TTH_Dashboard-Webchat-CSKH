import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation

# Create workbook
wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Test Plan"

# Define headers
headers = ["STT", "Module name", "Task ID", "Task name", "Task description", "Tester", "Progress", "Start date", "End date", "Note"]

# Styling
header_fill = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
header_font = Font(color="FFFFFF", bold=True)
thin_border = Border(left=Side(style='thin'), right=Side(style='thin'), top=Side(style='thin'), bottom=Side(style='thin'))
align_center = Alignment(horizontal="center", vertical="center", wrap_text=True)
align_left = Alignment(horizontal="left", vertical="center", wrap_text=True)
align_left_top = Alignment(horizontal="left", vertical="top", wrap_text=True)

# Write headers
for col_num, header in enumerate(headers, 1):
    cell = ws.cell(row=1, column=col_num, value=header)
    cell.fill = header_fill
    cell.font = header_font
    cell.alignment = align_center
    cell.border = thin_border

# Data mapping
modules = [
    {
        "name": "Xác thực người dùng",
        "tasks": [
            {"name": "Kiểm thử Login form - đăng nhập hợp lệ và redirect đúng dashboard theo role", "desc": "Viết test case đăng nhập thành công với tài khoản đúng\nThực hiện test đảm bảo redirect vào dashboard và lưu token"},
            {"name": "Kiểm thử Login form - đăng nhập sai mật khẩu hiển thị lỗi và không tạo token", "desc": "Viết test case nhập sai mật khẩu\nThực hiện test kiểm tra thông báo lỗi hiển thị rõ ràng"},
            {"name": "Kiểm thử Login form - validation trường email không đúng định dạng", "desc": "Viết test case nhập email sai định dạng (thiếu @)\nThực hiện test form chặn submit và báo lỗi đỏ ngay tại input"},
            {"name": "Kiểm thử Login form - validation bỏ trống trường bắt buộc", "desc": "Viết test case bỏ trống email/password và nhấn Đăng nhập\nThực hiện test form chặn submit và hiển thị validation message"},
            {"name": "Kiểm thử chức năng Quên mật khẩu - gửi email đặt lại thành công", "desc": "Viết test case nhập email hợp lệ để reset mật khẩu\nThực hiện test kiểm tra API gửi email thành công hoặc thông báo hướng dẫn"},
            {"name": "Kiểm thử Header - đăng xuất xóa token và redirect login", "desc": "Viết test case click nút đăng xuất ở góc màn hình\nThực hiện test kiểm tra xóa cookie/local storage, clear state và redirect về trang login"},
            {"name": "Kiểm thử Auth Interceptor - token giả/hết hạn trả 401 và redirect login", "desc": "Viết test case giả lập khi JWT token bị sửa hoặc hết hạn\nThực hiện test hệ thống chặn các request lấy data và tự động đưa về login"},
            {"name": "Kiểm thử Route Guard - chặn truy cập URL nội bộ khi chưa đăng nhập", "desc": "Viết test case truy cập trực tiếp URL /overview khi không có session\nThực hiện test ứng dụng tự động redirect về màn đăng nhập"}
        ]
    },
    {
        "name": "Bộ lọc dữ liệu",
        "note": "Cần kiểm tra trên các page đang dùng filter: Overview, Channel Analysis, Keyword Analysis, Sentiment Analysis, AI Insights.",
        "tasks": [
            {"name": "Kiểm thử dropdown Khoảng thời gian - chọn Hôm nay/7 ngày/30 ngày/Tùy chỉnh", "desc": "Viết test case thao tác chọn từng mốc thời gian preset\nThực hiện test panel cập nhật đúng giới hạn ngày và trigger API phù hợp"},
            {"name": "Kiểm thử ô Từ ngày - bỏ trống, sai định dạng, ngày tương lai", "desc": "Viết test case nhập tay sai format hoặc chọn ngày tương lai trên ô Từ ngày\nThực hiện test datepicker ngăn chặn hoặc hiện lỗi validation tương ứng"},
            {"name": "Kiểm thử ô Đến ngày - nhỏ hơn Từ ngày và cùng ngày hợp lệ", "desc": "Viết test case chọn Đến ngày trước Từ ngày và trùng Từ ngày\nThực hiện test báo lỗi nếu nhỏ hơn, và chấp nhận gọi filter nếu cùng ngày"},
            {"name": "Kiểm thử chọn ngày tùy chỉnh - năm nhuận 29/02 hợp lệ và không hợp lệ", "desc": "Viết test case chọn 29/02 cho năm nhuận và năm thường\nThực hiện test đảm bảo component không lỗi crash và filter gọi đúng mốc UNIX timestamp"},
            {"name": "Kiểm thử nút Áp dụng bộ lọc - gọi API đúng params và cập nhật dữ liệu", "desc": "Viết test case thay đổi filter và click Áp dụng\nThực hiện test các biểu đồ được gọi đúng query params và UI render lại số liệu mới"},
            {"name": "Kiểm thử nút Đặt lại bộ lọc - xóa filter chip và reload mặc định", "desc": "Viết test case click Đặt lại bộ lọc trên panel\nThực hiện test form filter về mặc định (ví dụ 30 ngày qua, tất cả kênh) và reload dashboard"},
            {"name": "Kiểm thử dropdown Kênh - chọn Tất cả/Zalo/Facebook/Chat Widget", "desc": "Viết test case thao tác chọn đa dạng một hoặc nhiều kênh social\nThực hiện test hiển thị số liệu chỉ giới hạn trong phạm vi các kênh đã tick"},
            {"name": "Kiểm thử dropdown Chủ đề - chỉ hiển thị và lọc theo chủ đề active", "desc": "Viết test case mở dropdown list Chủ đề\nThực hiện test danh sách chủ đề khớp với DB và bộ lọc trả về list hội thoại đúng chủ đề"},
            {"name": "Kiểm thử chip filter - xóa từng điều kiện và đồng bộ panel", "desc": "Viết test case ấn dấu X trên từng chip filter nhỏ (thời gian, kênh, chủ đề)\nThực hiện test panel bộ lọc đồng bộ update xóa điều kiện tương ứng và tự động load data"},
            {"name": "Kiểm thử collapse/expand panel bộ lọc - giữ trạng thái giá trị", "desc": "Viết test case mở ra thu vào panel filter\nThực hiện test các giá trị đã chọn không bị mất và layout không bị đẩy lệch"}
        ]
    },
    {
        "name": "Tổng quan",
        "tasks": [
            {"name": "Kiểm thử KPI Tổng quan - loading/empty/error và format số liệu", "desc": "Viết test case load các thẻ KPI tổng hội thoại, CSAT\nThực hiện test trạng thái tải skeleton, format phân cách hàng nghìn và hiển thị đúng màu % tăng giảm"},
            {"name": "Kiểm thử biểu đồ Tổng quan - tooltip/legend/axis khi có dữ liệu", "desc": "Viết test case hiển thị biểu đồ xu hướng theo ngày tháng\nThực hiện test hover tooltip hiển thị số liệu tương ứng và trục tọa độ chia step đúng"},
            {"name": "Kiểm thử biểu đồ Tổng quan - empty state khi không có dữ liệu", "desc": "Viết test case khi filter trả về tập rỗng (0 record)\nThực hiện test hiển thị thông báo đẹp mắt thay vì để một bộ khung biểu đồ trắng không có đường line"},
            {"name": "Kiểm thử nút Tải lại - refresh dữ liệu thủ công giữ nguyên filter", "desc": "Viết test case click nút tải lại trên bảng điều khiển dashboard\nThực hiện test trigger gọi API mới nhất mà không làm reset điều kiện lọc hiện có"}
        ]
    },
    {
        "name": "Phân tích theo kênh",
        "tasks": [
            {"name": "Kiểm thử Pie chart phân bổ kênh - hiển thị tooltip phần trăm chính xác", "desc": "Viết test case xem biểu đồ tròn về tỷ trọng các kênh giao tiếp\nThực hiện test tổng % các lát cắt bằng 100% và hover tooltip ra số tuyệt đối đúng"},
            {"name": "Kiểm thử Bảng chi tiết kênh - phân trang và sort cột dữ liệu", "desc": "Viết test case chuyển trang 2, 3 và click header cột số lượng để sort\nThực hiện test thứ tự hiển thị thay đổi khớp với logic API trả về và giữ được pagination state"},
            {"name": "Kiểm thử Bảng chi tiết kênh - empty state khi filter không có data", "desc": "Viết test case áp dụng filter không tồn tại hội thoại\nThực hiện test hiển thị icon và thông báo rỗng giữa bảng thay vì crash hoặc bảng cụt"},
            {"name": "Kiểm thử Channel Analysis API 500 - hiển thị toast và giữ layout ổn định", "desc": "Viết test case mock lỗi 500 từ API thống kê kênh để xem UI phản ứng\nThực hiện test ứng dụng không bị trắng trang, hiện toast lỗi 'Máy chủ đang bận'"}
        ]
    },
    {
        "name": "Từ khóa nổi bật",
        "tasks": [
            {"name": "Kiểm thử Word cloud từ khóa - kích thước chữ tỉ lệ thuận tần suất", "desc": "Viết test case load chức năng đám mây từ khóa (word cloud)\nThực hiện test quan sát các từ khóa có count cao sẽ hiển thị font size to hơn rõ rệt ở giữa hình"},
            {"name": "Kiểm thử Input tìm kiếm từ khóa - lọc kết quả bảng chính xác", "desc": "Viết test case gõ vài ký tự vào ô tìm kiếm trên bảng từ khóa\nThực hiện test bảng cập nhật nhanh chóng chỉ hiển thị từ chứa chuỗi ký tự vừa nhập (debounce)"},
            {"name": "Kiểm thử click vào từ khóa - tự động lọc hội thoại chứa từ khóa tương ứng", "desc": "Viết test case click vào một từ khóa trên cloud hoặc table\nThực hiện test redirect sang màn list hội thoại và áp luôn filter từ khóa đó vào list"},
            {"name": "Kiểm thử Keyword Analysis timeout - hiển thị lỗi và không treo trang", "desc": "Viết test case khi query text lớn với khoảng thời gian dài bị chậm timeout\nThực hiện test hiển thị thông báo 'Truy vấn quá lâu' và nhả block UI để người dùng được thao tác tiếp"}
        ]
    },
    {
        "name": "Phân tích cảm xúc",
        "tasks": [
            {"name": "Kiểm thử Sentiment Summary - tổng phần trăm cảm xúc bằng 100%", "desc": "Viết test case load các bar/pie chart thể hiện Tích cực, Tiêu cực, Trung tính\nThực hiện test số liệu % cộng lại tròn 100, và hiển thị màu sắc đồng nhất (Xanh, Đỏ, Xám)"},
            {"name": "Kiểm thử danh sách hội thoại tiêu cực - mở chi tiết đúng đoạn chat", "desc": "Viết test case click vào row một cuộc gọi/tin nhắn bị gán nhãn tiêu cực trong bảng\nThực hiện test popup/modal chi tiết mở ra tự scroll và highlight đoạn tin nhắn mang tính tiêu cực đó"},
            {"name": "Kiểm thử Fallback ML-Service - hiển thị lỗi thân thiện khi model down", "desc": "Viết test case ngắt kết nối service FastAPI PhoBERT/ONNX\nThực hiện test UI fallback báo lỗi 'AI đang khởi động / phân tích gián đoạn' và không sập toàn hệ thống"}
        ]
    },
    {
        "name": "AI Insights",
        "tasks": [
            {"name": "Kiểm thử Panel AI Insights - sinh nhận xét khớp với dữ liệu thực tế", "desc": "Viết test case load panel nhận xét xu hướng tự động\nThực hiện test đọc chéo các câu text AI sinh ra xem logic tăng/giảm % có đúng với số liệu chart không"},
            {"name": "Kiểm thử AI Insights dữ liệu rỗng - hiển thị trạng thái không đủ dữ liệu", "desc": "Viết test case chọn khoảng filter quá hẹp không đủ sample (ví dụ 1 ngày, 0 chat)\nThực hiện test panel xử lý edge case hiển thị text tĩnh 'Không đủ dữ liệu để tạo phân tích'"}
        ]
    },
    {
        "name": "Chart Builder",
        "tasks": [
            {"name": "Kiểm thử Chart Builder Data Source - đổi nguồn và load đúng field list", "desc": "Viết test case mở dropdown data source chọn từ Conversations sang Feedback\nThực hiện test list lựa chọn X axis và Y axis bị thay thế bằng đúng bộ schema của nguồn data mới"},
            {"name": "Kiểm thử Chart Builder Chart Type - đổi Bar/Line/Pie và validate field", "desc": "Viết test case đổi loại biểu đồ sang Pie chart khi đang chọn trục thời gian\nThực hiện test ứng dụng vô hiệu hóa hoặc cảnh báo nếu cấu hình field hiện tại không phù hợp vẽ Pie"},
            {"name": "Kiểm thử Chart Builder Preview - thiếu X/Y axis và hiển thị validation", "desc": "Viết test case để trống trục X (bắt buộc) và bấm nút Preview\nThực hiện test ngăn vẽ chart và báo đỏ dưới input yêu cầu người dùng phải mapping đủ trường"},
            {"name": "Kiểm thử Chart Builder Preview - vẽ biểu đồ thực tế với data từ backend", "desc": "Viết test case cấu hình field đầy đủ hợp lý và click Preview\nThực hiện test biểu đồ được render hiển thị chính xác với preview data request trả về thành công"},
            {"name": "Kiểm thử Chart Builder Save - nhập tên cấu hình và lưu thành công", "desc": "Viết test case click Save, nhập tên config hợp lệ vào modal\nThực hiện test POST gọi API lưu và chart title hiện ra ở danh sách cấu hình của user đó"}
        ]
    },
    {
        "name": "Thư viện phản hồi",
        "tasks": [
            {"name": "Kiểm thử Table Thư viện phản hồi - hiển thị dữ liệu cơ bản và phân trang", "desc": "Viết test case load mặc định vào tab Thư viện phản hồi\nThực hiện test bảng hiển thị cột câu hỏi, câu trả lời, trạng thái, và bấm Next page load list mượt mà"},
            {"name": "Kiểm thử Input tìm kiếm phản hồi - tìm theo tiêu đề hoặc nội dung", "desc": "Viết test case gõ cụm từ khóa vào thanh search table\nThực hiện test bộ lọc client hoặc server thu hẹp row trả về thỏa mãn text trong title/content"},
            {"name": "Kiểm thử Thư viện phản hồi nút Thêm - mở modal, validate bắt buộc, submit", "desc": "Viết test case bấm Thêm mới, để trống thông tin và submit\nThực hiện test báo đỏ, sau đó điền text đầy đủ và tạo record thành công gọi API"},
            {"name": "Kiểm thử Thư viện phản hồi nút Sửa - bind dữ liệu cũ và lưu cập nhật", "desc": "Viết test case chọn click Sửa (Edit) trên 1 bản ghi hiện có\nThực hiện test form popup mở ra điền sẵn text cũ, cho sửa và PUT API thành công không lỗi"},
            {"name": "Kiểm thử Thư viện phản hồi nút Xóa - Hủy/Xác nhận trong modal", "desc": "Viết test case bấm Xóa record với hai nhánh Hủy và Xác nhận\nThực hiện test kiểm tra record giữ nguyên khi Hủy và bị bay màu khỏi list sau khi Xác nhận"},
            {"name": "Kiểm thử Thư viện phản hồi nút Duyệt - đổi trạng thái và kiểm tra quyền", "desc": "Viết test case dùng tài khoản Admin và chuyển toggle duyệt (Approve/Reject) câu trả lời\nThực hiện test API update status thành công và check quyền Staff bị disable nút này"}
        ]
    },
    {
        "name": "Quản lý người dùng",
        "tasks": [
            {"name": "Kiểm thử User Management table - hiển thị danh sách và role rõ ràng", "desc": "Viết test case login Admin truy cập màn Users\nThực hiện test bảng load đủ Email, Họ tên, Role (Admin/Manager/Staff) bằng màu sắc phân tách tốt"},
            {"name": "Kiểm thử User Management thêm user - validate email/password/role", "desc": "Viết test case thao tác tạo người dùng hệ thống mới\nThực hiện test validate chặn pass yếu, chặn trùng email và submit POST tạo account thành công"},
            {"name": "Kiểm thử User Management sửa user - đổi role từ Staff lên Manager", "desc": "Viết test case chọn cập nhật phân quyền 1 user từ Staff thành Manager\nThực hiện test API PATCH thành công và user đó có thể nhìn thấy menu nâng cao ở lần login kế"},
            {"name": "Kiểm thử User Management khóa user - user bị khóa không đăng nhập được", "desc": "Viết test case bấm nút Suspend/Ban một tài khoản đang hoạt động\nThực hiện test tài khoản đó lập tức bị đá văng token và nếu login lại sẽ báo lỗi bị vô hiệu hóa"},
            {"name": "Kiểm thử Phân quyền Menu - ẩn menu quản trị đối với tài khoản Staff", "desc": "Viết test case login với vai trò nhân viên thông thường (Staff)\nThực hiện test sidebar và header ẩn sạch những tính năng Settings, Users, ML config"}
        ]
    },
    {
        "name": "Cài đặt & Thông tin cá nhân",
        "tasks": [
            {"name": "Kiểm thử Profile lưu thông tin - validate email/số điện thoại và cập nhật API", "desc": "Viết test case vào Profile cá nhân nhập SĐT chứa chữ cái\nThực hiện test chặn lưu báo lỗi format, sau đó sửa đúng SĐT và save OK báo toast Xanh"},
            {"name": "Kiểm thử Profile upload avatar - validate kích thước và định dạng ảnh hợp lệ", "desc": "Viết test case tính năng đổi ảnh đại diện chọn file dung lượng 20MB hoặc file .exe\nThực hiện test chặn client báo lỗi file quá khổ, sau đó chọn PNG 1MB lưu thành công"},
            {"name": "Kiểm thử Đổi mật khẩu - yêu cầu nhập đúng mật khẩu cũ và khớp mật khẩu mới", "desc": "Viết test case chức năng đổi pass nhập pass mới và xác nhận pass mới bị lệch\nThực hiện test UI báo đỏ chưa khớp và không cho ấn gửi đổi mật khẩu"},
            {"name": "Kiểm thử Settings hệ thống - thay đổi tham số và lưu cấu hình chung", "desc": "Viết test case admin đổi config SLA time trên trang cài đặt\nThực hiện test cấu hình toàn cục thay đổi áp dụng cho các module khác yêu cầu logic SLA"}
        ]
    },
    {
        "name": "Xuất dữ liệu",
        "tasks": [
            {"name": "Kiểm thử Export CSV - UTF-8 tiếng Việt và đúng dữ liệu đang lọc", "desc": "Viết test case áp bộ lọc ngày ngắn và bấm Export CSV trên bảng\nThực hiện test check file csv tải về mở bằng Excel hiển thị đúng tiếng Việt không lỗi font/lỗi dấu"},
            {"name": "Kiểm thử Export Excel - đúng cột, đúng filter, định dạng ô chuẩn", "desc": "Viết test case export định dạng thuần Excel (XLSX) nếu hệ thống cung cấp\nThực hiện test file tải về chia cột thẳng thớm, không bị dính chuỗi hay tràn dòng header"},
            {"name": "Kiểm thử Export dữ liệu rỗng - trả về file có header nhưng không có row data", "desc": "Viết test case cố tình lọc không ra data và bấm nút Export\nThực hiện test file vẫn được sinh ra đàng hoàng gồm dòng tiêu đề cột thay vì trả về lỗi server"}
        ]
    },
    {
        "name": "Lịch sử hoạt động",
        "tasks": [
            {"name": "Kiểm thử Activity History bảng - hiển thị đầy đủ Ai, Hành động, Thời gian", "desc": "Viết test case login vào mục Lịch sử thao tác (Audit log)\nThực hiện test hệ thống record chuẩn xác list user nào thực hiện thêm/sửa/xóa ở giờ/ngày nào"},
            {"name": "Kiểm thử Activity History phân trang - chuyển trang giữ đúng thứ tự log", "desc": "Viết test case click nút phân trang tới lui trên view Audit log\nThực hiện test lấy data mượt, sorted log DESC theo time mà không bị nhảy trang hay duplicate"}
        ]
    },
    {
        "name": "Backend API & ML Service",
        "note": "Kiểm thử các rule API chung, error code, rate limiting, và health check ML service.",
        "tasks": [
            {"name": "Kiểm thử Health Check API - DB/ML disconnected không trả false green", "desc": "Viết test case shutdown cục bộ SQL Server hoặc Redis connection của backend\nThực hiện test hit API /health bắt buộc trả error array chứ không được báo OK 200 false"},
            {"name": "Kiểm thử Validation Middleware - payload thiếu params trả lỗi 422 chuẩn", "desc": "Viết test case call POST HTTP request nhưng body rỗng thiếu mọi parameter bắt buộc\nThực hiện test interceptor server FastAPI đáp về mã HTTP 422 Unprocessable Entity json error message"},
            {"name": "Kiểm thử Rate Limiting API - chống spam request liên tục", "desc": "Viết test case dùng tool giả lập spam API quá số lượng limit/phút (nếu có config)\nThực hiện test gateway chặn lại bằng mã 429 Too Many Requests không gây overload hệ thống"}
        ]
    }
]

# Write data
row_idx = 2
stt = 1
task_id_counter = 1

# Data Validation for Progress
dv = DataValidation(type="list", formula1='"Not Started,In Progress,Done,Blocked"', allow_blank=True)
ws.add_data_validation(dv)

for module in modules:
    start_row = row_idx
    tasks = module["tasks"]
    
    for task_idx, task in enumerate(tasks):
        ws.cell(row=row_idx, column=1, value=stt).alignment = align_center
        ws.cell(row=row_idx, column=2, value=module["name"]).alignment = align_center
        
        # Task ID format FLIC-XX
        task_id_str = f"FLIC-{task_id_counter:02d}"
        ws.cell(row=row_idx, column=3, value=task_id_str).alignment = align_center
        
        ws.cell(row=row_idx, column=4, value=task["name"]).alignment = align_left_top
        ws.cell(row=row_idx, column=5, value=task["desc"]).alignment = align_left_top
        
        ws.cell(row=row_idx, column=6, value="QA").alignment = align_center
        
        progress_cell = ws.cell(row=row_idx, column=7, value="Not Started")
        progress_cell.alignment = align_center
        dv.add(progress_cell)
        
        ws.cell(row=row_idx, column=8, value="TBD").alignment = align_center
        ws.cell(row=row_idx, column=9, value="TBD").alignment = align_center
        
        note_val = module.get("note", "") if task_idx == 0 else "" 
        ws.cell(row=row_idx, column=10, value=note_val).alignment = align_left_top
        
        # Apply borders
        for c in range(1, 11):
            ws.cell(row=row_idx, column=c).border = thin_border
            
        row_idx += 1
        task_id_counter += 1
        
    # Merge STT and Module Name
    if len(tasks) > 1:
        ws.merge_cells(start_row=start_row, start_column=1, end_row=row_idx-1, end_column=1)
        ws.merge_cells(start_row=start_row, start_column=2, end_row=row_idx-1, end_column=2)

    stt += 1

# Auto-fit columns
column_widths = {
    'A': 6,
    'B': 25,
    'C': 12,
    'D': 35,
    'E': 60,
    'F': 10,
    'G': 15,
    'H': 15,
    'I': 15,
    'J': 30
}
for col, width in column_widths.items():
    ws.column_dimensions[col].width = width

ws.freeze_panes = 'A2'

# Create Summary Sheet
if "Summary" in wb.sheetnames:
    del wb["Summary"]
ws_sum = wb.create_sheet(title="Summary")
ws_sum.column_dimensions['A'].width = 40
ws_sum.column_dimensions['B'].width = 80

summary_data = [
    ("Tổng số module", len(modules)),
    ("Tổng số task", task_id_counter - 1),
    ("Danh sách module rủi ro cao", "Chart Builder, Global Filter, Keyword Analysis, Sentiment Analysis, RBAC/Auth"),
    ("Module cần backend thật", "Tổng quan, Phân tích kênh, Chart Builder, Dashboard chung, Xuất dữ liệu"),
    ("Module cần DB thật", "Thư viện phản hồi (CRUD), Lịch sử hoạt động, Quản lý người dùng"),
    ("Module cần ML-service thật", "Phân tích cảm xúc, AI Insights, Từ khóa nổi bật"),
    ("Module/API cần kiểm tra phân quyền", "Quản lý người dùng, Thư viện phản hồi (Duyệt/Xóa), Cài đặt"),
    ("Các phần bị loại khỏi Test Plan", "Thư mục archive/legacy Node Backend (không nằm trong scope chính)"),
    ("Ghi chú khác", "Đã nâng cấp detail Task name & Task description bám sát từng action/control")
]

for idx, (k, v) in enumerate(summary_data, 1):
    ws_sum.cell(row=idx, column=1, value=k).font = Font(bold=True)
    ws_sum.cell(row=idx, column=2, value=str(v)).alignment = align_left
    ws_sum.cell(row=idx, column=1).border = thin_border
    ws_sum.cell(row=idx, column=2).border = thin_border

wb.save("FLIC_Test_Plan.xlsx")
