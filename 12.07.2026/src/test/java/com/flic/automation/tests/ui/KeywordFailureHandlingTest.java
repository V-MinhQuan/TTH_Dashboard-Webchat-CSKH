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


public class KeywordFailureHandlingTest extends BaseUiTest {

    /**
     * TC ID: KEYWORD-TC-12
     * Task name / test case lớn: LỖI API & TIMEOUT
     * Tên test case nhỏ: Keyword Analysis timeout – hiển thị lỗi và không treo trang
     * Expected Result chính: Sau timeout, hiển thị 'Truy vấn mất quá nhiều thời gian'. UI không frozen. Có thể thử lại.
     */
    @Test(
        description = "KEYWORD-TC-12 - Keyword Analysis timeout – hiển thị lỗi và không treo trang",
        groups = {"keyword", "regression", "requires-db", "environment-dependent", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void keywordtc12KeywordAnalysisTimeoutHienThiLoiVaKhongTreoTrang() {
        throw new SkipException("BLOCKED_ENVIRONMENT: Cần môi trường cô lập hoặc fault injection lặp lại được; không được dừng service/DB dùng chung hay sửa production để tạo lỗi.");
    }

    /**
     * TC ID: KEYWORD-TC-13
     * Task name / test case lớn: LỖI API & TIMEOUT
     * Tên test case nhỏ: Keyword API 500 – toast lỗi và layout giữ nguyên
     * Expected Result chính: Toast lỗi hiển thị. Word cloud và bảng hiển thị trạng thái lỗi. Không crash trang.
     */
    @Test(
        description = "KEYWORD-TC-13 - Keyword API 500 – toast lỗi và layout giữ nguyên",
        groups = {"keyword", "regression", "requires-db", "environment-dependent", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void keywordtc13KeywordAPI500ToastLoiVaLayoutGiuNguyen() {
        throw new SkipException("BLOCKED_ENVIRONMENT: Cần môi trường cô lập hoặc fault injection lặp lại được; không được dừng service/DB dùng chung hay sửa production để tạo lỗi.");
    }

    /**
     * TC ID: KEYWORD-TC-14
     * Task name / test case lớn: LỖI API & TIMEOUT
     * Tên test case nhỏ: Keyword Analysis với filter Tất cả kênh không bị lỗi query
     * Expected Result chính: API xử lý thành công khi không có filter kênh cụ thể. Không có lỗi SQL/query.
     */
    @Test(
        description = "KEYWORD-TC-14 - Keyword Analysis với filter Tất cả kênh không bị lỗi query",
        groups = {"keyword", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void keywordtc14KeywordAnalysisVoiFilterTatCaKenhKhongBiLoiQuery() {
        loginAsManager();
                openScreen("keyword");
                KeywordAnalysisPage page = new KeywordAnalysisPage(driver()).waitUntilReady();
                page.filters().selectChannel("Tất cả");
                page.filters().apply();
                Assert.assertFalse(page.hasLoadError());
                Assert.assertFalse(page.displayedTopicGroups().isEmpty());
    }

}
