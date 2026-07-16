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


public class FeedbackApprovalTest extends BaseUiTest {

    /**
     * TC ID: FEEDBACK-TC-26
     * Task name / test case lớn: DUYỆT / TỪ CHỐI PHẢN HỒI
     * Tên test case nhỏ: Admin click Duyệt – trạng thái đổi sang 'Đã duyệt'
     * Expected Result chính: API cập nhật thành công. Badge trạng thái đổi sang 'Đã duyệt'. Màu badge thay đổi.
     */
    @Test(
        description = "FEEDBACK-TC-26 - Admin click Duyệt – trạng thái đổi sang 'Đã duyệt'",
        groups = {"feedback-library", "regression", "requires-db", "skip-guard", "destructive", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void feedbacktc26AdminClickDuyetTrangThaiDoiSangDaDuyet() {
        throw new SkipException("NEEDS_REQUIREMENT_CONFIRMATION: Expected Result của Excel xung đột với contract/source active; cần Product Owner xác nhận trước khi tự động hóa như một tiêu chí pass/fail. Sai lệch: Frontend chỉ có manager/staff; Admin được map về manager.");
    }

    /**
     * TC ID: FEEDBACK-TC-27
     * Task name / test case lớn: DUYỆT / TỪ CHỐI PHẢN HỒI
     * Tên test case nhỏ: Admin click Từ chối – trạng thái đổi sang 'Từ chối'
     * Expected Result chính: API cập nhật. Badge đổi sang 'Từ chối'.
     */
    @Test(
        description = "FEEDBACK-TC-27 - Admin click Từ chối – trạng thái đổi sang 'Từ chối'",
        groups = {"feedback-library", "regression", "requires-db", "destructive", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void feedbacktc27AdminClickTuChoiTrangThaiDoiSangTuChoi() {
        loginAsManager();
                openScreen("chatbot_sheet");
                FeedbackLibraryPage page = new FeedbackLibraryPage(driver()).waitUntilReady();
                String id = requirePendingFeedbackId(page);
                page.reject(id);
                Assert.assertTrue(SourceBackedUiAssertions.pageContains(driver(), "Từ chối"));
    }

    /**
     * TC ID: FEEDBACK-TC-28
     * Task name / test case lớn: DUYỆT / TỪ CHỐI PHẢN HỒI
     * Tên test case nhỏ: Staff không được Duyệt – nút ẩn hoặc disabled
     * Expected Result chính: Nút Duyệt/Từ chối bị ẩn hoặc disabled với role Staff.
     */
    @Test(
        description = "FEEDBACK-TC-28 - Staff không được Duyệt – nút ẩn hoặc disabled",
        groups = {"feedback-library", "regression", "requires-db", "requires-staff"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void feedbacktc28StaffKhongDuocDuyetNutAnHoacDisabled() {
        loginAsStaff();
                openScreen("chatbot_sheet");
                FeedbackLibraryPage page = new FeedbackLibraryPage(driver()).waitUntilReady();
                Assert.assertEquals(driver().findElements(By.cssSelector("button[aria-label^='Duyệt phản hồi']")).size(), 0);
    }

    /**
     * TC ID: FEEDBACK-TC-29
     * Task name / test case lớn: DUYỆT / TỪ CHỐI PHẢN HỒI
     * Tên test case nhỏ: Manager click Duyệt nếu có quyền
     * Expected Result chính: Nếu Manager có quyền duyệt: thành công. Nếu không: nút bị ẩn hoặc API trả 403.
     */
    @Test(
        description = "FEEDBACK-TC-29 - Manager click Duyệt nếu có quyền",
        groups = {"feedback-library", "regression", "requires-db", "destructive", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void feedbacktc29ManagerClickDuyetNeuCoQuyen() {
        loginAsManager();
                openScreen("chatbot_sheet");
                FeedbackLibraryPage page = new FeedbackLibraryPage(driver()).waitUntilReady();
                String id = requirePendingFeedbackId(page);
                page.approve(id);
                Assert.assertTrue(SourceBackedUiAssertions.pageContains(driver(), "Đã duyệt"));
    }

}
