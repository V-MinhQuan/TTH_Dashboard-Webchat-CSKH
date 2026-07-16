from __future__ import annotations

import hashlib
import re
import unicodedata
from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import openpyxl


PROJECT_DIR = Path(__file__).resolve().parents[2]
OUTPUT_DIR = Path(__file__).resolve().parents[1]
TRACE_PATH = OUTPUT_DIR / "docs" / "TEST_CASE_TRACEABILITY.md"


@dataclass(frozen=True)
class Section:
    module: str
    heading: str
    class_name: str
    file_name: str
    surface: str
    owner: str
    primary_group: str


SECTIONS = [
    Section("Xác thực người dùng", "ĐĂNG NHẬP HỢP LỆ – HAPPY PATH", "LoginSuccessAndSessionTest", "LoginSuccessAndSessionTest.java", "UI", "LoginPage; AuthStorageUtils", "authentication"),
    Section("Xác thực người dùng", "ĐĂNG NHẬP LỖI – VALIDATION & ERROR", "LoginValidationTest", "LoginValidationTest.java", "UI", "LoginPage", "authentication"),
    Section("Xác thực người dùng", "ĐĂNG XUẤT & SESSION", "LogoutAndSessionProtectionTest", "LogoutAndSessionProtectionTest.java", "UI/API", "LoginPage; HeaderComponent; ApiClient", "authentication"),
    Section("Bộ lọc dữ liệu", "DROPDOWN KHOẢNG THỜI GIAN", "TimeRangePresetTest", "TimeRangePresetTest.java", "UI", "GlobalFilterComponent", "filter"),
    Section("Bộ lọc dữ liệu", "Ô TỪ NGÀY – VALIDATION", "StartDateValidationTest", "StartDateValidationTest.java", "UI", "GlobalFilterComponent", "filter"),
    Section("Bộ lọc dữ liệu", "Ô ĐẾN NGÀY – VALIDATION", "EndDateValidationTest", "EndDateValidationTest.java", "UI", "GlobalFilterComponent", "filter"),
    Section("Bộ lọc dữ liệu", "NGÀY TÙY CHỈNH – EDGE CASES", "CustomDateRangeBoundaryTest", "CustomDateRangeBoundaryTest.java", "UI", "GlobalFilterComponent", "filter"),
    Section("Bộ lọc dữ liệu", "NÚT ÁP DỤNG", "ApplyGlobalFilterTest", "ApplyGlobalFilterTest.java", "UI", "GlobalFilterComponent; NetworkCaptureUtils", "filter"),
    Section("Bộ lọc dữ liệu", "NÚT ĐẶT LẠI", "ResetGlobalFilterTest", "ResetGlobalFilterTest.java", "UI", "GlobalFilterComponent; NetworkCaptureUtils", "filter"),
    Section("Bộ lọc dữ liệu", "DROPDOWN KÊNH", "ChannelFilterTest", "ChannelFilterTest.java", "UI", "GlobalFilterComponent", "filter"),
    Section("Bộ lọc dữ liệu", "DROPDOWN CHỦ ĐỀ", "TopicFilterTest", "TopicFilterTest.java", "UI", "GlobalFilterComponent; topicTaxonomy.ts", "filter"),
    Section("Bộ lọc dữ liệu", "CHIP FILTER", "FilterChipSynchronizationTest", "FilterChipSynchronizationTest.java", "UI", "GlobalFilterComponent", "filter"),
    Section("Bộ lọc dữ liệu", "TỔ HỢP ĐA BỘ LỌC", "CombinedGlobalFilterTest", "CombinedGlobalFilterTest.java", "UI", "GlobalFilterComponent; NetworkCaptureUtils", "filter"),
    Section("Tổng quan", "KPI CARDS", "OverviewKpiTest", "OverviewKpiTest.java", "UI", "OverviewPage; GlobalFilterComponent", "overview"),
    Section("Tổng quan", "BIỂU ĐỒ TỔNG QUAN", "OverviewChartTest", "OverviewChartTest.java", "UI", "OverviewPage; ChartAssertions", "overview"),
    Section("Tổng quan", "REFRESH DỮ LIỆU", "OverviewRefreshTest", "OverviewRefreshTest.java", "UI", "OverviewPage; NetworkCaptureUtils", "overview"),
    Section("Phân tích theo kênh", "BIỂU ĐỒ KÊNH", "ChannelDistributionChartTest", "ChannelDistributionChartTest.java", "UI", "ChannelAnalysisPage; ChartAssertions", "channel"),
    Section("Phân tích theo kênh", "BẢNG CHI TIẾT KÊNH", "ChannelDetailsTableTest", "ChannelDetailsTableTest.java", "UI", "ChannelAnalysisPage; TableUtils", "channel"),
    Section("Từ khóa nổi bật", "WORD CLOUD & BẢNG TẦN SUẤT", "KeywordCloudAndTableTest", "KeywordCloudAndTableTest.java", "UI", "KeywordAnalysisPage", "keyword"),
    Section("Từ khóa nổi bật", "TÌM KIẾM TỪ KHÓA", "KeywordSearchTest", "KeywordSearchTest.java", "UI", "KeywordAnalysisPage", "keyword"),
    Section("Từ khóa nổi bật", "CLICK TỪ KHÓA & LỌC", "KeywordNavigationTest", "KeywordNavigationTest.java", "UI", "KeywordAnalysisPage", "keyword"),
    Section("Từ khóa nổi bật", "LỖI API & TIMEOUT", "KeywordFailureHandlingTest", "KeywordFailureHandlingTest.java", "UI", "KeywordAnalysisPage", "keyword"),
    Section("Phân tích cảm xúc", "SENTIMENT SUMMARY CHART", "SentimentSummaryAndTrendTest", "SentimentSummaryAndTrendTest.java", "UI", "SentimentAnalysisPage; ChartAssertions", "sentiment"),
    Section("Phân tích cảm xúc", "DANH SÁCH HỘI THOẠI TIÊU CỰC", "NegativeConversationTest", "NegativeConversationTest.java", "UI", "SentimentAnalysisPage; TableUtils", "sentiment"),
    Section("Phân tích cảm xúc", "ML SERVICE – FALLBACK", "SentimentMlResilienceTest", "SentimentMlResilienceTest.java", "UI/ML", "SentimentAnalysisPage; MlClient", "sentiment"),
    Section("Hiệu suất AI", "AI INSIGHTS PANEL", "AiInsightsTest", "AiInsightsTest.java", "UI", "AiInsightsPage", "ai-insights"),
    Section("Tạo biểu đồ ", "DATA SOURCE", "ChartDataSourceTest", "ChartDataSourceTest.java", "UI", "ChartBuilderPage", "chart-builder"),
    Section("Tạo biểu đồ ", "CHART TYPE", "ChartTypeConfigurationTest", "ChartTypeConfigurationTest.java", "UI", "ChartBuilderPage", "chart-builder"),
    Section("Tạo biểu đồ ", "PREVIEW CHART", "ChartPreviewTest", "ChartPreviewTest.java", "UI", "ChartBuilderPage; ChartAssertions", "chart-builder"),
    Section("Tạo biểu đồ ", "LƯU CẤU HÌNH", "ChartSaveTest", "ChartSaveTest.java", "UI", "ChartBuilderPage", "chart-builder"),
    Section("Tạo biểu đồ ", "QUẢN LÝ DANH SÁCH CONFIG", "SavedChartConfigurationTest", "SavedChartConfigurationTest.java", "UI", "ChartBuilderPage", "chart-builder"),
    Section("Thư viện phản hồi", "DANH SÁCH & PHÂN TRANG", "FeedbackTableTest", "FeedbackTableTest.java", "UI", "FeedbackLibraryPage; TableUtils", "feedback-library"),
    Section("Thư viện phản hồi", "TÌM KIẾM & LỌC", "FeedbackSearchAndFilterTest", "FeedbackSearchAndFilterTest.java", "UI", "FeedbackLibraryPage", "feedback-library"),
    Section("Thư viện phản hồi", "THÊM MỚI PHẢN HỒI", "CreateFeedbackTest", "CreateFeedbackTest.java", "UI", "FeedbackLibraryPage; FeedbackFormDialogComponent", "feedback-library"),
    Section("Thư viện phản hồi", "SỬA PHẢN HỒI", "UpdateFeedbackTest", "UpdateFeedbackTest.java", "UI", "FeedbackLibraryPage; FeedbackFormDialogComponent", "feedback-library"),
    Section("Thư viện phản hồi", "XÓA PHẢN HỒI", "DeleteFeedbackTest", "DeleteFeedbackTest.java", "UI", "FeedbackLibraryPage", "feedback-library"),
    Section("Thư viện phản hồi", "DUYỆT / TỪ CHỐI PHẢN HỒI", "FeedbackApprovalTest", "FeedbackApprovalTest.java", "UI", "FeedbackLibraryPage", "feedback-library"),
    Section("Quản lý người dùng", "DANH SÁCH NGƯỜI DÙNG", "UserManagementTableTest", "UserManagementTableTest.java", "UI", "SettingsPage; UserManagementPage", "user-management"),
    Section("Quản lý người dùng", "THÊM NGƯỜI DÙNG", "CreateUserTest", "CreateUserTest.java", "UI", "UserManagementPage", "user-management"),
    Section("Quản lý người dùng", "SỬA & KHÓA NGƯỜI DÙNG", "UpdateAndSuspendUserTest", "UpdateAndSuspendUserTest.java", "UI", "UserManagementPage", "user-management"),
    Section("Quản lý người dùng", "PHÂN QUYỀN MENU", "RoleBasedMenuTest", "RoleBasedMenuTest.java", "UI", "SidebarComponent; SettingsPage", "user-management"),
    Section("Cài đặt", "THÔNG TIN CÁ NHÂN (PROFILE)", "PersonalProfileTest", "PersonalProfileTest.java", "UI", "SettingsPage; PersonalInfoPage", "settings"),
    Section("Cài đặt", "UPLOAD AVATAR", "AvatarUploadTest", "AvatarUploadTest.java", "UI", "SettingsPage", "settings"),
    Section("Cài đặt", "ĐỔI MẬT KHẨU", "ChangePasswordTest", "ChangePasswordTest.java", "UI", "SettingsPage", "settings"),
    Section("Cài đặt", "SETTINGS HỆ THỐNG", "SystemSettingsTest", "SystemSettingsTest.java", "UI", "SettingsPage", "settings"),
    Section("Xuất dữ liệu", "EXPORT CSV", "CsvExportTest", "CsvExportTest.java", "UI", "GlobalFilterComponent; DownloadUtils", "export"),
    Section("Xuất dữ liệu", "EXPORT EXCEL (XLSX)", "XlsxExportTest", "XlsxExportTest.java", "UI", "GlobalFilterComponent; DownloadUtils; ExcelUtils", "export"),
    Section("Xuất dữ liệu", "LỖI & EDGE CASE", "ExportFailureAndAccessTest", "ExportFailureAndAccessTest.java", "UI", "GlobalFilterComponent; DownloadUtils", "export"),
    Section("Lịch sử hoạt động", "AUDIT LOG – HIỂN THỊ & CHÍNH XÁC", "ActivityHistoryTest", "ActivityHistoryTest.java", "UI", "HeaderComponent; ActivityHistoryPage", "activity"),
    Section("Backend API & ML", "HEALTH CHECK", "HealthCheckApiTest", "HealthCheckApiTest.java", "API", "ApiClient", "api"),
    Section("Backend API & ML", "AUTH API", "AuthenticationApiTest", "AuthenticationApiTest.java", "API", "ApiClient", "api"),
    Section("Backend API & ML", "DASHBOARD & ANALYTICS API", "DashboardAndConversationsApiTest", "DashboardAndConversationsApiTest.java", "API", "ApiClient", "api"),
    Section("Backend API & ML", "VALIDATION & ERROR HANDLING", "ApiValidationAndSecurityTest", "ApiValidationAndSecurityTest.java", "API", "ApiClient", "api"),
    Section("Backend API & ML", "ML SERVICE API", "MlServiceApiTest", "MlServiceApiTest.java", "ML", "MlClient", "ml"),
]

SECTION_BY_KEY = {(section.module.strip(), section.heading): section for section in SECTIONS}


def ids(prefix: str, *numbers: int) -> set[str]:
    return {f"{prefix}-TC-{number:02d}" for number in numbers}


NOT_APPLICABLE = (
    ids("AUTH", 10, 12)
    | ids("CHANNEL", 6, 7, 8)
    | ids("KEYWORD", 3, 4, 6, 7, 8, 9, 10, 11)
    | ids("FEEDBACK", 2, 3, 5)
    | ids("USER", 2, 3, 9, 12)
    | ids("SETTINGS", 7, 8, 9)
    | ids("EXPORT", 1, 2, 3, 4)
    | ids("ACTIVITY", 5, 6)
    | ids("API", 16, 25)
)

NEEDS_CONFIRMATION = (
    ids("AUTH", 1, 4, 7, 8, 15)
    | ids("FILTER", 22, 24)
    | ids("KEYWORD", 1)
    | ids("SENTIMENT", 14)
    | ids("FEEDBACK", 26)
    | ids("USER", 1, 17, 18)
    | ids("SETTINGS", 14, 15, 16)
    | ids("ACTIVITY", 1, 7)
    | ids("API", 5, 7, 10, 11, 12, 23)
)

BLOCKED_ENVIRONMENT = (
    ids("OVERVIEW", 5)
    | ids("CHANNEL", 10)
    | ids("KEYWORD", 12, 13)
    | ids("SENTIMENT", 11, 12, 13)
    | ids("AI", 6)
    | ids("FEEDBACK", 16, 24)
    | ids("SETTINGS", 6, 10, 11)
    | ids("EXPORT", 8)
    | ids("API", 2, 3, 8, 18)
)

MANUAL_ONLY = ids("AI", 3)

PARTIAL = (
    ids("AUTH", 5, 17)
    | ids("FILTER", 2, 3, 4, 10, 26, 27, 40, 42, 43, 44, 45, 46)
    | ids("OVERVIEW", 3, 7, 8, 9)
    | ids("CHANNEL", 1, 2, 11)
    | ids("SENTIMENT", 1, 2, 8, 10)
    | ids("AI", 1, 7)
    | ids("CHART", 3, 8, 14, 15, 19, 21)
    | ids("EXPORT", 9, 11)
)

NEEDS_DATA = (
    ids("AUTH", 2, 3, 6, 9, 11, 13, 14)
    | ids("FILTER", 11, 15, 17, 18, 19, 20, 23, 32, 33, 34, 35, 36, 37, 39, 41, 47, 48, 49, 50, 51)
    | ids("OVERVIEW", 2, 4, 6, 10, 11, 12, 13)
    | ids("CHANNEL", 3, 4, 5, 9)
    | ids("KEYWORD", 2, 5, 14)
    | ids("SENTIMENT", 3, 4, 6, 7, 9)
    | ids("AI", 2, 4, 5, 8)
    | ids("CHART", 1, 2, 4, 5, 6, 7, 9, 10, 11, 12, 13, 16, 17, 18, 20, 22, 23, 24)
    | ids("FEEDBACK", 1, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22, 23, 25, 27, 28, 29)
    | ids("USER", 4, 5, 6, 7, 8, 10, 11, 13, 14, 15, 16)
    | ids("SETTINGS", 1, 2, 3, 4, 5, 12, 13)
    | ids("EXPORT", 5, 6, 7, 10)
    | ids("ACTIVITY", 2, 3, 4)
    | ids("API", 6, 13, 14, 15, 17)
)

# Cases below remain discrepant, but a source-backed subset can still be executed
# and reported independently instead of being hidden behind a requirement-only row.
EXECUTABLE_CONFIRMATION = (
    ids("AUTH", 8)
    | ids("FILTER", 22)
    | ids("USER", 1)
    | ids("ACTIVITY", 1, 7)
    | ids("API", 10, 11, 12)
)
NEEDS_CONFIRMATION -= EXECUTABLE_CONFIRMATION
PARTIAL |= EXECUTABLE_CONFIRMATION

# Active-source inventory proved these controls/routes absent or unsafe to run.
NOT_APPLICABLE |= ids("AI", 8) | ids("CHART", 4)
BLOCKED_ENVIRONMENT |= ids("CHART", 14) | ids("USER", 6)
PARTIAL -= ids("CHART", 14)
NEEDS_DATA -= ids("AI", 8) | ids("CHART", 4) | ids("USER", 6)

AUTOMATED_API = ids("API", 1, 4, 9, 19, 20, 21, 22, 24)


MUTATING = (
    ids("CHART", 17, 24)
    | ids("FEEDBACK", 12, 18, 23, 26, 27, 29)
    | ids("USER", 6, 11, 13, 14, 15)
    | ids("SETTINGS", 2, 5, 10, 14)
)


DISCREPANCIES = {
    **{tc_id: "Excel dùng email; UI/API thực tế dùng username." for tc_id in ids("AUTH", 7, 8, 10, 12)},
    **{tc_id: "Excel mô tả JWT; backend phát HMAC Bearer session hai phần." for tc_id in ids("AUTH", 1, 4, 15, 17) | ids("API", 5)},
    "AUTH-TC-16": "App dùng activeScreen; /overview chỉ là alias khởi tạo, không phải React Router route.",
    "FILTER-TC-02": "Source tính today-0; cần xác minh timezone UTC+7 ở request thực tế.",
    "FILTER-TC-03": "Source dùng today-7 đến today; nếu inclusive là 8 ngày, khác expected today-6.",
    "FILTER-TC-04": "Source dùng today-30 đến today; nếu inclusive là 31 ngày.",
    "FILTER-TC-10": "Source không chặn ngày tương lai; test giữ expected Excel và được phép fail.",
    "FILTER-TC-24": "Expected dùng query token cũ; source dùng startDate/endDate cùng mapping kênh/chủ đề hiện hành.",
    "FILTER-TC-38": "Topic UI lấy từ topicTaxonomy.ts: 5 lựa chọn active, không dùng danh sách cũ trong tài liệu.",
    "FILTER-TC-42": "Chip hiện tính từ draft nên có thể xuất hiện trước Apply dù aria ghi đang áp dụng.",
    "KEYWORD-TC-01": "Source hiện là topic summary/keyword cards, không có word cloud đúng nghĩa.",
    **{tc_id: "Source không có search/pagination/click-to-Conversations tương ứng." for tc_id in ids("KEYWORD", 3, 4, 6, 7, 8, 9, 10, 11)},
    **{tc_id: "UI Channel chỉ có vài kênh và không có pagination/sort table theo expected." for tc_id in ids("CHANNEL", 6, 7, 8)},
    **{tc_id: "Thư viện phản hồi tải tối đa 500 dòng và không có pagination/sort control." for tc_id in ids("FEEDBACK", 2, 3, 5)},
    **{tc_id: "Frontend chỉ có manager/staff; Admin được map về manager." for tc_id in ids("FEEDBACK", 26) | ids("USER", 1, 17, 18) | ids("SETTINGS", 14, 15, 16)},
    **{tc_id: "UserManagement không có pagination/sort/edit-email hoặc role trống." for tc_id in ids("USER", 2, 3, 9, 12)},
    **{tc_id: "Source active không có chức năng upload avatar." for tc_id in ids("SETTINGS", 7, 8, 9)},
    **{tc_id: "Menu export global chỉ có PDF, PNG, XLSX; CSV helper không được expose." for tc_id in ids("EXPORT", 1, 2, 3, 4)},
    "ACTIVITY-TC-01": "Activity response/UI không có cột người thực hiện; trang là timeline, không phải bảng.",
    "ACTIVITY-TC-05": "Trang chỉ gọi limit=50, offset=0; không có pagination UI.",
    "ACTIVITY-TC-06": "Nút Thời gian/Lọc kết quả hiện không có handler.",
    "ACTIVITY-TC-07": "Header cho staff mở lịch sử hoạt động của chính mình.",
    "API-TC-01": "Known defect: DB health trả connected nhưng router so với ok, nên live trả 503 dù DB/ML sẵn sàng.",
    "API-TC-05": "Request thực tế là username/password; response HMAC Bearer, không phải JWT.",
    "API-TC-07": "/api/dashboard/kpi hiện public; expected 401 cần xác nhận requirement.",
    "API-TC-10": "KPI source không có các field csat/resolutionRate như expected cũ.",
    "API-TC-11": "Sentiment summary trả counts, không trả sẵn percentage fields.",
    "API-TC-12": "Sentiment trend trả counts theo ngày, không phải percentages.",
    "API-TC-16": "/api/analytics/run không được đăng ký trong runtime active.",
    "API-TC-23": "ML schema dùng texts[]; chuỗi rỗng trong mảng hiện trả neutral 200, không phải 422.",
    "API-TC-25": "Không có active backend /api/sentiment/predict để kiểm tra timeout/fallback qua public API.",
}


def newest(pattern: str) -> Path:
    matches = sorted(PROJECT_DIR.glob(pattern), key=lambda path: path.stat().st_mtime, reverse=True)
    if not matches:
        raise FileNotFoundError(pattern)
    return matches[0]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def java_method(tc_id: str, description: str) -> str:
    normalized = unicodedata.normalize("NFD", description.replace("Đ", "D").replace("đ", "d"))
    ascii_text = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    words = re.findall(r"[A-Za-z0-9]+", ascii_text)[:12]
    prefix = tc_id.lower().replace("-", "")
    if not words:
        return prefix
    return prefix + "".join(word[:1].upper() + word[1:] for word in words)


def classify(tc_id: str, surface: str) -> str:
    if tc_id in NOT_APPLICABLE:
        return "NOT_APPLICABLE"
    if tc_id in NEEDS_CONFIRMATION:
        return "NEEDS_REQUIREMENT_CONFIRMATION"
    if tc_id in BLOCKED_ENVIRONMENT:
        return "BLOCKED_ENVIRONMENT"
    if tc_id in MANUAL_ONLY:
        return "MANUAL_ONLY"
    if tc_id in PARTIAL:
        return "PARTIALLY_AUTOMATED"
    if tc_id in NEEDS_DATA:
        return "NEEDS_TEST_DATA"
    if tc_id in AUTOMATED_API or surface in {"API", "ML"}:
        return "AUTOMATED_API"
    return "AUTOMATED_UI"


def implementation_status(classification: str) -> str:
    if classification in {"AUTOMATED_UI", "AUTOMATED_API"}:
        return "IMPLEMENTED"
    if classification == "PARTIALLY_AUTOMATED":
        return "IMPLEMENTED_PARTIAL"
    if classification == "NEEDS_TEST_DATA":
        return "IMPLEMENTED_GATED"
    return "IMPLEMENTED_SKIP_GUARD"


def test_type(description: str) -> str:
    value = description.lower()
    if any(token in value for token in ("token", "cors", "quyền", "khóa", "401", "giả mạo")):
        return "Security/RBAC"
    if any(token in value for token in ("500", "timeout", "down", "lỗi api", "không treo")):
        return "Resilience/Error handling"
    if any(token in value for token in ("bỏ trống", "sai định dạng", "validation", "không hợp lệ", "422")):
        return "Validation/Negative"
    if any(token in value for token in ("api", "database", "ml service", "request", "response")):
        return "Integration/API"
    if any(token in value for token in ("màu", "tooltip", "legend", "layout", "kích thước")):
        return "UI/Visual functional"
    return "Functional"


def reason_for(classification: str, tc_id: str) -> str:
    if classification == "NOT_APPLICABLE":
        return "Control/endpoint/role được mô tả không tồn tại trong luồng active hiện tại."
    if classification == "NEEDS_REQUIREMENT_CONFIRMATION":
        return "Expected Result của Excel xung đột với contract/source active; cần Product Owner xác nhận trước khi tự động hóa như một tiêu chí pass/fail."
    if classification == "BLOCKED_ENVIRONMENT":
        return "Cần môi trường cô lập hoặc fault injection lặp lại được; không được dừng service/DB dùng chung hay sửa production để tạo lỗi."
    if classification == "MANUAL_ONLY":
        return "Cần đánh giá nghiệp vụ/ngữ nghĩa chủ quan; assertion tự động hiện không đủ đáng tin cậy."
    if classification == "NEEDS_TEST_DATA":
        return "Có thể tự động hóa nhưng cần credential/fixture DB hoặc record định danh chưa được cung cấp."
    if classification == "PARTIALLY_AUTOMATED":
        return "Tự động hóa được phần DOM/request/schema; phần trực quan, timing hoặc đối chiếu dữ liệu tuyệt đối cần bằng chứng bổ sung."
    return ""


def dependencies(tc_id: str, module: str, surface: str) -> tuple[str, str, str]:
    backend = "Có"
    database = "Không"
    ml = "Không"
    if module in {"Bộ lọc dữ liệu", "Tổng quan", "Phân tích theo kênh", "Từ khóa nổi bật", "Phân tích cảm xúc", "Hiệu suất AI", "Tạo biểu đồ ", "Thư viện phản hồi", "Quản lý người dùng", "Cài đặt", "Lịch sử hoạt động"}:
        database = "Có"
    if module in {"Phân tích cảm xúc"}:
        ml = "Có"
    if tc_id.startswith("API-TC-"):
        database = "Có" if tc_id in ids("API", 1, 2, 5, 6, 10, 11, 12, 13, 14, 15, 17, 18) else "Không"
        ml = "Có" if tc_id in ids("API", 1, 3, 4, 20, 21, 22, 23, 24, 25) else "Không"
    if module == "Xác thực người dùng" and tc_id in ids("AUTH", 8, 9, 10, 16):
        database = "Không"
    if surface == "ML":
        backend = "Không"
        ml = "Có"
    return backend, database, ml


def test_data(tc_id: str, classification: str) -> str:
    if tc_id.startswith("AUTH-") or tc_id in ids("API", 5, 6, 8, 13, 14, 15, 17):
        return "FLIC_MANAGER_USERNAME/PASSWORD hoặc FLIC_STAFF_USERNAME/PASSWORD; không commit secret."
    if tc_id.startswith("ML-") or tc_id.startswith("API-TC-2"):
        return "Câu tiếng Việt rõ nghĩa; model/mode/version phải được khóa trong báo cáo chạy."
    if tc_id in MUTATING:
        return f"AUTO_{tc_id}_<timestamp>; chỉ fixture do automation tạo; cleanup qua public API nếu có."
    if classification == "NEEDS_TEST_DATA":
        return "Fixture DB có dữ liệu phù hợp bộ lọc và ID ổn định; chưa được cung cấp."
    return "Dữ liệu đọc-only hiện có hoặc input biên ghi trong workbook."


def prerequisites(tc_id: str, section: Section, classification: str) -> str:
    values = []
    if section.surface in {"UI", "UI/API", "UI/ML"}:
        values.append("Frontend :5173")
        if not (tc_id.startswith("AUTH-") and tc_id in ids("AUTH", 8, 9, 10, 16)):
            values.append("tài khoản phù hợp")
    if section.surface in {"API", "UI/API"} or section.module != "Xác thực người dùng":
        values.append("Backend :5000")
    if section.surface in {"ML", "UI/ML"} or tc_id in ids("API", 1, 3, 4, 20, 21, 22, 23, 24, 25):
        values.append("ML :8001")
    if classification == "BLOCKED_ENVIRONMENT":
        values.append("môi trường fault-injection cô lập")
    return "; ".join(dict.fromkeys(values))


def groups(tc_id: str, section: Section, classification: str, mutating: bool) -> str:
    result = [section.primary_group, "regression"]
    if tc_id in {"AUTH-TC-09", "AUTH-TC-16", "API-TC-01", "API-TC-04", "API-TC-09", "API-TC-19", "API-TC-20"}:
        result.append("smoke")
    if section.surface in {"API", "ML", "UI/API"}:
        result.append("api")
    if section.surface in {"ML", "UI/ML"} or tc_id in ids("API", 20, 21, 22, 23, 24, 25):
        result.extend(["ml", "requires-ml"])
    if section.module not in {"Xác thực người dùng", "Xuất dữ liệu"} or tc_id in NEEDS_DATA:
        result.append("requires-db")
    if classification == "BLOCKED_ENVIRONMENT":
        result.append("environment-dependent")
    if classification in {"NOT_APPLICABLE", "NEEDS_REQUIREMENT_CONFIRMATION", "MANUAL_ONLY", "BLOCKED_ENVIRONMENT"}:
        result.append("skip-guard")
    if mutating:
        result.extend(["destructive", "requires-db"])
    if section.module in {"Tạo biểu đồ ", "Quản lý người dùng"} or tc_id in ids("FEEDBACK", 21, 22, 23, 24, 26, 27, 29):
        result.append("requires-manager")
    return ", ".join(dict.fromkeys(result))


def md(value: object) -> str:
    if value is None:
        return ""
    return str(value).replace("\\", "\\\\").replace("|", "\\|").replace("\r\n", "<br>").replace("\n", "<br>").strip()


def main() -> None:
    test_cases_path = newest("FLIC_Test_Cases_By_Module*.xlsx")
    test_plan_path = newest("FLIC_Test_Plan*.xlsx")
    workbook = openpyxl.load_workbook(test_cases_path, data_only=True, read_only=False)

    records = []
    seen: set[str] = set()
    for sheet in workbook.worksheets[1:]:
        heading = ""
        for row in sheet.iter_rows(min_row=2, max_col=8, values_only=True):
            first = row[0]
            if isinstance(first, str) and re.fullmatch(r"[A-Z]+-TC-\d{2}", first.strip()):
                tc_id = first.strip()
                if tc_id in seen:
                    raise ValueError(f"Duplicate TC ID: {tc_id}")
                seen.add(tc_id)
                key = (sheet.title.strip(), heading)
                section = SECTION_BY_KEY.get(key)
                if not section:
                    raise KeyError(f"Missing section mapping: {key}")
                description = str(row[1] or "").strip()
                classification = classify(tc_id, section.surface)
                mutating = tc_id in MUTATING
                backend, database, ml = dependencies(tc_id, section.module, section.surface)
                records.append({
                    "tc_id": tc_id,
                    "module": sheet.title.strip(),
                    "heading": heading,
                    "name": description,
                    "steps": row[2] or "",
                    "expected": row[3] or "",
                    "note": row[6] or "",
                    "test_type": test_type(description),
                    "surface": section.surface,
                    "owner": section.owner,
                    "prerequisites": prerequisites(tc_id, section, classification),
                    "test_data": test_data(tc_id, classification),
                    "automatable": "Không" if classification in {"NOT_APPLICABLE", "MANUAL_ONLY", "NEEDS_REQUIREMENT_CONFIRMATION"} else ("Một phần" if classification == "PARTIALLY_AUTOMATED" else "Có"),
                    "classification": classification,
                    "implementation": implementation_status(classification),
                    "file": section.file_name,
                    "class": section.class_name,
                    "method": java_method(tc_id, description),
                    "groups": groups(tc_id, section, classification, mutating),
                    "backend": backend,
                    "database": database,
                    "ml": ml,
                    "mutating": "Có" if mutating else "Không",
                    "reason": reason_for(classification, tc_id),
                    "discrepancy": DISCREPANCIES.get(tc_id, ""),
                })
            elif first:
                heading = str(first).strip()

    if len(records) != 258:
        raise ValueError(f"Expected 258 TC rows, found {len(records)}")
    if len(SECTIONS) != 54:
        raise ValueError(f"Expected 54 sections, found {len(SECTIONS)}")

    counts = Counter(record["classification"] for record in records)
    module_counts = Counter(record["module"] for record in records)
    generated_at = datetime.now().astimezone().isoformat(timespec="seconds")
    lines = [
        "# TEST CASE TRACEABILITY – Selenium Java/TestNG",
        "",
        "> Đã ánh xạ đủ 258 TC ID sang 258 `@Test` method. `IMPLEMENTED_GATED` và `IMPLEMENTED_SKIP_GUARD` chỉ cho biết đã có guard/logic truy vết; không được tính Pass khi chưa thực thi.",
        "",
        "## Nguồn đã sử dụng",
        "",
        f"- Test cases: `{test_cases_path.name}` — mtime `{datetime.fromtimestamp(test_cases_path.stat().st_mtime).astimezone().isoformat(timespec='milliseconds')}` — SHA-256 `{sha256(test_cases_path)}`.",
        f"- Test plan: `{test_plan_path.name}` — mtime `{datetime.fromtimestamp(test_plan_path.stat().st_mtime).astimezone().isoformat(timespec='milliseconds')}` — SHA-256 `{sha256(test_plan_path)}`.",
        "- Tài liệu: `FLIC_Tester_SKILL_TestPlan_Ready.md`, `README.md`, `docs/mo-ta-chuc-nang-trang-web.md`.",
        "- Source active: `src/app/`, `backend/app/`, `ml-service/app/`; loại `archive/`, prototype/import note, code comment/unregistered.",
        "- Existing tests: `tests/e2e/`, `tests/unit/`, `backend/tests/`, `backend/tests_fastapi/`, `ml-service/tests/`.",
        f"- Sinh lúc: `{generated_at}`.",
        "",
        "Workbook được lọc bằng regex TC ID thay vì UsedRange vì một số sheet bị format tới dòng 999/1000. Kết quả: **258 TC duy nhất**, **14 module**, **54 section lớn**; Test Plan có **63 task** nhưng không có khóa quan hệ chính thức tới từng TC.",
        "",
        "## Tổng hợp phân loại",
        "",
        "| Phân loại | Số TC |",
        "|---|---:|",
    ]
    for status in ["AUTOMATED_UI", "AUTOMATED_API", "PARTIALLY_AUTOMATED", "BLOCKED_ENVIRONMENT", "NEEDS_TEST_DATA", "NEEDS_REQUIREMENT_CONFIRMATION", "MANUAL_ONLY", "NOT_APPLICABLE"]:
        lines.append(f"| {status} | {counts[status]} |")
    lines.extend(["", "### Theo module", "", "| Module | Số TC |", "|---|---:|"])
    for module, count in module_counts.items():
        lines.append(f"| {md(module)} | {count} |")
    lines.extend([
        "",
        "## Sai lệch nền tảng cần giữ nguyên trong trace",
        "",
        "- Login active dùng username/password; Excel vẫn dùng Email ở nhiều TC.",
        "- Backend phát HMAC Bearer session hai phần; không phải JWT ba phần.",
        "- Role frontend/backend thực dùng `manager`/`staff`; `ADMIN`/`MANAGER` được frontend map về `manager`.",
        "- Điều hướng dùng `activeScreen`; URL path chỉ là alias khởi tạo, không phải React Router đầy đủ.",
        "- Topic lấy từ `topicTaxonomy.ts`; filter UI hiện có 5 topic active, không dùng taxonomy cũ trong tài liệu.",
        "- Global export menu chỉ expose PDF/PNG/XLSX; CSV helper có trong code nhưng không có control active.",
        "- Activity History cho cả manager/staff, không có pagination/filter handler và không có cột actor.",
        "- Không sửa Expected Result trong Excel; các xung đột được giữ ở cột cuối và phân loại confirmation/N/A.",
        "",
        "## Bảng truy vết 258 test case",
        "",
        "| TC ID | Module | Task name / test case lớn | Tên test case nhỏ | Mô tả | Bước thực hiện (Excel) | Kết quả mong đợi (Excel) | Loại kiểm thử | UI/API/ML | Page Object / API Client | Điều kiện tiên quyết | Dữ liệu kiểm thử | Có thể tự động hóa | Phân loại | Trạng thái triển khai | File Java | Class | Method | TestNG group | Backend | Database | ML Service | Thay đổi dữ liệu | Lý do nếu chưa tự động hóa | Sai lệch Excel/source |",
        "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ])

    for record in records:
        description = f"Kiểm tra: {record['name']}"
        row = [
            record["tc_id"], record["module"], record["heading"], record["name"], description,
            record["steps"], record["expected"], record["test_type"], record["surface"], record["owner"],
            record["prerequisites"], record["test_data"], record["automatable"], record["classification"],
            record["implementation"], record["file"], record["class"], record["method"], record["groups"],
            record["backend"], record["database"], record["ml"], record["mutating"], record["reason"], record["discrepancy"],
        ]
        lines.append("| " + " | ".join(md(value) for value in row) + " |")

    TRACE_PATH.parent.mkdir(parents=True, exist_ok=True)
    TRACE_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"WROTE={TRACE_PATH}")
    print(f"TC_COUNT={len(records)} UNIQUE={len(seen)} SECTIONS={len(SECTIONS)}")
    print("STATUS_COUNTS=" + ",".join(f"{key}:{counts[key]}" for key in sorted(counts)))


if __name__ == "__main__":
    main()
