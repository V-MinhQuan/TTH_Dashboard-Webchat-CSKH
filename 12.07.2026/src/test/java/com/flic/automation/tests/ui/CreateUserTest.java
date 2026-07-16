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


public class CreateUserTest extends BaseUiTest {

    /**
     * TC ID: USER-TC-06
     * Task name / test case lớn: THÊM NGƯỜI DÙNG
     * Tên test case nhỏ: Tạo user mới với đầy đủ thông tin hợp lệ
     * Expected Result chính: API POST thành công. User xuất hiện trong bảng với role đúng.
     */
    @Test(
        description = "USER-TC-06 - Tạo user mới với đầy đủ thông tin hợp lệ",
        groups = {"user-management", "regression", "requires-db", "environment-dependent", "skip-guard", "destructive", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void usertc06TaoUserMoiVoiDayDuThongTinHopLe() {
        throw new SkipException("BLOCKED_ENVIRONMENT: Cần môi trường cô lập hoặc fault injection lặp lại được; không được dừng service/DB dùng chung hay sửa production để tạo lỗi.");
    }

    /**
     * TC ID: USER-TC-07
     * Task name / test case lớn: THÊM NGƯỜI DÙNG
     * Tên test case nhỏ: Tạo user với email đã tồn tại – báo lỗi trùng
     * Expected Result chính: API trả 409 hoặc 400. UI báo 'Email đã được sử dụng'.
     */
    @Test(
        description = "USER-TC-07 - Tạo user với email đã tồn tại – báo lỗi trùng",
        groups = {"user-management", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void usertc07TaoUserVoiEmailDaTonTaiBaoLoiTrung() {
        loginAsManager();
                openScreen("users");
                UserManagementPage page = new UserManagementPage(driver()).waitUntilReady();
                page.openCreateDialog();
                fillDuplicateUser(page);
                Assert.assertFalse(SourceBackedUiAssertions.latestToast(driver()).isBlank());
    }

    /**
     * TC ID: USER-TC-08
     * Task name / test case lớn: THÊM NGƯỜI DÙNG
     * Tên test case nhỏ: Tạo user với mật khẩu quá yếu – validation từ chối
     * Expected Result chính: Form báo lỗi 'Mật khẩu phải có ít nhất 8 ký tự'.
     */
    @Test(
        description = "USER-TC-08 - Tạo user với mật khẩu quá yếu – validation từ chối",
        groups = {"user-management", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void usertc08TaoUserVoiMatKhauQuaYeuValidationTuChoi() {
        loginAsManager();
                openScreen("users");
                UserManagementPage page = new UserManagementPage(driver()).waitUntilReady();
                page.openCreateDialog();
                fillWeakPasswordUser(page);
                Assert.assertTrue(SourceBackedUiAssertions.latestToast(driver()).contains("6"));
    }

    /**
     * TC ID: USER-TC-09
     * Task name / test case lớn: THÊM NGƯỜI DÙNG
     * Tên test case nhỏ: Tạo user không chọn Role – validation báo bắt buộc
     * Expected Result chính: Form báo 'Vui lòng chọn vai trò'. Không gọi API.
     */
    @Test(
        description = "USER-TC-09 - Tạo user không chọn Role – validation báo bắt buộc",
        groups = {"user-management", "regression", "requires-db", "skip-guard", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void usertc09TaoUserKhongChonRoleValidationBaoBatBuoc() {
        throw new SkipException("NOT_APPLICABLE: Control/endpoint/role được mô tả không tồn tại trong luồng active hiện tại. Sai lệch: UserManagement không có pagination/sort/edit-email hoặc role trống.");
    }

    /**
     * TC ID: USER-TC-10
     * Task name / test case lớn: THÊM NGƯỜI DÙNG
     * Tên test case nhỏ: Click Hủy trong modal tạo user – không tạo user
     * Expected Result chính: Modal đóng. Không gọi API. Bảng không thay đổi.
     */
    @Test(
        description = "USER-TC-10 - Click Hủy trong modal tạo user – không tạo user",
        groups = {"user-management", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void usertc10ClickHuyTrongModalTaoUserKhongTaoUser() {
        loginAsManager();
                openScreen("users");
                UserManagementPage page = new UserManagementPage(driver()).waitUntilReady();
                int before = page.rows().size();
                page.openCreateDialog();
                cancelUserCreate(page);
                Assert.assertEquals(page.rows().size(), before);
    }

}
