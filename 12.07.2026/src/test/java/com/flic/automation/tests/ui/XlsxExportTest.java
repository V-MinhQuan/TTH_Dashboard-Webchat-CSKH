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


public class XlsxExportTest extends BaseUiTest {

    /**
     * TC ID: EXPORT-TC-05
     * Task name / test case lớn: EXPORT EXCEL (XLSX)
     * Tên test case nhỏ: Export XLSX thành công – file mở được bằng Excel
     * Expected Result chính: File .xlsx mở bình thường. Sheet chính hiển thị đúng dữ liệu.
     */
    @Test(
        description = "EXPORT-TC-05 - Export XLSX thành công – file mở được bằng Excel",
        groups = {"export", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void exporttc05ExportXLSXThanhCongFileMoDuocBangExcel() {
        loginAsManager();
                openScreen("overview");
                OverviewPage page = new OverviewPage(driver()).waitUntilReady();
                page.filters().openExportMenu();
                page.filters().exportXlsx();
                ExcelUtils.assertReadable(waitForDownload(".xlsx"));
    }

    /**
     * TC ID: EXPORT-TC-06
     * Task name / test case lớn: EXPORT EXCEL (XLSX)
     * Tên test case nhỏ: Export XLSX không bị dính dữ liệu giữa các cột
     * Expected Result chính: Mỗi cột chứa đúng dữ liệu tương ứng. Không bị tràn hoặc merge sai.
     */
    @Test(
        description = "EXPORT-TC-06 - Export XLSX không bị dính dữ liệu giữa các cột",
        groups = {"export", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void exporttc06ExportXLSXKhongBiDinhDuLieuGiuaCacCot() {
        loginAsManager();
                openScreen("overview");
                OverviewPage page = new OverviewPage(driver()).waitUntilReady();
                page.filters().openExportMenu();
                page.filters().exportXlsx();
                ExcelUtils.assertColumnsReadable(waitForDownload(".xlsx"));
    }

    /**
     * TC ID: EXPORT-TC-07
     * Task name / test case lớn: EXPORT EXCEL (XLSX)
     * Tên test case nhỏ: Export XLSX giữ đúng dữ liệu theo filter
     * Expected Result chính: Số liệu và danh sách trong file khớp với dữ liệu trên bảng sau khi filter.
     */
    @Test(
        description = "EXPORT-TC-07 - Export XLSX giữ đúng dữ liệu theo filter",
        groups = {"export", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void exporttc07ExportXLSXGiuDungDuLieuTheoFilter() {
        loginAsManager();
                openScreen("overview");
                OverviewPage page = new OverviewPage(driver()).waitUntilReady();
                page.filters().selectDateRange("7 ngày qua");
                page.filters().apply();
                page.filters().openExportMenu();
                page.filters().exportXlsx();
                ExcelUtils.assertContainsAppliedFilterMetadata(waitForDownload(".xlsx"), "7 ngày qua");
    }

}
