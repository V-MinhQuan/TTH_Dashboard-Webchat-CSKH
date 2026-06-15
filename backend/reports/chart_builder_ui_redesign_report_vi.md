# Báo cáo redesign giao diện Chart Builder

## A. Tóm tắt thay đổi

- Chuyển Chart Builder từ bố cục hai cột sang bố cục ba cột:
  - Trường dữ liệu bên trái: 325px.
  - Workspace và preview ở giữa.
  - Cài đặt biểu đồ bên phải: 320px.
- Trường dữ liệu được nhóm động từ metadata của `GET /api/chart-builder/sources`.
- Thêm kéo thả và click-to-select cho dimension/metric.
- Thêm toolbar, tiêu đề sửa trực tiếp, drop zone, theme, switch grid/tooltip và responsive drawer.
- Giữ nguyên API service, debounce 500ms, save/load/delete config, export PNG/PDF và dữ liệu SQL Server thật.
- Không thêm mock data, không sửa backend/API contract, không sửa SQL Server.

## B. Kết quả frontend

| File/Component | Thay đổi | Trạng thái | Ghi chú |
|---|---|---|---|
| `ChartBuilder.tsx` | Nối state/API hiện hữu vào layout ba cột, toolbar, drawer và drop zone | Đạt | Không gọi API trực tiếp, vẫn qua service |
| `ChartBuilder.css` | Style FLIC, panel scroll độc lập, preview card 22px, responsive dưới 1280px | Đạt | Không có overflow ngang ở viewport 1180px |
| `DataFieldsPanel.tsx` | Nhóm field động, accordion, drag/drop, click-to-select | Đạt | Không hard-code dữ liệu biểu đồ |
| `ChartToolbar.tsx` | Back, title, reset, save, panel toggles | Đạt | Save mở modal hiện hữu |
| `DropZoneBar.tsx` | Dimension, metrics, legend và filter chips | Đạt | Payload drag được validate trước khi dùng |
| `ChartSettingsPanel.tsx` | Chart type, X-axis, values, theme, switches và filter | Đạt | Dùng metadata source đang chọn |
| `SeriesSettings.tsx` | Multi-metric, màu và xóa series | Đạt | Không thay đổi `YAxisConfig` backend |
| `ToggleSetting.tsx` | Switch FLIC orange | Đạt | Legend, labels, grid, tooltip |
| `ChartPreview.tsx` | Grid/tooltip tùy chọn, palette, card responsive | Đạt | Giữ loading/error/empty state |
| `ChartTypeSelector.tsx` | Grid ba cột, trạng thái selected/disabled | Đạt có cảnh báo | Bốn loại chưa có API được vô hiệu hóa |
| `DataSourceSelector.tsx` | Giao diện nguồn dữ liệu và cảnh báo unavailable | Đạt | `agent_performance` hiển thị rõ lý do |
| `SavedConfigsList.tsx` | Style compact trong panel trái | Đạt | Giữ apply/delete handler |
| `chartBuilder.ts` | Bổ sung display-only state cho theme/grid/tooltip | Đạt | Không thay `ChartConfigPayload` gửi backend |

## C. Kết quả API và dữ liệu thật

| Endpoint | Kiểm tra | Kết quả | Ghi chú |
|---|---|---|---|
| `GET /api/chart-builder/sources` | Gọi backend port 5000 | Đạt | 6 source available, `agent_performance` unavailable |
| `POST /api/chart-builder/data` | `conversation_volume`, group `channel`, metric `total_conversations` | Đạt | Trả dữ liệu SQL thật |
| `GET /api/chart-builder/configs` | Đọc cấu hình hiện có | Đạt | Database hiện trả 0 cấu hình |
| `POST /api/chart-builder/configs` | Không submit | Chưa chạy | Tránh thay đổi SQL Server theo yêu cầu |
| `DELETE /api/chart-builder/configs/{id}` | Không gọi | Chưa chạy | Không có config hiện hữu và không thay đổi DB |

Dữ liệu xác minh:

| Kênh | Tổng hội thoại |
|---|---:|
| ChatWidget | 45 |
| Facebook | 1146 |
| Unknown | 1 |
| ZaloBusiness | 1858 |
| ZaloOA | 408 |

## D. Kiểm thử giao diện

| Test case | Kết quả | Ghi chú |
|---|---|---|
| `npm run build` | Pass | 2577 modules transformed, không lỗi TypeScript |
| Desktop 1720x1000 | Pass | Đủ ba cột, panel scroll độc lập |
| Compact 1180x900 | Pass | Settings drawer hoạt động, không overflow ngang |
| Drag `Kênh` vào X-axis | Pass | Drop zone cập nhật thành `Kênh` |
| Drag metric vào Values | Pass | Metric được giữ và render từ API |
| Bar/Line/Area/Donut/Pie/Stacked Bar | Pass | Tất cả tạo Recharts marks, không data error |
| Theme | Pass | FLIC/Navy palette cập nhật màu series |
| Legend/data labels/grid/tooltip | Pass | Bốn switch cập nhật state và preview |
| Reset | Pass | Trở về source đầu tiên, bar chart, `Biểu đồ mới` |
| Save modal | Pass | Modal mở đúng; không submit để tránh ghi DB |
| PNG export | Pass | Tạo file PNG 23,571 bytes |
| PDF export | Pass | Tạo file PDF 19,289 bytes |
| Runtime error | Pass | Không crash UI, lượt tương tác cuối không ghi nhận exception/log error |
| API 404/500 | Pass | Không có lỗi 404/500 từ Chart Builder API |

## E. Cảnh báo và giới hạn

1. Checkout hiện tại không có contract cho `horizontal_bar`, `scatter`, `combo`, `radar`, dual Y-axis, `axisGroup` hoặc `seriesType`. Các tile chưa hỗ trợ được hiển thị disabled thay vì tạo dữ liệu/hành vi giả.
2. `agent_performance` được backend trả về với `available=false` vì chưa xác minh được bảng/cột SQL Server.
3. Database trả 0 saved config, nên chưa thể kiểm thử tải một cấu hình cũ thực tế.
4. Không chạy POST save hoặc DELETE config vì yêu cầu không thay đổi dữ liệu SQL Server.
5. Theme, grid và tooltip là display-only state; backend config hiện không có field để lưu các giá trị này.
6. Không chạy FastAPI tests vì không có API contract hoặc backend code nào bị thay đổi trong lượt redesign.

## F. Kết luận

Giao diện mới đã dùng dữ liệu thật, giữ nguyên luồng FastAPI/SQL Server và đạt kiểm thử build, responsive, chart rendering, drag/drop, reset, modal và export.

**Trạng thái: `CHART_BUILDER_UI_REDESIGN_PASSED_WITH_WARNINGS`**

