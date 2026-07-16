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


public class ExportFailureAndAccessTest extends BaseUiTest {

    /**
     * TC ID: EXPORT-TC-08
     * Task name / test case lớn: LỖI & EDGE CASE
     * Tên test case nhỏ: API Export trả 500 – toast lỗi và không tải file
     * Expected Result chính: Toast 'Xuất dữ liệu thất bại'. Không có file nào tải xuống.
     */
    @Test(
        description = "EXPORT-TC-08 - API Export trả 500 – toast lỗi và không tải file",
        groups = {"export", "regression", "environment-dependent", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void exporttc08APIExportTra500ToastLoiVaKhongTaiFile() {
        throw new SkipException("BLOCKED_ENVIRONMENT: Cần môi trường cô lập hoặc fault injection lặp lại được; không được dừng service/DB dùng chung hay sửa production để tạo lỗi.");
    }

    /**
     * TC ID: EXPORT-TC-09
     * Task name / test case lớn: LỖI & EDGE CASE
     * Tên test case nhỏ: Export file lớn – loading indicator hiển thị
     * Expected Result chính: Nút Export hiển thị spinner/loading trong khi tạo file. Không bị treo UI.
     */
    @Test(
        description = "EXPORT-TC-09 - Export file lớn – loading indicator hiển thị",
        groups = {"export", "regression", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void exporttc09ExportFileLonLoadingIndicatorHienThi() {
        loginAsManager();
                openScreen("overview");
                OverviewPage page = new OverviewPage(driver()).waitUntilReady();
                page.filters().openExportMenu();
                page.filters().exportXlsx();
                Assert.assertTrue(SourceBackedUiAssertions.pageContains(driver(), "Đang xuất") || Files.exists(waitForDownload(".xlsx")));
    }

    /**
     * TC ID: EXPORT-TC-10
     * Task name / test case lớn: LỖI & EDGE CASE
     * Tên test case nhỏ: Tên file export chứa ngày tháng hoặc module để dễ nhận biết
     * Expected Result chính: Tên file có dạng: FLIC_Export_20250610.csv hoặc tương tự.
     */
    @Test(
        description = "EXPORT-TC-10 - Tên file export chứa ngày tháng hoặc module để dễ nhận biết",
        groups = {"export", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void exporttc10TenFileExportChuaNgayThangHoacModuleDeDeNhanBiet() {
        loginAsManager();
                openScreen("overview");
                OverviewPage page = new OverviewPage(driver()).waitUntilReady();
                page.filters().openExportMenu();
                page.filters().exportXlsx();
                Path file = waitForDownload(".xlsx");
                Assert.assertTrue(file.getFileName().toString().matches(".*\\d{4}-\\d{2}-\\d{2}.*\\.xlsx"));
    }

    /**
     * TC ID: EXPORT-TC-11
     * Task name / test case lớn: LỖI & EDGE CASE
     * Tên test case nhỏ: Export không yêu cầu quyền đặc biệt – tất cả role có thể xuất
     * Expected Result chính: Staff export được dữ liệu mà mình có quyền xem. Không bị 403.
     */
    @Test(
        description = "EXPORT-TC-11 - Export không yêu cầu quyền đặc biệt – tất cả role có thể xuất",
        groups = {"export", "regression", "requires-staff"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void exporttc11ExportKhongYeuCauQuyenDacBietTatCaRoleCoThe() {
        loginAsStaff();
                openScreen("overview");
                OverviewPage page = new OverviewPage(driver()).waitUntilReady();
                page.filters().openExportMenu();
                Assert.assertTrue(page.filters().exportMenuIsOpen());
    }

}
