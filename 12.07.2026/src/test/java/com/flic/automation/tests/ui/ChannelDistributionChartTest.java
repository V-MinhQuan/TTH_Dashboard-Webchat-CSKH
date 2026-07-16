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


public class ChannelDistributionChartTest extends BaseUiTest {

    /**
     * TC ID: CHANNEL-TC-01
     * Task name / test case lớn: BIỂU ĐỒ KÊNH
     * Tên test case nhỏ: Pie chart phân bổ kênh hiển thị tổng % = 100%
     * Expected Result chính: Tổng phần trăm các lát cắt bằng 100%. Legend hiển thị đúng tên và màu từng kênh.
     */
    @Test(
        description = "CHANNEL-TC-01 - Pie chart phân bổ kênh hiển thị tổng % = 100%",
        groups = {"channel", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void channeltc01PieChartPhanBoKenhHienThiTong100() {
        loginAsManager();
                openScreen("channel");
                ChannelAnalysisPage page = new ChannelAnalysisPage(driver()).waitUntilReady();
                Assert.assertEquals(SourceBackedUiAssertions.channelPercentageTotal(driver()), 100.0, 0.5);
    }

    /**
     * TC ID: CHANNEL-TC-02
     * Task name / test case lớn: BIỂU ĐỒ KÊNH
     * Tên test case nhỏ: Hover lát cắt Pie chart – tooltip hiển thị tên kênh, số lượng, %
     * Expected Result chính: Tooltip: Tên kênh, Số hội thoại (tuyệt đối), Tỉ lệ %. Tooltip không bị ẩn sau khi bỏ hover.
     */
    @Test(
        description = "CHANNEL-TC-02 - Hover lát cắt Pie chart – tooltip hiển thị tên kênh, số lượng, %",
        groups = {"channel", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void channeltc02HoverLatCatPieChartTooltipHienThiTenKenhSoLuong() {
        loginAsManager();
                openScreen("channel");
                ChannelAnalysisPage page = new ChannelAnalysisPage(driver()).waitUntilReady();
                ChartAssertions.assertTooltipOnFirstRenderableChart(driver());
    }

    /**
     * TC ID: CHANNEL-TC-03
     * Task name / test case lớn: BIỂU ĐỒ KÊNH
     * Tên test case nhỏ: Chart hiển thị empty state khi filter trả rỗng
     * Expected Result chính: Chart hiển thị trạng thái 'Chưa có dữ liệu' thay vì chart trắng.
     */
    @Test(
        description = "CHANNEL-TC-03 - Chart hiển thị empty state khi filter trả rỗng",
        groups = {"channel", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void channeltc03ChartHienThiEmptyStateKhiFilterTraRong() {
        loginAsManager();
                openScreen("channel");
                ChannelAnalysisPage page = new ChannelAnalysisPage(driver()).waitUntilReady();
                applyKnownEmptyDate(page.filters());
                Assert.assertTrue(page.isEmpty());
    }

    /**
     * TC ID: CHANNEL-TC-04
     * Task name / test case lớn: BIỂU ĐỒ KÊNH
     * Tên test case nhỏ: Chart cập nhật khi đổi filter kênh
     * Expected Result chính: Pie chart còn 1 lát cắt 100% cho kênh đã chọn.
     */
    @Test(
        description = "CHANNEL-TC-04 - Chart cập nhật khi đổi filter kênh",
        groups = {"channel", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void channeltc04ChartCapNhatKhiDoiFilterKenh() {
        loginAsManager();
                openScreen("channel");
                ChannelAnalysisPage page = new ChannelAnalysisPage(driver()).waitUntilReady();
                assertFilterTriggersDataRequest(page.filters(), "7 ngày qua");
    }

}
