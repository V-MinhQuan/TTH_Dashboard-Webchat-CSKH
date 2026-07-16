# PRODUCT TESTABILITY CHANGES

## Thay đổi đã thực hiện

**Không có thay đổi nào vào source sản phẩm trong giai đoạn tài liệu/cấu hình này.** Không `data-testid`, `id`, accessibility attribute, route, API hoặc business logic nào được thêm/sửa bởi bộ automation.

Mọi thay đổi sau này phải được ghi theo bảng:

| Ngày | File sản phẩm | Thành phần | Thay đổi | Lý do | Ảnh hưởng UI/business | TC liên quan |
|---|---|---|---|---|---|---|
| — | — | — | Chưa có | — | — | — |

## Đề xuất chưa áp dụng

Các đề xuất này chỉ nhằm tạo selector ổn định hoặc controlled test seam; chưa được phép tự động áp dụng.

### Selector UI

- Login: username, password, submit, loading, error.
- Sidebar/Header: active screen, avatar menu, logout, activity history.
- Global Filter: preset, from/to date, channel, topic, apply/reset, chips.
- KPI/chart: card value, loading/empty/error, chart container, legend.
- Chart Builder: data source, chart type, axes, preview, save/load/delete dialog.
- Feedback/User/Settings: table row keyed theo record ID, form field, validation, confirm dialog.
- Download action: format và trạng thái đang tạo file.

Tên gợi ý nên mang nghiệp vụ, ví dụ `data-testid="login-username"`, `global-filter-apply`, `chart-preview`, không dùng thứ tự DOM hoặc màu sắc.

### Accessibility

- Bổ sung `aria-label` cho icon-only button.
- Liên kết validation message bằng `aria-describedby`.
- Dialog có accessible name và focus trap ổn định.
- Chart có text summary hoặc data table tương đương để automation và screen reader đọc được dữ liệu có nghĩa.

### API/test environment

- Endpoint/fixture public dành cho tạo và cleanup record có prefix `AUTO_`.
- Config test-only để trỏ dependency tới stub server, không nhúng nhánh lỗi vào production logic.
- Correlation ID trong response/log để nối UI failure với backend evidence.
- Health response chỉ rõ điều kiện nào khiến readiness fail.
- Export trả `Content-Disposition`, content type và schema/header ổn định.

## Ràng buộc

- Không đổi Expected Result trong Excel để làm test pass.
- Không thêm feature prototype chỉ vì workbook có TC cũ.
- Không expose secret/test backdoor.
- Test hook phải tắt mặc định và chỉ có trong môi trường kiểm thử được kiểm soát.
