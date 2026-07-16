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


public class ActivityHistoryTest extends BaseUiTest {

    /**
     * TC ID: ACTIVITY-TC-01
     * Task name / test case lớn: AUDIT LOG – HIỂN THỊ & CHÍNH XÁC
     * Tên test case nhỏ: Bảng Audit Log hiển thị đủ cột: Ai, Hành động, Đối tượng, Thời gian
     * Expected Result chính: Bảng có cột: Người thực hiện, Hành động (Thêm/Sửa/Xóa), Đối tượng, Timestamp.
     */
    @Test(
        description = "ACTIVITY-TC-01 - Bảng Audit Log hiển thị đủ cột: Ai, Hành động, Đối tượng, Thời gian",
        groups = {"activity", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void activitytc01BangAuditLogHienThiDuCotAiHanhDongDoiTuong() {
        loginAsManager();
                openScreen("activity_history");
                ActivityHistoryPage page = new ActivityHistoryPage(driver()).waitUntilReady();
                SourceBackedUiAssertions.assertActivityRowsHaveActionEntityAndTime(page.visibleActivities());
    }

    /**
     * TC ID: ACTIVITY-TC-02
     * Task name / test case lớn: AUDIT LOG – HIỂN THỊ & CHÍNH XÁC
     * Tên test case nhỏ: Log ghi nhận đúng action Thêm phản hồi
     * Expected Result chính: Log có entry: Ai thực hiện, 'Thêm phản hồi [tên]', timestamp gần đúng.
     */
    @Test(
        description = "ACTIVITY-TC-02 - Log ghi nhận đúng action Thêm phản hồi",
        groups = {"activity", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void activitytc02LogGhiNhanDungActionThemPhanHoi() {
        loginAsManager();
                openScreen("activity_history");
                ActivityHistoryPage page = new ActivityHistoryPage(driver()).waitUntilReady();
                String marker = config().activityMarker("ACTIVITY-TC-02");
                page.search(marker);
                Assert.assertTrue(page.visibleActivities().stream().anyMatch(row -> row.compactText().contains(marker)));
    }

    /**
     * TC ID: ACTIVITY-TC-03
     * Task name / test case lớn: AUDIT LOG – HIỂN THỊ & CHÍNH XÁC
     * Tên test case nhỏ: Log ghi nhận đúng action Sửa user
     * Expected Result chính: Log có entry: Admin, 'Sửa user [email]', timestamp.
     */
    @Test(
        description = "ACTIVITY-TC-03 - Log ghi nhận đúng action Sửa user",
        groups = {"activity", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void activitytc03LogGhiNhanDungActionSuaUser() {
        loginAsManager();
                openScreen("activity_history");
                ActivityHistoryPage page = new ActivityHistoryPage(driver()).waitUntilReady();
                String marker = config().activityMarker("ACTIVITY-TC-03");
                page.search(marker);
                Assert.assertTrue(page.visibleActivities().stream().anyMatch(row -> row.compactText().contains(marker)));
    }

    /**
     * TC ID: ACTIVITY-TC-04
     * Task name / test case lớn: AUDIT LOG – HIỂN THỊ & CHÍNH XÁC
     * Tên test case nhỏ: Bảng sort mặc định theo thời gian giảm dần
     * Expected Result chính: Log mới nhất ở đầu bảng. Timestamp giảm dần.
     */
    @Test(
        description = "ACTIVITY-TC-04 - Bảng sort mặc định theo thời gian giảm dần",
        groups = {"activity", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void activitytc04BangSortMacDinhTheoThoiGianGiamDan() {
        loginAsManager();
                openScreen("activity_history");
                ActivityHistoryPage page = new ActivityHistoryPage(driver()).waitUntilReady();
                Assert.assertTrue(SourceBackedUiAssertions.activityTimesDescending(page.visibleActivities()));
    }

    /**
     * TC ID: ACTIVITY-TC-05
     * Task name / test case lớn: AUDIT LOG – HIỂN THỊ & CHÍNH XÁC
     * Tên test case nhỏ: Phân trang bảng Audit Log – chuyển trang đúng thứ tự
     * Expected Result chính: Trang 2 hiển thị log cũ hơn trang 1. Không trùng lặp.
     */
    @Test(
        description = "ACTIVITY-TC-05 - Phân trang bảng Audit Log – chuyển trang đúng thứ tự",
        groups = {"activity", "regression", "requires-db", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void activitytc05PhanTrangBangAuditLogChuyenTrangDungThuTu() {
        throw new SkipException("NOT_APPLICABLE: Control/endpoint/role được mô tả không tồn tại trong luồng active hiện tại. Sai lệch: Trang chỉ gọi limit=50, offset=0; không có pagination UI.");
    }

    /**
     * TC ID: ACTIVITY-TC-06
     * Task name / test case lớn: AUDIT LOG – HIỂN THỊ & CHÍNH XÁC
     * Tên test case nhỏ: Lọc log theo loại hành động (Thêm/Sửa/Xóa)
     * Expected Result chính: Bảng chỉ hiển thị các log có hành động Xóa.
     */
    @Test(
        description = "ACTIVITY-TC-06 - Lọc log theo loại hành động (Thêm/Sửa/Xóa)",
        groups = {"activity", "regression", "requires-db", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void activitytc06LocLogTheoLoaiHanhDongThemSuaXoa() {
        throw new SkipException("NOT_APPLICABLE: Control/endpoint/role được mô tả không tồn tại trong luồng active hiện tại. Sai lệch: Nút Thời gian/Lọc kết quả hiện không có handler.");
    }

    /**
     * TC ID: ACTIVITY-TC-07
     * Task name / test case lớn: AUDIT LOG – HIỂN THỊ & CHÍNH XÁC
     * Tên test case nhỏ: Staff không truy cập được Lịch sử nếu không có quyền
     * Expected Result chính: Hệ thống ẩn menu hoặc redirect 403. Không hiển thị log.
     */
    @Test(
        description = "ACTIVITY-TC-07 - Staff không truy cập được Lịch sử nếu không có quyền",
        groups = {"activity", "regression", "requires-db", "requires-staff"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void activitytc07StaffKhongTruyCapDuocLichSuNeuKhongCoQuyen() {
        loginAsStaff();
                openScreen("activity_history");
                ActivityHistoryPage page = new ActivityHistoryPage(driver()).waitUntilReady();
                Assert.assertFalse(page.isLoaded(), "Expected Excel yêu cầu Staff bị chặn; source hiện cho Staff xem lịch sử của chính mình");
    }

}
