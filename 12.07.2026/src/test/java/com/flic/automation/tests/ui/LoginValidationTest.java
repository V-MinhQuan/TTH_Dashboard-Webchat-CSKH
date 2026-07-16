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


public class LoginValidationTest extends BaseUiTest {

    /**
     * TC ID: AUTH-TC-06
     * Task name / test case lớn: ĐĂNG NHẬP LỖI – VALIDATION & ERROR
     * Tên test case nhỏ: Đăng nhập sai mật khẩu hiển thị thông báo lỗi và không tạo token
     * Expected Result chính: API trả 401. UI hiển thị 'Sai mật khẩu hoặc email'. Không có token trong localStorage. Không redirect.
     */
    @Test(
        description = "AUTH-TC-06 - Đăng nhập sai mật khẩu hiển thị thông báo lỗi và không tạo token",
        groups = {"authentication", "regression", "requires-db"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void authtc06DangNhapSaiMatKhauHienThiThongBaoLoiVaKhong() {
        openLogin();
                LoginPage page = loginPage().enterUsername(config().managerUsernameRequired()).enterPassword("AUTO_INCORRECT_PASSWORD");
                page.submit();
                Assert.assertFalse(page.errorMessage().isBlank(), "Sai mật khẩu phải hiển thị lỗi");
                Assert.assertTrue(localStorage("flic_dashboard_auth").isBlank() && sessionStorage("flic_dashboard_auth").isBlank(), "Không được tạo auth storage");
    }

    /**
     * TC ID: AUTH-TC-07
     * Task name / test case lớn: ĐĂNG NHẬP LỖI – VALIDATION & ERROR
     * Tên test case nhỏ: Đăng nhập với email không tồn tại trong hệ thống
     * Expected Result chính: API trả 401 hoặc 404. UI hiển thị lỗi 'Tài khoản không tồn tại'. Không redirect.
     */
    @Test(
        description = "AUTH-TC-07 - Đăng nhập với email không tồn tại trong hệ thống",
        groups = {"authentication", "regression", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void authtc07DangNhapVoiEmailKhongTonTaiTrongHeThong() {
        throw new SkipException("NEEDS_REQUIREMENT_CONFIRMATION: Expected Result của Excel xung đột với contract/source active; cần Product Owner xác nhận trước khi tự động hóa như một tiêu chí pass/fail. Sai lệch: Excel dùng email; UI/API thực tế dùng username.");
    }

    /**
     * TC ID: AUTH-TC-08
     * Task name / test case lớn: ĐĂNG NHẬP LỖI – VALIDATION & ERROR
     * Tên test case nhỏ: Bỏ trống ô Email khi đăng nhập – validation báo bắt buộc
     * Expected Result chính: Form báo lỗi 'Email không được để trống' tại ô Email. Không gọi API.
     */
    @Test(
        description = "AUTH-TC-08 - Bỏ trống ô Email khi đăng nhập – validation báo bắt buộc",
        groups = {"authentication", "regression"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void authtc08BoTrongOEmailKhiDangNhapValidationBaoBatBuoc() {
        openLogin();
                LoginPage page = loginPage().enterPassword("AUTO_NOT_SUBMITTED");
                page.submit();
                Assert.assertTrue(page.errorMessage().contains("đầy đủ"), "Trường username trống phải bị chặn; Excel đang gọi trường này là Email");
                Assert.assertTrue(localStorage("flic_dashboard_auth").isBlank() && sessionStorage("flic_dashboard_auth").isBlank());
    }

    /**
     * TC ID: AUTH-TC-09
     * Task name / test case lớn: ĐĂNG NHẬP LỖI – VALIDATION & ERROR
     * Tên test case nhỏ: Bỏ trống ô Password khi đăng nhập – validation báo bắt buộc
     * Expected Result chính: Form báo lỗi 'Mật khẩu không được để trống' tại ô Password. Không gọi API.
     */
    @Test(
        description = "AUTH-TC-09 - Bỏ trống ô Password khi đăng nhập – validation báo bắt buộc",
        groups = {"authentication", "regression", "smoke", "requires-db"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void authtc09BoTrongOPasswordKhiDangNhapValidationBaoBatBuoc() {
        openLogin();
                LoginPage page = loginPage().enterUsername("automation-user");
                page.submit();
                Assert.assertTrue(page.errorMessage().contains("đầy đủ"), "Thiếu mật khẩu phải bị validation trước API");
                Assert.assertTrue(localStorage("flic_dashboard_auth").isBlank() && sessionStorage("flic_dashboard_auth").isBlank());
    }

    /**
     * TC ID: AUTH-TC-10
     * Task name / test case lớn: ĐĂNG NHẬP LỖI – VALIDATION & ERROR
     * Tên test case nhỏ: Nhập email sai định dạng thiếu @ – validation báo lỗi format
     * Expected Result chính: Form báo lỗi 'Email không đúng định dạng'. Không gọi API đăng nhập.
     */
    @Test(
        description = "AUTH-TC-10 - Nhập email sai định dạng thiếu @ – validation báo lỗi format",
        groups = {"authentication", "regression", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void authtc10NhapEmailSaiDinhDangThieuValidationBaoLoiFormat() {
        throw new SkipException("NOT_APPLICABLE: Control/endpoint/role được mô tả không tồn tại trong luồng active hiện tại. Sai lệch: Excel dùng email; UI/API thực tế dùng username.");
    }

    /**
     * TC ID: AUTH-TC-11
     * Task name / test case lớn: ĐĂNG NHẬP LỖI – VALIDATION & ERROR
     * Tên test case nhỏ: Nhập mật khẩu có khoảng trắng đầu cuối – không tự trim gây lỗi không rõ ràng
     * Expected Result chính: Hệ thống không tự trim, API trả 401. Hiển thị lỗi mật khẩu sai rõ ràng thay vì lỗi server 500.
     */
    @Test(
        description = "AUTH-TC-11 - Nhập mật khẩu có khoảng trắng đầu cuối – không tự trim gây lỗi không rõ ràng",
        groups = {"authentication", "regression", "requires-db"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void authtc11NhapMatKhauCoKhoangTrangDauCuoiKhongTuTrimGay() {
        openLogin();
                LoginPage page = loginPage().enterUsername(config().managerUsernameRequired()).enterPassword(" " + config().managerPasswordRequired() + " ");
                page.submit();
                Assert.assertFalse(page.errorMessage().isBlank(), "Password có whitespace phải bị backend từ chối rõ ràng");
    }

    /**
     * TC ID: AUTH-TC-12
     * Task name / test case lớn: ĐĂNG NHẬP LỖI – VALIDATION & ERROR
     * Tên test case nhỏ: Nhập email có chữ hoa – login thành công (case-insensitive email)
     * Expected Result chính: Hệ thống xử lý email case-insensitive. Login thành công với email viết hoa.
     */
    @Test(
        description = "AUTH-TC-12 - Nhập email có chữ hoa – login thành công (case-insensitive email)",
        groups = {"authentication", "regression", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void authtc12NhapEmailCoChuHoaLoginThanhCongCaseInsensitiveEmail() {
        throw new SkipException("NOT_APPLICABLE: Control/endpoint/role được mô tả không tồn tại trong luồng active hiện tại. Sai lệch: Excel dùng email; UI/API thực tế dùng username.");
    }

}
