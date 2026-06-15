x# Báo cáo triển khai Dynamic Chart Builder

## 1. Tóm tắt

Chart Builder đã được chuyển từ mô hình source/query định nghĩa sẵn sang mô hình data catalog và query specification có whitelist.

Luồng mới:

```text
Catalog được phê duyệt
-> chọn dataset
-> chọn dimension/metric/series/filter
-> aggregation/date grain/sort/Top N/limit
-> compiler an toàn
-> SQL Server aggregate
-> Recharts preview
-> lưu config v2
```

Không có mock data được thêm lại. Không sửa ML service, không thêm logic vào `legacy.py`, không chạy migration và không ghi dữ liệu thử vào SQL Server.

## 2. Backend

| File | Thay đổi | Kết quả |
|---|---|---|
| `app/config/chart_builder_catalog.py` | Catalog immutable cho 4 dataset, field, role, aggregation, filter operator, date grain và approved relation | Hoàn thành |
| `app/services/chart_query_builder.py` | Compiler `SELECT/GROUP BY/ORDER BY/TOP` từ whitelist, parameterized filter, date grain và type coercion | Hoàn thành |
| `app/schemas/chart_builder.py` | Schema v1/v2, custom request, catalog, filter, sort, execution metadata, dual axis và series type | Hoàn thành |
| `app/repositories/chart_builder_repository.py` | Metadata discovery nội bộ, read-only query execution và query timeout tương thích pyodbc | Hoàn thành |
| `app/services/chart_builder_service.py` | Phân luồng predefined/custom, cache catalog 60 giây, pivot series, config normalizer và execution metadata | Hoàn thành |
| `app/routers/chart_builder.py` | Thêm `/catalog`, `/preview`; `/data` nhận v1/v2; giữ `/sources` | Hoàn thành |
| `app/core/config.py` | Thêm `CHART_QUERY_TIMEOUT_SECONDS`, mặc định 15 giây | Hoàn thành |
| `tests_fastapi/test_dynamic_chart_builder.py` | Test whitelist, injection, aggregation, date, joins, limits, v1/v2, boolean series, disconnect | 17 test đạt |

## 3. API

| Endpoint | Method | Chế độ | Xác minh |
|---|---|---|---|
| `/api/chart-builder/catalog` | GET | custom v2 | `200`, 4 dataset khả dụng |
| `/api/chart-builder/sources` | GET | predefined v1 alias | `200`, tương thích cũ |
| `/api/chart-builder/preview` | POST | custom v2, cap preview 200 | `200`, trả 5 nhóm kênh thật |
| `/api/chart-builder/data` | POST | predefined v1 hoặc custom v2 | `200`, trả 5 nhóm kênh thật |
| `/api/chart-builder/configs` | GET | v1/v2 | `200` |
| `/api/chart-builder/configs` | POST | v1/v2 | Có unit test; không gọi thật vì yêu cầu không ghi SQL Server |
| `/api/chart-builder/configs/{id}` | DELETE | soft delete | Giữ logic cũ; không gọi thật vì yêu cầu không ghi SQL Server |

## 4. Bảo mật truy vấn

- Client chỉ gửi ID theo pattern an toàn, không gửi table/column SQL.
- Dataset, field, aggregation, relation và date grain đều resolve từ catalog backend.
- Filter value luôn dùng placeholder `?`.
- LIKE value được escape `%`, `_`, `[` và `\`.
- Không dùng `SELECT *`.
- Chỉ select dimension và aggregate metric.
- Join chỉ dùng `OUTER APPLY TOP 1` đã định nghĩa trong relation map.
- Field không thuộc dataset bị từ chối.
- Topic/keyword bị khóa trong custom mode.
- Mặc định 500 dòng, tối đa 5.000; preview tối đa 200.
- Query timeout mặc định 15 giây.
- Catalog chỉ kiểm tra metadata các object đã whitelist.
- Không expose password, email, phone, customer ID, sender/receiver ID hoặc nội dung tin nhắn.

## 5. Frontend

| Thành phần | Thay đổi | Kết quả |
|---|---|---|
| `types/chartBuilder.ts` | Type đầy đủ cho catalog, request v2, config union v1/v2 và execution metadata | Hoàn thành |
| `services/chartBuilderService.ts` | Thêm `getCatalog`, `fetchPreview`; dùng API base chung | Hoàn thành |
| `DataFieldsPanel.tsx` | Dataset selector, search, semantic/data type, field unavailable, drag/click, trường dùng gần đây | Hoàn thành |
| `DropZoneBar.tsx` | Dimension, metrics, series, filters và tooltip | Hoàn thành |
| `ChartSettingsPanel.tsx` | Aggregation, date grain, null handling, filters, sort, Top N, limit, theme và recommendation | Hoàn thành |
| `SeriesSettings.tsx` | Label, color, number format, left/right Y-axis và combo series type | Hoàn thành |
| `ChartPreview.tsx` | Bar, stacked, horizontal, line, area, pie, donut, scatter, combo, radar và dual axis | Hoàn thành |
| `ChartBuilder.tsx` | Debounce 500 ms, AbortController, v1 compatibility mode, save/load/delete và export | Hoàn thành |
| `ChartBuilder.css` | Layout 3 cột, panel scroll riêng, drop zones và responsive drawer | Hoàn thành |

Thay đổi title, theme hoặc toggle hiển thị không gọi lại SQL. Chỉ query specification thay đổi mới refresh preview.

## 6. Tương thích cấu hình

- Config không có `version` được normalize trong bộ nhớ thành `version=1`, `mode=predefined`.
- Không update hàng loạt `ChartConfigs.ConfigJson`.
- Config v1 tiếp tục gọi predefined API để giữ đúng metric điều kiện cũ.
- Config v2 lưu toàn bộ query specification và chart settings.
- Frontend nhận biết v1/v2 bằng type guard.

## 7. Xác minh dữ liệu SQL Server

| Trường hợp | Dataset/query động | Kết quả thật |
|---|---|---|
| Conversations by channel | `conversations`, channel + count distinct conversation | 5 dòng; ZaloBusiness 1.858, Facebook 1.146 |
| Messages by month | `messages`, sent_at month + count message | 8 tháng; mẫu 11/2025 là 1.532 |
| Sentiment by month | `message_analytics`, month + sentiment series + count | 8 dòng pivot; positive/neutral/negative |
| Need-review by source | `message_analytics`, channel + need_staff_review series | 4 kênh; boolean False/True giữ đúng |
| Agent performance | `agent_performance`, agent + conversation count | 6 agent/AI |
| Average response by agent | `agent_performance`, agent + avg response minutes | 6 dòng; query khoảng 0,55 giây |
| No-data | Date range 1900-01-01 đến 1900-01-02 | 0 dòng, không tạo dữ liệu giả |
| Top 10 keywords | Field keyword JSON | Không khả dụng trong custom mode |

Lưu ý dữ liệu: `MessageLogs.SentAt` có độ lệch khoảng 26 ngày so với timestamp hội thoại ở một số bản ghi. Metric response time dùng cặp timestamp tổng hợp trong `WebChat_Conversations`; tên agent vẫn lấy từ approved latest-agent relation.

## 8. Kết quả test

| Lệnh/kiểm tra | Kết quả |
|---|---|
| `python -m pytest tests/test_chart_builder.py tests_fastapi/test_dynamic_chart_builder.py -q` | 25 passed |
| `npm run build` | Passed, 2.577 modules transformed |
| FastAPI TestClient `/catalog`, `/sources`, `/configs` | Đều `200` |
| FastAPI TestClient `/preview`, `/data` custom v2 | Đều `200`, 5 dòng |
| SQL Server disconnected | Safe `500`, không lộ chi tiết kết nối |
| Full backend suite | 48 passed, 4 failed ngoài Chart Builder |

Bốn lỗi full suite nằm ở `tests/test_dashboard.py`: health response envelope và KPI test đang mock legacy service nhưng runtime router dùng modular dashboard service. Không sửa vì ngoài phạm vi.

## 9. Chưa xác minh trực tiếp

- Chưa chạy browser E2E vì project không cài Playwright.
- Chưa click tải file PNG/PDF trong browser; code export cũ được giữ và frontend build đạt.
- Chưa POST/DELETE config trên database thật vì yêu cầu không ghi dữ liệu SQL Server.
- Chưa kiểm thử trực quan mọi breakpoint trên trình duyệt thật.

## 10. Rủi ro còn lại

1. SQL Server 2014 không có `OPENJSON`; topic và keyword custom aggregate chưa thể bật an toàn.
2. Approved latest-agent relation chưa có index tối ưu trên `MessageLogs(Source, ReceiverId, FromHost, SentAt)`.
3. Dữ liệu timestamp giữa conversation và message log có sai lệch cần data owner xác minh.
4. Full backend suite còn 4 lỗi dashboard ngoài phạm vi.
5. Cần visual/browser test trước khi coi là hoàn tất sản phẩm.

## 11. Trạng thái

DYNAMIC_CHART_BUILDER_READY_FOR_UI_TEST
