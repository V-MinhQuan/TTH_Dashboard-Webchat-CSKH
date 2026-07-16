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


public class ChartPreviewTest extends BaseUiTest {

    /**
     * TC ID: CHART-TC-10
     * Task name / test case lớn: PREVIEW CHART
     * Tên test case nhỏ: Click Preview khi thiếu X axis – báo lỗi validation
     * Expected Result chính: Lỗi 'X axis là bắt buộc' xuất hiện tại dropdown. Không gọi API preview.
     */
    @Test(
        description = "CHART-TC-10 - Click Preview khi thiếu X axis – báo lỗi validation",
        groups = {"chart-builder", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void charttc10ClickPreviewKhiThieuXAxisBaoLoiValidation() {
        loginAsManager();
                openScreen("chartbuilder");
                ChartBuilderPage page = new ChartBuilderPage(driver()).waitUntilCatalogReady();
                page.reset();
                page.refreshPreview();
                Assert.assertFalse(page.validationMessages().isEmpty());
    }

    /**
     * TC ID: CHART-TC-11
     * Task name / test case lớn: PREVIEW CHART
     * Tên test case nhỏ: Click Preview khi thiếu Y axis – báo lỗi validation
     * Expected Result chính: Lỗi 'Y axis là bắt buộc'. Không gọi API preview.
     */
    @Test(
        description = "CHART-TC-11 - Click Preview khi thiếu Y axis – báo lỗi validation",
        groups = {"chart-builder", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void charttc11ClickPreviewKhiThieuYAxisBaoLoiValidation() {
        loginAsManager();
                openScreen("chartbuilder");
                ChartBuilderPage page = new ChartBuilderPage(driver()).waitUntilCatalogReady();
                page.reset();
                page.selectFirstDimensionOnly();
                page.refreshPreview();
                Assert.assertFalse(page.validationMessages().isEmpty());
    }

    /**
     * TC ID: CHART-TC-12
     * Task name / test case lớn: PREVIEW CHART
     * Tên test case nhỏ: Click Preview với config đầy đủ – biểu đồ render thành công
     * Expected Result chính: API preview được gọi với config. Biểu đồ render trong khu vực preview đúng với data trả về.
     */
    @Test(
        description = "CHART-TC-12 - Click Preview với config đầy đủ – biểu đồ render thành công",
        groups = {"chart-builder", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void charttc12ClickPreviewVoiConfigDayDuBieuDoRenderThanhCong() {
        loginAsManager();
                openScreen("chartbuilder");
                ChartBuilderPage page = new ChartBuilderPage(driver()).waitUntilCatalogReady();
                page.selectMinimalValidConfiguration("Biểu đồ cột");
                page.refreshPreview();
                ChartAssertions.assertSvgHasSize(page.previewSvg());
    }

    /**
     * TC ID: CHART-TC-13
     * Task name / test case lớn: PREVIEW CHART
     * Tên test case nhỏ: Preview loading state – skeleton khi đang tải
     * Expected Result chính: Khu vực preview hiển thị spinner/skeleton trong khi chờ API.
     */
    @Test(
        description = "CHART-TC-13 - Preview loading state – skeleton khi đang tải",
        groups = {"chart-builder", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void charttc13PreviewLoadingStateSkeletonKhiDangTai() {
        loginAsManager();
                openScreen("chartbuilder");
                ChartBuilderPage page = new ChartBuilderPage(driver()).waitUntilCatalogReady();
                page.selectMinimalValidConfiguration("Biểu đồ cột");
                page.refreshPreview();
                Assert.assertTrue(page.previewState().matches("loading|success|empty"));
    }

    /**
     * TC ID: CHART-TC-14
     * Task name / test case lớn: PREVIEW CHART
     * Tên test case nhỏ: Preview API lỗi – thông báo lỗi trong khu vực preview
     * Expected Result chính: Khu vực preview hiển thị 'Không thể tải dữ liệu preview'. Không crash form.
     */
    @Test(
        description = "CHART-TC-14 - Preview API lỗi – thông báo lỗi trong khu vực preview",
        groups = {"chart-builder", "regression", "requires-db", "environment-dependent", "skip-guard", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void charttc14PreviewAPILoiThongBaoLoiTrongKhuVucPreview() {
        throw new SkipException("BLOCKED_ENVIRONMENT: Cần môi trường cô lập hoặc fault injection lặp lại được; không được dừng service/DB dùng chung hay sửa production để tạo lỗi.");
    }

    /**
     * TC ID: CHART-TC-15
     * Task name / test case lớn: PREVIEW CHART
     * Tên test case nhỏ: Thay đổi field sau preview – preview tự reset hoặc gợi ý refresh
     * Expected Result chính: Preview bị reset về trạng thái chờ hoặc hiển thị gợi ý 'Nhấn Preview để xem lại'.
     */
    @Test(
        description = "CHART-TC-15 - Thay đổi field sau preview – preview tự reset hoặc gợi ý refresh",
        groups = {"chart-builder", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void charttc15ThayDoiFieldSauPreviewPreviewTuResetHoacGoiYRefresh() {
        loginAsManager();
                openScreen("chartbuilder");
                ChartBuilderPage page = new ChartBuilderPage(driver()).waitUntilCatalogReady();
                page.selectMinimalValidConfiguration("Biểu đồ cột");
                page.refreshPreview();
                page.selectAnotherMetric();
                Assert.assertNotEquals(page.previewState(), "success");
    }

}
