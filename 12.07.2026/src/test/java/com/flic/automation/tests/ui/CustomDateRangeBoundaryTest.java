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


public class CustomDateRangeBoundaryTest extends BaseUiTest {

    /**
     * TC ID: FILTER-TC-18
     * Task name / test case lớn: NGÀY TÙY CHỈNH – EDGE CASES
     * Tên test case nhỏ: Khoảng ngày khác tháng (25/05 – 10/06) – dữ liệu đúng 2 tháng
     * Expected Result chính: API nhận đúng params cross-month. Biểu đồ hiển thị liên tục từ 25/5 đến 10/6, không bị đứt đoạn.
     */
    @Test(
        description = "FILTER-TC-18 - Khoảng ngày khác tháng (25/05 – 10/06) – dữ liệu đúng 2 tháng",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc18KhoangNgayKhacThang25051006DuLieuDung2() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                filter.selectDateRange("Tùy chỉnh");
                filter.setCustomDateRange(LocalDate.of(2025, 5, 25), LocalDate.of(2025, 6, 10));
                filter.apply();
                Assert.assertTrue(toastText().contains("Đã áp dụng"));
    }

    /**
     * TC ID: FILTER-TC-19
     * Task name / test case lớn: NGÀY TÙY CHỈNH – EDGE CASES
     * Tên test case nhỏ: Khoảng ngày khác năm (01/12/2024 – 31/01/2025) – không lỗi timezone
     * Expected Result chính: API nhận đúng params cross-year. Dashboard tính đúng 62 ngày, không bị lệch do timezone.
     */
    @Test(
        description = "FILTER-TC-19 - Khoảng ngày khác năm (01/12/2024 – 31/01/2025) – không lỗi timezone",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc19KhoangNgayKhacNam0112202431012025KhongLoi() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                filter.selectDateRange("Tùy chỉnh");
                filter.setCustomDateRange(LocalDate.of(2024, 12, 1), LocalDate.of(2025, 1, 31));
                filter.apply();
                Assert.assertTrue(toastText().contains("Đã áp dụng"));
    }

    /**
     * TC ID: FILTER-TC-20
     * Task name / test case lớn: NGÀY TÙY CHỈNH – EDGE CASES
     * Tên test case nhỏ: Chọn 29/02 năm nhuận 2024 là ngày hợp lệ
     * Expected Result chính: Datepicker cho phép chọn 29/02/2024. API gọi thành công với timestamp đúng.
     */
    @Test(
        description = "FILTER-TC-20 - Chọn 29/02 năm nhuận 2024 là ngày hợp lệ",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc20Chon2902NamNhuan2024LaNgayHopLe() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                filter.selectDateRange("Tùy chỉnh");
                filter.setCustomDateRange(LocalDate.of(2024, 2, 29), LocalDate.of(2024, 3, 1));
                filter.apply();
                Assert.assertTrue(toastText().contains("Đã áp dụng"));
    }

    /**
     * TC ID: FILTER-TC-21
     * Task name / test case lớn: NGÀY TÙY CHỈNH – EDGE CASES
     * Tên test case nhỏ: Cố chọn 29/02 năm không nhuận 2025 – datepicker chặn
     * Expected Result chính: Datepicker không hiển thị ngày 29 ở tháng 2 năm 2025.
     */
    @Test(
        description = "FILTER-TC-21 - Cố chọn 29/02 năm không nhuận 2025 – datepicker chặn",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc21CoChon2902NamKhongNhuan2025DatepickerChan() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                filter.selectDateRange("Tùy chỉnh");
                filter.setRawCustomDates("2025-02-29", "2025-03-01");
                Assert.assertNotEquals(filter.customDateFrom(), "2025-02-29");
    }

    /**
     * TC ID: FILTER-TC-22
     * Task name / test case lớn: NGÀY TÙY CHỈNH – EDGE CASES
     * Tên test case nhỏ: Khoảng ngày quá dài (1 năm) – có thể cảnh báo performance
     * Expected Result chính: Hệ thống hoặc chấp nhận và load được, hoặc cảnh báo 'Khoảng thời gian quá dài, có thể chậm'. Không crash.
     */
    @Test(
        description = "FILTER-TC-22 - Khoảng ngày quá dài (1 năm) – có thể cảnh báo performance",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc22KhoangNgayQuaDai1NamCoTheCanhBaoPerformance() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                filter.selectDateRange("Tùy chỉnh");
                filter.setCustomDateRange(LocalDate.of(2024, 1, 1), LocalDate.of(2024, 12, 31));
                filter.apply();
                Assert.assertTrue(toastText().contains("Đã áp dụng") || toastText().toLowerCase().contains("quá dài"), "Expected cho phép áp dụng hoặc cảnh báo rõ ràng, nhưng không crash");
                Assert.assertFalse(SourceBackedUiAssertions.hasBlankApplicationShell(driver()));
    }

    /**
     * TC ID: FILTER-TC-23
     * Task name / test case lớn: NGÀY TÙY CHỈNH – EDGE CASES
     * Tên test case nhỏ: Ngày ngoài phạm vi dữ liệu (1 năm trước khi hệ thống có data) – trả empty
     * Expected Result chính: API trả data rỗng. Dashboard hiển thị empty state thân thiện, không lỗi.
     */
    @Test(
        description = "FILTER-TC-23 - Ngày ngoài phạm vi dữ liệu (1 năm trước khi hệ thống có data) – trả empty",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc23NgayNgoaiPhamViDuLieu1NamTruocKhiHeThong() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                filter.selectDateRange("Tùy chỉnh");
                filter.setCustomDateRange(LocalDate.of(2010, 1, 1), LocalDate.of(2010, 1, 1));
                filter.apply();
                Assert.assertTrue(SourceBackedUiAssertions.hasEmptyStateOrZeroData(driver()), "Khoảng ngoài dữ liệu phải có empty/zero state");
    }

}
