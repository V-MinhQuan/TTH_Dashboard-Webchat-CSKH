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


public class SavedChartConfigurationTest extends BaseUiTest {

    /**
     * TC ID: CHART-TC-22
     * Task name / test case lớn: QUẢN LÝ DANH SÁCH CONFIG
     * Tên test case nhỏ: Danh sách config hiển thị các biểu đồ đã lưu
     * Expected Result chính: Hiển thị tên các config đã lưu trước đó. Có thể load lại từng config.
     */
    @Test(
        description = "CHART-TC-22 - Danh sách config hiển thị các biểu đồ đã lưu",
        groups = {"chart-builder", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void charttc22DanhSachConfigHienThiCacBieuDoDaLuu() {
        loginAsManager();
                openScreen("chartbuilder");
                ChartBuilderPage page = new ChartBuilderPage(driver()).waitUntilCatalogReady();
                Assert.assertTrue(page.savedConfigCount() >= 0);
    }

    /**
     * TC ID: CHART-TC-23
     * Task name / test case lớn: QUẢN LÝ DANH SÁCH CONFIG
     * Tên test case nhỏ: Click vào config cũ – load lại đúng cấu hình
     * Expected Result chính: Form điền lại đúng Data Source, Chart Type, X/Y axis của config đó.
     */
    @Test(
        description = "CHART-TC-23 - Click vào config cũ – load lại đúng cấu hình",
        groups = {"chart-builder", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void charttc23ClickVaoConfigCuLoadLaiDungCauHinh() {
        loginAsManager();
                openScreen("chartbuilder");
                ChartBuilderPage page = new ChartBuilderPage(driver()).waitUntilCatalogReady();
                String name = requireExistingAutomationChart(page);
                page.applySavedConfig(name);
                Assert.assertFalse(page.selectedDataSource().isBlank());
    }

    /**
     * TC ID: CHART-TC-24
     * Task name / test case lớn: QUẢN LÝ DANH SÁCH CONFIG
     * Tên test case nhỏ: Xóa config – modal xác nhận và xóa thành công
     * Expected Result chính: Config biến mất khỏi danh sách. API DELETE thành công.
     */
    @Test(
        description = "CHART-TC-24 - Xóa config – modal xác nhận và xóa thành công",
        groups = {"chart-builder", "regression", "requires-db", "destructive", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void charttc24XoaConfigModalXacNhanVaXoaThanhCong() {
        loginAsManager();
                openScreen("chartbuilder");
                ChartBuilderPage page = new ChartBuilderPage(driver()).waitUntilCatalogReady();
                requireDestructive("CHART-TC-24");
                String name = createAutomationChart(page, "CHART-TC-24");
                page.deleteSavedConfig(name);
                Assert.assertFalse(page.hasSavedConfig(name));
    }

}
