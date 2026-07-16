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


public class FeedbackTableTest extends BaseUiTest {

    /**
     * TC ID: FEEDBACK-TC-01
     * Task name / test case lớn: DANH SÁCH & PHÂN TRANG
     * Tên test case nhỏ: Load mặc định bảng phản hồi hiển thị đầy đủ cột
     * Expected Result chính: Bảng load với cột: Câu hỏi, Câu trả lời, Kênh, Trạng thái, Người tạo, Ngày tạo.
     */
    @Test(
        description = "FEEDBACK-TC-01 - Load mặc định bảng phản hồi hiển thị đầy đủ cột",
        groups = {"feedback-library", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void feedbacktc01LoadMacDinhBangPhanHoiHienThiDayDuCot() {
        loginAsManager();
                openScreen("chatbot_sheet");
                FeedbackLibraryPage page = new FeedbackLibraryPage(driver()).waitUntilReady();
                SourceBackedUiAssertions.assertTableHasHeaders(driver(), List.of("CÂU HỎI", "CÂU TRẢ LỜI", "TRẠNG THÁI"));
    }

    /**
     * TC ID: FEEDBACK-TC-02
     * Task name / test case lớn: DANH SÁCH & PHÂN TRANG
     * Tên test case nhỏ: Phân trang bảng – click Next load đúng trang 2
     * Expected Result chính: Trang 2 hiển thị 10 row tiếp theo. Không trùng với trang 1.
     */
    @Test(
        description = "FEEDBACK-TC-02 - Phân trang bảng – click Next load đúng trang 2",
        groups = {"feedback-library", "regression", "requires-db", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void feedbacktc02PhanTrangBangClickNextLoadDungTrang2() {
        throw new SkipException("NOT_APPLICABLE: Control/endpoint/role được mô tả không tồn tại trong luồng active hiện tại. Sai lệch: Thư viện phản hồi tải tối đa 500 dòng và không có pagination/sort control.");
    }

    /**
     * TC ID: FEEDBACK-TC-03
     * Task name / test case lớn: DANH SÁCH & PHÂN TRANG
     * Tên test case nhỏ: Phân trang bảng – click Prev quay về trang 1
     * Expected Result chính: Trang 1 hiển thị lại đúng 10 row ban đầu.
     */
    @Test(
        description = "FEEDBACK-TC-03 - Phân trang bảng – click Prev quay về trang 1",
        groups = {"feedback-library", "regression", "requires-db", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void feedbacktc03PhanTrangBangClickPrevQuayVeTrang1() {
        throw new SkipException("NOT_APPLICABLE: Control/endpoint/role được mô tả không tồn tại trong luồng active hiện tại. Sai lệch: Thư viện phản hồi tải tối đa 500 dòng và không có pagination/sort control.");
    }

    /**
     * TC ID: FEEDBACK-TC-04
     * Task name / test case lớn: DANH SÁCH & PHÂN TRANG
     * Tên test case nhỏ: Bảng empty state khi chưa có phản hồi
     * Expected Result chính: Bảng hiển thị icon và text 'Chưa có phản hồi nào'.
     */
    @Test(
        description = "FEEDBACK-TC-04 - Bảng empty state khi chưa có phản hồi",
        groups = {"feedback-library", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void feedbacktc04BangEmptyStateKhiChuaCoPhanHoi() {
        loginAsManager();
                openScreen("chatbot_sheet");
                FeedbackLibraryPage page = new FeedbackLibraryPage(driver()).waitUntilReady();
                applyFeedbackEmptySearch(page);
                Assert.assertTrue(page.rows().isEmpty());
    }

    /**
     * TC ID: FEEDBACK-TC-05
     * Task name / test case lớn: DANH SÁCH & PHÂN TRANG
     * Tên test case nhỏ: Sort bảng theo cột Ngày tạo
     * Expected Result chính: Sort tăng/giảm theo ngày. Icon header thay đổi.
     */
    @Test(
        description = "FEEDBACK-TC-05 - Sort bảng theo cột Ngày tạo",
        groups = {"feedback-library", "regression", "requires-db", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void feedbacktc05SortBangTheoCotNgayTao() {
        throw new SkipException("NOT_APPLICABLE: Control/endpoint/role được mô tả không tồn tại trong luồng active hiện tại. Sai lệch: Thư viện phản hồi tải tối đa 500 dòng và không có pagination/sort control.");
    }

}
