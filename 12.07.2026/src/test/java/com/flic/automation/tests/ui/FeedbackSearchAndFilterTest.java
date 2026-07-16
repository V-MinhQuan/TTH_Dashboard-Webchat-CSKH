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


public class FeedbackSearchAndFilterTest extends BaseUiTest {

    /**
     * TC ID: FEEDBACK-TC-06
     * Task name / test case lớn: TÌM KIẾM & LỌC
     * Tên test case nhỏ: Tìm kiếm theo tiêu đề câu hỏi – bảng filter kết quả
     * Expected Result chính: Bảng chỉ hiển thị row chứa từ khóa trong cột Câu hỏi hoặc Câu trả lời.
     */
    @Test(
        description = "FEEDBACK-TC-06 - Tìm kiếm theo tiêu đề câu hỏi – bảng filter kết quả",
        groups = {"feedback-library", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void feedbacktc06TimKiemTheoTieuDeCauHoiBangFilterKetQua() {
        loginAsManager();
                openScreen("chatbot_sheet");
                FeedbackLibraryPage page = new FeedbackLibraryPage(driver()).waitUntilReady();
                String query = requireFeedbackSearchSeed(page);
                page.search(query);
                Assert.assertTrue(SourceBackedUiAssertions.everyTableRowContains(driver(), query));
    }

    /**
     * TC ID: FEEDBACK-TC-07
     * Task name / test case lớn: TÌM KIẾM & LỌC
     * Tên test case nhỏ: Tìm kiếm không có kết quả – empty state
     * Expected Result chính: Bảng hiển thị 'Không tìm thấy kết quả'.
     */
    @Test(
        description = "FEEDBACK-TC-07 - Tìm kiếm không có kết quả – empty state",
        groups = {"feedback-library", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void feedbacktc07TimKiemKhongCoKetQuaEmptyState() {
        loginAsManager();
                openScreen("chatbot_sheet");
                FeedbackLibraryPage page = new FeedbackLibraryPage(driver()).waitUntilReady();
                page.search("AUTO_NO_RESULT_9f874be");
                Assert.assertTrue(page.rows().isEmpty());
    }

    /**
     * TC ID: FEEDBACK-TC-08
     * Task name / test case lớn: TÌM KIẾM & LỌC
     * Tên test case nhỏ: Lọc theo trạng thái 'Chờ duyệt'
     * Expected Result chính: Bảng chỉ hiển thị phản hồi có trạng thái 'Chờ duyệt'.
     */
    @Test(
        description = "FEEDBACK-TC-08 - Lọc theo trạng thái 'Chờ duyệt'",
        groups = {"feedback-library", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void feedbacktc08LocTheoTrangThaiChoDuyet() {
        loginAsManager();
                openScreen("chatbot_sheet");
                FeedbackLibraryPage page = new FeedbackLibraryPage(driver()).waitUntilReady();
                page.filterStatus("Chờ xử lý");
                Assert.assertTrue(SourceBackedUiAssertions.everyTableRowContains(driver(), "Chờ xử lý"));
    }

    /**
     * TC ID: FEEDBACK-TC-09
     * Task name / test case lớn: TÌM KIẾM & LỌC
     * Tên test case nhỏ: Lọc theo trạng thái 'Đã duyệt'
     * Expected Result chính: Bảng chỉ hiển thị phản hồi đã được duyệt.
     */
    @Test(
        description = "FEEDBACK-TC-09 - Lọc theo trạng thái 'Đã duyệt'",
        groups = {"feedback-library", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void feedbacktc09LocTheoTrangThaiDaDuyet() {
        loginAsManager();
                openScreen("chatbot_sheet");
                FeedbackLibraryPage page = new FeedbackLibraryPage(driver()).waitUntilReady();
                page.filterStatus("Đã duyệt");
                Assert.assertTrue(SourceBackedUiAssertions.everyTableRowContains(driver(), "Đã duyệt"));
    }

    /**
     * TC ID: FEEDBACK-TC-10
     * Task name / test case lớn: TÌM KIẾM & LỌC
     * Tên test case nhỏ: Lọc theo kênh – chỉ hiển thị phản hồi của kênh đó
     * Expected Result chính: Bảng chỉ hiển thị phản hồi thuộc kênh Zalo.
     */
    @Test(
        description = "FEEDBACK-TC-10 - Lọc theo kênh – chỉ hiển thị phản hồi của kênh đó",
        groups = {"feedback-library", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void feedbacktc10LocTheoKenhChiHienThiPhanHoiCuaKenhDo() {
        loginAsManager();
                openScreen("chatbot_sheet");
                FeedbackLibraryPage page = new FeedbackLibraryPage(driver()).waitUntilReady();
                String channel = firstAvailableFeedbackChannel(page);
                page.filterChannel(channel);
                Assert.assertTrue(SourceBackedUiAssertions.everyTableRowContains(driver(), channel));
    }

}
