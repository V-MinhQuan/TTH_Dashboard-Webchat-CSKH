from __future__ import annotations

import re
import sys
from pathlib import Path

import openpyxl

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
import generate_traceability as gt  # noqa: E402


JAVA_DIR = gt.OUTPUT_DIR / "src" / "test" / "java" / "com" / "flic" / "automation" / "tests" / "ui"


def java(value: object) -> str:
    return str(value or "").replace("\\", "\\\\").replace('"', '\\"').replace("\r", "").replace("\n", "\\n")


def javadoc(value: object) -> str:
    return str(value or "").replace("*/", "* /").replace("\r", "").replace("\n", "<br>")


def skip_body(status: str, reason: str, discrepancy: str) -> str:
    detail = f"{status}: {reason}"
    if discrepancy:
        detail += f" Sai lệch: {discrepancy}"
    return f'throw new SkipException("{java(detail)}");'


def auth_body(tc_id: str) -> str:
    bodies = {
        "AUTH-TC-02": """openLogin();
        LoginPage page = loginPage();
        page.login(config().managerUsernameRequired(), config().managerPasswordRequired(), false);
        Assert.assertTrue(sidebar().hasMenu("Tổng quan"), "Manager phải vào được workspace sau login");
        Assert.assertFalse(sessionStorage("flic_dashboard_auth").isBlank(), "Session auth phải được lưu khi không Remember");""",
        "AUTH-TC-03": """openLogin();
        LoginPage page = loginPage();
        page.login(config().staffUsernameRequired(), config().staffPasswordRequired(), false);
        Assert.assertTrue(sidebar().hasMenu("Tổng quan"), "Staff phải vào được workspace");
        Assert.assertFalse(sidebar().hasMenu("Kênh"), "Staff không được thấy menu phân tích Kênh");""",
        "AUTH-TC-05": """openLogin();
        LoginPage page = loginPage().enterUsername(config().managerUsernameRequired()).enterPassword(config().managerPasswordRequired());
        page.submit();
        Assert.assertTrue(page.isSubmitting() || sidebar().isVisible(), "Nút phải disabled/loading trong lúc request hoặc login đã hoàn tất");""",
        "AUTH-TC-06": """openLogin();
        LoginPage page = loginPage().enterUsername(config().managerUsernameRequired()).enterPassword("AUTO_INCORRECT_PASSWORD");
        page.submit();
        Assert.assertFalse(page.errorMessage().isBlank(), "Sai mật khẩu phải hiển thị lỗi");
        Assert.assertTrue(localStorage("flic_dashboard_auth").isBlank() && sessionStorage("flic_dashboard_auth").isBlank(), "Không được tạo auth storage");""",
        "AUTH-TC-08": """openLogin();
        LoginPage page = loginPage().enterPassword("AUTO_NOT_SUBMITTED");
        page.submit();
        Assert.assertTrue(page.errorMessage().contains("đầy đủ"), "Trường username trống phải bị chặn; Excel đang gọi trường này là Email");
        Assert.assertTrue(localStorage("flic_dashboard_auth").isBlank() && sessionStorage("flic_dashboard_auth").isBlank());""",
        "AUTH-TC-09": """openLogin();
        LoginPage page = loginPage().enterUsername("automation-user");
        page.submit();
        Assert.assertTrue(page.errorMessage().contains("đầy đủ"), "Thiếu mật khẩu phải bị validation trước API");
        Assert.assertTrue(localStorage("flic_dashboard_auth").isBlank() && sessionStorage("flic_dashboard_auth").isBlank());""",
        "AUTH-TC-11": """openLogin();
        LoginPage page = loginPage().enterUsername(config().managerUsernameRequired()).enterPassword(" " + config().managerPasswordRequired() + " ");
        page.submit();
        Assert.assertFalse(page.errorMessage().isBlank(), "Password có whitespace phải bị backend từ chối rõ ràng");""",
        "AUTH-TC-13": """loginAsManager();
        header().openAvatarMenu();
        header().requestLogout();
        header().confirmLogout();
        Assert.assertTrue(new LoginPage(driver()).isLoaded(), "Logout phải đưa về Login");
        Assert.assertTrue(localStorage("flic_dashboard_auth").isBlank() && sessionStorage("flic_dashboard_auth").isBlank(), "Logout phải xóa cả hai storage");""",
        "AUTH-TC-14": """loginAsManager();
        header().openAvatarMenu();
        header().requestLogout();
        header().confirmLogout();
        driver().navigate().back();
        Assert.assertTrue(new LoginPage(driver()).isLoaded(), "Back sau logout không được lộ dashboard");""",
        "AUTH-TC-16": """driver().get(config().baseUrl());
        clearAuthentication();
        driver().get(config().baseUrl() + "/overview");
        Assert.assertTrue(new LoginPage(driver()).isLoaded(), "URL nội bộ phải hiển thị Login khi chưa có session");""",
        "AUTH-TC-17": """loginAsManager();
        tamperStoredAccessToken();
        driver().navigate().refresh();
        openScreen("overview");
        Assert.assertTrue(waitForLoginOrUnauthorized(), "HMAC Bearer bị sửa phải dẫn đến 401 và xóa session");""",
    }
    return bodies.get(tc_id, "")


def filter_body(tc_id: str) -> str:
    number = int(tc_id.rsplit("-", 1)[1])
    setup = """loginAsManager();
        openScreen("overview");
        GlobalFilterComponent filter = globalFilter();
        filter.expand();
        """
    if number == 1:
        action = 'Assert.assertEquals(filter.optionTexts("Khoảng thời gian"), List.of("30 ngày qua", "7 ngày qua", "Hôm nay", "Tùy chỉnh"));'
    elif number in {2, 3, 4}:
        value = {2: "Hôm nay", 3: "7 ngày qua", 4: "30 ngày qua"}[number]
        action = f'''filter.selectDateRange("{value}");
        int before = apiRequestCount();
        filter.apply();
        Assert.assertEquals(filter.selectedDateRange(), "{value}");
        Assert.assertTrue(waitForApiRequestAfter(before, "/api/dashboard"), "Apply phải gọi API dashboard");'''
    elif number == 5:
        action = 'filter.selectDateRange("Tùy chỉnh");\n        Assert.assertTrue(filter.customDateInputsVisible());'
    elif number == 6:
        action = 'filter.selectDateRange("7 ngày qua");\n        filter.selectDateRange("Tùy chỉnh");\n        Assert.assertTrue(filter.customDateInputsVisible());'
    elif number == 7:
        action = 'filter.selectDateRange("Tùy chỉnh");\n        filter.selectDateRange("30 ngày qua");\n        Assert.assertFalse(filter.customDateInputsVisible());'
    elif number in {8, 13, 25}:
        action = '''filter.selectDateRange("Tùy chỉnh");
        filter.setRawCustomDates("", "2026-07-01");
        int before = apiRequestCount();
        filter.apply();
        Assert.assertTrue(toastText().contains("đầy đủ"), "Thiếu ngày phải có toast validation");
        Assert.assertEquals(apiRequestCount(), before, "Validation không được gọi API mới");'''
    elif number in {9, 12}:
        action = '''filter.selectDateRange("Tùy chỉnh");
        filter.setRawCustomDates("2025-13-99", "2025-02-28");
        Assert.assertNotEquals(filter.customDateFrom(), "2025-13-99", "Browser/date input không được giữ ngày vô hiệu");'''
    elif number == 10:
        action = '''filter.selectDateRange("Tùy chỉnh");
        LocalDate future = LocalDate.now().plusDays(1);
        filter.setCustomDateRange(future, future);
        filter.apply();
        Assert.assertTrue(toastText().toLowerCase().contains("tương lai"), "Expected Excel yêu cầu chặn ngày tương lai");'''
    elif number == 11:
        action = '''filter.selectDateRange("Tùy chỉnh");
        filter.setCustomDateRange(LocalDate.of(2025, 6, 1), LocalDate.of(2025, 6, 2));
        filter.apply();
        Assert.assertTrue(toastText().contains("Đã áp dụng"));'''
    elif number == 14:
        action = '''filter.selectDateRange("Tùy chỉnh");
        filter.setCustomDateRange(LocalDate.of(2025, 6, 15), LocalDate.of(2025, 6, 10));
        filter.apply();
        Assert.assertTrue(toastText().contains("trước"), "Range đảo phải bị từ chối");'''
    elif number == 15:
        action = '''filter.selectDateRange("Tùy chỉnh");
        filter.setCustomDateRange(LocalDate.of(2025, 6, 10), LocalDate.of(2025, 6, 10));
        filter.apply();
        Assert.assertTrue(toastText().contains("Đã áp dụng"));'''
    elif number == 16:
        action = '''filter.selectDateRange("Tùy chỉnh");
        filter.setRawCustomDates("2025-06-01", "abc");
        Assert.assertNotEquals(filter.customDateTo(), "abc");'''
    elif number == 17:
        action = '''filter.selectDateRange("Tùy chỉnh");
        filter.setCustomDateRange(LocalDate.of(2025, 6, 1), LocalDate.of(2025, 6, 30));
        filter.apply();
        Assert.assertTrue(toastText().contains("Đã áp dụng"));'''
    elif number in {18, 19, 20}:
        dates = {18: ("2025, 5, 25", "2025, 6, 10"), 19: ("2024, 12, 1", "2025, 1, 31"), 20: ("2024, 2, 29", "2024, 3, 1")}[number]
        action = f'''filter.selectDateRange("Tùy chỉnh");
        filter.setCustomDateRange(LocalDate.of({dates[0]}), LocalDate.of({dates[1]}));
        filter.apply();
        Assert.assertTrue(toastText().contains("Đã áp dụng"));'''
    elif number == 21:
        action = '''filter.selectDateRange("Tùy chỉnh");
        filter.setRawCustomDates("2025-02-29", "2025-03-01");
        Assert.assertNotEquals(filter.customDateFrom(), "2025-02-29");'''
    elif number == 22:
        action = '''filter.selectDateRange("Tùy chỉnh");
        filter.setCustomDateRange(LocalDate.of(2024, 1, 1), LocalDate.of(2024, 12, 31));
        filter.apply();
        Assert.assertTrue(toastText().contains("Đã áp dụng") || toastText().toLowerCase().contains("quá dài"), "Expected cho phép áp dụng hoặc cảnh báo rõ ràng, nhưng không crash");
        Assert.assertFalse(SourceBackedUiAssertions.hasBlankApplicationShell(driver()));'''
    elif number == 23:
        action = '''filter.selectDateRange("Tùy chỉnh");
        filter.setCustomDateRange(LocalDate.of(2010, 1, 1), LocalDate.of(2010, 1, 1));
        filter.apply();
        Assert.assertTrue(SourceBackedUiAssertions.hasEmptyStateOrZeroData(driver()), "Khoảng ngoài dữ liệu phải có empty/zero state");'''
    elif number == 24:
        action = '''selectFirstNonDefault(filter, "Kênh");
        selectFirstNonDefault(filter, "Chủ đề");
        filter.selectDateRange("7 ngày qua");
        int before = apiRequestCount();
        filter.apply();
        Assert.assertTrue(waitForApiRequestAfter(before, "/api/"));
        Assert.assertTrue(latestApiRequestUrl().contains("startDate"));'''
    elif number == 26:
        action = '''filter.selectDateRange("7 ngày qua");
        int before = apiRequestCount();
        filter.apply(); filter.apply(); filter.apply();
        waitForNetworkQuiet();
        Assert.assertEquals(apiRequestCount() - before, 1, "Expected chỉ một request cuối sau click liên tiếp");'''
    elif number == 27:
        action = '''String beforeState = SourceBackedUiAssertions.dashboardDataFingerprint(driver());
        filter.selectDateRange("7 ngày qua");
        filter.apply();
        waitForNetworkQuiet();
        String afterState = SourceBackedUiAssertions.dashboardDataFingerprint(driver());
        Assert.assertNotEquals(afterState, "", "Dashboard phải có trạng thái dữ liệu sau Apply");
        Assert.assertFalse(beforeState.isBlank());'''
    elif number in {28, 29, 30, 31}:
        action = '''filter.selectDateRange("Tùy chỉnh");
        filter.setCustomDateRange(LocalDate.of(2025, 6, 1), LocalDate.of(2025, 6, 2));
        selectFirstNonDefault(filter, "Kênh");
        filter.apply();
        int before = apiRequestCount();
        filter.reset();
        Assert.assertEquals(filter.selectedDateRange(), "30 ngày qua");
        Assert.assertEquals(filter.selectedChannel(), "Tất cả");
        Assert.assertTrue(filter.activeChips().isEmpty());
        Assert.assertTrue(waitForApiRequestAfter(before, "/api/"));'''
    elif number == 32:
        action = '''filter.selectChannel("Tất cả");
        filter.apply();
        Assert.assertEquals(filter.selectedChannel(), "Tất cả");'''
    elif number in {33, 34, 35, 36}:
        channel = {33: "Zalo OA", 34: "Zalo Business", 35: "Facebook", 36: "Chat Widget"}[number]
        action = f'''requireOption(filter, "Kênh", "{channel}");
        filter.selectChannel("{channel}");
        filter.apply();
        Assert.assertEquals(filter.selectedChannel(), "{channel}");'''
    elif number == 37:
        action = '''selectConfiguredEmptyChannel(filter);
        filter.apply();
        Assert.assertTrue(SourceBackedUiAssertions.hasEmptyStateOrZeroData(driver()));'''
    elif number == 38:
        action = '''Assert.assertEquals(filter.optionTexts("Chủ đề"), List.of("Tất cả", "Sát hạch CNTT", "TOEIC", "MOS", "Học Tiếng Anh", "Học Tin học"));'''
    elif number == 39:
        action = 'filter.selectTopic("Tất cả");\n        filter.apply();\n        Assert.assertEquals(filter.selectedTopic(), "Tất cả");'
    elif number == 40:
        action = '''String topic = firstNonDefaultOption(filter, "Chủ đề");
        filter.selectTopic(topic);
        int before = apiRequestCount();
        filter.apply();
        Assert.assertTrue(waitForApiRequestAfter(before, "/api/"));
        Assert.assertTrue(latestApiRequestUrl().toLowerCase().contains("topic"));'''
    elif number == 41:
        action = '''selectConfiguredEmptyTopic(filter);
        filter.apply();
        Assert.assertTrue(SourceBackedUiAssertions.hasEmptyStateOrZeroData(driver()));'''
    elif number == 42:
        action = '''selectFirstNonDefault(filter, "Kênh");
        selectFirstNonDefault(filter, "Chủ đề");
        filter.apply();
        Assert.assertTrue(filter.activeChips().stream().anyMatch(v -> v.contains("Kênh")));
        Assert.assertTrue(filter.activeChips().stream().anyMatch(v -> v.contains("Chủ đề")));'''
    elif number in {43, 44, 45, 46}:
        label = {43: "Kênh", 44: "Chủ đề", 45: "Thời gian", 46: "Kênh"}[number]
        action = f'''filter.selectDateRange("7 ngày qua");
        selectFirstNonDefault(filter, "Kênh");
        selectFirstNonDefault(filter, "Chủ đề");
        filter.apply();
        filter.removeFirstChip("{label}");
        Assert.assertFalse(filter.activeChips().stream().anyMatch(v -> v.startsWith("{label}:")));
        Assert.assertEquals(filter.selectedValueForChip("{label}"), filter.defaultValueForChip("{label}"));'''
    elif number in {47, 48, 49, 50}:
        selects = []
        if number in {47, 48, 50}:
            selects.append('filter.selectDateRange("7 ngày qua");')
        if number in {47, 49, 50}:
            selects.append('selectFirstNonDefault(filter, "Kênh");')
        if number in {48, 49, 50}:
            selects.append('selectFirstNonDefault(filter, "Chủ đề");')
        action = "\n        ".join(selects) + '''
        int before = apiRequestCount();
        filter.apply();
        Assert.assertTrue(waitForApiRequestAfter(before, "/api/"));
        Assert.assertFalse(latestApiRequestUrl().isBlank());'''
    elif number == 51:
        action = '''Assert.assertEquals(filter.selectedDateRange(), "30 ngày qua");
        Assert.assertEquals(filter.selectedChannel(), "Tất cả");
        Assert.assertEquals(filter.selectedTopic(), "Tất cả");
        Assert.assertTrue(filter.activeChips().isEmpty());'''
    else:
        action = 'Assert.fail("Missing filter test body");'
    return setup + action


def non_filter_body(record: dict) -> str:
    tc_id = record["tc_id"]
    prefix, number_text = tc_id.split("-TC-")
    number = int(number_text)
    module = record["module"]
    setup_by_module = {
        "Tổng quan": ('overview', 'OverviewPage page = new OverviewPage(driver()).waitUntilReady();'),
        "Phân tích theo kênh": ('channel', 'ChannelAnalysisPage page = new ChannelAnalysisPage(driver()).waitUntilReady();'),
        "Từ khóa nổi bật": ('keyword', 'KeywordAnalysisPage page = new KeywordAnalysisPage(driver()).waitUntilReady();'),
        "Phân tích cảm xúc": ('sentiment', 'SentimentAnalysisPage page = new SentimentAnalysisPage(driver()).waitUntilReady();'),
        "Hiệu suất AI": ('aiinsights', 'AiInsightsPage page = new AiInsightsPage(driver()).waitUntilReady();'),
        "Tạo biểu đồ": ('chartbuilder', 'ChartBuilderPage page = new ChartBuilderPage(driver()).waitUntilCatalogReady();'),
        "Thư viện phản hồi": ('chatbot_sheet', 'FeedbackLibraryPage page = new FeedbackLibraryPage(driver()).waitUntilReady();'),
        "Quản lý người dùng": ('users', 'UserManagementPage page = new UserManagementPage(driver()).waitUntilReady();'),
        "Cài đặt": ('settings', 'SettingsPage page = new SettingsPage(driver()).waitUntilReady();'),
        "Xuất dữ liệu": ('overview', 'OverviewPage page = new OverviewPage(driver()).waitUntilReady();'),
        "Lịch sử hoạt động": ('activity_history', 'ActivityHistoryPage page = new ActivityHistoryPage(driver()).waitUntilReady();'),
    }
    screen, page_init = setup_by_module[module]
    role = "loginAsStaff();" if tc_id in {"USER-TC-05", "USER-TC-16", "FEEDBACK-TC-25", "FEEDBACK-TC-28", "EXPORT-TC-11", "ACTIVITY-TC-07"} else "loginAsManager();"
    setup = f'''{role}
        openScreen("{screen}");
        {page_init}
        '''

    if prefix == "OVERVIEW":
        actions = {
            1: 'Assert.assertTrue(SourceBackedUiAssertions.loadingOrMeaningfulContent(driver()));',
            2: 'SourceBackedUiAssertions.assertNumericText(page.kpiValue("Tổng hội thoại"));',
            3: 'SourceBackedUiAssertions.assertGrowthIndicatorsUseSemanticColors(driver());',
            4: 'applyKnownEmptyDate(page.filters());\n        Assert.assertTrue(page.isEmpty() || SourceBackedUiAssertions.hasZeroKpi(driver()));',
            6: 'assertFilterTriggersDataRequest(page.filters(), "7 ngày qua");',
            7: 'ChartAssertions.assertTooltipOnFirstRenderableChart(driver());',
            8: 'ChartAssertions.assertLegendHasLabels(driver());',
            9: 'ChartAssertions.assertXAxisHasLabels(driver());',
            10: 'applyKnownEmptyDate(page.filters());\n        Assert.assertTrue(page.isEmpty());',
            11: 'assertFilterTriggersDataRequest(page.filters(), "7 ngày qua");\n        ChartAssertions.assertEveryVisibleChartHasGeometry(driver());',
            12: 'String selected = page.filters().selectedDateRange();\n        int before = apiRequestCount();\n        page.refresh();\n        Assert.assertTrue(waitForApiRequestAfter(before, "/api/dashboard"));\n        Assert.assertEquals(page.filters().selectedDateRange(), selected);',
            13: 'String before = SourceBackedUiAssertions.textMatching(driver(), "Cập nhật lúc");\n        page.refresh();\n        Assert.assertNotEquals(SourceBackedUiAssertions.waitForTextChange(driver(), before), before);',
        }
        action = actions[number]
    elif prefix == "CHANNEL":
        actions = {
            1: 'Assert.assertEquals(SourceBackedUiAssertions.channelPercentageTotal(driver()), 100.0, 0.5);',
            2: 'ChartAssertions.assertTooltipOnFirstRenderableChart(driver());',
            3: 'applyKnownEmptyDate(page.filters());\n        Assert.assertTrue(page.isEmpty());',
            4: 'assertFilterTriggersDataRequest(page.filters(), "7 ngày qua");',
            5: 'SourceBackedUiAssertions.assertTableHasHeaders(driver(), List.of("KÊNH", "HỘI THOẠI"));',
            9: 'applyKnownEmptyDate(page.filters());\n        Assert.assertTrue(page.isEmpty());',
            11: 'page.filters().openExportMenu();\n        page.filters().exportXlsx();\n        ExcelUtils.assertReadable(waitForDownload(".xlsx"));',
        }
        action = actions[number]
    elif prefix == "KEYWORD":
        actions = {
            2: 'SourceBackedUiAssertions.assertKeywordCountsDescending(driver());',
            5: 'applyKnownEmptyDate(page.filters());\n        Assert.assertTrue(page.displayedTopicGroups().isEmpty() || SourceBackedUiAssertions.hasEmptyStateOrZeroData(driver()));',
            14: 'page.filters().selectChannel("Tất cả");\n        page.filters().apply();\n        Assert.assertFalse(page.hasLoadError());\n        Assert.assertFalse(page.displayedTopicGroups().isEmpty());',
        }
        action = actions[number]
    elif prefix == "SENTIMENT":
        actions = {
            1: 'Assert.assertEquals(SourceBackedUiAssertions.sentimentPercentageTotal(driver()), 100.0, 0.5);',
            2: 'ChartAssertions.assertLegendColorsMatchSeries(driver());',
            3: 'assertFilterTriggersDataRequest(page.filters(), "7 ngày qua");',
            4: 'applyKnownEmptyDate(page.filters());\n        Assert.assertTrue(SourceBackedUiAssertions.hasEmptyStateOrZeroData(driver()));',
            5: 'Assert.assertTrue(SourceBackedUiAssertions.loadingOrMeaningfulContent(driver()));',
            6: 'ChartAssertions.assertEveryVisibleChartHasGeometry(driver());',
            7: 'SourceBackedUiAssertions.assertTableHasHeaders(driver(), List.of("KHÁCH HÀNG", "CẢM XÚC"));',
            8: 'SourceBackedUiAssertions.openFirstTableRow(driver());\n        Assert.assertTrue(SourceBackedUiAssertions.hasDialogOrDetailPanel(driver()));',
            9: 'String before = page.negativePageIndicator();\n        page.nextNegativePage();\n        Assert.assertNotEquals(page.negativePageIndicator(), before);',
            10: 'page.filters().openExportMenu();\n        page.filters().exportXlsx();\n        ExcelUtils.assertReadable(waitForDownload(".xlsx"));',
        }
        action = actions[number]
    elif prefix == "AI":
        actions = {
            1: 'long started = System.nanoTime();\n        Assert.assertFalse(page.failedConversationRows().isEmpty() && SourceBackedUiAssertions.hasLoadError(driver()));\n        Assert.assertTrue(Duration.ofNanos(System.nanoTime() - started).toSeconds() < 10);',
            2: 'Assert.assertTrue(SourceBackedUiAssertions.loadingOrMeaningfulContent(driver()));',
            4: 'assertFilterTriggersDataRequest(page.filters(), "7 ngày qua");',
            5: 'applyKnownEmptyDate(page.filters());\n        Assert.assertTrue(SourceBackedUiAssertions.hasEmptyStateOrZeroData(driver()));',
            7: 'SourceBackedUiAssertions.assertVietnameseTextWithoutMojibake(driver());',
            8: 'page.openTopicDetail(firstAvailableTopic(page));\n        Assert.assertTrue(SourceBackedUiAssertions.hasDialogOrDetailPanel(driver()));',
        }
        action = actions[number]
    elif prefix == "CHART":
        actions = {
            1: 'Assert.assertFalse(page.dataSourceOptions().isEmpty());',
            2: 'page.selectFirstAvailableDataSource();\n        Assert.assertFalse(page.availableFieldLabels().isEmpty());',
            3: 'List<String> before = page.availableFieldLabels();\n        page.selectAnotherAvailableDataSource();\n        Assert.assertNotEquals(page.availableFieldLabels(), before);',
            4: 'Assert.assertFalse(page.hasBlankDataSourceOption(), "Data source trống không phải option active");',
            5: 'page.selectChartType("Biểu đồ cột");\n        Assert.assertTrue(page.visibleSlotLabels().size() >= 2);',
            6: 'page.selectChartType("Biểu đồ đường");\n        Assert.assertTrue(page.availableFieldLabels().stream().anyMatch(v -> v.toLowerCase().contains("ngày") || v.toLowerCase().contains("thời gian")));',
            7: 'page.selectChartType("Biểu đồ tròn");\n        Assert.assertTrue(page.visibleSlotLabels().size() >= 2);',
            8: 'page.selectMinimalValidConfiguration("Biểu đồ cột");\n        page.selectChartType("Biểu đồ tròn");\n        Assert.assertTrue(page.validationMessages().isEmpty() || !page.previewState().equals("success"));',
            9: 'page.selectFirstAvailableDataSource();\n        String source = page.selectedDataSource();\n        page.selectChartType("Biểu đồ đường");\n        Assert.assertEquals(page.selectedDataSource(), source);',
            10: 'page.reset();\n        page.refreshPreview();\n        Assert.assertFalse(page.validationMessages().isEmpty());',
            11: 'page.reset();\n        page.selectFirstDimensionOnly();\n        page.refreshPreview();\n        Assert.assertFalse(page.validationMessages().isEmpty());',
            12: 'page.selectMinimalValidConfiguration("Biểu đồ cột");\n        page.refreshPreview();\n        ChartAssertions.assertSvgHasSize(page.previewSvg());',
            13: 'page.selectMinimalValidConfiguration("Biểu đồ cột");\n        page.refreshPreview();\n        Assert.assertTrue(page.previewState().matches("loading|success|empty"));',
            15: 'page.selectMinimalValidConfiguration("Biểu đồ cột");\n        page.refreshPreview();\n        page.selectAnotherMetric();\n        Assert.assertNotEquals(page.previewState(), "success");',
            16: 'page.openSaveDialog();\n        Assert.assertTrue(page.saveDialogIsOpen());',
            17: 'requireDestructive("CHART-TC-17");\n        String name = testDataName("CHART-TC-17");\n        page.selectMinimalValidConfiguration("Biểu đồ cột");\n        page.saveConfig(name, "Automation");\n        Assert.assertTrue(page.hasSavedConfig(name));\n        page.deleteSavedConfig(name);',
            18: 'page.openSaveDialog();\n        page.saveConfig("", "Automation");\n        Assert.assertFalse(page.validationMessages().isEmpty());',
            19: 'requireDestructive("CHART-TC-19");\n        verifyDuplicateChartNameConflict(page, testDataName("CHART-TC-19"));',
            20: 'int before = page.savedConfigCount();\n        page.openSaveDialog();\n        page.cancelSaveDialog();\n        Assert.assertEquals(page.savedConfigCount(), before);',
            21: 'page.reset();\n        page.openSaveDialog();\n        Assert.assertTrue(page.saveDialogIsOpen());',
            22: 'Assert.assertTrue(page.savedConfigCount() >= 0);',
            23: 'String name = requireExistingAutomationChart(page);\n        page.applySavedConfig(name);\n        Assert.assertFalse(page.selectedDataSource().isBlank());',
            24: 'requireDestructive("CHART-TC-24");\n        String name = createAutomationChart(page, "CHART-TC-24");\n        page.deleteSavedConfig(name);\n        Assert.assertFalse(page.hasSavedConfig(name));',
        }
        action = actions[number]
    elif prefix == "FEEDBACK":
        actions = {
            1: 'SourceBackedUiAssertions.assertTableHasHeaders(driver(), List.of("CÂU HỎI", "CÂU TRẢ LỜI", "TRẠNG THÁI"));',
            4: 'applyFeedbackEmptySearch(page);\n        Assert.assertTrue(page.rows().isEmpty());',
            6: 'String query = requireFeedbackSearchSeed(page);\n        page.search(query);\n        Assert.assertTrue(SourceBackedUiAssertions.everyTableRowContains(driver(), query));',
            7: 'page.search("AUTO_NO_RESULT_9f874be");\n        Assert.assertTrue(page.rows().isEmpty());',
            8: 'page.filterStatus("Chờ xử lý");\n        Assert.assertTrue(SourceBackedUiAssertions.everyTableRowContains(driver(), "Chờ xử lý"));',
            9: 'page.filterStatus("Đã duyệt");\n        Assert.assertTrue(SourceBackedUiAssertions.everyTableRowContains(driver(), "Đã duyệt"));',
            10: 'String channel = firstAvailableFeedbackChannel(page);\n        page.filterChannel(channel);\n        Assert.assertTrue(SourceBackedUiAssertions.everyTableRowContains(driver(), channel));',
            11: 'page.openCreateDialog();\n        FeedbackFormDialogComponent form = page.form();\n        Assert.assertTrue(form.isOpen());\n        Assert.assertTrue(form.question().isBlank() && form.answer().isBlank());',
            12: 'requireDestructive("FEEDBACK-TC-12");\n        String marker = testDataName("FEEDBACK-TC-12");\n        createFeedback(page, marker);\n        Assert.assertTrue(SourceBackedUiAssertions.pageContains(driver(), marker));\n        cleanupFeedback(page, marker);',
            13: 'page.openCreateDialog();\n        fillFeedbackExceptQuestion(page.form());\n        page.form().save();\n        Assert.assertFalse(page.form().errorMessage().isBlank());',
            14: 'page.openCreateDialog();\n        fillFeedbackExceptAnswer(page.form());\n        page.form().save();\n        Assert.assertFalse(page.form().errorMessage().isBlank());',
            15: 'int before = page.rows().size();\n        page.openCreateDialog();\n        page.form().cancel();\n        Assert.assertEquals(page.rows().size(), before);',
            17: 'String id = requireEditableFeedbackId(page);\n        page.openEditDialog(id);\n        Assert.assertFalse(page.form().question().isBlank());',
            18: 'requireDestructive("FEEDBACK-TC-18");\n        verifyFeedbackUpdateWithCleanup(page, testDataName("FEEDBACK-TC-18"));',
            19: 'String id = requireEditableFeedbackId(page);\n        page.openEditDialog(id);\n        page.form().setQuestion("");\n        page.form().save();\n        Assert.assertFalse(page.form().errorMessage().isBlank());',
            20: 'String id = requireEditableFeedbackId(page);\n        String original = feedbackRowFingerprint(page, id);\n        page.openEditDialog(id);\n        page.form().setAnswer("AUTO_CANCELLED_CHANGE");\n        page.form().cancel();\n        Assert.assertEquals(feedbackRowFingerprint(page, id), original);',
            21: 'requireDestructive("FEEDBACK-TC-21");\n        String id = createRejectedAutomationFeedback(page, "FEEDBACK-TC-21");\n        page.requestDelete(id);\n        Assert.assertTrue(SourceBackedUiAssertions.hasConfirmationDialog(driver()));\n        page.cancelDelete();\n        cleanupFeedbackById(page, id);',
            22: 'requireDestructive("FEEDBACK-TC-22");\n        String id = createRejectedAutomationFeedback(page, "FEEDBACK-TC-22");\n        page.requestDelete(id);\n        page.cancelDelete();\n        Assert.assertTrue(feedbackIdVisible(page, id));\n        cleanupFeedbackById(page, id);',
            23: 'requireDestructive("FEEDBACK-TC-23");\n        String id = createRejectedAutomationFeedback(page, "FEEDBACK-TC-23");\n        page.requestDelete(id);\n        page.confirmDelete();\n        Assert.assertFalse(feedbackIdVisible(page, id));',
            25: 'Assert.assertTrue(page.rows().stream().noneMatch(row -> row.findElements(By.cssSelector("button[aria-label^=\'Xóa phản hồi\']")).size() > 0));',
            27: 'String id = requirePendingFeedbackId(page);\n        page.reject(id);\n        Assert.assertTrue(SourceBackedUiAssertions.pageContains(driver(), "Từ chối"));',
            28: 'Assert.assertEquals(driver().findElements(By.cssSelector("button[aria-label^=\'Duyệt phản hồi\']")).size(), 0);',
            29: 'String id = requirePendingFeedbackId(page);\n        page.approve(id);\n        Assert.assertTrue(SourceBackedUiAssertions.pageContains(driver(), "Đã duyệt"));',
        }
        action = actions[number]
    elif prefix == "USER":
        actions = {
            1: 'SourceBackedUiAssertions.assertTableHasHeaders(driver(), List.of("TÊN NGƯỜI DÙNG", "VAI TRÒ", "HÀNH ĐỘNG"));\n        Assert.assertTrue(SourceBackedUiAssertions.pageContains(driver(), "Nhân viên CSKH") || SourceBackedUiAssertions.pageContains(driver(), "Quản lý CSKH"));',
            4: 'String email = requireExistingUserEmail(page);\n        page.search(email);\n        Assert.assertTrue(SourceBackedUiAssertions.everyTableRowContains(driver(), email));',
            5: 'Assert.assertTrue(page.isAccessDenied());',
            6: 'throw new SkipException("BLOCKED_ENVIRONMENT: User create không có public delete API để cleanup an toàn.");',
            7: 'page.openCreateDialog();\n        fillDuplicateUser(page);\n        Assert.assertFalse(SourceBackedUiAssertions.latestToast(driver()).isBlank());',
            8: 'page.openCreateDialog();\n        fillWeakPasswordUser(page);\n        Assert.assertTrue(SourceBackedUiAssertions.latestToast(driver()).contains("6"));',
            10: 'int before = page.rows().size();\n        page.openCreateDialog();\n        cancelUserCreate(page);\n        Assert.assertEquals(page.rows().size(), before);',
            11: 'requireDestructive("USER-TC-11");\n        verifyRoleChangeAndRestore(page);',
            13: 'requireDestructive("USER-TC-13");\n        verifyDisposableUserLockAndRestore(page);',
            14: 'requireDestructive("USER-TC-14");\n        verifyDisposableUserUnlockAndRestore(page);',
            15: 'requireDestructive("USER-TC-15");\n        Assert.assertThrows(IllegalArgumentException.class, () -> guardAgainstCurrentUserMutation(config().managerUsernameRequired()));',
            16: 'Assert.assertFalse(sidebar().hasMenu("Kênh"));\n        Assert.assertTrue(sidebar().hasMenu("Cài đặt"), "Staff vẫn có Cài đặt cá nhân theo source");',
        }
        action = actions[number]
    elif prefix == "SETTINGS":
        actions = {
            1: 'Assert.assertFalse(page.name().isBlank());\n        Assert.assertFalse(page.email().isBlank());\n        Assert.assertFalse(page.displayedRole().isBlank());',
            2: 'requireDestructive("SETTINGS-TC-02");\n        verifyProfileNameUpdateAndRestore(page, testDataName("SETTINGS-TC-02"));',
            3: 'page.setEmail("invalid-email");\n        page.saveProfile();\n        Assert.assertTrue(SourceBackedUiAssertions.latestToast(driver()).toLowerCase().contains("email"));',
            4: 'page.setPhone("09abc123");\n        page.saveProfile();\n        Assert.assertTrue(SourceBackedUiAssertions.latestToast(driver()).toLowerCase().contains("điện thoại"));',
            5: 'requireDestructive("SETTINGS-TC-05");\n        verifyPhoneUpdateAndRestore(page, "0900000000");',
            12: 'page.enterCurrentPassword("AUTO_CURRENT");\n        page.enterNewPassword("AUTO_NEW_123");\n        page.confirmNewPassword("AUTO_DIFFERENT_123");\n        page.requestPasswordChange();\n        Assert.assertTrue(SourceBackedUiAssertions.latestToast(driver()).contains("không khớp"));',
            13: 'page.enterCurrentPassword("AUTO_CURRENT");\n        page.enterNewPassword("123");\n        page.confirmNewPassword("123");\n        page.requestPasswordChange();\n        Assert.assertTrue(SourceBackedUiAssertions.latestToast(driver()).contains("6"));',
        }
        action = actions[number]
    elif prefix == "EXPORT":
        actions = {
            5: 'page.filters().openExportMenu();\n        page.filters().exportXlsx();\n        ExcelUtils.assertReadable(waitForDownload(".xlsx"));',
            6: 'page.filters().openExportMenu();\n        page.filters().exportXlsx();\n        ExcelUtils.assertColumnsReadable(waitForDownload(".xlsx"));',
            7: 'page.filters().selectDateRange("7 ngày qua");\n        page.filters().apply();\n        page.filters().openExportMenu();\n        page.filters().exportXlsx();\n        ExcelUtils.assertContainsAppliedFilterMetadata(waitForDownload(".xlsx"), "7 ngày qua");',
            9: 'page.filters().openExportMenu();\n        page.filters().exportXlsx();\n        Assert.assertTrue(SourceBackedUiAssertions.pageContains(driver(), "Đang xuất") || Files.exists(waitForDownload(".xlsx")));',
            10: 'page.filters().openExportMenu();\n        page.filters().exportXlsx();\n        Path file = waitForDownload(".xlsx");\n        Assert.assertTrue(file.getFileName().toString().matches(".*\\\\d{4}-\\\\d{2}-\\\\d{2}.*\\\\.xlsx"));',
            11: 'page.filters().openExportMenu();\n        Assert.assertTrue(page.filters().exportMenuIsOpen());',
        }
        action = actions[number]
    elif prefix == "ACTIVITY":
        actions = {
            1: 'SourceBackedUiAssertions.assertActivityRowsHaveActionEntityAndTime(page.visibleActivities());',
            2: 'String marker = config().activityMarker("ACTIVITY-TC-02");\n        page.search(marker);\n        Assert.assertTrue(page.visibleActivities().stream().anyMatch(row -> row.compactText().contains(marker)));',
            3: 'String marker = config().activityMarker("ACTIVITY-TC-03");\n        page.search(marker);\n        Assert.assertTrue(page.visibleActivities().stream().anyMatch(row -> row.compactText().contains(marker)));',
            4: 'Assert.assertTrue(SourceBackedUiAssertions.activityTimesDescending(page.visibleActivities()));',
            7: 'Assert.assertFalse(page.isLoaded(), "Expected Excel yêu cầu Staff bị chặn; source hiện cho Staff xem lịch sử của chính mình");',
        }
        action = actions[number]
    else:
        raise KeyError(tc_id)
    return setup + action


def body_for(record: dict) -> str:
    classification = record["classification"]
    if classification in {"NOT_APPLICABLE", "NEEDS_REQUIREMENT_CONFIRMATION", "MANUAL_ONLY", "BLOCKED_ENVIRONMENT"}:
        return skip_body(classification, gt.reason_for(classification, record["tc_id"]), gt.DISCREPANCIES.get(record["tc_id"], ""))
    tc_id = record["tc_id"]
    if tc_id.startswith("AUTH-"):
        body = auth_body(tc_id)
        if body:
            return body
        return skip_body("NEEDS_REQUIREMENT_CONFIRMATION", "Chưa có source-aligned assertion an toàn.", gt.DISCREPANCIES.get(tc_id, ""))
    if tc_id.startswith("FILTER-"):
        return filter_body(tc_id)
    return non_filter_body(record)


def load_records() -> list[dict]:
    workbook = openpyxl.load_workbook(gt.newest("FLIC_Test_Cases_By_Module*.xlsx"), data_only=True)
    records = []
    for sheet in workbook.worksheets[1:]:
        heading = ""
        for row in sheet.iter_rows(min_row=2, max_col=8, values_only=True):
            first = row[0]
            if isinstance(first, str) and re.fullmatch(r"[A-Z]+-TC-\d{2}", first.strip()):
                section = gt.SECTION_BY_KEY[(sheet.title.strip(), heading)]
                if section.surface in {"API", "ML"}:
                    continue
                description = str(row[1] or "").strip()
                classification = gt.classify(first.strip(), section.surface)
                records.append({
                    "tc_id": first.strip(), "module": sheet.title.strip(), "heading": heading,
                    "name": description, "expected": str(row[3] or "").strip(), "section": section,
                    "classification": classification,
                    "groups": gt.groups(first.strip(), section, classification, first.strip() in gt.MUTATING),
                })
            elif first:
                heading = str(first).strip()
    return records


def main() -> None:
    records = load_records()
    grouped: dict[str, list[dict]] = {}
    for record in records:
        grouped.setdefault(record["section"].class_name, []).append(record)
    JAVA_DIR.mkdir(parents=True, exist_ok=True)
    for class_name, class_records in grouped.items():
        imports = """package com.flic.automation.tests.ui;

import com.flic.automation.components.*;
import com.flic.automation.core.BaseUiTest;
import com.flic.automation.listeners.RetryAnalyzer;
import com.flic.automation.pages.*;
import com.flic.automation.utils.*;
import org.openqa.selenium.By;
import org.testng.Assert;
import org.testng.SkipException;
import org.testng.annotations.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;

"""
        lines = [imports, f"public class {class_name} extends BaseUiTest {{", ""]
        for record in class_records:
            body = body_for(record)
            group_values = [item.strip() for item in record["groups"].split(",") if item.strip()]
            if "loginAsManager()" in body and "requires-manager" not in group_values:
                group_values.append("requires-manager")
            if "loginAsStaff()" in body and "requires-staff" not in group_values:
                group_values.append("requires-staff")
            groups = ", ".join(f'"{item}"' for item in group_values)
            lines.extend([
                "    /**",
                f"     * TC ID: {record['tc_id']}",
                f"     * Task name / test case lớn: {javadoc(record['heading'])}",
                f"     * Tên test case nhỏ: {javadoc(record['name'])}",
                f"     * Expected Result chính: {javadoc(record['expected'])}",
                "     */",
                "    @Test(",
                f"        description = \"{java(record['tc_id'] + ' - ' + record['name'])}\",",
                f"        groups = {{{groups}}},",
                "        retryAnalyzer = RetryAnalyzer.class",
                "    )",
                f"    public void {gt.java_method(record['tc_id'], record['name'])}() {{",
            ])
            for body_line in body.splitlines():
                lines.append("        " + body_line.rstrip())
            lines.extend(["    }", ""])
        lines.append("}")
        (JAVA_DIR / f"{class_name}.java").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"FILES={len(grouped)} METHODS={len(records)} OUT={JAVA_DIR}")


if __name__ == "__main__":
    main()
