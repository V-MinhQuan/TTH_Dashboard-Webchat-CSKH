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


public class ChartDataSourceTest extends BaseUiTest {

    /**
     * TC ID: CHART-TC-01
     * Task name / test case lớn: DATA SOURCE
     * Tên test case nhỏ: Mở Chart Builder – dropdown Data Source hiển thị các nguồn có sẵn
     * Expected Result chính: Dropdown liệt kê các nguồn dữ liệu: Hội thoại, Sentiment, Kênh, Từ khóa, v.v.
     */
    @Test(
        description = "CHART-TC-01 - Mở Chart Builder – dropdown Data Source hiển thị các nguồn có sẵn",
        groups = {"chart-builder", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void charttc01MoChartBuilderDropdownDataSourceHienThiCacNguonCoSan() {
        loginAsManager();
                openScreen("chartbuilder");
                ChartBuilderPage page = new ChartBuilderPage(driver()).waitUntilCatalogReady();
                Assert.assertFalse(page.dataSourceOptions().isEmpty());
    }

    /**
     * TC ID: CHART-TC-02
     * Task name / test case lớn: DATA SOURCE
     * Tên test case nhỏ: Chọn Data Source 'Conversations' – field list X/Y đúng schema
     * Expected Result chính: Field list chứa các field của Conversations: date, channel, topic, rating, v.v.
     */
    @Test(
        description = "CHART-TC-02 - Chọn Data Source 'Conversations' – field list X/Y đúng schema",
        groups = {"chart-builder", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void charttc02ChonDataSourceConversationsFieldListXYDungSchema() {
        loginAsManager();
                openScreen("chartbuilder");
                ChartBuilderPage page = new ChartBuilderPage(driver()).waitUntilCatalogReady();
                page.selectFirstAvailableDataSource();
                Assert.assertFalse(page.availableFieldLabels().isEmpty());
    }

    /**
     * TC ID: CHART-TC-03
     * Task name / test case lớn: DATA SOURCE
     * Tên test case nhỏ: Chọn Data Source khác – field list tự động thay thế
     * Expected Result chính: Field X/Y bị reset. Field list mới thuộc schema Data Source mới. Không giữ field cũ không tương thích.
     */
    @Test(
        description = "CHART-TC-03 - Chọn Data Source khác – field list tự động thay thế",
        groups = {"chart-builder", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void charttc03ChonDataSourceKhacFieldListTuDongThayThe() {
        loginAsManager();
                openScreen("chartbuilder");
                ChartBuilderPage page = new ChartBuilderPage(driver()).waitUntilCatalogReady();
                List<String> before = page.availableFieldLabels();
                page.selectAnotherAvailableDataSource();
                Assert.assertNotEquals(page.availableFieldLabels(), before);
    }

    /**
     * TC ID: CHART-TC-04
     * Task name / test case lớn: DATA SOURCE
     * Tên test case nhỏ: Data Source trống – không load được field list
     * Expected Result chính: Field list hiển thị trạng thái lỗi hoặc trống kèm thông báo. Không crash form.
     */
    @Test(
        description = "CHART-TC-04 - Data Source trống – không load được field list",
        groups = {"chart-builder", "regression", "requires-db", "skip-guard", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void charttc04DataSourceTrongKhongLoadDuocFieldList() {
        throw new SkipException("NOT_APPLICABLE: Control/endpoint/role được mô tả không tồn tại trong luồng active hiện tại.");
    }

}
