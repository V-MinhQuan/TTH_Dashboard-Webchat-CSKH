package com.flic.automation.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.flic.automation.components.GlobalFilterComponent;
import com.flic.automation.components.HeaderComponent;
import com.flic.automation.components.SidebarComponent;
import com.flic.automation.driver.DriverFactory;
import com.flic.automation.pages.ChartBuilderPage;
import com.flic.automation.pages.FeedbackLibraryPage;
import com.flic.automation.pages.LoginPage;
import com.flic.automation.pages.PersonalInfoPage;
import com.flic.automation.pages.UserManagementPage;
import com.flic.automation.utils.JsonUtils;
import com.flic.automation.utils.AuthStorageUtils;
import com.flic.automation.utils.WaitUtils;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.openqa.selenium.logging.LogEntry;
import org.openqa.selenium.logging.LogType;
import org.testng.SkipException;

/** UI workflow helpers shared across task-oriented test classes. */
public abstract class BaseUiTest extends BaseTest {
    private final List<String> observedRequests = new ArrayList<>();

    protected LoginPage openLogin() {
        clearAuthenticationAfterOpen();
        return new LoginPage(driver()).open(config().baseUrl());
    }

    protected LoginPage loginPage() { return new LoginPage(driver()); }
    protected SidebarComponent sidebar() { return new SidebarComponent(driver()); }
    protected HeaderComponent header() { return new HeaderComponent(driver()); }
    protected GlobalFilterComponent globalFilter() { return new GlobalFilterComponent(driver()); }

    protected void loginAsManager() { login(config().managerUsernameRequired(), config().managerPasswordRequired()); }
    protected void loginAsStaff() { login(config().staffUsernameRequired(), config().staffPasswordRequired()); }

    protected void clearAuthentication() {
        if (driver().getCurrentUrl().startsWith("http")) clearAuthenticationAfterOpen();
    }

    protected String localStorage(String key) { if(!AuthStorageUtils.KEY.equals(key)) throw new IllegalArgumentException("Unsupported auth key: "+key); return AuthStorageUtils.local(driver()); }
    protected String sessionStorage(String key) { if(!AuthStorageUtils.KEY.equals(key)) throw new IllegalArgumentException("Unsupported auth key: "+key); return AuthStorageUtils.session(driver()); }

    protected void openScreen(String screen) {
        switch (screen) {
            case "overview" -> sidebar().navigateTo("Tổng quan");
            case "channel" -> sidebar().navigateTo("Kênh");
            case "keyword" -> sidebar().navigateTo("Từ khóa");
            case "sentiment" -> sidebar().navigateTo("Cảm xúc");
            case "aiinsights" -> sidebar().navigateTo("Hiệu suất AI");
            case "chartbuilder" -> sidebar().navigateTo("Biểu đồ");
            case "chatbot_sheet" -> sidebar().navigateTo("Thư viện phản hồi");
            case "settings" -> sidebar().navigateTo("Cài đặt");
            case "users" -> { sidebar().navigateTo("Cài đặt"); driver().findElement(org.openqa.selenium.By.xpath("//*[normalize-space()='Người dùng & phân quyền']")).click(); }
            case "personal_info" -> header().openPersonalInfo();
            case "activity_history" -> header().openActivityHistory();
            default -> throw new IllegalArgumentException("Unknown activeScreen: " + screen);
        }
    }

    protected int apiRequestCount() { collectPerformanceRequests(); return observedRequests.size(); }
    protected String latestApiRequestUrl() { collectPerformanceRequests(); return observedRequests.isEmpty() ? "" : observedRequests.get(observedRequests.size() - 1); }
    protected boolean waitForApiRequestAfter(int before, String fragment) {
        try {
            WaitUtils.until(() -> {
                collectPerformanceRequests();
                return observedRequests.size() > before && observedRequests.subList(before, observedRequests.size())
                        .stream().anyMatch(url -> url.contains(fragment));
            }, config().explicitWait(), "No matching API request after action: " + fragment);
            return true;
        } catch (RuntimeException ignored) { return false; }
    }
    protected void waitForNetworkQuiet() { collectPerformanceRequests(); }
    protected String toastText() { return com.flic.automation.utils.SourceBackedUiAssertions.latestToast(driver()); }

    protected Path waitForDownload(String suffix) {
        Path directory = DriverFactory.downloadDirectory();
        WaitUtils.until(() -> findDownload(directory, suffix) != null, Duration.ofSeconds(30), "Download not found: " + suffix);
        return findDownload(directory, suffix);
    }

    protected String testDataName(String tcId) {
        return "AUTO_" + tcId.replace('-', '_') + "_" + DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS").format(java.time.LocalDateTime.now());
    }

    protected void requireDestructive(String tcId) {
        if (!config().allowDestructiveTests()) throw new SkipException(tcId + " thay đổi dữ liệu; cần FLIC_ALLOW_DESTRUCTIVE_TESTS=true.");
    }

    protected void applyKnownEmptyDate(GlobalFilterComponent filter) {
        filter.setCustomDateRange(LocalDate.of(2000, 1, 1), LocalDate.of(2000, 1, 1));
        filter.apply();
    }

    protected void assertFilterTriggersDataRequest(GlobalFilterComponent filter, String preset) {
        int before = apiRequestCount();
        filter.selectDateRange(preset);
        filter.apply();
        if (!waitForApiRequestAfter(before, "/api/")) throw new AssertionError("Filter did not trigger an API request");
    }

    protected void requireOption(GlobalFilterComponent filter, String label, String value) {
        if (!filter.optionTexts(label).contains(value)) throw new SkipException("Kênh/chủ đề không bật trong cấu hình hiện tại: " + value);
    }

    protected String firstNonDefaultOption(GlobalFilterComponent filter, String label) {
        return filter.optionTexts(label).stream().filter(value -> !value.toLowerCase(Locale.ROOT).startsWith("tất cả"))
                .findFirst().orElseThrow(() -> new SkipException("Không có option cấu hình cho " + label));
    }

    protected void selectFirstNonDefault(GlobalFilterComponent filter, String label) {
        String value = firstNonDefaultOption(filter, label);
        if (label.equals("Kênh")) filter.selectChannel(value); else filter.selectTopic(value);
    }

    protected void selectConfiguredEmptyChannel(GlobalFilterComponent filter) {
        if (config().emptyChannel().isBlank()) throw missing("FLIC_EMPTY_CHANNEL");
        requireOption(filter, "Kênh", config().emptyChannel());
        filter.selectChannel(config().emptyChannel()); filter.apply();
    }

    protected void selectConfiguredEmptyTopic(GlobalFilterComponent filter) {
        if (config().emptyTopic().isBlank()) throw missing("FLIC_EMPTY_TOPIC");
        requireOption(filter, "Chủ đề", config().emptyTopic());
        filter.selectTopic(config().emptyTopic()); filter.apply();
    }

    protected void tamperStoredAccessToken() {
        AuthStorageUtils.tamperToken(driver());
    }

    protected boolean waitForLoginOrUnauthorized() {
        driver().navigate().refresh();
        try { WaitUtils.until(() -> new LoginPage(driver()).isLoaded() || driver().getPageSource().contains("401"), config().explicitWait(), "No 401/login after tampering"); return true; }
        catch (RuntimeException error) { return false; }
    }

    protected void guardAgainstCurrentUserMutation(String username) {
        if (config().managerUsername().equalsIgnoreCase(username)) throw new IllegalArgumentException("Automation cannot mutate its current user");
    }

    protected String requireExistingUserEmail(UserManagementPage page) { return required(config().existingUserEmail(), "FLIC_EXISTING_USER_EMAIL"); }
    protected String requirePendingFeedbackId(FeedbackLibraryPage page) { return required(config().pendingFeedbackId(), "FLIC_PENDING_FEEDBACK_ID"); }
    protected String requireEditableFeedbackId(FeedbackLibraryPage page) { return required(config().editableFeedbackId(), "FLIC_EDITABLE_FEEDBACK_ID"); }
    protected String requireExistingAutomationChart(ChartBuilderPage page) { return required(config().existingAutomationChart(), "FLIC_EXISTING_AUTOMATION_CHART"); }
    protected String requireFeedbackSearchSeed(FeedbackLibraryPage page) { return required(config().feedbackSearchSeed(), "FLIC_FEEDBACK_SEARCH_SEED"); }

    protected void applyFeedbackEmptySearch(FeedbackLibraryPage page) { page.search("AUTO_NO_RESULT_" + UUID.randomUUID()); }
    protected String firstAvailableFeedbackChannel(FeedbackLibraryPage page) { return page.firstAvailableChannel(); }
    protected boolean feedbackIdVisible(FeedbackLibraryPage page, String id) { return page.hasRow(id); }
    protected String feedbackRowFingerprint(FeedbackLibraryPage page, String id) { return page.rowText(id); }

    protected String createRejectedAutomationFeedback(FeedbackLibraryPage page, String tcId) { throw missing("controlled rejected feedback fixture for " + tcId); }
    protected void cleanupFeedbackById(FeedbackLibraryPage page, String id) { if (page.hasRow(id)) page.delete(id); }
    protected void cleanupFeedback(FeedbackLibraryPage page, String marker) { page.deleteByMarker(marker); }
    protected void createFeedback(FeedbackLibraryPage page, String marker) { page.create(marker, marker + " answer"); }
    protected void fillFeedbackExceptQuestion(com.flic.automation.components.FeedbackFormDialogComponent form) { form.setAnswer("AUTO answer"); }
    protected void fillFeedbackExceptAnswer(com.flic.automation.components.FeedbackFormDialogComponent form) { form.setQuestion("AUTO question"); }

    protected String createAutomationChart(ChartBuilderPage page, String tcId) { throw missing("stable Chart Builder fixture for " + tcId); }
    protected void verifyDuplicateChartNameConflict(ChartBuilderPage page, String name) { throw missing("isolated duplicate chart fixture"); }
    protected void verifyFeedbackUpdateWithCleanup(FeedbackLibraryPage page, String marker) { throw missing("safe feedback update fixture"); }
    protected void verifyProfileNameUpdateAndRestore(com.flic.automation.pages.SettingsPage page, String name) { throw missing("profile restore fixture"); }
    protected void verifyPhoneUpdateAndRestore(com.flic.automation.pages.SettingsPage page, String phone) { throw missing("profile restore fixture"); }
    protected void verifyRoleChangeAndRestore(UserManagementPage page) { throw missing("disposable user fixture"); }
    protected void verifyDisposableUserLockAndRestore(UserManagementPage page) { throw missing("disposable active user fixture"); }
    protected void verifyDisposableUserUnlockAndRestore(UserManagementPage page) { throw missing("disposable suspended user fixture"); }
    protected void fillDuplicateUser(UserManagementPage page) { throw missing("known duplicate user fixture"); }
    protected void fillWeakPasswordUser(UserManagementPage page) { page.fillCreateForm(testDataName("USER-TC-08") + "@example.test", "123", "staff"); }
    protected void cancelUserCreate(UserManagementPage page) { page.cancelCreate(); }

    private void login(String username, String password) {
        LoginPage page = openLogin();
        page.login(username, password, false);
        WaitUtils.until(() -> sidebar().isVisible() || !page.errorMessage().isBlank(), config().explicitWait(), "Login did not complete");
        if (!page.errorMessage().isBlank()) throw new AssertionError("Login failed: " + page.errorMessage());
    }

    private void clearAuthenticationAfterOpen() {
        if (!driver().getCurrentUrl().startsWith("http")) driver().get(config().baseUrl());
        AuthStorageUtils.clear(driver());
    }

    private void collectPerformanceRequests() {
        try {
            for (LogEntry entry : driver().manage().logs().get(LogType.PERFORMANCE)) {
                JsonNode message = JsonUtils.mapper().readTree(entry.getMessage()).path("message");
                if ("Network.requestWillBeSent".equals(message.path("method").asText())) {
                    String url = message.path("params").path("request").path("url").asText();
                    if (url.contains("/api/")) observedRequests.add(url);
                }
            }
        } catch (Exception ignored) { /* Browser logging is capability-dependent. */ }
    }

    private static Path findDownload(Path directory, String suffix) {
        try (var files = Files.list(directory)) {
            return files.filter(Files::isRegularFile).filter(path -> path.getFileName().toString().toLowerCase(Locale.ROOT).endsWith(suffix.toLowerCase(Locale.ROOT)))
                    .filter(path -> !path.getFileName().toString().endsWith(".crdownload")).findFirst().orElse(null);
        } catch (Exception error) { return null; }
    }

    private static String required(String value, String name) { if (value == null || value.isBlank()) throw missing(name); return value; }
    private static SkipException missing(String name) { return new SkipException("Thiếu dữ liệu/môi trường kiểm thử an toàn: " + name + ". Xem REQUIRED_TEST_INFORMATION.md."); }
}
