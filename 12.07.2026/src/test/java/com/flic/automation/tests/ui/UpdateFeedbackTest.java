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


public class UpdateFeedbackTest extends BaseUiTest {

    /**
     * TC ID: FEEDBACK-TC-17
     * Task name / test case lớn: SỬA PHẢN HỒI
     * Tên test case nhỏ: Click Sửa – form mở với dữ liệu cũ đã bind
     * Expected Result chính: Modal form mở, Câu hỏi và Câu trả lời điền sẵn đúng nội dung record đó.
     */
    @Test(
        description = "FEEDBACK-TC-17 - Click Sửa – form mở với dữ liệu cũ đã bind",
        groups = {"feedback-library", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void feedbacktc17ClickSuaFormMoVoiDuLieuCuDaBind() {
        loginAsManager();
                openScreen("chatbot_sheet");
                FeedbackLibraryPage page = new FeedbackLibraryPage(driver()).waitUntilReady();
                String id = requireEditableFeedbackId(page);
                page.openEditDialog(id);
                Assert.assertFalse(page.form().question().isBlank());
    }

    /**
     * TC ID: FEEDBACK-TC-18
     * Task name / test case lớn: SỬA PHẢN HỒI
     * Tên test case nhỏ: Sửa Câu trả lời và lưu – API PUT cập nhật thành công
     * Expected Result chính: API PUT thành công. Modal đóng. Row trong bảng hiển thị nội dung mới.
     */
    @Test(
        description = "FEEDBACK-TC-18 - Sửa Câu trả lời và lưu – API PUT cập nhật thành công",
        groups = {"feedback-library", "regression", "requires-db", "destructive", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void feedbacktc18SuaCauTraLoiVaLuuAPIPUTCapNhatThanhCong() {
        loginAsManager();
                openScreen("chatbot_sheet");
                FeedbackLibraryPage page = new FeedbackLibraryPage(driver()).waitUntilReady();
                requireDestructive("FEEDBACK-TC-18");
                verifyFeedbackUpdateWithCleanup(page, testDataName("FEEDBACK-TC-18"));
    }

    /**
     * TC ID: FEEDBACK-TC-19
     * Task name / test case lớn: SỬA PHẢN HỒI
     * Tên test case nhỏ: Sửa xóa trắng Câu hỏi – validation báo bắt buộc
     * Expected Result chính: Form báo lỗi 'Câu hỏi là bắt buộc'. Không gọi API.
     */
    @Test(
        description = "FEEDBACK-TC-19 - Sửa xóa trắng Câu hỏi – validation báo bắt buộc",
        groups = {"feedback-library", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void feedbacktc19SuaXoaTrangCauHoiValidationBaoBatBuoc() {
        loginAsManager();
                openScreen("chatbot_sheet");
                FeedbackLibraryPage page = new FeedbackLibraryPage(driver()).waitUntilReady();
                String id = requireEditableFeedbackId(page);
                page.openEditDialog(id);
                page.form().setQuestion("");
                page.form().save();
                Assert.assertFalse(page.form().errorMessage().isBlank());
    }

    /**
     * TC ID: FEEDBACK-TC-20
     * Task name / test case lớn: SỬA PHẢN HỒI
     * Tên test case nhỏ: Click Hủy trong modal Sửa – dữ liệu gốc không đổi
     * Expected Result chính: Modal đóng. Record trong bảng giữ nguyên nội dung gốc.
     */
    @Test(
        description = "FEEDBACK-TC-20 - Click Hủy trong modal Sửa – dữ liệu gốc không đổi",
        groups = {"feedback-library", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void feedbacktc20ClickHuyTrongModalSuaDuLieuGocKhongDoi() {
        loginAsManager();
                openScreen("chatbot_sheet");
                FeedbackLibraryPage page = new FeedbackLibraryPage(driver()).waitUntilReady();
                String id = requireEditableFeedbackId(page);
                String original = feedbackRowFingerprint(page, id);
                page.openEditDialog(id);
                page.form().setAnswer("AUTO_CANCELLED_CHANGE");
                page.form().cancel();
                Assert.assertEquals(feedbackRowFingerprint(page, id), original);
    }

}
