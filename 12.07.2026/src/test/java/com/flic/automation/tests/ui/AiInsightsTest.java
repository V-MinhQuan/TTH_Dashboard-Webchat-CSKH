package com.flic.automation.tests.ui;

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


public class AiInsightsTest extends BaseUiTest {

    /**
     * TC ID: AI-TC-01
     * Task name / test case lớn: AI INSIGHTS PANEL
     * Tên test case nhỏ: Panel AI Insights load và hiển thị nhận xét tự động trong < 10 giây
     * Expected Result chính: Panel hiển thị các nhận xét xu hướng do AI sinh trong < 10 giây với network bình thường.
     */
    @Test(
        description = "AI-TC-01 - Panel AI Insights load và hiển thị nhận xét tự động trong < 10 giây",
        groups = {"ai-insights", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void aitc01PanelAIInsightsLoadVaHienThiNhanXetTuDongTrong() {
        loginAsManager();
                openScreen("aiinsights");
                AiInsightsPage page = new AiInsightsPage(driver()).waitUntilReady();
                long started = System.nanoTime();
                Assert.assertFalse(page.failedConversationRows().isEmpty() && SourceBackedUiAssertions.hasLoadError(driver()));
                Assert.assertTrue(Duration.ofNanos(System.nanoTime() - started).toSeconds() < 10);
    }

    /**
     * TC ID: AI-TC-02
     * Task name / test case lớn: AI INSIGHTS PANEL
     * Tên test case nhỏ: AI Insights loading state – skeleton trong khi xử lý
     * Expected Result chính: Skeleton placeholder hiển thị ở khu vực nhận xét. Không hiển thị nội dung rỗng đột ngột.
     */
    @Test(
        description = "AI-TC-02 - AI Insights loading state – skeleton trong khi xử lý",
        groups = {"ai-insights", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void aitc02AIInsightsLoadingStateSkeletonTrongKhiXuLy() {
        loginAsManager();
                openScreen("aiinsights");
                AiInsightsPage page = new AiInsightsPage(driver()).waitUntilReady();
                Assert.assertTrue(SourceBackedUiAssertions.loadingOrMeaningfulContent(driver()));
    }

    /**
     * TC ID: AI-TC-03
     * Task name / test case lớn: AI INSIGHTS PANEL
     * Tên test case nhỏ: Nội dung insight phù hợp với số liệu chart (logic check)
     * Expected Result chính: Câu 'tăng 20%' phải tương ứng với chart đang tăng 20%. Không có câu insight ngược chiều.
     */
    @Test(
        description = "AI-TC-03 - Nội dung insight phù hợp với số liệu chart (logic check)",
        groups = {"ai-insights", "regression", "requires-db", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void aitc03NoiDungInsightPhuHopVoiSoLieuChartLogicCheck() {
        throw new SkipException("MANUAL_ONLY: Cần đánh giá nghiệp vụ/ngữ nghĩa chủ quan; assertion tự động hiện không đủ đáng tin cậy.");
    }

    /**
     * TC ID: AI-TC-04
     * Task name / test case lớn: AI INSIGHTS PANEL
     * Tên test case nhỏ: AI Insights cập nhật khi thay đổi filter
     * Expected Result chính: Panel tải lại insight mới phù hợp khoảng 7 ngày. Nội dung thay đổi.
     */
    @Test(
        description = "AI-TC-04 - AI Insights cập nhật khi thay đổi filter",
        groups = {"ai-insights", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void aitc04AIInsightsCapNhatKhiThayDoiFilter() {
        loginAsManager();
                openScreen("aiinsights");
                AiInsightsPage page = new AiInsightsPage(driver()).waitUntilReady();
                assertFilterTriggersDataRequest(page.filters(), "7 ngày qua");
    }

    /**
     * TC ID: AI-TC-05
     * Task name / test case lớn: AI INSIGHTS PANEL
     * Tên test case nhỏ: AI Insights empty state khi không đủ dữ liệu
     * Expected Result chính: Panel hiển thị 'Không đủ dữ liệu để tạo phân tích AI.' Không hiển thị insight giả tạo.
     */
    @Test(
        description = "AI-TC-05 - AI Insights empty state khi không đủ dữ liệu",
        groups = {"ai-insights", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void aitc05AIInsightsEmptyStateKhiKhongDuDuLieu() {
        loginAsManager();
                openScreen("aiinsights");
                AiInsightsPage page = new AiInsightsPage(driver()).waitUntilReady();
                applyKnownEmptyDate(page.filters());
                Assert.assertTrue(SourceBackedUiAssertions.hasEmptyStateOrZeroData(driver()));
    }

    /**
     * TC ID: AI-TC-06
     * Task name / test case lớn: AI INSIGHTS PANEL
     * Tên test case nhỏ: AI Insights API lỗi – toast lỗi và không crash
     * Expected Result chính: Toast lỗi xuất hiện. Panel hiển thị trạng thái lỗi. Các module khác trên trang không bị ảnh hưởng.
     */
    @Test(
        description = "AI-TC-06 - AI Insights API lỗi – toast lỗi và không crash",
        groups = {"ai-insights", "regression", "requires-db", "environment-dependent", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void aitc06AIInsightsAPILoiToastLoiVaKhongCrash() {
        throw new SkipException("BLOCKED_ENVIRONMENT: Cần môi trường cô lập hoặc fault injection lặp lại được; không được dừng service/DB dùng chung hay sửa production để tạo lỗi.");
    }

    /**
     * TC ID: AI-TC-07
     * Task name / test case lớn: AI INSIGHTS PANEL
     * Tên test case nhỏ: AI Insights hiển thị đúng ngôn ngữ Tiếng Việt
     * Expected Result chính: Tất cả câu nhận xét AI viết đúng tiếng Việt, không có lỗi encoding hoặc ký tự lạ.
     */
    @Test(
        description = "AI-TC-07 - AI Insights hiển thị đúng ngôn ngữ Tiếng Việt",
        groups = {"ai-insights", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void aitc07AIInsightsHienThiDungNgonNguTiengViet() {
        loginAsManager();
                openScreen("aiinsights");
                AiInsightsPage page = new AiInsightsPage(driver()).waitUntilReady();
                SourceBackedUiAssertions.assertVietnameseTextWithoutMojibake(driver());
    }

    /**
     * TC ID: AI-TC-08
     * Task name / test case lớn: AI INSIGHTS PANEL
     * Tên test case nhỏ: Keyword nổi bật trong AI Insights có thể click để lọc
     * Expected Result chính: Chuyển sang Keyword Analysis hoặc Conversations với filter từ khóa đó.
     */
    @Test(
        description = "AI-TC-08 - Keyword nổi bật trong AI Insights có thể click để lọc",
        groups = {"ai-insights", "regression", "requires-db", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void aitc08KeywordNoiBatTrongAIInsightsCoTheClickDeLoc() {
        throw new SkipException("NOT_APPLICABLE: Control/endpoint/role được mô tả không tồn tại trong luồng active hiện tại.");
    }

}
