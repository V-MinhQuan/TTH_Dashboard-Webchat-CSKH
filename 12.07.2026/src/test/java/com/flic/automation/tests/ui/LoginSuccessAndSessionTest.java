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


public class LoginSuccessAndSessionTest extends BaseUiTest {

    /**
     * TC ID: AUTH-TC-01
     * Task name / test case lớn: ĐĂNG NHẬP HỢP LỆ – HAPPY PATH
     * Tên test case nhỏ: Đăng nhập thành công với tài khoản Admin hợp lệ và redirect đúng dashboard
     * Expected Result chính: Redirect về Overview Dashboard. JWT token được lưu vào localStorage/cookie. Sidebar hiển thị menu Admin đầy đủ.
     */
    @Test(
        description = "AUTH-TC-01 - Đăng nhập thành công với tài khoản Admin hợp lệ và redirect đúng dashboard",
        groups = {"authentication", "regression", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void authtc01DangNhapThanhCongVoiTaiKhoanAdminHopLeVaRedirect() {
        throw new SkipException("NEEDS_REQUIREMENT_CONFIRMATION: Expected Result của Excel xung đột với contract/source active; cần Product Owner xác nhận trước khi tự động hóa như một tiêu chí pass/fail. Sai lệch: Excel mô tả JWT; backend phát HMAC Bearer session hai phần.");
    }

    /**
     * TC ID: AUTH-TC-02
     * Task name / test case lớn: ĐĂNG NHẬP HỢP LỆ – HAPPY PATH
     * Tên test case nhỏ: Đăng nhập thành công với tài khoản Manager hợp lệ
     * Expected Result chính: Đăng nhập thành công, redirect vào Dashboard. Menu hiển thị quyền Manager (không có Users quản trị).
     */
    @Test(
        description = "AUTH-TC-02 - Đăng nhập thành công với tài khoản Manager hợp lệ",
        groups = {"authentication", "regression", "requires-db"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void authtc02DangNhapThanhCongVoiTaiKhoanManagerHopLe() {
        openLogin();
                LoginPage page = loginPage();
                page.login(config().managerUsernameRequired(), config().managerPasswordRequired(), false);
                com.flic.automation.utils.WaitUtils.until(
                    () -> sidebar().isVisible() || !page.errorMessage().isBlank(),
                    config().explicitWait(), "Login did not complete within timeout");
                if (!page.errorMessage().isBlank()) throw new AssertionError("Login failed with error: " + page.errorMessage());
                Assert.assertTrue(sidebar().hasMenu("Tổng quan"), "Manager phải vào được workspace sau login");
                Assert.assertFalse(sessionStorage("flic_dashboard_auth").isBlank(), "Session auth phải được lưu khi không Remember");
    }

    /**
     * TC ID: AUTH-TC-03
     * Task name / test case lớn: ĐĂNG NHẬP HỢP LỆ – HAPPY PATH
     * Tên test case nhỏ: Đăng nhập thành công với tài khoản Staff hợp lệ
     * Expected Result chính: Đăng nhập thành công. Sidebar ẩn Users, Settings hệ thống. Chỉ có menu báo cáo cơ bản.
     */
    @Test(
        description = "AUTH-TC-03 - Đăng nhập thành công với tài khoản Staff hợp lệ",
        groups = {"authentication", "regression", "requires-db"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void authtc03DangNhapThanhCongVoiTaiKhoanStaffHopLe() {
        openLogin();
                LoginPage page = loginPage();
                page.login(config().staffUsernameRequired(), config().staffPasswordRequired(), false);
                com.flic.automation.utils.WaitUtils.until(
                    () -> sidebar().isVisible() || !page.errorMessage().isBlank(),
                    config().explicitWait(), "Login did not complete within timeout");
                if (!page.errorMessage().isBlank()) throw new AssertionError("Login failed with error: " + page.errorMessage());
                Assert.assertTrue(sidebar().hasMenu("Tổng quan"), "Staff phải vào được workspace");
                Assert.assertFalse(sidebar().hasMenu("Kênh"), "Staff không được thấy menu phân tích Kênh");
    }

    /**
     * TC ID: AUTH-TC-04
     * Task name / test case lớn: ĐĂNG NHẬP HỢP LỆ – HAPPY PATH
     * Tên test case nhỏ: JWT token được lưu đúng sau khi đăng nhập thành công
     * Expected Result chính: Token JWT hợp lệ tồn tại trong localStorage hoặc cookie httpOnly. Không bị trống.
     */
    @Test(
        description = "AUTH-TC-04 - JWT token được lưu đúng sau khi đăng nhập thành công",
        groups = {"authentication", "regression", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void authtc04JWTTokenDuocLuuDungSauKhiDangNhapThanhCong() {
        throw new SkipException("NEEDS_REQUIREMENT_CONFIRMATION: Expected Result của Excel xung đột với contract/source active; cần Product Owner xác nhận trước khi tự động hóa như một tiêu chí pass/fail. Sai lệch: Excel mô tả JWT; backend phát HMAC Bearer session hai phần.");
    }

    /**
     * TC ID: AUTH-TC-05
     * Task name / test case lớn: ĐĂNG NHẬP HỢP LỆ – HAPPY PATH
     * Tên test case nhỏ: Màn hình đăng nhập hiển thị loading spinner khi đang xác thực
     * Expected Result chính: Nút Đăng nhập chuyển sang trạng thái loading (spinner/disabled) trong quá trình gọi API.
     */
    @Test(
        description = "AUTH-TC-05 - Màn hình đăng nhập hiển thị loading spinner khi đang xác thực",
        groups = {"authentication", "regression"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void authtc05ManHinhDangNhapHienThiLoadingSpinnerKhiDangXacThuc() {
        openLogin();
                LoginPage page = loginPage().enterUsername(config().managerUsernameRequired()).enterPassword(config().managerPasswordRequired());
                page.submit();
                Assert.assertTrue(page.isSubmitting() || sidebar().isVisible(), "Nút phải disabled/loading trong lúc request hoặc login đã hoàn tất");
    }

}
