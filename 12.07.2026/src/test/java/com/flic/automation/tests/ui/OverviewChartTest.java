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


public class OverviewChartTest extends BaseUiTest {

    /**
     * TC ID: OVERVIEW-TC-07
     * Task name / test case lớn: BIỂU ĐỒ TỔNG QUAN
     * Tên test case nhỏ: Biểu đồ xu hướng hiển thị tooltip khi hover vào điểm dữ liệu
     * Expected Result chính: Tooltip xuất hiện với: ngày, giá trị tuyệt đối, tên series. Không bị dính cố định.
     */
    @Test(
        description = "OVERVIEW-TC-07 - Biểu đồ xu hướng hiển thị tooltip khi hover vào điểm dữ liệu",
        groups = {"overview", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void overviewtc07BieuDoXuHuongHienThiTooltipKhiHoverVaoDiemDu() {
        loginAsManager();
                openScreen("overview");
                OverviewPage page = new OverviewPage(driver()).waitUntilReady();
                ChartAssertions.assertTooltipOnFirstRenderableChart(driver());
    }

    /**
     * TC ID: OVERVIEW-TC-08
     * Task name / test case lớn: BIỂU ĐỒ TỔNG QUAN
     * Tên test case nhỏ: Biểu đồ legend hiển thị đúng tên series và màu sắc
     * Expected Result chính: Mỗi series có nhãn rõ ràng và màu sắc tương ứng với đường/cột trên chart.
     */
    @Test(
        description = "OVERVIEW-TC-08 - Biểu đồ legend hiển thị đúng tên series và màu sắc",
        groups = {"overview", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void overviewtc08BieuDoLegendHienThiDungTenSeriesVaMauSac() {
        loginAsManager();
                openScreen("overview");
                OverviewPage page = new OverviewPage(driver()).waitUntilReady();
                ChartAssertions.assertLegendHasLabels(driver());
    }

    /**
     * TC ID: OVERVIEW-TC-09
     * Task name / test case lớn: BIỂU ĐỒ TỔNG QUAN
     * Tên test case nhỏ: Biểu đồ trục X hiển thị đúng khoảng ngày tháng
     * Expected Result chính: Trục X hiển thị 30 mốc thời gian theo ngày hoặc tick phù hợp. Không bị overlap nhãn.
     */
    @Test(
        description = "OVERVIEW-TC-09 - Biểu đồ trục X hiển thị đúng khoảng ngày tháng",
        groups = {"overview", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void overviewtc09BieuDoTrucXHienThiDungKhoangNgayThang() {
        loginAsManager();
                openScreen("overview");
                OverviewPage page = new OverviewPage(driver()).waitUntilReady();
                ChartAssertions.assertXAxisHasLabels(driver());
    }

    /**
     * TC ID: OVERVIEW-TC-10
     * Task name / test case lớn: BIỂU ĐỒ TỔNG QUAN
     * Tên test case nhỏ: Biểu đồ empty state khi không có dữ liệu
     * Expected Result chính: Khu vực chart hiển thị icon và text 'Không có dữ liệu' thay vì canvas trắng trống.
     */
    @Test(
        description = "OVERVIEW-TC-10 - Biểu đồ empty state khi không có dữ liệu",
        groups = {"overview", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void overviewtc10BieuDoEmptyStateKhiKhongCoDuLieu() {
        loginAsManager();
                openScreen("overview");
                OverviewPage page = new OverviewPage(driver()).waitUntilReady();
                applyKnownEmptyDate(page.filters());
                Assert.assertTrue(page.isEmpty());
    }

    /**
     * TC ID: OVERVIEW-TC-11
     * Task name / test case lớn: BIỂU ĐỒ TỔNG QUAN
     * Tên test case nhỏ: Biểu đồ cập nhật đúng khi đổi filter
     * Expected Result chính: Chart re-render với data 7 ngày. Trục X co lại đúng khoảng mới.
     */
    @Test(
        description = "OVERVIEW-TC-11 - Biểu đồ cập nhật đúng khi đổi filter",
        groups = {"overview", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void overviewtc11BieuDoCapNhatDungKhiDoiFilter() {
        loginAsManager();
                openScreen("overview");
                OverviewPage page = new OverviewPage(driver()).waitUntilReady();
                assertFilterTriggersDataRequest(page.filters(), "7 ngày qua");
                ChartAssertions.assertEveryVisibleChartHasGeometry(driver());
    }

}
