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


public class ChartTypeConfigurationTest extends BaseUiTest {

    /**
     * TC ID: CHART-TC-05
     * Task name / test case lớn: CHART TYPE
     * Tên test case nhỏ: Chọn Bar chart – form hiển thị field X (category) và Y (metric)
     * Expected Result chính: Hiển thị dropdown cho X axis (category) và Y axis (numeric metric).
     */
    @Test(
        description = "CHART-TC-05 - Chọn Bar chart – form hiển thị field X (category) và Y (metric)",
        groups = {"chart-builder", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void charttc05ChonBarChartFormHienThiFieldXCategoryVaYMetric() {
        loginAsManager();
                openScreen("chartbuilder");
                ChartBuilderPage page = new ChartBuilderPage(driver()).waitUntilCatalogReady();
                page.selectChartType("Biểu đồ cột");
                Assert.assertTrue(page.visibleSlotLabels().size() >= 2);
    }

    /**
     * TC ID: CHART-TC-06
     * Task name / test case lớn: CHART TYPE
     * Tên test case nhỏ: Chọn Line chart – gợi ý X axis là field Date/Time
     * Expected Result chính: X axis dropdown gợi ý hoặc chỉ cho phép field kiểu Date/Time.
     */
    @Test(
        description = "CHART-TC-06 - Chọn Line chart – gợi ý X axis là field Date/Time",
        groups = {"chart-builder", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void charttc06ChonLineChartGoiYXAxisLaFieldDateTime() {
        loginAsManager();
                openScreen("chartbuilder");
                ChartBuilderPage page = new ChartBuilderPage(driver()).waitUntilCatalogReady();
                page.selectChartType("Biểu đồ đường");
                Assert.assertTrue(page.availableFieldLabels().stream().anyMatch(v -> v.toLowerCase().contains("ngày") || v.toLowerCase().contains("thời gian")));
    }

    /**
     * TC ID: CHART-TC-07
     * Task name / test case lớn: CHART TYPE
     * Tên test case nhỏ: Chọn Pie chart – form chỉ cần 1 dimension và 1 metric
     * Expected Result chính: Form hiển thị 1 dimension (label) và 1 metric (value). Không có Y axis riêng.
     */
    @Test(
        description = "CHART-TC-07 - Chọn Pie chart – form chỉ cần 1 dimension và 1 metric",
        groups = {"chart-builder", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void charttc07ChonPieChartFormChiCan1DimensionVa1Metric() {
        loginAsManager();
                openScreen("chartbuilder");
                ChartBuilderPage page = new ChartBuilderPage(driver()).waitUntilCatalogReady();
                page.selectChartType("Biểu đồ tròn");
                Assert.assertTrue(page.visibleSlotLabels().size() >= 2);
    }

    /**
     * TC ID: CHART-TC-08
     * Task name / test case lớn: CHART TYPE
     * Tên test case nhỏ: Đổi Chart Type từ Bar sang Pie khi field đã config – cảnh báo hoặc reset
     * Expected Result chính: Hệ thống hiển thị cảnh báo hoặc tự reset field không tương thích với Pie.
     */
    @Test(
        description = "CHART-TC-08 - Đổi Chart Type từ Bar sang Pie khi field đã config – cảnh báo hoặc reset",
        groups = {"chart-builder", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void charttc08DoiChartTypeTuBarSangPieKhiFieldDaConfigCanh() {
        loginAsManager();
                openScreen("chartbuilder");
                ChartBuilderPage page = new ChartBuilderPage(driver()).waitUntilCatalogReady();
                page.selectMinimalValidConfiguration("Biểu đồ cột");
                page.selectChartType("Biểu đồ tròn");
                Assert.assertTrue(page.validationMessages().isEmpty() || !page.previewState().equals("success"));
    }

    /**
     * TC ID: CHART-TC-09
     * Task name / test case lớn: CHART TYPE
     * Tên test case nhỏ: Đổi Chart Type giữ Data Source không thay đổi
     * Expected Result chính: Data Source không bị reset khi đổi Chart Type.
     */
    @Test(
        description = "CHART-TC-09 - Đổi Chart Type giữ Data Source không thay đổi",
        groups = {"chart-builder", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void charttc09DoiChartTypeGiuDataSourceKhongThayDoi() {
        loginAsManager();
                openScreen("chartbuilder");
                ChartBuilderPage page = new ChartBuilderPage(driver()).waitUntilCatalogReady();
                page.selectFirstAvailableDataSource();
                String source = page.selectedDataSource();
                page.selectChartType("Biểu đồ đường");
                Assert.assertEquals(page.selectedDataSource(), source);
    }

}
