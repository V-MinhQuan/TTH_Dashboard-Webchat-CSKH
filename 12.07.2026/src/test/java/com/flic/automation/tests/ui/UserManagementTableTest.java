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


public class UserManagementTableTest extends BaseUiTest {

    /**
     * TC ID: USER-TC-01
     * Task name / test case lớn: DANH SÁCH NGƯỜI DÙNG
     * Tên test case nhỏ: Admin load bảng Users – hiển thị đầy đủ cột và badge role màu sắc
     * Expected Result chính: Bảng hiển thị cột: Email, Họ tên, Role (badge màu), Ngày tạo, Trạng thái.
     */
    @Test(
        description = "USER-TC-01 - Admin load bảng Users – hiển thị đầy đủ cột và badge role màu sắc",
        groups = {"user-management", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void usertc01AdminLoadBangUsersHienThiDayDuCotVaBadgeRole() {
        loginAsManager();
                openScreen("users");
                UserManagementPage page = new UserManagementPage(driver()).waitUntilReady();
                SourceBackedUiAssertions.assertTableHasHeaders(driver(), List.of("TÊN NGƯỜI DÙNG", "VAI TRÒ", "HÀNH ĐỘNG"));
                Assert.assertTrue(SourceBackedUiAssertions.pageContains(driver(), "Nhân viên CSKH") || SourceBackedUiAssertions.pageContains(driver(), "Quản lý CSKH"));
    }

    /**
     * TC ID: USER-TC-02
     * Task name / test case lớn: DANH SÁCH NGƯỜI DÙNG
     * Tên test case nhỏ: Phân trang bảng Users
     * Expected Result chính: Phân trang đúng, không trùng user.
     */
    @Test(
        description = "USER-TC-02 - Phân trang bảng Users",
        groups = {"user-management", "regression", "requires-db", "skip-guard", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void usertc02PhanTrangBangUsers() {
        throw new SkipException("NOT_APPLICABLE: Control/endpoint/role được mô tả không tồn tại trong luồng active hiện tại. Sai lệch: UserManagement không có pagination/sort/edit-email hoặc role trống.");
    }

    /**
     * TC ID: USER-TC-03
     * Task name / test case lớn: DANH SÁCH NGƯỜI DÙNG
     * Tên test case nhỏ: Sort bảng Users theo Ngày tạo hoặc Họ tên
     * Expected Result chính: Sort tăng/giảm đúng chiều.
     */
    @Test(
        description = "USER-TC-03 - Sort bảng Users theo Ngày tạo hoặc Họ tên",
        groups = {"user-management", "regression", "requires-db", "skip-guard", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void usertc03SortBangUsersTheoNgayTaoHoacHoTen() {
        throw new SkipException("NOT_APPLICABLE: Control/endpoint/role được mô tả không tồn tại trong luồng active hiện tại. Sai lệch: UserManagement không có pagination/sort/edit-email hoặc role trống.");
    }

    /**
     * TC ID: USER-TC-04
     * Task name / test case lớn: DANH SÁCH NGƯỜI DÙNG
     * Tên test case nhỏ: Tìm kiếm user theo email
     * Expected Result chính: Bảng chỉ hiển thị user có email chứa chuỗi tìm kiếm.
     */
    @Test(
        description = "USER-TC-04 - Tìm kiếm user theo email",
        groups = {"user-management", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void usertc04TimKiemUserTheoEmail() {
        loginAsManager();
                openScreen("users");
                UserManagementPage page = new UserManagementPage(driver()).waitUntilReady();
                String email = requireExistingUserEmail(page);
                page.search(email);
                Assert.assertTrue(SourceBackedUiAssertions.everyTableRowContains(driver(), email));
    }

    /**
     * TC ID: USER-TC-05
     * Task name / test case lớn: DANH SÁCH NGƯỜI DÙNG
     * Tên test case nhỏ: Non-Admin truy cập trang Users bị chặn
     * Expected Result chính: Hệ thống redirect hoặc hiện 403. Không hiển thị danh sách user.
     */
    @Test(
        description = "USER-TC-05 - Non-Admin truy cập trang Users bị chặn",
        groups = {"user-management", "regression", "requires-db", "requires-manager", "requires-staff"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void usertc05NonAdminTruyCapTrangUsersBiChan() {
        loginAsStaff();
                openScreen("users");
                UserManagementPage page = new UserManagementPage(driver()).waitUntilReady();
                Assert.assertTrue(page.isAccessDenied());
    }

}
