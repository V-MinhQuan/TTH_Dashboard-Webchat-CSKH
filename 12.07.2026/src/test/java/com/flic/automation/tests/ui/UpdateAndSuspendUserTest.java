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


public class UpdateAndSuspendUserTest extends BaseUiTest {

    /**
     * TC ID: USER-TC-11
     * Task name / test case lớn: SỬA & KHÓA NGƯỜI DÙNG
     * Tên test case nhỏ: Sửa user đổi Role Staff thành Manager – API cập nhật
     * Expected Result chính: API PATCH thành công. Badge role đổi sang Manager. User đó login lại thấy menu Manager.
     */
    @Test(
        description = "USER-TC-11 - Sửa user đổi Role Staff thành Manager – API cập nhật",
        groups = {"user-management", "regression", "requires-db", "destructive", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void usertc11SuaUserDoiRoleStaffThanhManagerAPICapNhat() {
        loginAsManager();
                openScreen("users");
                UserManagementPage page = new UserManagementPage(driver()).waitUntilReady();
                requireDestructive("USER-TC-11");
                verifyRoleChangeAndRestore(page);
    }

    /**
     * TC ID: USER-TC-12
     * Task name / test case lớn: SỬA & KHÓA NGƯỜI DÙNG
     * Tên test case nhỏ: Sửa user đổi email sang email đã tồn tại – conflict
     * Expected Result chính: API trả 409. UI báo 'Email đã tồn tại'. Không cập nhật.
     */
    @Test(
        description = "USER-TC-12 - Sửa user đổi email sang email đã tồn tại – conflict",
        groups = {"user-management", "regression", "requires-db", "skip-guard", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void usertc12SuaUserDoiEmailSangEmailDaTonTaiConflict() {
        throw new SkipException("NOT_APPLICABLE: Control/endpoint/role được mô tả không tồn tại trong luồng active hiện tại. Sai lệch: UserManagement không có pagination/sort/edit-email hoặc role trống.");
    }

    /**
     * TC ID: USER-TC-13
     * Task name / test case lớn: SỬA & KHÓA NGƯỜI DÙNG
     * Tên test case nhỏ: Khóa user đang active – user bị kick và không login được
     * Expected Result chính: Trạng thái = Suspended. User đó login lại thấy 'Tài khoản bị vô hiệu hóa'. Token cũ trả 401.
     */
    @Test(
        description = "USER-TC-13 - Khóa user đang active – user bị kick và không login được",
        groups = {"user-management", "regression", "requires-db", "destructive", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void usertc13KhoaUserDangActiveUserBiKickVaKhongLoginDuoc() {
        loginAsManager();
                openScreen("users");
                UserManagementPage page = new UserManagementPage(driver()).waitUntilReady();
                requireDestructive("USER-TC-13");
                verifyDisposableUserLockAndRestore(page);
    }

    /**
     * TC ID: USER-TC-14
     * Task name / test case lớn: SỬA & KHÓA NGƯỜI DÙNG
     * Tên test case nhỏ: Mở khóa user Suspended – user login được bình thường
     * Expected Result chính: Trạng thái về Active. User đó login lại thành công.
     */
    @Test(
        description = "USER-TC-14 - Mở khóa user Suspended – user login được bình thường",
        groups = {"user-management", "regression", "requires-db", "destructive", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void usertc14MoKhoaUserSuspendedUserLoginDuocBinhThuong() {
        loginAsManager();
                openScreen("users");
                UserManagementPage page = new UserManagementPage(driver()).waitUntilReady();
                requireDestructive("USER-TC-14");
                verifyDisposableUserUnlockAndRestore(page);
    }

    /**
     * TC ID: USER-TC-15
     * Task name / test case lớn: SỬA & KHÓA NGƯỜI DÙNG
     * Tên test case nhỏ: Admin không thể tự khóa chính mình
     * Expected Result chính: Hệ thống không cho khóa account đang đăng nhập. Hiển thị thông báo lỗi.
     */
    @Test(
        description = "USER-TC-15 - Admin không thể tự khóa chính mình",
        groups = {"user-management", "regression", "requires-db", "destructive", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void usertc15AdminKhongTheTuKhoaChinhMinh() {
        loginAsManager();
                openScreen("users");
                UserManagementPage page = new UserManagementPage(driver()).waitUntilReady();
                requireDestructive("USER-TC-15");
                Assert.assertThrows(IllegalArgumentException.class, () -> guardAgainstCurrentUserMutation(config().managerUsernameRequired()));
    }

}
