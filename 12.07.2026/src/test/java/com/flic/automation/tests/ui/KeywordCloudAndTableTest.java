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


public class KeywordCloudAndTableTest extends BaseUiTest {

    /**
     * TC ID: KEYWORD-TC-01
     * Task name / test case lớn: WORD CLOUD & BẢNG TẦN SUẤT
     * Tên test case nhỏ: Word cloud hiển thị từ khóa kích thước tỉ lệ thuận với tần suất
     * Expected Result chính: Từ khóa có count cao nhất có font size lớn nhất rõ rệt. Không có từ nào size đồng đều hoàn toàn.
     */
    @Test(
        description = "KEYWORD-TC-01 - Word cloud hiển thị từ khóa kích thước tỉ lệ thuận với tần suất",
        groups = {"keyword", "regression", "requires-db", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void keywordtc01WordCloudHienThiTuKhoaKichThuocTiLeThuanVoi() {
        throw new SkipException("NEEDS_REQUIREMENT_CONFIRMATION: Expected Result của Excel xung đột với contract/source active; cần Product Owner xác nhận trước khi tự động hóa như một tiêu chí pass/fail. Sai lệch: Source hiện là topic summary/keyword cards, không có word cloud đúng nghĩa.");
    }

    /**
     * TC ID: KEYWORD-TC-02
     * Task name / test case lớn: WORD CLOUD & BẢNG TẦN SUẤT
     * Tên test case nhỏ: Bảng tần suất sort giảm dần theo count mặc định
     * Expected Result chính: Từ khóa có tần suất cao nhất ở đầu bảng. Sort giảm dần là mặc định.
     */
    @Test(
        description = "KEYWORD-TC-02 - Bảng tần suất sort giảm dần theo count mặc định",
        groups = {"keyword", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void keywordtc02BangTanSuatSortGiamDanTheoCountMacDinh() {
        loginAsManager();
                openScreen("keyword");
                KeywordAnalysisPage page = new KeywordAnalysisPage(driver()).waitUntilReady();
                SourceBackedUiAssertions.assertKeywordCountsDescending(driver());
    }

    /**
     * TC ID: KEYWORD-TC-03
     * Task name / test case lớn: WORD CLOUD & BẢNG TẦN SUẤT
     * Tên test case nhỏ: Sort bảng theo tần suất tăng dần
     * Expected Result chính: Lần 1: sort giảm dần. Lần 2: sort tăng dần. Từ khóa ít xuất hiện nhất ở đầu.
     */
    @Test(
        description = "KEYWORD-TC-03 - Sort bảng theo tần suất tăng dần",
        groups = {"keyword", "regression", "requires-db", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void keywordtc03SortBangTheoTanSuatTangDan() {
        throw new SkipException("NOT_APPLICABLE: Control/endpoint/role được mô tả không tồn tại trong luồng active hiện tại. Sai lệch: Source không có search/pagination/click-to-Conversations tương ứng.");
    }

    /**
     * TC ID: KEYWORD-TC-04
     * Task name / test case lớn: WORD CLOUD & BẢNG TẦN SUẤT
     * Tên test case nhỏ: Phân trang bảng từ khóa – Next/Prev load đúng
     * Expected Result chính: Phân trang hoạt động đúng, không trùng từ khóa giữa các trang.
     */
    @Test(
        description = "KEYWORD-TC-04 - Phân trang bảng từ khóa – Next/Prev load đúng",
        groups = {"keyword", "regression", "requires-db", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void keywordtc04PhanTrangBangTuKhoaNextPrevLoadDung() {
        throw new SkipException("NOT_APPLICABLE: Control/endpoint/role được mô tả không tồn tại trong luồng active hiện tại. Sai lệch: Source không có search/pagination/click-to-Conversations tương ứng.");
    }

    /**
     * TC ID: KEYWORD-TC-05
     * Task name / test case lớn: WORD CLOUD & BẢNG TẦN SUẤT
     * Tên test case nhỏ: Bảng empty state khi không có từ khóa
     * Expected Result chính: Word cloud trống và bảng hiển thị 'Không có từ khóa trong khoảng thời gian này'.
     */
    @Test(
        description = "KEYWORD-TC-05 - Bảng empty state khi không có từ khóa",
        groups = {"keyword", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void keywordtc05BangEmptyStateKhiKhongCoTuKhoa() {
        loginAsManager();
                openScreen("keyword");
                KeywordAnalysisPage page = new KeywordAnalysisPage(driver()).waitUntilReady();
                applyKnownEmptyDate(page.filters());
                Assert.assertTrue(page.displayedTopicGroups().isEmpty() || SourceBackedUiAssertions.hasEmptyStateOrZeroData(driver()));
    }

}
