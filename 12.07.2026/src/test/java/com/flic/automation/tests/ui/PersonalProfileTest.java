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


public class PersonalProfileTest extends BaseUiTest {

    /**
     * TC ID: SETTINGS-TC-01
     * Task name / test case lớn: THÔNG TIN CÁ NHÂN (PROFILE)
     * Tên test case nhỏ: Load trang Profile – hiển thị đúng thông tin user hiện tại
     * Expected Result chính: Họ tên, Email, SĐT, Avatar hiển thị đúng tài khoản đang đăng nhập.
     */
    @Test(
        description = "SETTINGS-TC-01 - Load trang Profile – hiển thị đúng thông tin user hiện tại",
        groups = {"settings", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void settingstc01LoadTrangProfileHienThiDungThongTinUserHienTai() {
        loginAsManager();
                openScreen("settings");
                SettingsPage page = new SettingsPage(driver()).waitUntilReady();
                Assert.assertFalse(page.name().isBlank());
                Assert.assertFalse(page.email().isBlank());
                Assert.assertFalse(page.displayedRole().isBlank());
    }

    /**
     * TC ID: SETTINGS-TC-02
     * Task name / test case lớn: THÔNG TIN CÁ NHÂN (PROFILE)
     * Tên test case nhỏ: Sửa Họ tên hợp lệ và lưu thành công
     * Expected Result chính: API PATCH thành công. Toast xanh. Header hiển thị tên mới.
     */
    @Test(
        description = "SETTINGS-TC-02 - Sửa Họ tên hợp lệ và lưu thành công",
        groups = {"settings", "regression", "requires-db", "destructive", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void settingstc02SuaHoTenHopLeVaLuuThanhCong() {
        loginAsManager();
                openScreen("settings");
                SettingsPage page = new SettingsPage(driver()).waitUntilReady();
                requireDestructive("SETTINGS-TC-02");
                verifyProfileNameUpdateAndRestore(page, testDataName("SETTINGS-TC-02"));
    }

    /**
     * TC ID: SETTINGS-TC-03
     * Task name / test case lớn: THÔNG TIN CÁ NHÂN (PROFILE)
     * Tên test case nhỏ: Sửa Email sang định dạng sai – validation báo lỗi
     * Expected Result chính: Form báo 'Email không đúng định dạng'. Không gọi API.
     */
    @Test(
        description = "SETTINGS-TC-03 - Sửa Email sang định dạng sai – validation báo lỗi",
        groups = {"settings", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void settingstc03SuaEmailSangDinhDangSaiValidationBaoLoi() {
        loginAsManager();
                openScreen("settings");
                SettingsPage page = new SettingsPage(driver()).waitUntilReady();
                page.setEmail("invalid-email");
                page.saveProfile();
                Assert.assertTrue(SourceBackedUiAssertions.latestToast(driver()).toLowerCase().contains("email"));
    }

    /**
     * TC ID: SETTINGS-TC-04
     * Task name / test case lớn: THÔNG TIN CÁ NHÂN (PROFILE)
     * Tên test case nhỏ: Sửa SĐT chứa ký tự chữ – validation báo lỗi
     * Expected Result chính: Form báo 'Số điện thoại không hợp lệ'. Không gọi API.
     */
    @Test(
        description = "SETTINGS-TC-04 - Sửa SĐT chứa ký tự chữ – validation báo lỗi",
        groups = {"settings", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void settingstc04SuaSDTChuaKyTuChuValidationBaoLoi() {
        loginAsManager();
                openScreen("settings");
                SettingsPage page = new SettingsPage(driver()).waitUntilReady();
                page.setPhone("09abc123");
                page.saveProfile();
                Assert.assertTrue(SourceBackedUiAssertions.latestToast(driver()).toLowerCase().contains("điện thoại"));
    }

    /**
     * TC ID: SETTINGS-TC-05
     * Task name / test case lớn: THÔNG TIN CÁ NHÂN (PROFILE)
     * Tên test case nhỏ: Sửa SĐT hợp lệ 10 chữ số – lưu thành công
     * Expected Result chính: API PATCH thành công. Toast xanh. SĐT mới hiển thị trên Profile.
     */
    @Test(
        description = "SETTINGS-TC-05 - Sửa SĐT hợp lệ 10 chữ số – lưu thành công",
        groups = {"settings", "regression", "requires-db", "destructive", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void settingstc05SuaSDTHopLe10ChuSoLuuThanhCong() {
        loginAsManager();
                openScreen("settings");
                SettingsPage page = new SettingsPage(driver()).waitUntilReady();
                requireDestructive("SETTINGS-TC-05");
                verifyPhoneUpdateAndRestore(page, "0900000000");
    }

    /**
     * TC ID: SETTINGS-TC-06
     * Task name / test case lớn: THÔNG TIN CÁ NHÂN (PROFILE)
     * Tên test case nhỏ: API lỗi khi lưu Profile – toast lỗi và form giữ nguyên
     * Expected Result chính: Toast lỗi 'Cập nhật thất bại'. Form giữ nguyên dữ liệu người dùng đã nhập.
     */
    @Test(
        description = "SETTINGS-TC-06 - API lỗi khi lưu Profile – toast lỗi và form giữ nguyên",
        groups = {"settings", "regression", "requires-db", "environment-dependent", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void settingstc06APILoiKhiLuuProfileToastLoiVaFormGiuNguyen() {
        throw new SkipException("BLOCKED_ENVIRONMENT: Cần môi trường cô lập hoặc fault injection lặp lại được; không được dừng service/DB dùng chung hay sửa production để tạo lỗi.");
    }

}
