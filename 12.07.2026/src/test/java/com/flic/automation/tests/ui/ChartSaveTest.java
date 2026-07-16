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


public class ChartSaveTest extends BaseUiTest {

    /**
     * TC ID: CHART-TC-16
     * Task name / test case lớn: LƯU CẤU HÌNH
     * Tên test case nhỏ: Click Save – mở modal nhập tên biểu đồ
     * Expected Result chính: Modal xuất hiện với ô nhập tên, nút Lưu và Hủy.
     */
    @Test(
        description = "CHART-TC-16 - Click Save – mở modal nhập tên biểu đồ",
        groups = {"chart-builder", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void charttc16ClickSaveMoModalNhapTenBieuDo() {
        loginAsManager();
                openScreen("chartbuilder");
                ChartBuilderPage page = new ChartBuilderPage(driver()).waitUntilCatalogReady();
                page.openSaveDialog();
                Assert.assertTrue(page.saveDialogIsOpen());
    }

    /**
     * TC ID: CHART-TC-17
     * Task name / test case lớn: LƯU CẤU HÌNH
     * Tên test case nhỏ: Nhập tên config hợp lệ và lưu thành công
     * Expected Result chính: API POST thành công. Modal đóng. Config mới xuất hiện trong danh sách.
     */
    @Test(
        description = "CHART-TC-17 - Nhập tên config hợp lệ và lưu thành công",
        groups = {"chart-builder", "regression", "requires-db", "destructive", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void charttc17NhapTenConfigHopLeVaLuuThanhCong() {
        loginAsManager();
                openScreen("chartbuilder");
                ChartBuilderPage page = new ChartBuilderPage(driver()).waitUntilCatalogReady();
                requireDestructive("CHART-TC-17");
                String name = testDataName("CHART-TC-17");
                page.selectMinimalValidConfiguration("Biểu đồ cột");
                page.saveConfig(name, "Automation");
                Assert.assertTrue(page.hasSavedConfig(name));
                page.deleteSavedConfig(name);
    }

    /**
     * TC ID: CHART-TC-18
     * Task name / test case lớn: LƯU CẤU HÌNH
     * Tên test case nhỏ: Lưu config với tên bị bỏ trống – validation báo bắt buộc
     * Expected Result chính: Form báo lỗi 'Tên biểu đồ không được để trống'. Không gọi API.
     */
    @Test(
        description = "CHART-TC-18 - Lưu config với tên bị bỏ trống – validation báo bắt buộc",
        groups = {"chart-builder", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void charttc18LuuConfigVoiTenBiBoTrongValidationBaoBatBuoc() {
        loginAsManager();
                openScreen("chartbuilder");
                ChartBuilderPage page = new ChartBuilderPage(driver()).waitUntilCatalogReady();
                page.openSaveDialog();
                page.saveConfig("", "Automation");
                Assert.assertFalse(page.validationMessages().isEmpty());
    }

    /**
     * TC ID: CHART-TC-19
     * Task name / test case lớn: LƯU CẤU HÌNH
     * Tên test case nhỏ: Lưu config với tên trùng lặp – xử lý conflict
     * Expected Result chính: Hệ thống báo lỗi 'Tên đã tồn tại' hoặc tự thêm hậu tố (1), (2).
     */
    @Test(
        description = "CHART-TC-19 - Lưu config với tên trùng lặp – xử lý conflict",
        groups = {"chart-builder", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void charttc19LuuConfigVoiTenTrungLapXuLyConflict() {
        loginAsManager();
                openScreen("chartbuilder");
                ChartBuilderPage page = new ChartBuilderPage(driver()).waitUntilCatalogReady();
                requireDestructive("CHART-TC-19");
                verifyDuplicateChartNameConflict(page, testDataName("CHART-TC-19"));
    }

    /**
     * TC ID: CHART-TC-20
     * Task name / test case lớn: LƯU CẤU HÌNH
     * Tên test case nhỏ: Click Hủy trong modal Save – không tạo config
     * Expected Result chính: Modal đóng. Không gọi API. Danh sách config không thay đổi.
     */
    @Test(
        description = "CHART-TC-20 - Click Hủy trong modal Save – không tạo config",
        groups = {"chart-builder", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void charttc20ClickHuyTrongModalSaveKhongTaoConfig() {
        loginAsManager();
                openScreen("chartbuilder");
                ChartBuilderPage page = new ChartBuilderPage(driver()).waitUntilCatalogReady();
                int before = page.savedConfigCount();
                page.openSaveDialog();
                page.cancelSaveDialog();
                Assert.assertEquals(page.savedConfigCount(), before);
    }

    /**
     * TC ID: CHART-TC-21
     * Task name / test case lớn: LƯU CẤU HÌNH
     * Tên test case nhỏ: Lưu khi chưa preview – cảnh báo hoặc vẫn cho lưu
     * Expected Result chính: Hệ thống có thể hiển thị cảnh báo 'Bạn chưa preview biểu đồ' hoặc vẫn cho lưu trực tiếp.
     */
    @Test(
        description = "CHART-TC-21 - Lưu khi chưa preview – cảnh báo hoặc vẫn cho lưu",
        groups = {"chart-builder", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void charttc21LuuKhiChuaPreviewCanhBaoHoacVanChoLuu() {
        loginAsManager();
                openScreen("chartbuilder");
                ChartBuilderPage page = new ChartBuilderPage(driver()).waitUntilCatalogReady();
                page.reset();
                page.openSaveDialog();
                Assert.assertTrue(page.saveDialogIsOpen());
    }

}
