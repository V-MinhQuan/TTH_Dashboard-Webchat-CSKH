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


public class LogoutAndSessionProtectionTest extends BaseUiTest {

    /**
     * TC ID: AUTH-TC-13
     * Task name / test case lớn: ĐĂNG XUẤT & SESSION
     * Tên test case nhỏ: Click nút Đăng xuất xóa token và redirect về trang Login
     * Expected Result chính: Token bị xóa khỏi localStorage/cookie. State React bị clear. URL redirect về /login.
     */
    @Test(
        description = "AUTH-TC-13 - Click nút Đăng xuất xóa token và redirect về trang Login",
        groups = {"authentication", "regression", "api", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void authtc13ClickNutDangXuatXoaTokenVaRedirectVeTrangLogin() {
        loginAsManager();
                header().openAvatarMenu();
                header().requestLogout();
                header().confirmLogout();
                Assert.assertTrue(new LoginPage(driver()).isLoaded(), "Logout phải đưa về Login");
                Assert.assertTrue(localStorage("flic_dashboard_auth").isBlank() && sessionStorage("flic_dashboard_auth").isBlank(), "Logout phải xóa cả hai storage");
    }

    /**
     * TC ID: AUTH-TC-14
     * Task name / test case lớn: ĐĂNG XUẤT & SESSION
     * Tên test case nhỏ: Đăng xuất sau đó dùng nút Back trình duyệt không vào được dashboard
     * Expected Result chính: Hệ thống redirect lại về Login. Không hiển thị dashboard khi không có token.
     */
    @Test(
        description = "AUTH-TC-14 - Đăng xuất sau đó dùng nút Back trình duyệt không vào được dashboard",
        groups = {"authentication", "regression", "api", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void authtc14DangXuatSauDoDungNutBackTrinhDuyetKhongVaoDuoc() {
        loginAsManager();
                header().openAvatarMenu();
                header().requestLogout();
                header().confirmLogout();
                driver().navigate().back();
                Assert.assertTrue(new LoginPage(driver()).isLoaded(), "Back sau logout không được lộ dashboard");
    }

    /**
     * TC ID: AUTH-TC-15
     * Task name / test case lớn: ĐĂNG XUẤT & SESSION
     * Tên test case nhỏ: Token JWT hết hạn tự động redirect về Login và xóa session
     * Expected Result chính: API interceptor nhận 401 Unauthorized. Tự xóa token. Redirect về Login.
     */
    @Test(
        description = "AUTH-TC-15 - Token JWT hết hạn tự động redirect về Login và xóa session",
        groups = {"authentication", "regression", "api", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void authtc15TokenJWTHetHanTuDongRedirectVeLoginVaXoaSession() {
        throw new SkipException("NEEDS_REQUIREMENT_CONFIRMATION: Expected Result của Excel xung đột với contract/source active; cần Product Owner xác nhận trước khi tự động hóa như một tiêu chí pass/fail. Sai lệch: Excel mô tả JWT; backend phát HMAC Bearer session hai phần.");
    }

    /**
     * TC ID: AUTH-TC-16
     * Task name / test case lớn: ĐĂNG XUẤT & SESSION
     * Tên test case nhỏ: Truy cập URL nội bộ /overview khi chưa đăng nhập bị chặn
     * Expected Result chính: Route Guard phát hiện không có token hợp lệ, redirect về màn Login.
     */
    @Test(
        description = "AUTH-TC-16 - Truy cập URL nội bộ /overview khi chưa đăng nhập bị chặn",
        groups = {"authentication", "regression", "smoke", "api"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void authtc16TruyCapURLNoiBoOverviewKhiChuaDangNhapBiChan() {
        driver().get(config().baseUrl());
                clearAuthentication();
                driver().get(config().baseUrl() + "/overview");
                Assert.assertTrue(new LoginPage(driver()).isLoaded(), "URL nội bộ phải hiển thị Login khi chưa có session");
    }

    /**
     * TC ID: AUTH-TC-17
     * Task name / test case lớn: ĐĂNG XUẤT & SESSION
     * Tên test case nhỏ: Token giả mạo (tampered JWT) bị backend từ chối với 401
     * Expected Result chính: Backend xác thực chữ ký JWT thất bại, trả 401 Unauthorized. Frontend redirect về Login.
     */
    @Test(
        description = "AUTH-TC-17 - Token giả mạo (tampered JWT) bị backend từ chối với 401",
        groups = {"authentication", "regression", "api", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void authtc17TokenGiaMaoTamperedJWTBiBackendTuChoiVoi401() {
        loginAsManager();
                tamperStoredAccessToken();
                driver().navigate().refresh();
                openScreen("overview");
                Assert.assertTrue(waitForLoginOrUnauthorized(), "HMAC Bearer bị sửa phải dẫn đến 401 và xóa session");
    }

}
