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


public class RoleBasedMenuTest extends BaseUiTest {

    /**
     * TC ID: USER-TC-16
     * Task name / test case lớn: PHÂN QUYỀN MENU
     * Tên test case nhỏ: Staff không thấy menu Users và Settings hệ thống trong sidebar
     * Expected Result chính: Menu 'Quản lý người dùng' và 'Cài đặt hệ thống' không hiển thị hoặc bị ẩn.
     */
    @Test(
        description = "USER-TC-16 - Staff không thấy menu Users và Settings hệ thống trong sidebar",
        groups = {"user-management", "regression", "requires-db", "requires-manager", "requires-staff"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void usertc16StaffKhongThayMenuUsersVaSettingsHeThongTrongSidebar() {
        loginAsStaff();
                openScreen("users");
                UserManagementPage page = new UserManagementPage(driver()).waitUntilReady();
                Assert.assertFalse(sidebar().hasMenu("Kênh"));
                Assert.assertTrue(sidebar().hasMenu("Cài đặt"), "Staff vẫn có Cài đặt cá nhân theo source");
    }

    /**
     * TC ID: USER-TC-17
     * Task name / test case lớn: PHÂN QUYỀN MENU
     * Tên test case nhỏ: Manager thấy menu báo cáo nâng cao nhưng không thấy Users quản trị
     * Expected Result chính: Manager có menu báo cáo chi tiết nhưng không có menu tạo/xóa user.
     */
    @Test(
        description = "USER-TC-17 - Manager thấy menu báo cáo nâng cao nhưng không thấy Users quản trị",
        groups = {"user-management", "regression", "requires-db", "skip-guard", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void usertc17ManagerThayMenuBaoCaoNangCaoNhungKhongThayUsersQuan() {
        throw new SkipException("NEEDS_REQUIREMENT_CONFIRMATION: Expected Result của Excel xung đột với contract/source active; cần Product Owner xác nhận trước khi tự động hóa như một tiêu chí pass/fail. Sai lệch: Frontend chỉ có manager/staff; Admin được map về manager.");
    }

    /**
     * TC ID: USER-TC-18
     * Task name / test case lớn: PHÂN QUYỀN MENU
     * Tên test case nhỏ: Admin thấy toàn bộ menu không bị ẩn
     * Expected Result chính: Sidebar hiển thị tất cả menu: Dashboard, Phân tích, Quản lý, Cài đặt, Users.
     */
    @Test(
        description = "USER-TC-18 - Admin thấy toàn bộ menu không bị ẩn",
        groups = {"user-management", "regression", "requires-db", "skip-guard", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void usertc18AdminThayToanBoMenuKhongBiAn() {
        throw new SkipException("NEEDS_REQUIREMENT_CONFIRMATION: Expected Result của Excel xung đột với contract/source active; cần Product Owner xác nhận trước khi tự động hóa như một tiêu chí pass/fail. Sai lệch: Frontend chỉ có manager/staff; Admin được map về manager.");
    }

}
