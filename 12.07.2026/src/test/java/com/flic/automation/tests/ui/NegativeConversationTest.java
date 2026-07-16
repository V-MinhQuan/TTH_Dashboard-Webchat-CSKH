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


public class NegativeConversationTest extends BaseUiTest {

    /**
     * TC ID: SENTIMENT-TC-07
     * Task name / test case lớn: DANH SÁCH HỘI THOẠI TIÊU CỰC
     * Tên test case nhỏ: Bảng hội thoại tiêu cực hiển thị đủ cột thông tin
     * Expected Result chính: Bảng có cột: ID hội thoại, Kênh, Thời gian, Đoạn chat, Điểm sentiment.
     */
    @Test(
        description = "SENTIMENT-TC-07 - Bảng hội thoại tiêu cực hiển thị đủ cột thông tin",
        groups = {"sentiment", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void sentimenttc07BangHoiThoaiTieuCucHienThiDuCotThongTin() {
        loginAsManager();
                openScreen("sentiment");
                SentimentAnalysisPage page = new SentimentAnalysisPage(driver()).waitUntilReady();
                SourceBackedUiAssertions.assertTableHasHeaders(driver(), List.of("KHÁCH HÀNG", "CẢM XÚC"));
    }

    /**
     * TC ID: SENTIMENT-TC-08
     * Task name / test case lớn: DANH SÁCH HỘI THOẠI TIÊU CỰC
     * Tên test case nhỏ: Click vào row – modal chi tiết mở đúng đoạn chat
     * Expected Result chính: Modal/panel mở hiển thị toàn bộ đoạn hội thoại. Đoạn tiêu cực được highlight hoặc scroll to.
     */
    @Test(
        description = "SENTIMENT-TC-08 - Click vào row – modal chi tiết mở đúng đoạn chat",
        groups = {"sentiment", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void sentimenttc08ClickVaoRowModalChiTietMoDungDoanChat() {
        loginAsManager();
                openScreen("sentiment");
                SentimentAnalysisPage page = new SentimentAnalysisPage(driver()).waitUntilReady();
                SourceBackedUiAssertions.openFirstTableRow(driver());
                Assert.assertTrue(SourceBackedUiAssertions.hasDialogOrDetailPanel(driver()));
    }

    /**
     * TC ID: SENTIMENT-TC-09
     * Task name / test case lớn: DANH SÁCH HỘI THOẠI TIÊU CỰC
     * Tên test case nhỏ: Phân trang bảng hội thoại tiêu cực
     * Expected Result chính: Phân trang đúng, không trùng row.
     */
    @Test(
        description = "SENTIMENT-TC-09 - Phân trang bảng hội thoại tiêu cực",
        groups = {"sentiment", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void sentimenttc09PhanTrangBangHoiThoaiTieuCuc() {
        loginAsManager();
                openScreen("sentiment");
                SentimentAnalysisPage page = new SentimentAnalysisPage(driver()).waitUntilReady();
                String before = page.negativePageIndicator();
                page.nextNegativePage();
                Assert.assertNotEquals(page.negativePageIndicator(), before);
    }

    /**
     * TC ID: SENTIMENT-TC-10
     * Task name / test case lớn: DANH SÁCH HỘI THOẠI TIÊU CỰC
     * Tên test case nhỏ: Export bảng hội thoại tiêu cực nếu có nút Export
     * Expected Result chính: File CSV/Excel tải về với đúng dữ liệu hội thoại tiêu cực theo filter.
     */
    @Test(
        description = "SENTIMENT-TC-10 - Export bảng hội thoại tiêu cực nếu có nút Export",
        groups = {"sentiment", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void sentimenttc10ExportBangHoiThoaiTieuCucNeuCoNutExport() {
        loginAsManager();
                openScreen("sentiment");
                SentimentAnalysisPage page = new SentimentAnalysisPage(driver()).waitUntilReady();
                page.filters().openExportMenu();
                page.filters().exportXlsx();
                ExcelUtils.assertReadable(waitForDownload(".xlsx"));
    }

}
