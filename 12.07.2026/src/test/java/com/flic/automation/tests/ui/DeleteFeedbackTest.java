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


public class DeleteFeedbackTest extends BaseUiTest {

    /**
     * TC ID: FEEDBACK-TC-21
     * Task name / test case lớn: XÓA PHẢN HỒI
     * Tên test case nhỏ: Click Xóa – modal xác nhận xuất hiện với text rõ ràng
     * Expected Result chính: Modal hiển thị 'Bạn có chắc muốn xóa phản hồi này?' với nút Hủy và Xác nhận.
     */
    @Test(
        description = "FEEDBACK-TC-21 - Click Xóa – modal xác nhận xuất hiện với text rõ ràng",
        groups = {"feedback-library", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void feedbacktc21ClickXoaModalXacNhanXuatHienVoiTextRoRang() {
        loginAsManager();
                openScreen("chatbot_sheet");
                FeedbackLibraryPage page = new FeedbackLibraryPage(driver()).waitUntilReady();
                requireDestructive("FEEDBACK-TC-21");
                String id = createRejectedAutomationFeedback(page, "FEEDBACK-TC-21");
                page.requestDelete(id);
                Assert.assertTrue(SourceBackedUiAssertions.hasConfirmationDialog(driver()));
                page.cancelDelete();
                cleanupFeedbackById(page, id);
    }

    /**
     * TC ID: FEEDBACK-TC-22
     * Task name / test case lớn: XÓA PHẢN HỒI
     * Tên test case nhỏ: Click Hủy trong modal xóa – record không bị xóa
     * Expected Result chính: Modal đóng. Record vẫn còn trong bảng. Không gọi API DELETE.
     */
    @Test(
        description = "FEEDBACK-TC-22 - Click Hủy trong modal xóa – record không bị xóa",
        groups = {"feedback-library", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void feedbacktc22ClickHuyTrongModalXoaRecordKhongBiXoa() {
        loginAsManager();
                openScreen("chatbot_sheet");
                FeedbackLibraryPage page = new FeedbackLibraryPage(driver()).waitUntilReady();
                requireDestructive("FEEDBACK-TC-22");
                String id = createRejectedAutomationFeedback(page, "FEEDBACK-TC-22");
                page.requestDelete(id);
                page.cancelDelete();
                Assert.assertTrue(feedbackIdVisible(page, id));
                cleanupFeedbackById(page, id);
    }

    /**
     * TC ID: FEEDBACK-TC-23
     * Task name / test case lớn: XÓA PHẢN HỒI
     * Tên test case nhỏ: Click Xác nhận xóa – record bị xóa khỏi bảng
     * Expected Result chính: API DELETE thành công. Record biến mất. Toast 'Đã xóa thành công'.
     */
    @Test(
        description = "FEEDBACK-TC-23 - Click Xác nhận xóa – record bị xóa khỏi bảng",
        groups = {"feedback-library", "regression", "requires-db", "destructive", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void feedbacktc23ClickXacNhanXoaRecordBiXoaKhoiBang() {
        loginAsManager();
                openScreen("chatbot_sheet");
                FeedbackLibraryPage page = new FeedbackLibraryPage(driver()).waitUntilReady();
                requireDestructive("FEEDBACK-TC-23");
                String id = createRejectedAutomationFeedback(page, "FEEDBACK-TC-23");
                page.requestDelete(id);
                page.confirmDelete();
                Assert.assertFalse(feedbackIdVisible(page, id));
    }

    /**
     * TC ID: FEEDBACK-TC-24
     * Task name / test case lớn: XÓA PHẢN HỒI
     * Tên test case nhỏ: Xóa thất bại do API lỗi – toast lỗi và record giữ nguyên
     * Expected Result chính: Toast 'Xóa thất bại, vui lòng thử lại'. Record vẫn còn trong bảng.
     */
    @Test(
        description = "FEEDBACK-TC-24 - Xóa thất bại do API lỗi – toast lỗi và record giữ nguyên",
        groups = {"feedback-library", "regression", "requires-db", "environment-dependent", "skip-guard", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void feedbacktc24XoaThatBaiDoAPILoiToastLoiVaRecordGiuNguyen() {
        throw new SkipException("BLOCKED_ENVIRONMENT: Cần môi trường cô lập hoặc fault injection lặp lại được; không được dừng service/DB dùng chung hay sửa production để tạo lỗi.");
    }

    /**
     * TC ID: FEEDBACK-TC-25
     * Task name / test case lớn: XÓA PHẢN HỒI
     * Tên test case nhỏ: Staff không thấy hoặc không dùng được nút Xóa
     * Expected Result chính: Nút Xóa bị ẩn hoặc disabled. Gọi API DELETE bị chặn trả 403.
     */
    @Test(
        description = "FEEDBACK-TC-25 - Staff không thấy hoặc không dùng được nút Xóa",
        groups = {"feedback-library", "regression", "requires-db", "requires-staff"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void feedbacktc25StaffKhongThayHoacKhongDungDuocNutXoa() {
        loginAsStaff();
                openScreen("chatbot_sheet");
                FeedbackLibraryPage page = new FeedbackLibraryPage(driver()).waitUntilReady();
                Assert.assertTrue(page.rows().stream().noneMatch(row -> row.findElements(By.cssSelector("button[aria-label^='Xóa phản hồi']")).size() > 0));
    }

}
