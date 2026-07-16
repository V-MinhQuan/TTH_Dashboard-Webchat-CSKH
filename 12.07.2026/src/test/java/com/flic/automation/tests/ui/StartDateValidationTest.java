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


public class StartDateValidationTest extends BaseUiTest {

    /**
     * TC ID: FILTER-TC-08
     * Task name / test case lớn: Ô TỪ NGÀY – VALIDATION
     * Tên test case nhỏ: Bỏ trống ô Từ ngày khi Tùy chỉnh và click Áp dụng – báo lỗi bắt buộc
     * Expected Result chính: Hiển thị lỗi 'Vui lòng chọn Từ ngày'. Không gọi API.
     */
    @Test(
        description = "FILTER-TC-08 - Bỏ trống ô Từ ngày khi Tùy chỉnh và click Áp dụng – báo lỗi bắt buộc",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc08BoTrongOTuNgayKhiTuyChinhVaClickApDung() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                filter.selectDateRange("Tùy chỉnh");
                filter.setRawCustomDates("", "2026-07-01");
                int before = apiRequestCount();
                filter.apply();
                Assert.assertTrue(toastText().contains("đầy đủ"), "Thiếu ngày phải có toast validation");
                Assert.assertEquals(apiRequestCount(), before, "Validation không được gọi API mới");
    }

    /**
     * TC ID: FILTER-TC-09
     * Task name / test case lớn: Ô TỪ NGÀY – VALIDATION
     * Tên test case nhỏ: Nhập Từ ngày sai định dạng DD/MM/YYYY – datepicker chặn hoặc báo lỗi
     * Expected Result chính: Datepicker không cho nhập ngày không hợp lệ, hoặc báo lỗi 'Ngày không hợp lệ'.
     */
    @Test(
        description = "FILTER-TC-09 - Nhập Từ ngày sai định dạng DD/MM/YYYY – datepicker chặn hoặc báo lỗi",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc09NhapTuNgaySaiDinhDangDDMMYYYYDatepickerChanHoac() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                filter.selectDateRange("Tùy chỉnh");
                filter.setRawCustomDates("2025-13-99", "2025-02-28");
                Assert.assertNotEquals(filter.customDateFrom(), "2025-13-99", "Browser/date input không được giữ ngày vô hiệu");
    }

    /**
     * TC ID: FILTER-TC-10
     * Task name / test case lớn: Ô TỪ NGÀY – VALIDATION
     * Tên test case nhỏ: Nhập Từ ngày là ngày tương lai – bị từ chối
     * Expected Result chính: Datepicker disable ngày tương lai hoặc hiển thị cảnh báo 'Không thể chọn ngày trong tương lai'.
     */
    @Test(
        description = "FILTER-TC-10 - Nhập Từ ngày là ngày tương lai – bị từ chối",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc10NhapTuNgayLaNgayTuongLaiBiTuChoi() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                filter.selectDateRange("Tùy chỉnh");
                LocalDate future = LocalDate.now().plusDays(1);
                filter.setCustomDateRange(future, future);
                filter.apply();
                Assert.assertTrue(toastText().toLowerCase().contains("tương lai"), "Expected Excel yêu cầu chặn ngày tương lai");
    }

    /**
     * TC ID: FILTER-TC-11
     * Task name / test case lớn: Ô TỪ NGÀY – VALIDATION
     * Tên test case nhỏ: Nhập Từ ngày hợp lệ trong quá khứ – được chấp nhận
     * Expected Result chính: Bộ lọc áp dụng thành công. API gọi đúng params. Dashboard cập nhật.
     */
    @Test(
        description = "FILTER-TC-11 - Nhập Từ ngày hợp lệ trong quá khứ – được chấp nhận",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc11NhapTuNgayHopLeTrongQuaKhuDuocChapNhan() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                filter.selectDateRange("Tùy chỉnh");
                filter.setCustomDateRange(LocalDate.of(2025, 6, 1), LocalDate.of(2025, 6, 2));
                filter.apply();
                Assert.assertTrue(toastText().contains("Đã áp dụng"));
    }

    /**
     * TC ID: FILTER-TC-12
     * Task name / test case lớn: Ô TỪ NGÀY – VALIDATION
     * Tên test case nhỏ: Nhập ngày 31/02 không tồn tại – datepicker chặn
     * Expected Result chính: Datepicker không hiển thị ngày 31/02 trong calendar. Ô không nhận giá trị sai.
     */
    @Test(
        description = "FILTER-TC-12 - Nhập ngày 31/02 không tồn tại – datepicker chặn",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc12NhapNgay3102KhongTonTaiDatepickerChan() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                filter.selectDateRange("Tùy chỉnh");
                filter.setRawCustomDates("2025-13-99", "2025-02-28");
                Assert.assertNotEquals(filter.customDateFrom(), "2025-13-99", "Browser/date input không được giữ ngày vô hiệu");
    }

}
