# Kế hoạch redesign giao diện Chart Builder

## 1. Phạm vi

- Chỉ thay đổi lớp trình bày và trải nghiệm người dùng của Chart Builder.
- Giữ nguyên FastAPI, SQL Server, API service, normalizer, lưu/xóa cấu hình và xuất PNG/PDF.
- Không sửa `legacy.py`, ML service, migration hoặc dữ liệu SQL Server.
- Không thêm mock data hoặc fallback sang Node.js.

## 2. Kết quả kiểm tra trước khi triển khai

| Khu vực | Kết quả xác minh |
|---|---|
| Màn hình chính | `src/app/components/screens/ChartBuilder.tsx` đang dùng bố cục hai cột, cấu hình nằm trong panel trái. |
| Dữ liệu | Preview gọi `POST /api/chart-builder/data` qua `chartBuilderService.ts`; không còn dùng mock data. |
| Nguồn dữ liệu | Metadata dimension/metric lấy từ `GET /api/chart-builder/sources`. |
| Cấu hình đã lưu | Có luồng lấy, lưu và soft-delete cấu hình qua SQL Server. |
| Export | Có tiện ích xuất PNG/PDF bằng `html2canvas` và `jspdf`. |
| Chart type thực tế | Frontend và backend cùng hỗ trợ `line`, `bar`, `stacked_bar`, `pie`, `donut`, `area`. |
| Contract chưa tồn tại | Không có `horizontal_bar`, `scatter`, `combo`, `radar`, dual Y-axis, `axisGroup` hoặc `seriesType` trong type frontend, schema backend, lịch sử Git và `archive.zip`. |
| Agent performance | Source được discovery nhưng backend đánh dấu `available=false` do chưa xác minh được bảng/cột dữ liệu. |

## 3. Thiết kế triển khai

1. Tạo bố cục ba cột:
   - Panel trường dữ liệu: 325px.
   - Workspace: `minmax(0, 1fr)`.
   - Panel cài đặt: 320px.
2. Tạo panel trường dữ liệu từ metadata API:
   - Nhóm theo thời gian, hội thoại, kênh, chủ đề, AI, cảm xúc và nhân viên.
   - Hỗ trợ kéo thả và click để chọn.
3. Tạo toolbar workspace:
   - Quay lại Dashboard.
   - Tiêu đề sửa trực tiếp, mặc định `Biểu đồ mới`.
   - Reset, lưu cấu hình, mở/đóng panel khi màn hình hẹp.
4. Tạo bốn drop zone:
   - Dimension, Metrics, Legend, Filter.
   - Có chip, nút xóa và phản hồi drag-over.
5. Nâng cấp preview:
   - Card bo góc 22px, padding 28-32px, chống overflow.
   - Bổ sung tùy chọn grid và tooltip ở lớp hiển thị.
   - Giữ loading/error/empty state và dữ liệu API thật.
6. Tạo panel cài đặt:
   - Grid chart type ba cột.
   - X-axis, multi metrics, màu từng series, theme và switch.
   - Bộ lọc theo capability của source.
   - Danh sách cấu hình đã lưu.
7. Responsive:
   - Desktop lớn hiển thị đủ ba cột.
   - Dưới 1280px cho phép thu panel trái và mở panel phải dạng drawer.

## 4. Quyết định tương thích

- Sáu chart type có trong API được bật và giữ nguyên khả năng lưu/tải.
- `horizontal_bar`, `scatter`, `combo`, `radar` được hiển thị đúng vị trí nhưng vô hiệu hóa, có tooltip nêu rõ contract API hiện chưa hỗ trợ.
- Không tạo field giả cho dual Y-axis, `axisGroup` hoặc `seriesType`, vì làm vậy sẽ không được backend lưu và phá vỡ tính nhất quán của saved config.
- Cấu hình cũ tiếp tục được đọc theo `ChartConfigPayload` hiện tại.

## 5. Kiểm thử

- Chạy `npm run build`.
- Rà soát không có URL/port hard-code trong component.
- Rà soát request vẫn đi qua `chartBuilderService`.
- Kiểm tra source, dimension, metric, filter, save/load/delete và export không bị thay contract.
- Kiểm tra responsive bằng viewport desktop lớn và dưới 1280px nếu môi trường chạy ứng dụng sẵn sàng.

