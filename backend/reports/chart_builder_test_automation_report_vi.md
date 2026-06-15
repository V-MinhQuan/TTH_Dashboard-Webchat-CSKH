# Báo Cáo Tự Động Hóa Kiểm Thử: Dynamic Chart Builder

## 1. Tóm Tắt

Dựa trên yêu cầu, toàn bộ kiến trúc kiểm thử tự động (Test Automation) cho mô-đun **Dynamic Chart Builder** đã được thiết lập thành công. Việc kiểm thử được chia làm hai phần:
- **Backend (FastAPI)**: Thực thi thông qua `pytest`, kiểm tra tính logic của Query Compiler, bảo mật dữ liệu, và tính tương thích của Saved Configs.
- **Frontend (React)**: Thực thi E2E thông qua `Playwright`, kiểm tra tương tác người dùng, kéo thả, query options, rendering biểu đồ (Recharts), tương thích giao diện trên nhiều độ phân giải, và các kịch bản thực tế.

Toàn bộ quá trình kiểm tra đảm bảo **không ghi đè cơ sở dữ liệu thực (production)** thông qua việc sử dụng cơ chế mock interceptors trên Frontend và dependency injection trên Backend.

## 2. Phạm Vi Kiểm Thử (Test Coverage)

### 2.1. Backend API (Pytest)
- **Tổng số Test Cases**: `41` (100% Passed)
- **Phạm vi kiểm tra**:
  - Biên dịch câu lệnh SQL an toàn (Safe SQL Compiler).
  - Tự động áp dụng `base_conditions` để giới hạn dữ liệu (ví dụ: loại bỏ `AI Assistant` khỏi báo cáo hiệu suất nhân sự).
  - Khả năng tương thích ngược của cấu hình đã lưu (V1 và V2).
  - Xử lý các điều kiện lọc (Filters), gom nhóm (Date Grain), sắp xếp (Sorting), và giới hạn dữ liệu (Top N & Limit).
  - Xử lý mượt mà lỗi không có dữ liệu (Empty data) hoặc lỗi tham số không hợp lệ.

### 2.2. Frontend E2E (Playwright)
- **Tổng số Test Cases**: `66` kịch bản
- **Framework**: `@playwright/test`
- **Fixture `auth.ts`**: Tự động inject token và role người dùng (manager) vào localStorage và chuyển trực tiếp đến màn hình `chartbuilder`, giúp test nhanh và không dính màn hình Login.
- **Mocking**: `api-mocks.ts` thực hiện việc giả lập phản hồi của `/catalog`, `/preview`, `/data`, và `/save` (ngăn thao tác ghi xuống DB thật).
- **Phạm vi kiểm tra**:
  - **Catalog & Field Selection**: Hiển thị danh sách trường, tìm kiếm, kéo thả trường (drag-and-drop), và click-to-select.
  - **Query Options & Debounce**: Thay đổi aggregation, date grain, và đảm bảo cơ chế debounce tối ưu (hạn chế gọi API `/preview` liên tục).
  - **Chart Rendering**: Kiểm tra việc render SVG của 10 loại biểu đồ (Bar, Line, Area, Pie, Donut, Scatter, Combo, Radar, v.v.), Dual Y-Axis, và chú thích (Tooltip/Legend).
  - **Real Scenarios**: Giả lập các báo cáo thực tế như *Conversations by channel*, *Messages by month*, *Agent performance* (loại AI Assistant).
  - **Saved Configurations**: Kiểm tra UI khi load cấu hình V1/V2 và hiển thị banner "Legacy Mode".
  - **Export**: Chức năng xuất file PNG/PDF với dung lượng và bounding box hợp lệ.
  - **Error States**: Xử lý 400 Bad Request, 500 Server Error, Offline mode, và rỗng dữ liệu (Empty State).
  - **Security Regression**: Đảm bảo UI gọi đúng port 5000 cho Chart Builder API, không gọi nhầm sang port 5173.
  - **Responsive Layout**: Kiểm thử khả năng co giãn trên Desktop và Mobile (Drawer/Panel collapses).

## 3. Kiến Trúc E2E Test (Playwright)

Cấu trúc file test E2E cho Chart Builder:
```text
tests/e2e/
├── fixtures/
│   ├── index.ts        (Tổng hợp fixtures)
│   ├── auth.ts         (Inject localStorage authentication)
│   └── api-mocks.ts    (Cung cấp withCatalogMock, withPreviewMock, v.v.)
└── chart-builder/
    ├── 01-catalog.spec.ts
    ├── 02-field-selection.spec.ts
    ├── 03-query-options.spec.ts
    ├── 04-chart-rendering.spec.ts
    ├── 05-real-scenarios.spec.ts
    ├── 06-saved-configs.spec.ts
    ├── 07-export.spec.ts
    ├── 08-error-states.spec.ts
    ├── 09-security.spec.ts
    └── 10-responsive.spec.ts
```

## 4. Hướng Dẫn Chạy Automation Test

### 4.1. Chạy Backend Test
Mở Terminal, active môi trường ảo và chạy lệnh:
```bash
cd backend
python -m pytest tests_fastapi/test_dynamic_chart_builder_extended.py tests_fastapi/test_saved_config_compatibility.py -v
```

### 4.2. Chạy Frontend E2E Test
Đảm bảo bạn đã cài đặt các trình duyệt của Playwright (`npx playwright install`).
Mở Terminal, truy cập thư mục gốc và chạy lệnh:
```bash
# Chạy với giao diện (Headed mode)
npx playwright test tests/e2e/chart-builder/ --project=chromium --headed

# Chạy ngầm (Headless mode) để kiểm tra CI
npx playwright test tests/e2e/chart-builder/ --project=chromium

# Chạy một file test cụ thể
npx playwright test tests/e2e/chart-builder/04-chart-rendering.spec.ts
```

## 5. Kết Luận

Hệ thống Dynamic Chart Builder đã được bảo vệ hoàn chỉnh bởi hệ thống kiểm thử tự động từ tầng giao diện (UI E2E) đến tầng truy vấn logic (Backend Pytest). Các lỗi hồi quy (regression) như leak dữ liệu AI Assistant, sụp đổ giao diện khi thay đổi nhanh, và lưu nhầm cấu hình phiên bản cũ sẽ bị bắt ngay lập tức trước khi triển khai (deploy). Khuyến nghị đưa chuỗi test này vào CI Pipeline ở bước tiếp theo.
