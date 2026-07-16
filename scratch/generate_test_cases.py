import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side

# ─────────────────────────────── STYLE HELPERS ────────────────────────────────
HDR_FILL = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
HDR_FONT = Font(color="FFFFFF", bold=True, size=10)
GRP_FILL = PatternFill(start_color="D6E4F0", end_color="D6E4F0", fill_type="solid")
GRP_FONT = Font(bold=True, color="1F4E78", size=10)
BODY_FONT = Font(size=10)
THIN = Side(style="thin")
BDR = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
C_CENTER = Alignment(horizontal="center", vertical="top", wrap_text=True)
C_LEFT = Alignment(horizontal="left", vertical="top", wrap_text=True)
C_MID = Alignment(horizontal="center", vertical="center", wrap_text=True)

HEADERS = ["TC ID", "Mô tả", "Bước thực hiện", "Kết quả mong đợi",
           "Kết quả thực tế", "Trạng thái", "Ghi chú", "Minh chứng"]
COL_WIDTHS = [14, 42, 58, 48, 22, 13, 22, 14]


def new_sheet(wb, title):
    ws = wb.create_sheet(title=title)
    for c, h in enumerate(HEADERS, 1):
        cell = ws.cell(row=1, column=c, value=h)
        cell.fill = HDR_FILL; cell.font = HDR_FONT
        cell.alignment = C_MID; cell.border = BDR
    for i, w in enumerate(COL_WIDTHS, 1):
        ws.column_dimensions[ws.cell(1, i).column_letter].width = w
    ws.freeze_panes = "A2"
    ws.row_dimensions[1].height = 22
    return ws


def grp(ws, row, title):
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=8)
    c = ws.cell(row, 1, title)
    c.fill = GRP_FILL; c.font = GRP_FONT
    c.alignment = Alignment(horizontal="center", vertical="center")
    c.border = BDR; ws.row_dimensions[row].height = 17
    return row + 1


def tc(ws, row, tc_id, desc, steps, expected, note=""):
    data = [tc_id, desc, steps, expected, "", "Not Run", note, ""]
    aligns = [C_CENTER, C_LEFT, C_LEFT, C_LEFT, C_LEFT, C_CENTER, C_LEFT, C_CENTER]
    for c_idx, (val, aln) in enumerate(zip(data, aligns), 1):
        cell = ws.cell(row=row, column=c_idx, value=val)
        cell.font = BODY_FONT; cell.alignment = aln; cell.border = BDR
    ws.row_dimensions[row].height = 65
    return row + 1


# ══════════════════════════════════════════════════════════════════════════════
wb = openpyxl.Workbook()
wb.remove(wb.active)
total_tc = 0
sheet_info = []


# ══════════════════════════════════════════════════════════════════════════════
#  MODULE 1 – XÁC THỰC NGƯỜI DÙNG  (target 15+)
# ══════════════════════════════════════════════════════════════════════════════
ws = new_sheet(wb, "Xac thuc nguoi dung")
r = 2; n = 1; PFX = "AUTH"

r = grp(ws, r, "ĐĂNG NHẬP HỢP LỆ – HAPPY PATH")
for desc, steps, exp in [
    ("Đăng nhập thành công với tài khoản Admin hợp lệ và redirect đúng dashboard",
     "1. Mở trang đăng nhập\n2. Nhập email Admin + password đúng\n3. Click Đăng nhập\n4. Quan sát URL và màn hình sau đăng nhập",
     "Redirect về Overview Dashboard. JWT token được lưu vào localStorage/cookie. Sidebar hiển thị menu Admin đầy đủ."),
    ("Đăng nhập thành công với tài khoản Manager hợp lệ",
     "1. Mở trang đăng nhập\n2. Nhập email Manager + password đúng\n3. Click Đăng nhập",
     "Đăng nhập thành công, redirect vào Dashboard. Menu hiển thị quyền Manager (không có Users quản trị)."),
    ("Đăng nhập thành công với tài khoản Staff hợp lệ",
     "1. Mở trang đăng nhập\n2. Nhập email Staff + password đúng\n3. Click Đăng nhập",
     "Đăng nhập thành công. Sidebar ẩn Users, Settings hệ thống. Chỉ có menu báo cáo cơ bản."),
    ("JWT token được lưu đúng sau khi đăng nhập thành công",
     "1. Đăng nhập thành công\n2. Mở DevTools → Application → LocalStorage\n3. Kiểm tra key token",
     "Token JWT hợp lệ tồn tại trong localStorage hoặc cookie httpOnly. Không bị trống."),
    ("Màn hình đăng nhập hiển thị loading spinner khi đang xác thực",
     "1. Nhập đúng thông tin\n2. Click Đăng nhập\n3. Quan sát nút Đăng nhập trong vài ms",
     "Nút Đăng nhập chuyển sang trạng thái loading (spinner/disabled) trong quá trình gọi API."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

r = grp(ws, r, "ĐĂNG NHẬP LỖI – VALIDATION & ERROR")
for desc, steps, exp in [
    ("Đăng nhập sai mật khẩu hiển thị thông báo lỗi và không tạo token",
     "1. Nhập email đúng\n2. Nhập password sai\n3. Click Đăng nhập\n4. Kiểm tra Network tab",
     "API trả 401. UI hiển thị 'Sai mật khẩu hoặc email'. Không có token trong localStorage. Không redirect."),
    ("Đăng nhập với email không tồn tại trong hệ thống",
     "1. Nhập email không tồn tại 'abc@notexist.com'\n2. Nhập password bất kỳ\n3. Click Đăng nhập",
     "API trả 401 hoặc 404. UI hiển thị lỗi 'Tài khoản không tồn tại'. Không redirect."),
    ("Bỏ trống ô Email khi đăng nhập – validation báo bắt buộc",
     "1. Để trống ô Email\n2. Nhập Password\n3. Click Đăng nhập",
     "Form báo lỗi 'Email không được để trống' tại ô Email. Không gọi API."),
    ("Bỏ trống ô Password khi đăng nhập – validation báo bắt buộc",
     "1. Nhập Email hợp lệ\n2. Để trống ô Password\n3. Click Đăng nhập",
     "Form báo lỗi 'Mật khẩu không được để trống' tại ô Password. Không gọi API."),
    ("Nhập email sai định dạng thiếu @ – validation báo lỗi format",
     "1. Nhập 'abcexample.com' vào ô Email\n2. Nhập Password\n3. Click Đăng nhập",
     "Form báo lỗi 'Email không đúng định dạng'. Không gọi API đăng nhập."),
    ("Nhập mật khẩu có khoảng trắng đầu cuối – không tự trim gây lỗi không rõ ràng",
     "1. Nhập email đúng\n2. Nhập password có khoảng trắng đầu ' password123 '\n3. Click Đăng nhập",
     "Hệ thống không tự trim, API trả 401. Hiển thị lỗi mật khẩu sai rõ ràng thay vì lỗi server 500."),
    ("Nhập email có chữ hoa – login thành công (case-insensitive email)",
     "1. Nhập 'Admin@Example.COM'\n2. Nhập password đúng\n3. Click Đăng nhập",
     "Hệ thống xử lý email case-insensitive. Login thành công với email viết hoa."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

r = grp(ws, r, "ĐĂNG XUẤT & SESSION")
for desc, steps, exp in [
    ("Click nút Đăng xuất xóa token và redirect về trang Login",
     "1. Đăng nhập thành công\n2. Click icon user → Đăng xuất\n3. Quan sát LocalStorage và URL",
     "Token bị xóa khỏi localStorage/cookie. State React bị clear. URL redirect về /login."),
    ("Đăng xuất sau đó dùng nút Back trình duyệt không vào được dashboard",
     "1. Đăng nhập → Đăng xuất\n2. Nhấn nút Back trình duyệt",
     "Hệ thống redirect lại về Login. Không hiển thị dashboard khi không có token."),
    ("Token JWT hết hạn tự động redirect về Login và xóa session",
     "1. Đăng nhập thành công\n2. Chỉnh sửa token trong localStorage thành chuỗi hết hạn\n3. Reload trang hoặc gọi API",
     "API interceptor nhận 401 Unauthorized. Tự xóa token. Redirect về Login."),
    ("Truy cập URL nội bộ /overview khi chưa đăng nhập bị chặn",
     "1. Chưa đăng nhập\n2. Nhập trực tiếp URL http://localhost:5173/overview\n3. Nhấn Enter",
     "Route Guard phát hiện không có token hợp lệ, redirect về màn Login."),
    ("Token giả mạo (tampered JWT) bị backend từ chối với 401",
     "1. Đăng nhập thành công\n2. Sửa phần payload của JWT thành giá trị khác\n3. Gọi API /api/dashboard/kpi",
     "Backend xác thực chữ ký JWT thất bại, trả 401 Unauthorized. Frontend redirect về Login."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

sheet_info.append(("Xac thuc nguoi dung", n - 1)); total_tc += n - 1

# ══════════════════════════════════════════════════════════════════════════════
#  MODULE 2 – BỘ LỌC DỮ LIỆU  (target 35+)
# ══════════════════════════════════════════════════════════════════════════════
ws = new_sheet(wb, "Bo loc du lieu")
r = 2; n = 1; PFX = "FILTER"
NOTE_FILTER = "Áp dụng trên Overview, Channel Analysis, Keyword, Sentiment, AI Insights."

r = grp(ws, r, "DROPDOWN KHOẢNG THỜI GIAN")
for desc, steps, exp in [
    ("Mở dropdown Khoảng thời gian hiển thị đủ 4 option",
     "1. Vào trang Overview\n2. Click dropdown 'Khoảng thời gian'\n3. Quan sát danh sách",
     "Dropdown hiển thị: Hôm nay, 7 ngày qua, 30 ngày qua, Tùy chỉnh. Không có option thừa."),
    ("Chọn preset 'Hôm nay' – API gọi đúng date_from = date_to = hôm nay",
     "1. Mở dropdown\n2. Chọn 'Hôm nay'\n3. Click Áp dụng\n4. Quan sát Network tab",
     "API nhận date_from = date_to = ngày hiện tại (UTC+7). Dashboard hiển thị dữ liệu hôm nay."),
    ("Chọn preset '7 ngày qua' – API gọi date_from = hôm nay - 6 ngày",
     "1. Chọn '7 ngày qua'\n2. Click Áp dụng",
     "API nhận params tương ứng 7 ngày. KPI và biểu đồ hiển thị đúng khoảng."),
    ("Chọn preset '30 ngày qua' – API gọi đúng 30 ngày",
     "1. Chọn '30 ngày qua'\n2. Click Áp dụng",
     "API nhận params 30 ngày. Chart hiển thị đủ 30 data point theo ngày."),
    ("Chọn 'Tùy chỉnh' – hiển thị ô Từ ngày và Đến ngày",
     "1. Chọn 'Tùy chỉnh'\n2. Quan sát UI",
     "Ô 'Từ ngày' và 'Đến ngày' xuất hiện dưới dropdown. Hai ô ban đầu có thể trống hoặc pre-fill."),
    ("Đổi từ preset '7 ngày' sang 'Tùy chỉnh' – ô ngày không crash",
     "1. Chọn '7 ngày qua'\n2. Đổi về 'Tùy chỉnh'\n3. Quan sát UI",
     "UI chuyển mượt mà sang chế độ Tùy chỉnh. Hai ô ngày có thể pre-fill theo giá trị 7 ngày hoặc trống."),
    ("Đổi từ Tùy chỉnh về preset – ô ngày ẩn đi",
     "1. Đang ở Tùy chỉnh\n2. Chọn lại '30 ngày qua'\n3. Quan sát UI",
     "Ô Từ ngày và Đến ngày ẩn. Chip filter cập nhật theo preset mới."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp, NOTE_FILTER); n += 1

r = grp(ws, r, "Ô TỪ NGÀY – VALIDATION")
for desc, steps, exp in [
    ("Bỏ trống ô Từ ngày khi Tùy chỉnh và click Áp dụng – báo lỗi bắt buộc",
     "1. Chọn Tùy chỉnh\n2. Bỏ trống Từ ngày\n3. Nhập Đến ngày hợp lệ\n4. Click Áp dụng",
     "Hiển thị lỗi 'Vui lòng chọn Từ ngày'. Không gọi API."),
    ("Nhập Từ ngày sai định dạng DD/MM/YYYY – datepicker chặn hoặc báo lỗi",
     "1. Chọn Tùy chỉnh\n2. Gõ tay '99/13/2025' vào ô Từ ngày\n3. Click Áp dụng",
     "Datepicker không cho nhập ngày không hợp lệ, hoặc báo lỗi 'Ngày không hợp lệ'."),
    ("Nhập Từ ngày là ngày tương lai – bị từ chối",
     "1. Chọn Tùy chỉnh\n2. Chọn Từ ngày = ngày mai\n3. Click Áp dụng",
     "Datepicker disable ngày tương lai hoặc hiển thị cảnh báo 'Không thể chọn ngày trong tương lai'."),
    ("Nhập Từ ngày hợp lệ trong quá khứ – được chấp nhận",
     "1. Chọn Tùy chỉnh\n2. Chọn Từ ngày = 01/06/2025\n3. Chọn Đến ngày ≥ Từ ngày\n4. Áp dụng",
     "Bộ lọc áp dụng thành công. API gọi đúng params. Dashboard cập nhật."),
    ("Nhập ngày 31/02 không tồn tại – datepicker chặn",
     "1. Chọn Tùy chỉnh\n2. Gõ '31/02/2025' thủ công vào ô Từ ngày",
     "Datepicker không hiển thị ngày 31/02 trong calendar. Ô không nhận giá trị sai."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp, NOTE_FILTER); n += 1

r = grp(ws, r, "Ô ĐẾN NGÀY – VALIDATION")
for desc, steps, exp in [
    ("Bỏ trống ô Đến ngày khi Tùy chỉnh và click Áp dụng – báo lỗi bắt buộc",
     "1. Chọn Tùy chỉnh\n2. Nhập Từ ngày\n3. Bỏ trống Đến ngày\n4. Click Áp dụng",
     "Hiển thị lỗi 'Vui lòng chọn Đến ngày'. Không gọi API."),
    ("Nhập Đến ngày nhỏ hơn Từ ngày – bị từ chối",
     "1. Từ ngày = 15/06/2025\n2. Đến ngày = 10/06/2025\n3. Click Áp dụng",
     "Hệ thống hiển thị lỗi 'Đến ngày phải lớn hơn hoặc bằng Từ ngày'. Không gọi API."),
    ("Nhập Đến ngày bằng Từ ngày (cùng ngày) – hợp lệ",
     "1. Từ ngày = Đến ngày = 10/06/2025\n2. Click Áp dụng",
     "Bộ lọc áp dụng thành công với date_from = date_to = 10/06/2025. Trả dữ liệu trong ngày đó."),
    ("Nhập Đến ngày sai định dạng – datepicker chặn",
     "1. Gõ 'abc' vào ô Đến ngày\n2. Click Áp dụng",
     "Input không nhận ký tự không phải số/slash. Nếu nhập được thì báo lỗi format."),
    ("Nhập Đến ngày hợp lệ sau Từ ngày – áp dụng thành công",
     "1. Từ ngày = 01/06/2025\n2. Đến ngày = 30/06/2025\n3. Click Áp dụng",
     "API nhận đúng params, dashboard render data từ 01/06 đến 30/06."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp, NOTE_FILTER); n += 1

r = grp(ws, r, "NGÀY TÙY CHỈNH – EDGE CASES")
for desc, steps, exp in [
    ("Khoảng ngày khác tháng (25/05 – 10/06) – dữ liệu đúng 2 tháng",
     "1. Từ ngày = 25/05/2025\n2. Đến ngày = 10/06/2025\n3. Áp dụng",
     "API nhận đúng params cross-month. Biểu đồ hiển thị liên tục từ 25/5 đến 10/6, không bị đứt đoạn."),
    ("Khoảng ngày khác năm (01/12/2024 – 31/01/2025) – không lỗi timezone",
     "1. Từ ngày = 01/12/2024\n2. Đến ngày = 31/01/2025\n3. Áp dụng",
     "API nhận đúng params cross-year. Dashboard tính đúng 62 ngày, không bị lệch do timezone."),
    ("Chọn 29/02 năm nhuận 2024 là ngày hợp lệ",
     "1. Từ ngày = 29/02/2024\n2. Đến ngày = 01/03/2024\n3. Áp dụng",
     "Datepicker cho phép chọn 29/02/2024. API gọi thành công với timestamp đúng."),
    ("Cố chọn 29/02 năm không nhuận 2025 – datepicker chặn",
     "1. Chọn tháng 2 năm 2025\n2. Cố click ngày 29",
     "Datepicker không hiển thị ngày 29 ở tháng 2 năm 2025."),
    ("Khoảng ngày quá dài (1 năm) – có thể cảnh báo performance",
     "1. Từ ngày = 01/01/2024\n2. Đến ngày = 31/12/2024\n3. Áp dụng",
     "Hệ thống hoặc chấp nhận và load được, hoặc cảnh báo 'Khoảng thời gian quá dài, có thể chậm'. Không crash."),
    ("Ngày ngoài phạm vi dữ liệu (1 năm trước khi hệ thống có data) – trả empty",
     "1. Chọn ngày trước khi hệ thống có data (ví dụ 01/01/2010)\n2. Áp dụng",
     "API trả data rỗng. Dashboard hiển thị empty state thân thiện, không lỗi."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp, NOTE_FILTER); n += 1

r = grp(ws, r, "NÚT ÁP DỤNG")
for desc, steps, exp in [
    ("Click Áp dụng với filter hợp lệ – API gọi đúng tất cả params",
     "1. Chọn 7 ngày + kênh Zalo + chủ đề 'Tư vấn'\n2. Click Áp dụng\n3. Quan sát Network",
     "API được gọi với đúng query string: date_range=7d&channel=zalo&topic=tu_van. Dashboard cập nhật."),
    ("Click Áp dụng khi thiếu Từ ngày trong Tùy chỉnh – không gọi API",
     "1. Chọn Tùy chỉnh\n2. Bỏ trống Từ ngày\n3. Click Áp dụng",
     "Form validate và hiển thị lỗi. Không gọi API. Dashboard không thay đổi."),
    ("Click Áp dụng nhiều lần liên tiếp – debounce chỉ gọi 1 API cuối",
     "1. Thay đổi filter\n2. Click Áp dụng 3 lần nhanh liên tiếp\n3. Quan sát Network",
     "Chỉ có 1 API request cuối được gửi (debounce hoặc cancel prev). Không có 3 request song song."),
    ("Dữ liệu chart/KPI cập nhật đúng sau khi Áp dụng",
     "1. Ghi lại số liệu hiện tại (30 ngày)\n2. Đổi sang 7 ngày\n3. Áp dụng\n4. So sánh số",
     "KPI cards và biểu đồ hiển thị số liệu mới khác với lần trước. Dữ liệu phù hợp khoảng 7 ngày."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp, NOTE_FILTER); n += 1

r = grp(ws, r, "NÚT ĐẶT LẠI")
for desc, steps, exp in [
    ("Đặt lại sau preset – dropdown về mặc định và dữ liệu reload",
     "1. Chọn '7 ngày qua' và Áp dụng\n2. Click Đặt lại",
     "Dropdown Thời gian về '30 ngày qua' (hoặc mặc định). API gọi với params mặc định."),
    ("Đặt lại sau Tùy chỉnh – ô ngày bị xóa",
     "1. Chọn Tùy chỉnh + nhập ngày + Áp dụng\n2. Click Đặt lại",
     "Ô Từ ngày và Đến ngày bị xóa. Dropdown về preset mặc định."),
    ("Đặt lại xóa tất cả chip filter trên thanh",
     "1. Áp dụng filter: ngày + kênh + chủ đề\n2. Click Đặt lại",
     "Tất cả chip filter biến mất. Bộ lọc trở về mặc định. Dữ liệu reload."),
    ("Đặt lại gọi lại API với params mặc định",
     "1. Áp dụng filter phức tạp\n2. Click Đặt lại\n3. Quan sát Network",
     "API được gọi với params mặc định (không có channel/topic filter hoặc date=30days)."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp, NOTE_FILTER); n += 1

r = grp(ws, r, "DROPDOWN KÊNH")
for desc, steps, exp in [
    ("Chọn 'Tất cả' kênh – hiển thị dữ liệu không lọc kênh",
     "1. Mở dropdown Kênh\n2. Chọn 'Tất cả'\n3. Click Áp dụng",
     "API gọi không có param channel hoặc channel=all. Dashboard tổng hợp mọi kênh."),
    ("Chọn kênh 'Zalo OA' – dữ liệu chỉ thuộc kênh Zalo OA",
     "1. Chọn kênh 'Zalo OA'\n2. Click Áp dụng",
     "API nhận channel=zalo_oa. Dữ liệu chart/bảng chỉ gồm Zalo OA."),
    ("Chọn kênh 'Zalo Business' – lọc đúng kênh",
     "1. Chọn 'Zalo Business'\n2. Click Áp dụng",
     "Dữ liệu hiển thị chỉ của kênh Zalo Business."),
    ("Chọn kênh 'Facebook' – lọc đúng kênh",
     "1. Chọn 'Facebook'\n2. Click Áp dụng",
     "Dữ liệu hiển thị chỉ của kênh Facebook Messenger."),
    ("Chọn kênh 'Chat Widget' – lọc đúng kênh",
     "1. Chọn 'Chat Widget'\n2. Click Áp dụng",
     "Dữ liệu hiển thị chỉ của kênh Chat Widget tích hợp website."),
    ("Kênh không có dữ liệu trong khoảng ngày – hiển thị empty state",
     "1. Chọn kênh chưa có hội thoại\n2. Click Áp dụng",
     "Dashboard hiển thị empty state thân thiện. KPI = 0 hoặc '--'. Không crash."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp, NOTE_FILTER); n += 1

r = grp(ws, r, "DROPDOWN CHỦ ĐỀ")
for desc, steps, exp in [
    ("Mở dropdown Chủ đề – chỉ hiển thị chủ đề đang active",
     "1. Mở dropdown Chủ đề\n2. Quan sát danh sách",
     "Chỉ hiển thị chủ đề active trong DB. Không có chủ đề bị xóa/deactivate."),
    ("Chọn 'Tất cả' chủ đề – không filter theo topic",
     "1. Chọn 'Tất cả' trong dropdown Chủ đề\n2. Click Áp dụng",
     "API gọi không có param topic. Dữ liệu bao gồm mọi chủ đề."),
    ("Chọn 1 chủ đề cụ thể – lọc đúng topic ID",
     "1. Chọn 1 chủ đề cụ thể\n2. Click Áp dụng\n3. Quan sát Network",
     "API nhận đúng topic_id. Dữ liệu chỉ thuộc chủ đề đó."),
    ("Chủ đề không có dữ liệu trong khoảng ngày – empty state",
     "1. Chọn chủ đề không có hội thoại\n2. Click Áp dụng",
     "Dashboard hiển thị empty state. Không hiển thị dữ liệu sai của chủ đề khác."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp, NOTE_FILTER); n += 1

r = grp(ws, r, "CHIP FILTER")
for desc, steps, exp in [
    ("Chip filter hiển thị sau khi áp dụng bộ lọc có kênh và chủ đề",
     "1. Chọn kênh Zalo + chủ đề 'Tư vấn'\n2. Click Áp dụng\n3. Quan sát thanh chip",
     "Chip 'Zalo' và chip 'Tư vấn' xuất hiện trên thanh filter active."),
    ("Xóa chip kênh – dropdown Kênh trở về 'Tất cả'",
     "1. Áp dụng filter kênh\n2. Click X trên chip kênh",
     "Chip kênh biến mất. Dropdown Kênh reset về 'Tất cả'. API gọi lại không có channel filter."),
    ("Xóa chip chủ đề – dropdown Chủ đề trở về 'Tất cả'",
     "1. Áp dụng filter chủ đề\n2. Click X trên chip chủ đề",
     "Chip chủ đề biến mất. Dropdown về 'Tất cả'. Data reload."),
    ("Xóa chip thời gian – filter trở về preset mặc định",
     "1. Áp dụng filter thời gian tùy chỉnh\n2. Click X trên chip thời gian",
     "Chip thời gian biến mất. Dropdown Thời gian về mặc định (30 ngày qua)."),
    ("Chip đồng bộ lại với filter panel khi xóa chip",
     "1. Áp dụng filter\n2. Mở lại panel filter sau khi xóa chip",
     "Panel filter hiển thị đúng trạng thái hiện tại (đã mất điều kiện vừa xóa chip)."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp, NOTE_FILTER); n += 1

r = grp(ws, r, "TỔ HỢP ĐA BỘ LỌC")
for desc, steps, exp in [
    ("Tổ hợp Thời gian + Kênh – API gọi đúng 2 params",
     "1. Chọn 7 ngày qua + kênh Facebook\n2. Click Áp dụng",
     "API nhận date_range=7d&channel=facebook. Data đúng tổ hợp."),
    ("Tổ hợp Thời gian + Chủ đề – API gọi đúng 2 params",
     "1. Chọn 30 ngày + chủ đề 'Kỹ thuật'\n2. Click Áp dụng",
     "API nhận date_range=30d&topic=kt. Data chỉ thuộc topic trong 30 ngày."),
    ("Tổ hợp Kênh + Chủ đề không có Thời gian tùy chỉnh",
     "1. Giữ preset thời gian\n2. Chọn kênh + chủ đề\n3. Áp dụng",
     "API nhận channel + topic + date_range mặc định. Data giao 3 điều kiện."),
    ("Tổ hợp Thời gian + Kênh + Chủ đề (3 filter cùng lúc)",
     "1. Tùy chỉnh ngày + Facebook + topic cụ thể\n2. Áp dụng",
     "API nhận đủ 3 params. Dashboard hiển thị dữ liệu giao của cả 3 điều kiện."),
    ("Tất cả filter mặc định – không filter gì cả",
     "1. Đặt lại toàn bộ filter về mặc định\n2. Áp dụng",
     "API gọi không có params filter đặc biệt. Dashboard hiển thị toàn bộ data mặc định."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp, NOTE_FILTER); n += 1

sheet_info.append(("Bo loc du lieu", n - 1)); total_tc += n - 1

# ══════════════════════════════════════════════════════════════════════════════
#  MODULE 3 – TỔNG QUAN (OVERVIEW)  (target 12+)
# ══════════════════════════════════════════════════════════════════════════════
ws = new_sheet(wb, "Tong quan")
r = 2; n = 1; PFX = "OVERVIEW"

r = grp(ws, r, "KPI CARDS")
for desc, steps, exp in [
    ("KPI tổng hội thoại hiển thị skeleton loading khi đang tải",
     "1. Throttle mạng xuống Slow 3G\n2. Load trang Overview\n3. Quan sát KPI cards",
     "KPI cards hiển thị skeleton/placeholder trong khi API chưa trả về dữ liệu."),
    ("KPI tổng hội thoại hiển thị số đúng định dạng phân cách nghìn",
     "1. Load trang Overview với dữ liệu > 1000\n2. Quan sát giá trị KPI",
     "Số liệu được format ví dụ 1,234 (dấu phẩy) hoặc 1.234 (dấu chấm) theo locale. Không hiển thị 1234 thô."),
    ("KPI % tăng trưởng màu xanh khi tăng dương, đỏ khi âm",
     "1. Load Overview\n2. So sánh kỳ này và kỳ trước\n3. Quan sát badge %",
     "Badge màu xanh + mũi tên lên khi % > 0. Màu đỏ + mũi tên xuống khi % < 0."),
    ("KPI hiển thị 0 hoặc -- khi không có dữ liệu trong filter",
     "1. Chọn khoảng thời gian không có hội thoại\n2. Áp dụng",
     "KPI cards hiển thị 0 hoặc dấu '--'. Không hiển thị NaN hoặc undefined."),
    ("KPI API lỗi 500 – giữ layout và hiển thị toast lỗi",
     "1. Mock API /api/dashboard/kpi trả 500\n2. Load Overview",
     "Toast lỗi xuất hiện. KPI cards hiển thị '--' hoặc trạng thái lỗi. Không crash trang."),
    ("KPI cập nhật đúng khi thay đổi filter",
     "1. Ghi lại KPI với 30 ngày\n2. Đổi filter sang 7 ngày\n3. Áp dụng",
     "KPI cards cập nhật số liệu mới phù hợp khoảng 7 ngày. Khác với giá trị 30 ngày trước đó."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

r = grp(ws, r, "BIỂU ĐỒ TỔNG QUAN")
for desc, steps, exp in [
    ("Biểu đồ xu hướng hiển thị tooltip khi hover vào điểm dữ liệu",
     "1. Load Overview có dữ liệu\n2. Hover chuột vào các điểm trên line chart",
     "Tooltip xuất hiện với: ngày, giá trị tuyệt đối, tên series. Không bị dính cố định."),
    ("Biểu đồ legend hiển thị đúng tên series và màu sắc",
     "1. Load Overview\n2. Quan sát legend bên dưới hoặc bên phải chart",
     "Mỗi series có nhãn rõ ràng và màu sắc tương ứng với đường/cột trên chart."),
    ("Biểu đồ trục X hiển thị đúng khoảng ngày tháng",
     "1. Chọn filter 30 ngày\n2. Quan sát trục X",
     "Trục X hiển thị 30 mốc thời gian theo ngày hoặc tick phù hợp. Không bị overlap nhãn."),
    ("Biểu đồ empty state khi không có dữ liệu",
     "1. Chọn khoảng thời gian không có hội thoại\n2. Áp dụng",
     "Khu vực chart hiển thị icon và text 'Không có dữ liệu' thay vì canvas trắng trống."),
    ("Biểu đồ cập nhật đúng khi đổi filter",
     "1. Xem chart 30 ngày\n2. Đổi sang 7 ngày\n3. Áp dụng",
     "Chart re-render với data 7 ngày. Trục X co lại đúng khoảng mới."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

r = grp(ws, r, "REFRESH DỮ LIỆU")
for desc, steps, exp in [
    ("Click nút Tải lại giữ nguyên filter và gọi API mới",
     "1. Áp dụng filter 7 ngày + kênh\n2. Click Tải lại\n3. Quan sát Network",
     "API gọi lại với cùng params filter. Dữ liệu được lấy mới. Filter không bị reset."),
    ("Timestamp 'Cập nhật lúc' cập nhật sau khi refresh",
     "1. Ghi lại timestamp\n2. Click Tải lại\n3. Quan sát timestamp",
     "Timestamp 'Cập nhật lúc HH:MM' thay đổi sang giờ hiện tại sau khi refresh."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

sheet_info.append(("Tong quan", n - 1)); total_tc += n - 1

# ══════════════════════════════════════════════════════════════════════════════
#  MODULE 4 – PHÂN TÍCH THEO KÊNH  (target 12+)
# ══════════════════════════════════════════════════════════════════════════════
ws = new_sheet(wb, "Phan tich theo kenh")
r = 2; n = 1; PFX = "CHANNEL"

r = grp(ws, r, "BIỂU ĐỒ KÊNH")
for desc, steps, exp in [
    ("Pie chart phân bổ kênh hiển thị tổng % = 100%",
     "1. Load trang Channel Analysis\n2. Quan sát pie chart",
     "Tổng phần trăm các lát cắt bằng 100%. Legend hiển thị đúng tên và màu từng kênh."),
    ("Hover lát cắt Pie chart – tooltip hiển thị tên kênh, số lượng, %",
     "1. Hover chuột vào từng lát cắt\n2. Quan sát tooltip",
     "Tooltip: Tên kênh, Số hội thoại (tuyệt đối), Tỉ lệ %. Tooltip không bị ẩn sau khi bỏ hover."),
    ("Chart hiển thị empty state khi filter trả rỗng",
     "1. Filter không có hội thoại nào\n2. Load Channel Analysis",
     "Chart hiển thị trạng thái 'Chưa có dữ liệu' thay vì chart trắng."),
    ("Chart cập nhật khi đổi filter kênh",
     "1. Xem Chart với tất cả kênh\n2. Đổi filter sang 1 kênh cụ thể",
     "Pie chart còn 1 lát cắt 100% cho kênh đã chọn."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

r = grp(ws, r, "BẢNG CHI TIẾT KÊNH")
for desc, steps, exp in [
    ("Bảng hiển thị đầy đủ cột dữ liệu theo kênh",
     "1. Load Channel Analysis\n2. Quan sát bảng",
     "Bảng có cột: Kênh, Tổng hội thoại, CSAT, Tỉ lệ giải quyết, Thời gian phản hồi TB."),
    ("Sort bảng theo cột số hội thoại tăng/giảm dần",
     "1. Click header 'Tổng hội thoại'\n2. Click lần 2 để đảo chiều",
     "Lần 1: sort tăng dần. Lần 2: sort giảm dần. Icon mũi tên trên header thay đổi."),
    ("Phân trang bảng – click Next load đúng dữ liệu",
     "1. Bảng có > 10 row\n2. Click nút Next\n3. Quan sát row",
     "Trang 2 load row tiếp theo. Không trùng lặp row với trang 1."),
    ("Phân trang bảng – click Prev quay về trang trước",
     "1. Chuyển sang trang 2\n2. Click Prev",
     "Quay về trang 1 với dữ liệu ban đầu."),
    ("Bảng empty state khi không có dữ liệu trong filter",
     "1. Filter kênh không có hội thoại\n2. Load bảng",
     "Bảng hiển thị 'Không có dữ liệu' thay vì cột bị trắng."),
    ("Channel Analysis API 500 – toast lỗi và layout ổn định",
     "1. Mock API /api/analytics/channel trả 500\n2. Load trang",
     "Toast lỗi hiển thị. Bảng và chart hiển thị trạng thái lỗi. Không crash toàn trang."),
    ("Export dữ liệu kênh nếu có nút xuất",
     "1. Load Channel Analysis\n2. Click nút Export (nếu có)\n3. Quan sát file",
     "File CSV/Excel được tải về với đúng dữ liệu theo bộ lọc hiện tại."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

sheet_info.append(("Phan tich theo kenh", n - 1)); total_tc += n - 1

# ══════════════════════════════════════════════════════════════════════════════
#  MODULE 5 – TỪ KHÓA NỔI BẬT  (target 15+)
# ══════════════════════════════════════════════════════════════════════════════
ws = new_sheet(wb, "Tu khoa noi bat")
r = 2; n = 1; PFX = "KEYWORD"

r = grp(ws, r, "WORD CLOUD & BẢNG TẦN SUẤT")
for desc, steps, exp in [
    ("Word cloud hiển thị từ khóa kích thước tỉ lệ thuận với tần suất",
     "1. Load Keyword Analysis\n2. Quan sát word cloud",
     "Từ khóa có count cao nhất có font size lớn nhất rõ rệt. Không có từ nào size đồng đều hoàn toàn."),
    ("Bảng tần suất sort giảm dần theo count mặc định",
     "1. Load Keyword Analysis\n2. Quan sát bảng",
     "Từ khóa có tần suất cao nhất ở đầu bảng. Sort giảm dần là mặc định."),
    ("Sort bảng theo tần suất tăng dần",
     "1. Click header cột 'Tần suất'\n2. Click lần 2",
     "Lần 1: sort giảm dần. Lần 2: sort tăng dần. Từ khóa ít xuất hiện nhất ở đầu."),
    ("Phân trang bảng từ khóa – Next/Prev load đúng",
     "1. Có > 10 từ khóa\n2. Click Next\n3. Click Prev",
     "Phân trang hoạt động đúng, không trùng từ khóa giữa các trang."),
    ("Bảng empty state khi không có từ khóa",
     "1. Filter không có hội thoại\n2. Load trang",
     "Word cloud trống và bảng hiển thị 'Không có từ khóa trong khoảng thời gian này'."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

r = grp(ws, r, "TÌM KIẾM TỪ KHÓA")
for desc, steps, exp in [
    ("Nhập text vào ô search – bảng lọc theo từ khóa chứa text",
     "1. Gõ 'giao hàng' vào ô search\n2. Quan sát bảng",
     "Bảng chỉ hiển thị các từ khóa chứa 'giao hàng'. Debounce ~300ms."),
    ("Tìm kiếm không có kết quả – hiển thị empty state tìm kiếm",
     "1. Gõ chuỗi random không có trong từ khóa",
     "Bảng hiển thị 'Không tìm thấy từ khóa phù hợp'."),
    ("Xóa text search – bảng trở về đầy đủ danh sách",
     "1. Đang tìm kiếm\n2. Xóa toàn bộ text trong ô search",
     "Bảng hiển thị lại đầy đủ list từ khóa."),
    ("Tìm kiếm không case-sensitive",
     "1. Gõ 'GIAO HÀNG' vào ô search",
     "Bảng trả về từ khóa 'giao hàng' (lowercase). Search hoạt động không phân biệt hoa/thường."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

r = grp(ws, r, "CLICK TỪ KHÓA & LỌC")
for desc, steps, exp in [
    ("Click từ khóa trong word cloud – chuyển sang Conversations với filter",
     "1. Click vào từ khóa 'giao hàng' trong word cloud",
     "Navigate sang màn Conversations. Filter từ khóa 'giao hàng' được áp sẵn. List chỉ hiện chat liên quan."),
    ("Click từ khóa trong bảng – filter hội thoại tương tự",
     "1. Click tên từ khóa trong row bảng",
     "Tương tự click cloud, navigate sang Conversations với filter từ khóa."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

r = grp(ws, r, "LỖI API & TIMEOUT")
for desc, steps, exp in [
    ("Keyword Analysis timeout – hiển thị lỗi và không treo trang",
     "1. Mock API keyword với delay > 30 giây\n2. Load trang",
     "Sau timeout, hiển thị 'Truy vấn mất quá nhiều thời gian'. UI không frozen. Có thể thử lại."),
    ("Keyword API 500 – toast lỗi và layout giữ nguyên",
     "1. Mock API trả 500\n2. Load trang",
     "Toast lỗi hiển thị. Word cloud và bảng hiển thị trạng thái lỗi. Không crash trang."),
    ("Keyword Analysis với filter Tất cả kênh không bị lỗi query",
     "1. Để filter kênh = Tất cả\n2. Load Keyword Analysis",
     "API xử lý thành công khi không có filter kênh cụ thể. Không có lỗi SQL/query."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

sheet_info.append(("Tu khoa noi bat", n - 1)); total_tc += n - 1

# ══════════════════════════════════════════════════════════════════════════════
#  MODULE 6 – PHÂN TÍCH CẢM XÚC  (target 15+)
# ══════════════════════════════════════════════════════════════════════════════
ws = new_sheet(wb, "Phan tich cam xuc")
r = 2; n = 1; PFX = "SENTIMENT"

r = grp(ws, r, "SENTIMENT SUMMARY CHART")
for desc, steps, exp in [
    ("Tỉ lệ Tích cực + Tiêu cực + Trung tính cộng bằng 100%",
     "1. Load Sentiment Analysis\n2. Đọc giá trị % từng loại cảm xúc",
     "Tổng 3 giá trị % = 100% (±1% làm tròn). Không hiển thị > 100 hoặc < 99."),
    ("Màu sắc biểu đồ nhất quán với legend",
     "1. Load Sentiment Analysis\n2. Đối chiếu màu chart với legend",
     "Tích cực = xanh, Tiêu cực = đỏ, Trung tính = xám. Nhất quán trên cả chart và legend."),
    ("Chart cập nhật đúng khi thay đổi filter",
     "1. Xem với 30 ngày\n2. Đổi sang 7 ngày\n3. Áp dụng",
     "Tỉ lệ % thay đổi theo dữ liệu 7 ngày. Chart re-render."),
    ("Chart empty state khi không có data sentiment",
     "1. Filter không có hội thoại\n2. Load trang",
     "Hiển thị 'Chưa có dữ liệu phân tích cảm xúc' thay vì chart trắng."),
    ("Sentiment loading state hiển thị skeleton",
     "1. Throttle mạng\n2. Load trang",
     "Skeleton loader hiển thị trong khu vực chart khi API chưa trả về."),
    ("Trend chart hiển thị xu hướng cảm xúc theo thời gian",
     "1. Load Sentiment Analysis\n2. Quan sát trend chart",
     "Chart line/area hiển thị xu hướng 3 loại cảm xúc theo ngày. Trục X là ngày, Y là %."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

r = grp(ws, r, "DANH SÁCH HỘI THOẠI TIÊU CỰC")
for desc, steps, exp in [
    ("Bảng hội thoại tiêu cực hiển thị đủ cột thông tin",
     "1. Load Sentiment Analysis\n2. Scroll xuống xem bảng tiêu cực",
     "Bảng có cột: ID hội thoại, Kênh, Thời gian, Đoạn chat, Điểm sentiment."),
    ("Click vào row – modal chi tiết mở đúng đoạn chat",
     "1. Click vào 1 row hội thoại tiêu cực",
     "Modal/panel mở hiển thị toàn bộ đoạn hội thoại. Đoạn tiêu cực được highlight hoặc scroll to."),
    ("Phân trang bảng hội thoại tiêu cực",
     "1. Bảng có > 10 row\n2. Click Next\n3. Click Prev",
     "Phân trang đúng, không trùng row."),
    ("Export bảng hội thoại tiêu cực nếu có nút Export",
     "1. Click Export (nếu có) trên bảng hội thoại tiêu cực",
     "File CSV/Excel tải về với đúng dữ liệu hội thoại tiêu cực theo filter."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

r = grp(ws, r, "ML SERVICE – FALLBACK")
for desc, steps, exp in [
    ("ML Service down – UI hiển thị thông báo lỗi thân thiện",
     "1. Tắt service ML\n2. Load Sentiment Analysis",
     "Hiển thị toast 'Dịch vụ AI đang tạm gián đoạn'. Chart hiển thị trạng thái lỗi. Không crash trang."),
    ("ML Service khởi động chậm – toast loading 'AI đang khởi động'",
     "1. Restart ML service\n2. Vào ứng dụng ngay lập tức",
     "Toast 'AI đang khởi động model, vui lòng đợi...' hiển thị. Tự dismiss khi model sẵn sàng."),
    ("ML Service kết nối lại – toast success 'AI đã sẵn sàng'",
     "1. Để toast loading đang hiện\n2. Chờ ML model load xong",
     "Toast loading dismiss. Toast success 'AI đã sẵn sàng!' xuất hiện."),
    ("Sentiment accuracy – điểm của câu tích cực > 0.5",
     "1. Gọi API predict với câu 'Dịch vụ tuyệt vời'\n2. Quan sát response",
     "Response trả label=positive với confidence > 0.5. Không bị phân loại sai sang negative."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp, "Cần ML-service thật."); n += 1

sheet_info.append(("Phan tich cam xuc", n - 1)); total_tc += n - 1

# ══════════════════════════════════════════════════════════════════════════════
#  MODULE 7 – AI INSIGHTS  (target 10+)
# ══════════════════════════════════════════════════════════════════════════════
ws = new_sheet(wb, "AI Insights")
r = 2; n = 1; PFX = "AI"

r = grp(ws, r, "AI INSIGHTS PANEL")
for desc, steps, exp in [
    ("Panel AI Insights load và hiển thị nhận xét tự động trong < 10 giây",
     "1. Load trang AI Insights\n2. Đo thời gian render",
     "Panel hiển thị các nhận xét xu hướng do AI sinh trong < 10 giây với network bình thường."),
    ("AI Insights loading state – skeleton trong khi xử lý",
     "1. Load trang với mạng chậm",
     "Skeleton placeholder hiển thị ở khu vực nhận xét. Không hiển thị nội dung rỗng đột ngột."),
    ("Nội dung insight phù hợp với số liệu chart (logic check)",
     "1. Load AI Insights\n2. So sánh câu nhận xét với biểu đồ",
     "Câu 'tăng 20%' phải tương ứng với chart đang tăng 20%. Không có câu insight ngược chiều."),
    ("AI Insights cập nhật khi thay đổi filter",
     "1. Load với 30 ngày\n2. Đổi sang 7 ngày\n3. Áp dụng",
     "Panel tải lại insight mới phù hợp khoảng 7 ngày. Nội dung thay đổi."),
    ("AI Insights empty state khi không đủ dữ liệu",
     "1. Chọn filter 1 ngày với 0 hội thoại\n2. Áp dụng",
     "Panel hiển thị 'Không đủ dữ liệu để tạo phân tích AI.' Không hiển thị insight giả tạo."),
    ("AI Insights API lỗi – toast lỗi và không crash",
     "1. Mock API AI insights trả 500\n2. Load trang",
     "Toast lỗi xuất hiện. Panel hiển thị trạng thái lỗi. Các module khác trên trang không bị ảnh hưởng."),
    ("AI Insights hiển thị đúng ngôn ngữ Tiếng Việt",
     "1. Load AI Insights\n2. Đọc nội dung nhận xét",
     "Tất cả câu nhận xét AI viết đúng tiếng Việt, không có lỗi encoding hoặc ký tự lạ."),
    ("Keyword nổi bật trong AI Insights có thể click để lọc",
     "1. Nếu có từ khóa được highlight trong AI Insights\n2. Click vào từ khóa",
     "Chuyển sang Keyword Analysis hoặc Conversations với filter từ khóa đó."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

sheet_info.append(("AI Insights", n - 1)); total_tc += n - 1

# ══════════════════════════════════════════════════════════════════════════════
#  MODULE 8 – CHART BUILDER  (target 30+)
# ══════════════════════════════════════════════════════════════════════════════
ws = new_sheet(wb, "Chart Builder")
r = 2; n = 1; PFX = "CHART"

r = grp(ws, r, "DATA SOURCE")
for desc, steps, exp in [
    ("Mở Chart Builder – dropdown Data Source hiển thị các nguồn có sẵn",
     "1. Vào Chart Builder\n2. Quan sát dropdown Data Source",
     "Dropdown liệt kê các nguồn dữ liệu: Hội thoại, Sentiment, Kênh, Từ khóa, v.v."),
    ("Chọn Data Source 'Conversations' – field list X/Y đúng schema",
     "1. Chọn Data Source 'Conversations'\n2. Quan sát field list cho X và Y",
     "Field list chứa các field của Conversations: date, channel, topic, rating, v.v."),
    ("Chọn Data Source khác – field list tự động thay thế",
     "1. Chọn Data Source 'Conversations'\n2. Config X/Y axis\n3. Đổi sang Data Source khác",
     "Field X/Y bị reset. Field list mới thuộc schema Data Source mới. Không giữ field cũ không tương thích."),
    ("Data Source trống – không load được field list",
     "1. Nếu Data Source API lỗi\n2. Quan sát field list",
     "Field list hiển thị trạng thái lỗi hoặc trống kèm thông báo. Không crash form."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

r = grp(ws, r, "CHART TYPE")
for desc, steps, exp in [
    ("Chọn Bar chart – form hiển thị field X (category) và Y (metric)",
     "1. Chọn Chart Type = Bar\n2. Quan sát form cấu hình",
     "Hiển thị dropdown cho X axis (category) và Y axis (numeric metric)."),
    ("Chọn Line chart – gợi ý X axis là field Date/Time",
     "1. Chọn Chart Type = Line\n2. Quan sát X axis",
     "X axis dropdown gợi ý hoặc chỉ cho phép field kiểu Date/Time."),
    ("Chọn Pie chart – form chỉ cần 1 dimension và 1 metric",
     "1. Chọn Chart Type = Pie\n2. Quan sát form",
     "Form hiển thị 1 dimension (label) và 1 metric (value). Không có Y axis riêng."),
    ("Đổi Chart Type từ Bar sang Pie khi field đã config – cảnh báo hoặc reset",
     "1. Config đủ field cho Bar\n2. Đổi sang Pie",
     "Hệ thống hiển thị cảnh báo hoặc tự reset field không tương thích với Pie."),
    ("Đổi Chart Type giữ Data Source không thay đổi",
     "1. Chọn Data Source\n2. Đổi qua lại các Chart Type",
     "Data Source không bị reset khi đổi Chart Type."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

r = grp(ws, r, "PREVIEW CHART")
for desc, steps, exp in [
    ("Click Preview khi thiếu X axis – báo lỗi validation",
     "1. Bỏ trống X axis\n2. Click Preview",
     "Lỗi 'X axis là bắt buộc' xuất hiện tại dropdown. Không gọi API preview."),
    ("Click Preview khi thiếu Y axis – báo lỗi validation",
     "1. Config X axis, bỏ trống Y axis\n2. Click Preview",
     "Lỗi 'Y axis là bắt buộc'. Không gọi API preview."),
    ("Click Preview với config đầy đủ – biểu đồ render thành công",
     "1. Config đầy đủ Data Source, Chart Type, X/Y axis\n2. Click Preview",
     "API preview được gọi với config. Biểu đồ render trong khu vực preview đúng với data trả về."),
    ("Preview loading state – skeleton khi đang tải",
     "1. Click Preview\n2. Quan sát khu vực preview trong ms đầu",
     "Khu vực preview hiển thị spinner/skeleton trong khi chờ API."),
    ("Preview API lỗi – thông báo lỗi trong khu vực preview",
     "1. Mock API preview trả 500\n2. Click Preview",
     "Khu vực preview hiển thị 'Không thể tải dữ liệu preview'. Không crash form."),
    ("Thay đổi field sau preview – preview tự reset hoặc gợi ý refresh",
     "1. Preview thành công\n2. Đổi Y axis\n3. Quan sát",
     "Preview bị reset về trạng thái chờ hoặc hiển thị gợi ý 'Nhấn Preview để xem lại'."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

r = grp(ws, r, "LƯU CẤU HÌNH")
for desc, steps, exp in [
    ("Click Save – mở modal nhập tên biểu đồ",
     "1. Config đầy đủ\n2. Click nút Save",
     "Modal xuất hiện với ô nhập tên, nút Lưu và Hủy."),
    ("Nhập tên config hợp lệ và lưu thành công",
     "1. Click Save\n2. Nhập 'Biểu đồ kênh Q1'\n3. Click Lưu",
     "API POST thành công. Modal đóng. Config mới xuất hiện trong danh sách."),
    ("Lưu config với tên bị bỏ trống – validation báo bắt buộc",
     "1. Click Save\n2. Bỏ trống ô tên\n3. Click Lưu",
     "Form báo lỗi 'Tên biểu đồ không được để trống'. Không gọi API."),
    ("Lưu config với tên trùng lặp – xử lý conflict",
     "1. Click Save\n2. Nhập tên đã tồn tại\n3. Click Lưu",
     "Hệ thống báo lỗi 'Tên đã tồn tại' hoặc tự thêm hậu tố (1), (2)."),
    ("Click Hủy trong modal Save – không tạo config",
     "1. Click Save\n2. Nhập tên\n3. Click Hủy",
     "Modal đóng. Không gọi API. Danh sách config không thay đổi."),
    ("Lưu khi chưa preview – cảnh báo hoặc vẫn cho lưu",
     "1. Config đầy đủ nhưng không Click Preview\n2. Click Save",
     "Hệ thống có thể hiển thị cảnh báo 'Bạn chưa preview biểu đồ' hoặc vẫn cho lưu trực tiếp."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

r = grp(ws, r, "QUẢN LÝ DANH SÁCH CONFIG")
for desc, steps, exp in [
    ("Danh sách config hiển thị các biểu đồ đã lưu",
     "1. Load Chart Builder\n2. Quan sát danh sách config",
     "Hiển thị tên các config đã lưu trước đó. Có thể load lại từng config."),
    ("Click vào config cũ – load lại đúng cấu hình",
     "1. Click vào config 'Biểu đồ kênh Q1'",
     "Form điền lại đúng Data Source, Chart Type, X/Y axis của config đó."),
    ("Xóa config – modal xác nhận và xóa thành công",
     "1. Click Xóa trên config\n2. Xác nhận",
     "Config biến mất khỏi danh sách. API DELETE thành công."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

sheet_info.append(("Chart Builder", n - 1)); total_tc += n - 1

# ══════════════════════════════════════════════════════════════════════════════
#  MODULE 9 – THƯ VIỆN PHẢN HỒI  (target 25+)
# ══════════════════════════════════════════════════════════════════════════════
ws = new_sheet(wb, "Thu vien phan hoi")
r = 2; n = 1; PFX = "FEEDBACK"

r = grp(ws, r, "DANH SÁCH & PHÂN TRANG")
for desc, steps, exp in [
    ("Load mặc định bảng phản hồi hiển thị đầy đủ cột",
     "1. Vào trang Thư viện phản hồi\n2. Quan sát bảng",
     "Bảng load với cột: Câu hỏi, Câu trả lời, Kênh, Trạng thái, Người tạo, Ngày tạo."),
    ("Phân trang bảng – click Next load đúng trang 2",
     "1. Bảng có > 10 row\n2. Click Next",
     "Trang 2 hiển thị 10 row tiếp theo. Không trùng với trang 1."),
    ("Phân trang bảng – click Prev quay về trang 1",
     "1. Đang ở trang 2\n2. Click Prev",
     "Trang 1 hiển thị lại đúng 10 row ban đầu."),
    ("Bảng empty state khi chưa có phản hồi",
     "1. Truy cập hệ thống chưa có dữ liệu",
     "Bảng hiển thị icon và text 'Chưa có phản hồi nào'."),
    ("Sort bảng theo cột Ngày tạo",
     "1. Click header 'Ngày tạo'\n2. Click lần 2",
     "Sort tăng/giảm theo ngày. Icon header thay đổi."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

r = grp(ws, r, "TÌM KIẾM & LỌC")
for desc, steps, exp in [
    ("Tìm kiếm theo tiêu đề câu hỏi – bảng filter kết quả",
     "1. Nhập từ khóa vào ô search\n2. Quan sát bảng",
     "Bảng chỉ hiển thị row chứa từ khóa trong cột Câu hỏi hoặc Câu trả lời."),
    ("Tìm kiếm không có kết quả – empty state",
     "1. Nhập chuỗi không tồn tại",
     "Bảng hiển thị 'Không tìm thấy kết quả'."),
    ("Lọc theo trạng thái 'Chờ duyệt'",
     "1. Dùng dropdown lọc Trạng thái = 'Chờ duyệt'\n2. Quan sát bảng",
     "Bảng chỉ hiển thị phản hồi có trạng thái 'Chờ duyệt'."),
    ("Lọc theo trạng thái 'Đã duyệt'",
     "1. Dropdown Trạng thái = 'Đã duyệt'",
     "Bảng chỉ hiển thị phản hồi đã được duyệt."),
    ("Lọc theo kênh – chỉ hiển thị phản hồi của kênh đó",
     "1. Dùng dropdown lọc Kênh = Zalo\n2. Quan sát bảng",
     "Bảng chỉ hiển thị phản hồi thuộc kênh Zalo."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

r = grp(ws, r, "THÊM MỚI PHẢN HỒI")
for desc, steps, exp in [
    ("Click Thêm mới – modal form mở với các trường rỗng",
     "1. Click nút Thêm mới",
     "Modal form mở với ô Câu hỏi, Câu trả lời, Kênh, Chủ đề. Tất cả trống ban đầu."),
    ("Submit form Thêm với đầy đủ thông tin – tạo record thành công",
     "1. Điền Câu hỏi, Câu trả lời, Kênh, Chủ đề\n2. Click Lưu",
     "API POST thành công. Modal đóng. Record mới xuất hiện đầu bảng với trạng thái 'Chờ duyệt'."),
    ("Submit form Thêm với Câu hỏi bị bỏ trống – validation",
     "1. Bỏ trống Câu hỏi\n2. Điền các trường khác\n3. Click Lưu",
     "Form báo lỗi 'Câu hỏi là bắt buộc'. Không gọi API."),
    ("Submit form Thêm với Câu trả lời bị bỏ trống – validation",
     "1. Điền Câu hỏi\n2. Bỏ trống Câu trả lời\n3. Click Lưu",
     "Form báo lỗi 'Câu trả lời là bắt buộc'. Không gọi API."),
    ("Click Hủy trong modal Thêm – không tạo record",
     "1. Mở form Thêm\n2. Điền thông tin\n3. Click Hủy",
     "Modal đóng. Không gọi API. Bảng không thay đổi."),
    ("Submit khi API lỗi 500 – toast lỗi và modal không đóng",
     "1. Mock API POST trả 500\n2. Submit form hợp lệ",
     "Toast lỗi 'Tạo phản hồi thất bại'. Modal giữ nguyên với dữ liệu người dùng đã nhập."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

r = grp(ws, r, "SỬA PHẢN HỒI")
for desc, steps, exp in [
    ("Click Sửa – form mở với dữ liệu cũ đã bind",
     "1. Click icon Sửa trên 1 row",
     "Modal form mở, Câu hỏi và Câu trả lời điền sẵn đúng nội dung record đó."),
    ("Sửa Câu trả lời và lưu – API PUT cập nhật thành công",
     "1. Sửa nội dung Câu trả lời\n2. Click Lưu",
     "API PUT thành công. Modal đóng. Row trong bảng hiển thị nội dung mới."),
    ("Sửa xóa trắng Câu hỏi – validation báo bắt buộc",
     "1. Mở Sửa\n2. Xóa toàn bộ Câu hỏi\n3. Click Lưu",
     "Form báo lỗi 'Câu hỏi là bắt buộc'. Không gọi API."),
    ("Click Hủy trong modal Sửa – dữ liệu gốc không đổi",
     "1. Mở Sửa\n2. Sửa nội dung\n3. Click Hủy",
     "Modal đóng. Record trong bảng giữ nguyên nội dung gốc."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

r = grp(ws, r, "XÓA PHẢN HỒI")
for desc, steps, exp in [
    ("Click Xóa – modal xác nhận xuất hiện với text rõ ràng",
     "1. Click icon Xóa trên 1 row",
     "Modal hiển thị 'Bạn có chắc muốn xóa phản hồi này?' với nút Hủy và Xác nhận."),
    ("Click Hủy trong modal xóa – record không bị xóa",
     "1. Click Xóa\n2. Click Hủy trong modal",
     "Modal đóng. Record vẫn còn trong bảng. Không gọi API DELETE."),
    ("Click Xác nhận xóa – record bị xóa khỏi bảng",
     "1. Click Xóa\n2. Click Xác nhận",
     "API DELETE thành công. Record biến mất. Toast 'Đã xóa thành công'."),
    ("Xóa thất bại do API lỗi – toast lỗi và record giữ nguyên",
     "1. Mock API DELETE trả 500\n2. Xác nhận xóa",
     "Toast 'Xóa thất bại, vui lòng thử lại'. Record vẫn còn trong bảng."),
    ("Staff không thấy hoặc không dùng được nút Xóa",
     "1. Đăng nhập Staff\n2. Quan sát bảng",
     "Nút Xóa bị ẩn hoặc disabled. Gọi API DELETE bị chặn trả 403."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp, "Kiểm tra phân quyền Admin/Staff."); n += 1

r = grp(ws, r, "DUYỆT / TỪ CHỐI PHẢN HỒI")
for desc, steps, exp in [
    ("Admin click Duyệt – trạng thái đổi sang 'Đã duyệt'",
     "1. Đăng nhập Admin\n2. Click Duyệt trên record 'Chờ duyệt'",
     "API cập nhật thành công. Badge trạng thái đổi sang 'Đã duyệt'. Màu badge thay đổi."),
    ("Admin click Từ chối – trạng thái đổi sang 'Từ chối'",
     "1. Đăng nhập Admin\n2. Click Từ chối trên record",
     "API cập nhật. Badge đổi sang 'Từ chối'."),
    ("Staff không được Duyệt – nút ẩn hoặc disabled",
     "1. Đăng nhập Staff\n2. Quan sát cột action trong bảng",
     "Nút Duyệt/Từ chối bị ẩn hoặc disabled với role Staff."),
    ("Manager click Duyệt nếu có quyền",
     "1. Đăng nhập Manager\n2. Click Duyệt",
     "Nếu Manager có quyền duyệt: thành công. Nếu không: nút bị ẩn hoặc API trả 403."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp, "Kiểm tra phân quyền Admin/Manager/Staff."); n += 1

sheet_info.append(("Thu vien phan hoi", n - 1)); total_tc += n - 1

# ══════════════════════════════════════════════════════════════════════════════
#  MODULE 10 – QUẢN LÝ NGƯỜI DÙNG  (target 18+)
# ══════════════════════════════════════════════════════════════════════════════
ws = new_sheet(wb, "Quan ly nguoi dung")
r = 2; n = 1; PFX = "USER"

r = grp(ws, r, "DANH SÁCH NGƯỜI DÙNG")
for desc, steps, exp in [
    ("Admin load bảng Users – hiển thị đầy đủ cột và badge role màu sắc",
     "1. Đăng nhập Admin\n2. Vào menu Users\n3. Quan sát bảng",
     "Bảng hiển thị cột: Email, Họ tên, Role (badge màu), Ngày tạo, Trạng thái."),
    ("Phân trang bảng Users",
     "1. Bảng có > 10 user\n2. Click Next/Prev",
     "Phân trang đúng, không trùng user."),
    ("Sort bảng Users theo Ngày tạo hoặc Họ tên",
     "1. Click header 'Ngày tạo'\n2. Click header 'Họ tên'",
     "Sort tăng/giảm đúng chiều."),
    ("Tìm kiếm user theo email",
     "1. Gõ email vào ô search\n2. Quan sát bảng",
     "Bảng chỉ hiển thị user có email chứa chuỗi tìm kiếm."),
    ("Non-Admin truy cập trang Users bị chặn",
     "1. Đăng nhập Staff\n2. Truy cập menu Users hoặc URL /users",
     "Hệ thống redirect hoặc hiện 403. Không hiển thị danh sách user."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

r = grp(ws, r, "THÊM NGƯỜI DÙNG")
for desc, steps, exp in [
    ("Tạo user mới với đầy đủ thông tin hợp lệ",
     "1. Click Thêm user\n2. Nhập Email, Tên, Mật khẩu, Role\n3. Click Tạo",
     "API POST thành công. User xuất hiện trong bảng với role đúng."),
    ("Tạo user với email đã tồn tại – báo lỗi trùng",
     "1. Nhập email đã có trong hệ thống\n2. Click Tạo",
     "API trả 409 hoặc 400. UI báo 'Email đã được sử dụng'."),
    ("Tạo user với mật khẩu quá yếu – validation từ chối",
     "1. Nhập password '123'\n2. Click Tạo",
     "Form báo lỗi 'Mật khẩu phải có ít nhất 8 ký tự'."),
    ("Tạo user không chọn Role – validation báo bắt buộc",
     "1. Điền Email và Password\n2. Bỏ trống Role\n3. Click Tạo",
     "Form báo 'Vui lòng chọn vai trò'. Không gọi API."),
    ("Click Hủy trong modal tạo user – không tạo user",
     "1. Mở form Thêm\n2. Điền thông tin\n3. Click Hủy",
     "Modal đóng. Không gọi API. Bảng không thay đổi."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

r = grp(ws, r, "SỬA & KHÓA NGƯỜI DÙNG")
for desc, steps, exp in [
    ("Sửa user đổi Role Staff thành Manager – API cập nhật",
     "1. Mở Sửa user Staff\n2. Đổi Role = Manager\n3. Lưu",
     "API PATCH thành công. Badge role đổi sang Manager. User đó login lại thấy menu Manager."),
    ("Sửa user đổi email sang email đã tồn tại – conflict",
     "1. Mở Sửa\n2. Đổi email sang email của user khác\n3. Lưu",
     "API trả 409. UI báo 'Email đã tồn tại'. Không cập nhật."),
    ("Khóa user đang active – user bị kick và không login được",
     "1. Click Khóa trên user active\n2. Xác nhận",
     "Trạng thái = Suspended. User đó login lại thấy 'Tài khoản bị vô hiệu hóa'. Token cũ trả 401."),
    ("Mở khóa user Suspended – user login được bình thường",
     "1. Click Mở khóa trên user Suspended",
     "Trạng thái về Active. User đó login lại thành công."),
    ("Admin không thể tự khóa chính mình",
     "1. Đăng nhập Admin A\n2. Click Khóa trên chính account Admin A",
     "Hệ thống không cho khóa account đang đăng nhập. Hiển thị thông báo lỗi."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp, "Cần backend thật và DB thật."); n += 1

r = grp(ws, r, "PHÂN QUYỀN MENU")
for desc, steps, exp in [
    ("Staff không thấy menu Users và Settings hệ thống trong sidebar",
     "1. Đăng nhập Staff\n2. Quan sát sidebar",
     "Menu 'Quản lý người dùng' và 'Cài đặt hệ thống' không hiển thị hoặc bị ẩn."),
    ("Manager thấy menu báo cáo nâng cao nhưng không thấy Users quản trị",
     "1. Đăng nhập Manager\n2. Quan sát sidebar",
     "Manager có menu báo cáo chi tiết nhưng không có menu tạo/xóa user."),
    ("Admin thấy toàn bộ menu không bị ẩn",
     "1. Đăng nhập Admin\n2. Quan sát sidebar",
     "Sidebar hiển thị tất cả menu: Dashboard, Phân tích, Quản lý, Cài đặt, Users."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

sheet_info.append(("Quan ly nguoi dung", n - 1)); total_tc += n - 1

# ══════════════════════════════════════════════════════════════════════════════
#  MODULE 11 – CÀI ĐẶT & THÔNG TIN CÁ NHÂN  (target 15+)
# ══════════════════════════════════════════════════════════════════════════════
ws = new_sheet(wb, "Cai dat & Ca nhan")
r = 2; n = 1; PFX = "SETTINGS"

r = grp(ws, r, "THÔNG TIN CÁ NHÂN (PROFILE)")
for desc, steps, exp in [
    ("Load trang Profile – hiển thị đúng thông tin user hiện tại",
     "1. Vào Profile\n2. Quan sát thông tin",
     "Họ tên, Email, SĐT, Avatar hiển thị đúng tài khoản đang đăng nhập."),
    ("Sửa Họ tên hợp lệ và lưu thành công",
     "1. Sửa Họ tên\n2. Click Lưu",
     "API PATCH thành công. Toast xanh. Header hiển thị tên mới."),
    ("Sửa Email sang định dạng sai – validation báo lỗi",
     "1. Nhập email 'abc.com'\n2. Click Lưu",
     "Form báo 'Email không đúng định dạng'. Không gọi API."),
    ("Sửa SĐT chứa ký tự chữ – validation báo lỗi",
     "1. Nhập SĐT 'abc123xyz'\n2. Click Lưu",
     "Form báo 'Số điện thoại không hợp lệ'. Không gọi API."),
    ("Sửa SĐT hợp lệ 10 chữ số – lưu thành công",
     "1. Nhập SĐT '0912345678'\n2. Click Lưu",
     "API PATCH thành công. Toast xanh. SĐT mới hiển thị trên Profile."),
    ("API lỗi khi lưu Profile – toast lỗi và form giữ nguyên",
     "1. Mock API PATCH trả 500\n2. Click Lưu",
     "Toast lỗi 'Cập nhật thất bại'. Form giữ nguyên dữ liệu người dùng đã nhập."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

r = grp(ws, r, "UPLOAD AVATAR")
for desc, steps, exp in [
    ("Upload avatar PNG hợp lệ < 2MB thành công",
     "1. Click đổi avatar\n2. Chọn file PNG 500KB\n3. Lưu",
     "Avatar mới hiển thị trên Profile và Header."),
    ("Upload file ảnh > giới hạn kích thước – client báo lỗi",
     "1. Chọn file ảnh 20MB",
     "Client báo lỗi 'File quá lớn, tối đa X MB' trước khi upload. Không gọi API."),
    ("Upload file không phải ảnh (.pdf, .exe) – báo lỗi định dạng",
     "1. Chọn file .exe\n2. Quan sát",
     "Client hoặc server báo 'Chỉ chấp nhận JPG/PNG/WEBP'."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

r = grp(ws, r, "ĐỔI MẬT KHẨU")
for desc, steps, exp in [
    ("Đổi mật khẩu thành công với đầy đủ thông tin",
     "1. Vào Đổi mật khẩu\n2. Nhập pass cũ đúng\n3. Nhập pass mới + xác nhận khớp\n4. Click Đổi",
     "API thành công. Toast xanh. Đăng nhập lại với mật khẩu mới thành công."),
    ("Nhập mật khẩu cũ sai – báo lỗi xác thực",
     "1. Nhập pass cũ sai\n2. Click Đổi",
     "API hoặc UI báo 'Mật khẩu cũ không đúng'."),
    ("Nhập xác nhận mật khẩu không khớp – validation báo lỗi",
     "1. Pass mới = 'Abc@1234'\n2. Xác nhận = 'Abc@5678'\n3. Click Đổi",
     "Form báo 'Mật khẩu xác nhận không khớp'. Không gọi API."),
    ("Mật khẩu mới quá ngắn – validation từ chối",
     "1. Nhập pass mới '123'\n2. Click Đổi",
     "Form báo 'Mật khẩu phải có ít nhất 8 ký tự'."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

r = grp(ws, r, "SETTINGS HỆ THỐNG")
for desc, steps, exp in [
    ("Admin thay đổi cấu hình hệ thống và lưu thành công",
     "1. Đăng nhập Admin\n2. Vào Settings hệ thống\n3. Thay đổi config\n4. Lưu",
     "API cập nhật thành công. Toast xanh. Config mới hiển thị khi vào lại Settings."),
    ("Non-Admin truy cập Settings hệ thống bị chặn",
     "1. Đăng nhập Staff\n2. Truy cập /settings hệ thống",
     "Redirect hoặc 403. Không hiển thị form cài đặt."),
    ("Settings form validation – trường bắt buộc",
     "1. Xóa trắng trường bắt buộc trong Settings\n2. Click Lưu",
     "Form báo lỗi trường bắt buộc. Không gọi API."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp, "Cần kiểm tra quyền Admin."); n += 1

sheet_info.append(("Cai dat & Ca nhan", n - 1)); total_tc += n - 1

# ══════════════════════════════════════════════════════════════════════════════
#  MODULE 12 – XUẤT DỮ LIỆU  (target 12+)
# ══════════════════════════════════════════════════════════════════════════════
ws = new_sheet(wb, "Xuat du lieu")
r = 2; n = 1; PFX = "EXPORT"

r = grp(ws, r, "EXPORT CSV")
for desc, steps, exp in [
    ("Export CSV thành công – file .csv tải về mở được",
     "1. Áp dụng filter\n2. Click Export CSV\n3. Mở file",
     "File .csv tải về, mở được bằng Excel/Notepad. Có dòng header cột."),
    ("Export CSV giữ đúng tiếng Việt UTF-8 BOM",
     "1. Export CSV với dữ liệu có tiếng Việt\n2. Mở bằng Excel",
     "Tiếng Việt hiển thị đúng, không bị ký tự lạ. Encoding UTF-8 BOM được thiết lập."),
    ("Export CSV đúng dữ liệu theo filter hiện tại",
     "1. Filter kênh Zalo + 7 ngày\n2. Export CSV\n3. Kiểm tra nội dung",
     "File chỉ chứa dữ liệu kênh Zalo trong 7 ngày. Không có dữ liệu ngoài filter."),
    ("Export CSV khi bảng rỗng – file có header nhưng không có data row",
     "1. Filter không có dữ liệu\n2. Export CSV",
     "File CSV tải về với dòng header đầy đủ. Không có dòng data."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

r = grp(ws, r, "EXPORT EXCEL (XLSX)")
for desc, steps, exp in [
    ("Export XLSX thành công – file mở được bằng Excel",
     "1. Click Export XLSX\n2. Mở file",
     "File .xlsx mở bình thường. Sheet chính hiển thị đúng dữ liệu."),
    ("Export XLSX không bị dính dữ liệu giữa các cột",
     "1. Export XLSX\n2. Quan sát cấu trúc cột",
     "Mỗi cột chứa đúng dữ liệu tương ứng. Không bị tràn hoặc merge sai."),
    ("Export XLSX giữ đúng dữ liệu theo filter",
     "1. Filter cụ thể\n2. Export XLSX\n3. Kiểm tra nội dung file",
     "Số liệu và danh sách trong file khớp với dữ liệu trên bảng sau khi filter."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

r = grp(ws, r, "LỖI & EDGE CASE")
for desc, steps, exp in [
    ("API Export trả 500 – toast lỗi và không tải file",
     "1. Mock API export trả 500\n2. Click Export",
     "Toast 'Xuất dữ liệu thất bại'. Không có file nào tải xuống."),
    ("Export file lớn – loading indicator hiển thị",
     "1. Filter khoảng thời gian dài nhiều data\n2. Export",
     "Nút Export hiển thị spinner/loading trong khi tạo file. Không bị treo UI."),
    ("Tên file export chứa ngày tháng hoặc module để dễ nhận biết",
     "1. Export CSV hoặc XLSX\n2. Quan sát tên file tải về",
     "Tên file có dạng: FLIC_Export_20250610.csv hoặc tương tự."),
    ("Export không yêu cầu quyền đặc biệt – tất cả role có thể xuất",
     "1. Đăng nhập Staff\n2. Click Export trên bảng",
     "Staff export được dữ liệu mà mình có quyền xem. Không bị 403."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

sheet_info.append(("Xuat du lieu", n - 1)); total_tc += n - 1

# ══════════════════════════════════════════════════════════════════════════════
#  MODULE 13 – LỊCH SỬ HOẠT ĐỘNG  (target 8+)
# ══════════════════════════════════════════════════════════════════════════════
ws = new_sheet(wb, "Lich su hoat dong")
r = 2; n = 1; PFX = "ACTIVITY"

r = grp(ws, r, "AUDIT LOG – HIỂN THỊ & CHÍNH XÁC")
for desc, steps, exp in [
    ("Bảng Audit Log hiển thị đủ cột: Ai, Hành động, Đối tượng, Thời gian",
     "1. Vào Lịch sử hoạt động\n2. Quan sát bảng",
     "Bảng có cột: Người thực hiện, Hành động (Thêm/Sửa/Xóa), Đối tượng, Timestamp."),
    ("Log ghi nhận đúng action Thêm phản hồi",
     "1. Thêm phản hồi mới\n2. Vào Lịch sử\n3. Kiểm tra đầu bảng",
     "Log có entry: Ai thực hiện, 'Thêm phản hồi [tên]', timestamp gần đúng."),
    ("Log ghi nhận đúng action Sửa user",
     "1. Admin sửa role user\n2. Vào Lịch sử",
     "Log có entry: Admin, 'Sửa user [email]', timestamp."),
    ("Bảng sort mặc định theo thời gian giảm dần",
     "1. Load Lịch sử\n2. Quan sát thứ tự row",
     "Log mới nhất ở đầu bảng. Timestamp giảm dần."),
    ("Phân trang bảng Audit Log – chuyển trang đúng thứ tự",
     "1. Click Next trang",
     "Trang 2 hiển thị log cũ hơn trang 1. Không trùng lặp."),
    ("Lọc log theo loại hành động (Thêm/Sửa/Xóa)",
     "1. Dùng dropdown lọc 'Hành động'\n2. Chọn 'Xóa'",
     "Bảng chỉ hiển thị các log có hành động Xóa."),
    ("Staff không truy cập được Lịch sử nếu không có quyền",
     "1. Đăng nhập Staff\n2. Truy cập Lịch sử hoạt động",
     "Hệ thống ẩn menu hoặc redirect 403. Không hiển thị log."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp, "Cần backend và DB thật."); n += 1

sheet_info.append(("Lich su hoat dong", n - 1)); total_tc += n - 1

# ══════════════════════════════════════════════════════════════════════════════
#  MODULE 14 – BACKEND API & ML SERVICE  (target 25+)
# ══════════════════════════════════════════════════════════════════════════════
ws = new_sheet(wb, "Backend API & ML")
r = 2; n = 1; PFX = "API"

r = grp(ws, r, "HEALTH CHECK")
for desc, steps, exp in [
    ("GET /api/health trả 200 khi tất cả service bình thường",
     "1. Đảm bảo backend, DB, Redis, ML chạy\n2. Gọi GET /api/health",
     "Response 200 với JSON chứa status từng service: db=connected, ml=connected."),
    ("GET /api/health không trả false green khi DB tắt",
     "1. Tắt SQL Server connection\n2. Gọi GET /api/health",
     "Response trả error hoặc 503 cho DB status. Không trả 200 OK khi DB thực sự down."),
    ("GET /api/health/ml trả đúng trạng thái ML",
     "1. ML đang chạy: gọi /api/health/ml\n2. Tắt ML: gọi lại",
     "Khi ML chạy: mlService=connected, modelLoaded=true. Khi tắt: disconnected."),
    ("GET /api/health response có field chi tiết (details.ml.modelLoaded)",
     "1. Gọi /api/health\n2. Đọc response body",
     "Response body có field details.ml.modelLoaded=true/false phục vụ polling toast AI."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

r = grp(ws, r, "AUTH API")
for desc, steps, exp in [
    ("POST /api/auth/login credentials đúng – trả JWT token",
     "1. POST /api/auth/login {email, password đúng}",
     "Response 200 với access_token trong body. Token valid JWT format."),
    ("POST /api/auth/login credentials sai – trả 401",
     "1. POST /api/auth/login {email đúng, password sai}",
     "Response 401 Unauthorized với message lỗi rõ ràng."),
    ("Gọi API protected không có Authorization header – trả 401",
     "1. Gọi GET /api/dashboard/kpi không có header Authorization",
     "Response 401. Không trả 200 hay 500."),
    ("Gọi API protected với token hết hạn – trả 401",
     "1. Gọi API với Bearer token expired",
     "Response 401 với message 'Token expired'. Frontend redirect về Login."),
    ("Gọi API protected với token giả mạo – trả 401",
     "1. Gọi API với Bearer 'fake.token.here'",
     "Response 401. Không trả 200 hay 500 Server Error."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

r = grp(ws, r, "DASHBOARD & ANALYTICS API")
for desc, steps, exp in [
    ("GET /api/dashboard/kpi trả đúng cấu trúc data",
     "1. Gọi GET /api/dashboard/kpi với token hợp lệ và date params",
     "Response 200 với JSON chứa các field KPI: totalConversations, csat, resolutionRate."),
    ("GET /api/analytics/sentiment-summary trả tỉ lệ cảm xúc",
     "1. Gọi GET /api/analytics/sentiment-summary với date filter",
     "Response 200 với positive%, negative%, neutral%. Tổng = 100%."),
    ("GET /api/analytics/sentiment-trend trả dữ liệu theo ngày",
     "1. Gọi GET /api/analytics/sentiment-trend",
     "Response 200 với array ngày và % tương ứng. Định dạng datetime đúng."),
    ("GET /api/conversations trả danh sách hội thoại phân trang",
     "1. Gọi GET /api/conversations?page=1&limit=10",
     "Response 200 với array 10 conversations, total, page info."),
    ("GET /api/conversations/{id} trả chi tiết 1 hội thoại",
     "1. Gọi GET /api/conversations/123",
     "Response 200 với full conversation object gồm messages array."),
    ("GET /api/conversations/{id} với ID không tồn tại – trả 404",
     "1. Gọi GET /api/conversations/999999",
     "Response 404 Not Found. Message rõ ràng."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

r = grp(ws, r, "VALIDATION & ERROR HANDLING")
for desc, steps, exp in [
    ("POST API với body rỗng – FastAPI trả 422 Unprocessable Entity",
     "1. POST /api/analytics/run với body = {}\n2. Quan sát response",
     "Response 422 với detail array liệt kê field nào bị thiếu."),
    ("GET API với query param sai kiểu – trả 422",
     "1. GET /api/conversations?limit='abc'",
     "Response 422 với detail 'limit must be integer'."),
    ("API 500 Server Error – không lộ stack trace ra response",
     "1. Mock DB lỗi\n2. Gọi API data\n3. Kiểm tra response body",
     "Response 500 với message chung chung. Không có SQL error, file path, hoặc stack trace."),
    ("API CORS – chỉ cho phép origin đã cấu hình",
     "1. Gọi API từ origin không được phép",
     "Response 403 hoặc CORS error. Không trả data cho origin không hợp lệ."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp); n += 1

r = grp(ws, r, "ML SERVICE API")
for desc, steps, exp in [
    ("GET /health (ML) trả status khi đang chạy",
     "1. Gọi GET http://ml-service:8001/health",
     "Response 200 với status=ok, modelLoaded=true."),
    ("POST /predict câu tích cực – trả label positive",
     "1. POST /predict {text: 'Dịch vụ rất tốt'}",
     "Response 200 với label=positive, confidence > 0.5."),
    ("POST /predict câu tiêu cực – trả label negative",
     "1. POST /predict {text: 'Chất lượng quá tệ'}",
     "Response 200 với label=negative, confidence > 0.5."),
    ("POST /predict với text rỗng – trả 422 validation",
     "1. POST /predict {text: ''}",
     "Response 422 với detail 'text is required and cannot be empty'."),
    ("POST /predict-ensemble – kết quả ensemble từ nhiều model",
     "1. POST /predict-ensemble {text: 'Sản phẩm ổn'}",
     "Response 200 với kết quả ensemble label, confidence, và breakdown từng model."),
    ("ML Service timeout – backend xử lý graceful fallback",
     "1. Gọi predict với text rất dài gây timeout",
     "Response 504 hoặc 408 sau khoảng timeout config. Không treo vô hạn."),
]:
    r = tc(ws, r, f"{PFX}-TC-{n:02d}", desc, steps, exp, "Cần ML service thật."); n += 1

sheet_info.append(("Backend API & ML", n - 1)); total_tc += n - 1

# ══════════════════════════════════════════════════════════════════════════════
#  SHEET SUMMARY (index=0)
# ══════════════════════════════════════════════════════════════════════════════
ws_sum = wb.create_sheet(title="Summary", index=0)
ws_sum.column_dimensions["A"].width = 42
ws_sum.column_dimensions["B"].width = 72

HDR2_FILL = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
SEC_FILL  = PatternFill(start_color="D6E4F0", end_color="D6E4F0", fill_type="solid")

def shdr(ws, row, txt):
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=2)
    c = ws.cell(row, 1, txt)
    c.fill = HDR2_FILL; c.font = Font(color="FFFFFF", bold=True, size=11)
    c.alignment = Alignment(horizontal="center", vertical="center")
    c.border = BDR; ws.row_dimensions[row].height = 22
    return row + 1

def srow(ws, row, k, v, bk=False):
    c1 = ws.cell(row, 1, k); c1.font = Font(bold=bk, size=10)
    c1.border = BDR; c1.alignment = C_LEFT
    c2 = ws.cell(row, 2, str(v)); c2.font = Font(size=10)
    c2.border = BDR; c2.alignment = C_LEFT
    ws.row_dimensions[row].height = 18
    return row + 1

sr = 1
sr = shdr(ws_sum, sr, "FLIC TEST CASES – SUMMARY")
sr = srow(ws_sum, sr, "Tổng số module/sheet", len(sheet_info), True)
sr = srow(ws_sum, sr, "Tổng số test case", total_tc, True)
sr = srow(ws_sum, sr, "Thời gian tạo", "2026-07-10")
sr = srow(ws_sum, sr, "Nguồn dữ liệu", "FLIC_Test_Plan.xlsx + FLIC_Tester_SKILL_TestPlan_Ready.md + source code")
sr += 1

sr = shdr(ws_sum, sr, "DANH SÁCH SHEET MODULE")
for sname, cnt in sheet_info:
    sr = srow(ws_sum, sr, sname, f"{cnt} test case(s)")
sr += 1

sr = shdr(ws_sum, sr, "PHÂN TÍCH RỦI RO & PHỤ THUỘC")
risks = [
    ("Module rủi ro cao nhất",      "Chart Builder, Bộ lọc dữ liệu, Phân tích cảm xúc, Xác thực & RBAC"),
    ("Module cần backend thật",     "Tổng quan, Phân tích kênh, Chart Builder, Xuất dữ liệu, Backend API"),
    ("Module cần DB thật",          "Thư viện phản hồi (CRUD), Lịch sử hoạt động, Quản lý người dùng"),
    ("Module cần ML-service thật",  "Phân tích cảm xúc, AI Insights, Từ khóa nổi bật, Backend API & ML"),
    ("Module cần kiểm tra RBAC",    "Quản lý người dùng, Thư viện phản hồi (Duyệt/Xóa), Cài đặt, Lịch sử"),
]
for k, v in risks:
    sr = srow(ws_sum, sr, k, v)
sr += 1

sr = shdr(ws_sum, sr, "GHI CHÚ")
notes = [
    ("Skill file",        "Đã đọc và áp dụng: FLIC_Tester_SKILL_TestPlan_Ready.md"),
    ("Test Plan nguồn",   "Đã đọc FLIC_Test_Plan.xlsx (63 task, 14 module)"),
    ("Module bị loại",    "archive/ và backend_legacy_node/ – không test vì không dùng trong hệ thống chính"),
    ("Legacy/Archive",    "Nếu cần test legacy, phải yêu cầu rõ và tạo sheet riêng"),
    ("Kết quả thực tế",   "Để trống – chỉ tạo test case, chưa thực hiện test"),
    ("Trạng thái",        "Not Run – tất cả test case chưa chạy"),
    ("Minh chứng",        "Để trống – sẽ điền khi thực hiện test (screenshot/video/log)"),
]
for k, v in notes:
    sr = srow(ws_sum, sr, k, v)

ws_sum.freeze_panes = "A2"

wb.save("FLIC_Test_Cases_By_Module.xlsx")
print(f"Done! Total module sheets: {len(sheet_info)}, Total TCs: {total_tc}")
for sn, cnt in sheet_info:
    print(f"  {sn}: {cnt}")
