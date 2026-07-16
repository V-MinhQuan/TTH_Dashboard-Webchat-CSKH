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


public class CreateFeedbackTest extends BaseUiTest {

    /**
     * TC ID: FEEDBACK-TC-11
     * Task name / test case lớn: THÊM MỚI PHẢN HỒI
     * Tên test case nhỏ: Click Thêm mới – modal form mở với các trường rỗng
     * Expected Result chính: Modal form mở với ô Câu hỏi, Câu trả lời, Kênh, Chủ đề. Tất cả trống ban đầu.
     */
    @Test(
        description = "FEEDBACK-TC-11 - Click Thêm mới – modal form mở với các trường rỗng",
        groups = {"feedback-library", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void feedbacktc11ClickThemMoiModalFormMoVoiCacTruongRong() {
        loginAsManager();
                openScreen("chatbot_sheet");
                FeedbackLibraryPage page = new FeedbackLibraryPage(driver()).waitUntilReady();
                page.openCreateDialog();
                FeedbackFormDialogComponent form = page.form();
                Assert.assertTrue(form.isOpen());
                Assert.assertTrue(form.question().isBlank() && form.answer().isBlank());
    }

    /**
     * TC ID: FEEDBACK-TC-12
     * Task name / test case lớn: THÊM MỚI PHẢN HỒI
     * Tên test case nhỏ: Submit form Thêm với đầy đủ thông tin – tạo record thành công
     * Expected Result chính: API POST thành công. Modal đóng. Record mới xuất hiện đầu bảng với trạng thái 'Chờ duyệt'.
     */
    @Test(
        description = "FEEDBACK-TC-12 - Submit form Thêm với đầy đủ thông tin – tạo record thành công",
        groups = {"feedback-library", "regression", "requires-db", "destructive", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void feedbacktc12SubmitFormThemVoiDayDuThongTinTaoRecordThanhCong() {
        loginAsManager();
                openScreen("chatbot_sheet");
                FeedbackLibraryPage page = new FeedbackLibraryPage(driver()).waitUntilReady();
                requireDestructive("FEEDBACK-TC-12");
                String marker = testDataName("FEEDBACK-TC-12");
                createFeedback(page, marker);
                Assert.assertTrue(SourceBackedUiAssertions.pageContains(driver(), marker));
                cleanupFeedback(page, marker);
    }

    /**
     * TC ID: FEEDBACK-TC-13
     * Task name / test case lớn: THÊM MỚI PHẢN HỒI
     * Tên test case nhỏ: Submit form Thêm với Câu hỏi bị bỏ trống – validation
     * Expected Result chính: Form báo lỗi 'Câu hỏi là bắt buộc'. Không gọi API.
     */
    @Test(
        description = "FEEDBACK-TC-13 - Submit form Thêm với Câu hỏi bị bỏ trống – validation",
        groups = {"feedback-library", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void feedbacktc13SubmitFormThemVoiCauHoiBiBoTrongValidation() {
        loginAsManager();
                openScreen("chatbot_sheet");
                FeedbackLibraryPage page = new FeedbackLibraryPage(driver()).waitUntilReady();
                page.openCreateDialog();
                fillFeedbackExceptQuestion(page.form());
                page.form().save();
                Assert.assertFalse(page.form().errorMessage().isBlank());
    }

    /**
     * TC ID: FEEDBACK-TC-14
     * Task name / test case lớn: THÊM MỚI PHẢN HỒI
     * Tên test case nhỏ: Submit form Thêm với Câu trả lời bị bỏ trống – validation
     * Expected Result chính: Form báo lỗi 'Câu trả lời là bắt buộc'. Không gọi API.
     */
    @Test(
        description = "FEEDBACK-TC-14 - Submit form Thêm với Câu trả lời bị bỏ trống – validation",
        groups = {"feedback-library", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void feedbacktc14SubmitFormThemVoiCauTraLoiBiBoTrongValidation() {
        loginAsManager();
                openScreen("chatbot_sheet");
                FeedbackLibraryPage page = new FeedbackLibraryPage(driver()).waitUntilReady();
                page.openCreateDialog();
                fillFeedbackExceptAnswer(page.form());
                page.form().save();
                Assert.assertFalse(page.form().errorMessage().isBlank());
    }

    /**
     * TC ID: FEEDBACK-TC-15
     * Task name / test case lớn: THÊM MỚI PHẢN HỒI
     * Tên test case nhỏ: Click Hủy trong modal Thêm – không tạo record
     * Expected Result chính: Modal đóng. Không gọi API. Bảng không thay đổi.
     */
    @Test(
        description = "FEEDBACK-TC-15 - Click Hủy trong modal Thêm – không tạo record",
        groups = {"feedback-library", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void feedbacktc15ClickHuyTrongModalThemKhongTaoRecord() {
        loginAsManager();
                openScreen("chatbot_sheet");
                FeedbackLibraryPage page = new FeedbackLibraryPage(driver()).waitUntilReady();
                int before = page.rows().size();
                page.openCreateDialog();
                page.form().cancel();
                Assert.assertEquals(page.rows().size(), before);
    }

    /**
     * TC ID: FEEDBACK-TC-16
     * Task name / test case lớn: THÊM MỚI PHẢN HỒI
     * Tên test case nhỏ: Submit khi API lỗi 500 – toast lỗi và modal không đóng
     * Expected Result chính: Toast lỗi 'Tạo phản hồi thất bại'. Modal giữ nguyên với dữ liệu người dùng đã nhập.
     */
    @Test(
        description = "FEEDBACK-TC-16 - Submit khi API lỗi 500 – toast lỗi và modal không đóng",
        groups = {"feedback-library", "regression", "requires-db", "environment-dependent", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void feedbacktc16SubmitKhiAPILoi500ToastLoiVaModalKhongDong() {
        throw new SkipException("BLOCKED_ENVIRONMENT: Cần môi trường cô lập hoặc fault injection lặp lại được; không được dừng service/DB dùng chung hay sửa production để tạo lỗi.");
    }

}
