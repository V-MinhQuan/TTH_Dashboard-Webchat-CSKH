# AUTOMATION EXECUTION REPORT

## Kết quả xác minh

Bộ automation đã compile và chạy thật ngày `2026-07-12T19:18:08 GMT+07:00`. Default suite giữ nguyên lỗi sản phẩm ở `API-TC-01`; không sửa backend để đổi kết quả.

| Hạng mục | Giá trị |
|---|---|
| Ngày tạo báo cáo | 2026-07-12T19:19:10+07:00 |
| Repository | D:\FLIC\FLIC_Final\TTH_Dashboard-Webchat-CSKH |
| Branch / commit | main / 8a4f805119fa58f1dc368fc4dde7f9e94ef296a8 |
| Java | 25.0.2; Maven compiler release 17 |
| Maven | Apache Maven 3.9.16 từ distribution đã xác minh SHA-512; chưa thêm vào PATH hệ thống |
| Browser | Chrome 150.0.7871.114; ChromeDriver 150.0.7871.115 do Selenium Manager cấp |
| Base / API / ML | http://127.0.0.1:5173 / http://127.0.0.1:5000 / http://127.0.0.1:8001 |
| Lệnh baseline | mvn test (default suite, destructive=false), sau khi mvn clean test đã xác minh clean compile |
| Thời lượng TestNG | 44608 ms |

## Thống kê

| Chỉ số | Số lượng |
|---|---:|
| Tổng TC Excel | 258 |
| TC có @Test method và compile | 258 |
| Được chọn chạy (gồm Pass/Fail/Skip) | 241 |
| Pass | 10 |
| Fail | 1 |
| Skip | 230 |
| Ignored do destructive=false | 17 |
| Blocked environment (phân loại trace) | 20 |
| Manual only (phân loại trace) | 1 |
| Not applicable (phân loại trace) | 33 |

> `Skip`, `Ignored`, `Blocked`, `Manual only` và `Not applicable` là các trục khác nhau. Không TC nào trong các nhóm này được ghi Pass.

## Kết quả theo module

| Module | TC | Pass | Fail | Skip | Ignored |
|---|---:|---:|---:|---:|---:|
| Xác thực người dùng | 17 | 3 | 0 | 14 | 0 |
| Bộ lọc dữ liệu | 51 | 0 | 0 | 51 | 0 |
| Tổng quan | 13 | 0 | 0 | 13 | 0 |
| Phân tích theo kênh | 11 | 0 | 0 | 11 | 0 |
| Từ khóa nổi bật | 14 | 0 | 0 | 14 | 0 |
| Phân tích cảm xúc | 14 | 0 | 0 | 14 | 0 |
| Hiệu suất AI | 8 | 0 | 0 | 8 | 0 |
| Tạo biểu đồ | 24 | 0 | 0 | 22 | 2 |
| Thư viện phản hồi | 29 | 0 | 0 | 23 | 6 |
| Quản lý người dùng | 18 | 0 | 0 | 13 | 5 |
| Cài đặt | 16 | 0 | 0 | 12 | 4 |
| Xuất dữ liệu | 11 | 0 | 0 | 11 | 0 |
| Lịch sử hoạt động | 7 | 0 | 0 | 7 | 0 |
| Backend API & ML | 25 | 7 | 1 | 17 | 0 |

## Kết quả theo Task name / file Java

| Module | Task name / test case lớn | File Java | TC nhỏ | @Test | Pass | Fail | Skip | Ignored |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Xác thực người dùng | ĐĂNG NHẬP HỢP LỆ – HAPPY PATH | LoginSuccessAndSessionTest.java | 5 | 5 | 0 | 0 | 5 | 0 |
| Xác thực người dùng | ĐĂNG NHẬP LỖI – VALIDATION & ERROR | LoginValidationTest.java | 7 | 7 | 2 | 0 | 5 | 0 |
| Xác thực người dùng | ĐĂNG XUẤT & SESSION | LogoutAndSessionProtectionTest.java | 5 | 5 | 1 | 0 | 4 | 0 |
| Bộ lọc dữ liệu | DROPDOWN KHOẢNG THỜI GIAN | TimeRangePresetTest.java | 7 | 7 | 0 | 0 | 7 | 0 |
| Bộ lọc dữ liệu | Ô TỪ NGÀY – VALIDATION | StartDateValidationTest.java | 5 | 5 | 0 | 0 | 5 | 0 |
| Bộ lọc dữ liệu | Ô ĐẾN NGÀY – VALIDATION | EndDateValidationTest.java | 5 | 5 | 0 | 0 | 5 | 0 |
| Bộ lọc dữ liệu | NGÀY TÙY CHỈNH – EDGE CASES | CustomDateRangeBoundaryTest.java | 6 | 6 | 0 | 0 | 6 | 0 |
| Bộ lọc dữ liệu | NÚT ÁP DỤNG | ApplyGlobalFilterTest.java | 4 | 4 | 0 | 0 | 4 | 0 |
| Bộ lọc dữ liệu | NÚT ĐẶT LẠI | ResetGlobalFilterTest.java | 4 | 4 | 0 | 0 | 4 | 0 |
| Bộ lọc dữ liệu | DROPDOWN KÊNH | ChannelFilterTest.java | 6 | 6 | 0 | 0 | 6 | 0 |
| Bộ lọc dữ liệu | DROPDOWN CHỦ ĐỀ | TopicFilterTest.java | 4 | 4 | 0 | 0 | 4 | 0 |
| Bộ lọc dữ liệu | CHIP FILTER | FilterChipSynchronizationTest.java | 5 | 5 | 0 | 0 | 5 | 0 |
| Bộ lọc dữ liệu | TỔ HỢP ĐA BỘ LỌC | CombinedGlobalFilterTest.java | 5 | 5 | 0 | 0 | 5 | 0 |
| Tổng quan | KPI CARDS | OverviewKpiTest.java | 6 | 6 | 0 | 0 | 6 | 0 |
| Tổng quan | BIỂU ĐỒ TỔNG QUAN | OverviewChartTest.java | 5 | 5 | 0 | 0 | 5 | 0 |
| Tổng quan | REFRESH DỮ LIỆU | OverviewRefreshTest.java | 2 | 2 | 0 | 0 | 2 | 0 |
| Phân tích theo kênh | BIỂU ĐỒ KÊNH | ChannelDistributionChartTest.java | 4 | 4 | 0 | 0 | 4 | 0 |
| Phân tích theo kênh | BẢNG CHI TIẾT KÊNH | ChannelDetailsTableTest.java | 7 | 7 | 0 | 0 | 7 | 0 |
| Từ khóa nổi bật | WORD CLOUD & BẢNG TẦN SUẤT | KeywordCloudAndTableTest.java | 5 | 5 | 0 | 0 | 5 | 0 |
| Từ khóa nổi bật | TÌM KIẾM TỪ KHÓA | KeywordSearchTest.java | 4 | 4 | 0 | 0 | 4 | 0 |
| Từ khóa nổi bật | CLICK TỪ KHÓA & LỌC | KeywordNavigationTest.java | 2 | 2 | 0 | 0 | 2 | 0 |
| Từ khóa nổi bật | LỖI API & TIMEOUT | KeywordFailureHandlingTest.java | 3 | 3 | 0 | 0 | 3 | 0 |
| Phân tích cảm xúc | SENTIMENT SUMMARY CHART | SentimentSummaryAndTrendTest.java | 6 | 6 | 0 | 0 | 6 | 0 |
| Phân tích cảm xúc | DANH SÁCH HỘI THOẠI TIÊU CỰC | NegativeConversationTest.java | 4 | 4 | 0 | 0 | 4 | 0 |
| Phân tích cảm xúc | ML SERVICE – FALLBACK | SentimentMlResilienceTest.java | 4 | 4 | 0 | 0 | 4 | 0 |
| Hiệu suất AI | AI INSIGHTS PANEL | AiInsightsTest.java | 8 | 8 | 0 | 0 | 8 | 0 |
| Tạo biểu đồ | DATA SOURCE | ChartDataSourceTest.java | 4 | 4 | 0 | 0 | 4 | 0 |
| Tạo biểu đồ | CHART TYPE | ChartTypeConfigurationTest.java | 5 | 5 | 0 | 0 | 5 | 0 |
| Tạo biểu đồ | PREVIEW CHART | ChartPreviewTest.java | 6 | 6 | 0 | 0 | 6 | 0 |
| Tạo biểu đồ | LƯU CẤU HÌNH | ChartSaveTest.java | 6 | 6 | 0 | 0 | 5 | 1 |
| Tạo biểu đồ | QUẢN LÝ DANH SÁCH CONFIG | SavedChartConfigurationTest.java | 3 | 3 | 0 | 0 | 2 | 1 |
| Thư viện phản hồi | DANH SÁCH & PHÂN TRANG | FeedbackTableTest.java | 5 | 5 | 0 | 0 | 5 | 0 |
| Thư viện phản hồi | TÌM KIẾM & LỌC | FeedbackSearchAndFilterTest.java | 5 | 5 | 0 | 0 | 5 | 0 |
| Thư viện phản hồi | THÊM MỚI PHẢN HỒI | CreateFeedbackTest.java | 6 | 6 | 0 | 0 | 5 | 1 |
| Thư viện phản hồi | SỬA PHẢN HỒI | UpdateFeedbackTest.java | 4 | 4 | 0 | 0 | 3 | 1 |
| Thư viện phản hồi | XÓA PHẢN HỒI | DeleteFeedbackTest.java | 5 | 5 | 0 | 0 | 4 | 1 |
| Thư viện phản hồi | DUYỆT / TỪ CHỐI PHẢN HỒI | FeedbackApprovalTest.java | 4 | 4 | 0 | 0 | 1 | 3 |
| Quản lý người dùng | DANH SÁCH NGƯỜI DÙNG | UserManagementTableTest.java | 5 | 5 | 0 | 0 | 5 | 0 |
| Quản lý người dùng | THÊM NGƯỜI DÙNG | CreateUserTest.java | 5 | 5 | 0 | 0 | 4 | 1 |
| Quản lý người dùng | SỬA & KHÓA NGƯỜI DÙNG | UpdateAndSuspendUserTest.java | 5 | 5 | 0 | 0 | 1 | 4 |
| Quản lý người dùng | PHÂN QUYỀN MENU | RoleBasedMenuTest.java | 3 | 3 | 0 | 0 | 3 | 0 |
| Cài đặt | THÔNG TIN CÁ NHÂN (PROFILE) | PersonalProfileTest.java | 6 | 6 | 0 | 0 | 4 | 2 |
| Cài đặt | UPLOAD AVATAR | AvatarUploadTest.java | 3 | 3 | 0 | 0 | 3 | 0 |
| Cài đặt | ĐỔI MẬT KHẨU | ChangePasswordTest.java | 4 | 4 | 0 | 0 | 3 | 1 |
| Cài đặt | SETTINGS HỆ THỐNG | SystemSettingsTest.java | 3 | 3 | 0 | 0 | 2 | 1 |
| Xuất dữ liệu | EXPORT CSV | CsvExportTest.java | 4 | 4 | 0 | 0 | 4 | 0 |
| Xuất dữ liệu | EXPORT EXCEL (XLSX) | XlsxExportTest.java | 3 | 3 | 0 | 0 | 3 | 0 |
| Xuất dữ liệu | LỖI & EDGE CASE | ExportFailureAndAccessTest.java | 4 | 4 | 0 | 0 | 4 | 0 |
| Lịch sử hoạt động | AUDIT LOG – HIỂN THỊ & CHÍNH XÁC | ActivityHistoryTest.java | 7 | 7 | 0 | 0 | 7 | 0 |
| Backend API & ML | HEALTH CHECK | HealthCheckApiTest.java | 4 | 4 | 1 | 1 | 2 | 0 |
| Backend API & ML | AUTH API | AuthenticationApiTest.java | 5 | 5 | 1 | 0 | 4 | 0 |
| Backend API & ML | DASHBOARD & ANALYTICS API | DashboardAndConversationsApiTest.java | 6 | 6 | 0 | 0 | 6 | 0 |
| Backend API & ML | VALIDATION & ERROR HANDLING | ApiValidationAndSecurityTest.java | 4 | 4 | 1 | 0 | 3 | 0 |
| Backend API & ML | ML SERVICE API | MlServiceApiTest.java | 6 | 6 | 4 | 0 | 2 | 0 |

## TC Pass

- `AUTH-TC-08` — `LoginValidationTest.java#authtc08BoTrongOEmailKhiDangNhapValidationBaoBatBuoc`
- `AUTH-TC-09` — `LoginValidationTest.java#authtc09BoTrongOPasswordKhiDangNhapValidationBaoBatBuoc`
- `AUTH-TC-16` — `LogoutAndSessionProtectionTest.java#authtc16TruyCapURLNoiBoOverviewKhiChuaDangNhapBiChan`
- `API-TC-04` — `HealthCheckApiTest.java#apitc04GETApiHealthResponseCoFieldChiTietDetailsMlModelLoaded`
- `API-TC-09` — `AuthenticationApiTest.java#apitc09GoiAPIProtectedVoiTokenGiaMaoTra401`
- `API-TC-19` — `ApiValidationAndSecurityTest.java#apitc19APICORSChiChoPhepOriginDaCauHinh`
- `API-TC-20` — `MlServiceApiTest.java#apitc20GETHealthMLTraStatusKhiDangChay`
- `API-TC-21` — `MlServiceApiTest.java#apitc21POSTPredictCauTichCucTraLabelPositive`
- `API-TC-22` — `MlServiceApiTest.java#apitc22POSTPredictCauTieuCucTraLabelNegative`
- `API-TC-24` — `MlServiceApiTest.java#apitc24POSTPredictEnsembleKetQuaEnsembleTuNhieuModel`

## Lỗi

- `API-TC-01` — Backend phải trả 200 khi Database và ML đều sẵn sàng; source hiện có known defect connected/ok. expected [200] but found [503] Evidence: `target/evidence/API-TC-01/<timestamp>/`

## Minh chứng và báo cáo

- `target/surefire-reports/testng-results.xml` — kết quả 258 TC, gồm 17 destructive ignored.
- `target/surefire-reports/TEST-TestSuite.xml` và `TestSuite.txt` — báo cáo Surefire.
- `target/extent-report/index.html` — Extent HTML report.
- `target/evidence/API-TC-01/<timestamp>/` — screenshot giải thích API không có browser, page-source N/A, console N/A và failure.txt.

## Các lần chạy bổ sung

| Lệnh | Kết quả |
|---|---|
| mvn -DskipTests test-compile | PASS; compile 92 Java source files |
| mvn -Dgroups=ml test | PASS; ML group chạy thành công |
| mvn -DsuiteXmlFile=suites/api.xml test | 25 TC: 7 Pass, 1 Fail, 17 Skip; fail API-TC-01 |
| mvn -DsuiteXmlFile=suites/smoke.xml test | 7 TC: 6 Pass, 1 Fail; fail API-TC-01 |

## Thông tin còn thiếu

Các credential manager/staff, fixture DB, ID hội thoại/feedback/user/chart và controlled fault environment chưa được cung cấp. Xem `REQUIRED_TEST_INFORMATION.md`; các TC liên quan giữ Skip/Blocked, không suy diễn Pass.
