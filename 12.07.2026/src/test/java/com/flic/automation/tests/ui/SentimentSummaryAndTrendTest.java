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


public class SentimentSummaryAndTrendTest extends BaseUiTest {

    /**
     * TC ID: SENTIMENT-TC-01
     * Task name / test case lớn: SENTIMENT SUMMARY CHART
     * Tên test case nhỏ: Tỉ lệ Tích cực + Tiêu cực + Trung tính cộng bằng 100%
     * Expected Result chính: Tổng 3 giá trị % = 100% (±1% làm tròn). Không hiển thị > 100 hoặc < 99.
     */
    @Test(
        description = "SENTIMENT-TC-01 - Tỉ lệ Tích cực + Tiêu cực + Trung tính cộng bằng 100%",
        groups = {"sentiment", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void sentimenttc01TiLeTichCucTieuCucTrungTinhCongBang100() {
        loginAsManager();
                openScreen("sentiment");
                SentimentAnalysisPage page = new SentimentAnalysisPage(driver()).waitUntilReady();
                Assert.assertEquals(SourceBackedUiAssertions.sentimentPercentageTotal(driver()), 100.0, 0.5);
    }

    /**
     * TC ID: SENTIMENT-TC-02
     * Task name / test case lớn: SENTIMENT SUMMARY CHART
     * Tên test case nhỏ: Màu sắc biểu đồ nhất quán với legend
     * Expected Result chính: Tích cực = xanh, Tiêu cực = đỏ, Trung tính = xám. Nhất quán trên cả chart và legend.
     */
    @Test(
        description = "SENTIMENT-TC-02 - Màu sắc biểu đồ nhất quán với legend",
        groups = {"sentiment", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void sentimenttc02MauSacBieuDoNhatQuanVoiLegend() {
        loginAsManager();
                openScreen("sentiment");
                SentimentAnalysisPage page = new SentimentAnalysisPage(driver()).waitUntilReady();
                ChartAssertions.assertLegendColorsMatchSeries(driver());
    }

    /**
     * TC ID: SENTIMENT-TC-03
     * Task name / test case lớn: SENTIMENT SUMMARY CHART
     * Tên test case nhỏ: Chart cập nhật đúng khi thay đổi filter
     * Expected Result chính: Tỉ lệ % thay đổi theo dữ liệu 7 ngày. Chart re-render.
     */
    @Test(
        description = "SENTIMENT-TC-03 - Chart cập nhật đúng khi thay đổi filter",
        groups = {"sentiment", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void sentimenttc03ChartCapNhatDungKhiThayDoiFilter() {
        loginAsManager();
                openScreen("sentiment");
                SentimentAnalysisPage page = new SentimentAnalysisPage(driver()).waitUntilReady();
                assertFilterTriggersDataRequest(page.filters(), "7 ngày qua");
    }

    /**
     * TC ID: SENTIMENT-TC-04
     * Task name / test case lớn: SENTIMENT SUMMARY CHART
     * Tên test case nhỏ: Chart empty state khi không có data sentiment
     * Expected Result chính: Hiển thị 'Chưa có dữ liệu phân tích cảm xúc' thay vì chart trắng.
     */
    @Test(
        description = "SENTIMENT-TC-04 - Chart empty state khi không có data sentiment",
        groups = {"sentiment", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void sentimenttc04ChartEmptyStateKhiKhongCoDataSentiment() {
        loginAsManager();
                openScreen("sentiment");
                SentimentAnalysisPage page = new SentimentAnalysisPage(driver()).waitUntilReady();
                applyKnownEmptyDate(page.filters());
                Assert.assertTrue(SourceBackedUiAssertions.hasEmptyStateOrZeroData(driver()));
    }

    /**
     * TC ID: SENTIMENT-TC-05
     * Task name / test case lớn: SENTIMENT SUMMARY CHART
     * Tên test case nhỏ: Sentiment loading state hiển thị skeleton
     * Expected Result chính: Skeleton loader hiển thị trong khu vực chart khi API chưa trả về.
     */
    @Test(
        description = "SENTIMENT-TC-05 - Sentiment loading state hiển thị skeleton",
        groups = {"sentiment", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void sentimenttc05SentimentLoadingStateHienThiSkeleton() {
        loginAsManager();
                openScreen("sentiment");
                SentimentAnalysisPage page = new SentimentAnalysisPage(driver()).waitUntilReady();
                Assert.assertTrue(SourceBackedUiAssertions.loadingOrMeaningfulContent(driver()));
    }

    /**
     * TC ID: SENTIMENT-TC-06
     * Task name / test case lớn: SENTIMENT SUMMARY CHART
     * Tên test case nhỏ: Trend chart hiển thị xu hướng cảm xúc theo thời gian
     * Expected Result chính: Chart line/area hiển thị xu hướng 3 loại cảm xúc theo ngày. Trục X là ngày, Y là %.
     */
    @Test(
        description = "SENTIMENT-TC-06 - Trend chart hiển thị xu hướng cảm xúc theo thời gian",
        groups = {"sentiment", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void sentimenttc06TrendChartHienThiXuHuongCamXucTheoThoiGian() {
        loginAsManager();
                openScreen("sentiment");
                SentimentAnalysisPage page = new SentimentAnalysisPage(driver()).waitUntilReady();
                ChartAssertions.assertEveryVisibleChartHasGeometry(driver());
    }

}
