# FLIC Selenium Java Automation

Bộ automation độc lập cho **TTH_Dashboard-Webchat-CSKH – FLIC AI Operations Dashboard**. UI test dùng Selenium 4; API/ML test dùng Java `HttpClient`; điều phối và báo cáo kết quả bằng TestNG/Maven. Các test Playwright, Vitest và pytest hiện có của repository không bị thay thế.

## Trạng thái đã xác minh

- Traceability đã kiểm kê 258 TC tại [docs/TEST_CASE_TRACEABILITY.md](docs/TEST_CASE_TRACEABILITY.md).
- Có đúng 258 `@Test` method/258 TC ID và Maven `test-compile` đã pass.
- Default suite đã chạy thật: 258 TC được TestNG ghi nhận, gồm 10 Pass, 1 Fail, 230 Skip và 17 destructive Ignored.
- Baseline ngày 2026-07-12: frontend HTTP 200, ML health HTTP 200, nhưng backend `/api/health` trả 503 dù payload ghi DB và ML đã connected.
- Java cài trên máy là 25.0.2; source automation phải giữ tương thích Java 17.
- Maven chưa có trên `PATH`; lần xác minh dùng Apache Maven 3.9.16 từ distribution cục bộ đã kiểm tra SHA-512.

## Cấu trúc

```text
12.07.2026/
├── pom.xml
├── testng.xml
├── config/config.properties.example
├── suites/
│   ├── smoke.xml
│   ├── regression.xml
│   ├── ui.xml
│   ├── api.xml
│   └── destructive.xml
├── scripts/
├── docs/
└── src/test/
```

Test class chỉ nằm trong hai package:

- `com.flic.automation.tests.ui`: Selenium UI.
- `com.flic.automation.tests.api`: Backend API và ML API bằng `HttpClient`.

Page Object/component và API client được tổ chức theo màn hình hoặc endpoint nghiệp vụ, không theo từng TC ID.

## Yêu cầu môi trường

1. JDK 17 hoặc JDK tương thích với Maven compiler release 17.
2. Apache Maven 3.9+ trên `PATH`.
3. Chrome hoặc Edge. Selenium Manager tự quản lý driver; không commit driver executable.
4. Các service cần thiết:
   - Frontend: `http://127.0.0.1:5173`
   - Backend: `http://127.0.0.1:5000`
   - ML: `http://127.0.0.1:8001`
5. Tài khoản manager/staff và test data an toàn theo [docs/REQUIRED_TEST_INFORMATION.md](docs/REQUIRED_TEST_INFORMATION.md).

## Cấu hình và secret

Thứ tự ưu tiên:

1. Maven system property.
2. Environment variable.
3. `src/test/resources/config.properties`.
4. Giá trị mặc định an toàn.

Environment variables hỗ trợ:

```text
FLIC_BASE_URL
FLIC_API_URL
FLIC_ML_URL
FLIC_BROWSER
FLIC_HEADLESS
FLIC_MANAGER_USERNAME
FLIC_MANAGER_PASSWORD
FLIC_STAFF_USERNAME
FLIC_STAFF_PASSWORD
FLIC_DOWNLOAD_DIR
FLIC_ALLOW_DESTRUCTIVE_TESTS
```

Không điền credential thật vào `config.properties`, suite XML, source Java hoặc batch file. Dùng environment variable hoặc secret manager của CI.

Ví dụ PowerShell cho phiên làm việc cục bộ:

```powershell
$env:FLIC_MANAGER_USERNAME = '<manager-username>'
$env:FLIC_MANAGER_PASSWORD = '<manager-password>'
$env:FLIC_STAFF_USERNAME = '<staff-username>'
$env:FLIC_STAFF_PASSWORD = '<staff-password>'
```

## Lệnh chạy

```powershell
cd 12.07.2026
mvn clean test
mvn test -Dgroups=smoke
mvn test -Dgroups=regression
mvn test -Dgroups=api
mvn test -Dgroups=ml
mvn test -Dbrowser=chrome -Dheadless=true
mvn test -Dbrowser=edge -Dheadless=false
mvn test -DallowDestructiveTests=true -DsuiteXmlFile=suites/destructive.xml
```

Batch helper:

```powershell
scripts\run-smoke.bat
scripts\run-regression.bat
scripts\run-all.bat
scripts\run-headed.bat
```

Tất cả batch script dừng với exit code 127 và thông báo rõ nếu Maven chưa có trên `PATH`. Có thể truyền thêm Maven argument ở cuối lệnh batch. PowerShell cần đặt đối số chứa đường dẫn suite trong dấu nháy nếu shell tách dấu chấm.

## Suite và group

| Suite | Phạm vi | An toàn dữ liệu |
|---|---|---|
| `testng.xml` | UI + API mặc định | Loại `destructive` |
| `suites/smoke.xml` | Group `smoke` | Loại destructive và environment-dependent |
| `suites/regression.xml` | Group `regression` | Loại destructive |
| `suites/ui.xml` | Package UI | Loại destructive |
| `suites/api.xml` | Package API, group `api` | Loại destructive |
| `suites/destructive.xml` | Group `destructive`/`requires-db` | Fail-closed; cần system property cho phép |

Destructive test phải kiểm tra `allowDestructiveTests` theo thứ tự cấu hình và chỉ chạy khi giá trị hiệu lực là `true`. Dữ liệu tạo mới dùng prefix `AUTO_<TC_ID>_<timestamp>`; không sửa/xóa record không do automation tạo.

## Kết quả và minh chứng

Khi test thực sự chạy, đầu ra dự kiến:

```text
target/evidence/<TC_ID>/<timestamp>/
target/screenshots/
target/downloads/
target/extent-report/index.html
target/surefire-reports/
target/logs/automation.log
```

Failure evidence tối thiểu gồm screenshot, page source, URL, failure details và browser console nếu trình duyệt hỗ trợ. Với API-only failure, `screenshot.png`, page source và console ghi rõ “không có browser session”; assertion/request status nằm trong `failure.txt` và Surefire XML, không giả mạo ảnh UI.

Sau mỗi execution, cập nhật [docs/AUTOMATION_EXECUTION_REPORT.md](docs/AUTOMATION_EXECUTION_REPORT.md) từ report thực tế. Không ghi Pass cho test chưa chạy hoặc test bị skip do thiếu môi trường.

## Nguyên tắc triển khai

- Mỗi TC ID là một `@Test` độc lập với JavaDoc và TestNG description chứa TC ID + tên case.
- Không dùng `Thread.sleep()`, absolute XPath, selector theo màu, hoặc assertion giả.
- Retry tối đa một lần và chỉ cho lỗi hạ tầng/trình duyệt được nhận diện; assertion failure không retry.
- Topic phải lấy từ taxonomy active; không hard-code taxonomy cũ trong tài liệu.
- Login dùng username/password và storage key `flic_dashboard_auth`.
- Token hiện là HMAC bearer session, không assert JWT ba phần.
- Role automation chỉ dùng `manager` và `staff`; không tạo role Admin riêng.
