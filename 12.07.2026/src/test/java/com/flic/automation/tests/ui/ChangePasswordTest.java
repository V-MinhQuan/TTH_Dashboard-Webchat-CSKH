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


public class ChangePasswordTest extends BaseUiTest {

    /**
     * TC ID: SETTINGS-TC-10
     * Task name / test case lớn: ĐỔI MẬT KHẨU
     * Tên test case nhỏ: Đổi mật khẩu thành công với đầy đủ thông tin
     * Expected Result chính: API thành công. Toast xanh. Đăng nhập lại với mật khẩu mới thành công.
     */
    @Test(
        description = "SETTINGS-TC-10 - Đổi mật khẩu thành công với đầy đủ thông tin",
        groups = {"settings", "regression", "requires-db", "environment-dependent", "skip-guard", "destructive"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void settingstc10DoiMatKhauThanhCongVoiDayDuThongTin() {
        throw new SkipException("BLOCKED_ENVIRONMENT: Cần môi trường cô lập hoặc fault injection lặp lại được; không được dừng service/DB dùng chung hay sửa production để tạo lỗi.");
    }

    /**
     * TC ID: SETTINGS-TC-11
     * Task name / test case lớn: ĐỔI MẬT KHẨU
     * Tên test case nhỏ: Nhập mật khẩu cũ sai – báo lỗi xác thực
     * Expected Result chính: API hoặc UI báo 'Mật khẩu cũ không đúng'.
     */
    @Test(
        description = "SETTINGS-TC-11 - Nhập mật khẩu cũ sai – báo lỗi xác thực",
        groups = {"settings", "regression", "requires-db", "environment-dependent", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void settingstc11NhapMatKhauCuSaiBaoLoiXacThuc() {
        throw new SkipException("BLOCKED_ENVIRONMENT: Cần môi trường cô lập hoặc fault injection lặp lại được; không được dừng service/DB dùng chung hay sửa production để tạo lỗi.");
    }

    /**
     * TC ID: SETTINGS-TC-12
     * Task name / test case lớn: ĐỔI MẬT KHẨU
     * Tên test case nhỏ: Nhập xác nhận mật khẩu không khớp – validation báo lỗi
     * Expected Result chính: Form báo 'Mật khẩu xác nhận không khớp'. Không gọi API.
     */
    @Test(
        description = "SETTINGS-TC-12 - Nhập xác nhận mật khẩu không khớp – validation báo lỗi",
        groups = {"settings", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void settingstc12NhapXacNhanMatKhauKhongKhopValidationBaoLoi() {
        loginAsManager();
                openScreen("settings");
                SettingsPage page = new SettingsPage(driver()).waitUntilReady();
                page.enterCurrentPassword("AUTO_CURRENT");
                page.enterNewPassword("AUTO_NEW_123");
                page.confirmNewPassword("AUTO_DIFFERENT_123");
                page.requestPasswordChange();
                Assert.assertTrue(SourceBackedUiAssertions.latestToast(driver()).contains("không khớp"));
    }

    /**
     * TC ID: SETTINGS-TC-13
     * Task name / test case lớn: ĐỔI MẬT KHẨU
     * Tên test case nhỏ: Mật khẩu mới quá ngắn – validation từ chối
     * Expected Result chính: Form báo 'Mật khẩu phải có ít nhất 8 ký tự'.
     */
    @Test(
        description = "SETTINGS-TC-13 - Mật khẩu mới quá ngắn – validation từ chối",
        groups = {"settings", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void settingstc13MatKhauMoiQuaNganValidationTuChoi() {
        loginAsManager();
                openScreen("settings");
                SettingsPage page = new SettingsPage(driver()).waitUntilReady();
                page.enterCurrentPassword("AUTO_CURRENT");
                page.enterNewPassword("123");
                page.confirmNewPassword("123");
                page.requestPasswordChange();
                Assert.assertTrue(SourceBackedUiAssertions.latestToast(driver()).contains("6"));
    }

}
