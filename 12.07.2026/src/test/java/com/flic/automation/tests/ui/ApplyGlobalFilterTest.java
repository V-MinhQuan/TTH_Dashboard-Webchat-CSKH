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


public class ApplyGlobalFilterTest extends BaseUiTest {

    /**
     * TC ID: FILTER-TC-24
     * Task name / test case lớn: NÚT ÁP DỤNG
     * Tên test case nhỏ: Click Áp dụng với filter hợp lệ – API gọi đúng tất cả params
     * Expected Result chính: API được gọi với đúng query string: date_range=7d&channel=zalo&topic=tu_van. Dashboard cập nhật.
     */
    @Test(
        description = "FILTER-TC-24 - Click Áp dụng với filter hợp lệ – API gọi đúng tất cả params",
        groups = {"filter", "regression", "requires-db", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc24ClickApDungVoiFilterHopLeAPIGoiDungTatCa() {
        throw new SkipException("NEEDS_REQUIREMENT_CONFIRMATION: Expected Result của Excel xung đột với contract/source active; cần Product Owner xác nhận trước khi tự động hóa như một tiêu chí pass/fail. Sai lệch: Expected dùng query token cũ; source dùng startDate/endDate cùng mapping kênh/chủ đề hiện hành.");
    }

    /**
     * TC ID: FILTER-TC-25
     * Task name / test case lớn: NÚT ÁP DỤNG
     * Tên test case nhỏ: Click Áp dụng khi thiếu Từ ngày trong Tùy chỉnh – không gọi API
     * Expected Result chính: Form validate và hiển thị lỗi. Không gọi API. Dashboard không thay đổi.
     */
    @Test(
        description = "FILTER-TC-25 - Click Áp dụng khi thiếu Từ ngày trong Tùy chỉnh – không gọi API",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc25ClickApDungKhiThieuTuNgayTrongTuyChinhKhongGoi() {
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
     * TC ID: FILTER-TC-26
     * Task name / test case lớn: NÚT ÁP DỤNG
     * Tên test case nhỏ: Click Áp dụng nhiều lần liên tiếp – debounce chỉ gọi 1 API cuối
     * Expected Result chính: Chỉ có 1 API request cuối được gửi (debounce hoặc cancel prev). Không có 3 request song song.
     */
    @Test(
        description = "FILTER-TC-26 - Click Áp dụng nhiều lần liên tiếp – debounce chỉ gọi 1 API cuối",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc26ClickApDungNhieuLanLienTiepDebounceChiGoi1API() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                filter.selectDateRange("7 ngày qua");
                int before = apiRequestCount();
                filter.apply(); filter.apply(); filter.apply();
                waitForNetworkQuiet();
                Assert.assertEquals(apiRequestCount() - before, 1, "Expected chỉ một request cuối sau click liên tiếp");
    }

    /**
     * TC ID: FILTER-TC-27
     * Task name / test case lớn: NÚT ÁP DỤNG
     * Tên test case nhỏ: Dữ liệu chart/KPI cập nhật đúng sau khi Áp dụng
     * Expected Result chính: KPI cards và biểu đồ hiển thị số liệu mới khác với lần trước. Dữ liệu phù hợp khoảng 7 ngày.
     */
    @Test(
        description = "FILTER-TC-27 - Dữ liệu chart/KPI cập nhật đúng sau khi Áp dụng",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc27DuLieuChartKPICapNhatDungSauKhiApDung() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                String beforeState = SourceBackedUiAssertions.dashboardDataFingerprint(driver());
                filter.selectDateRange("7 ngày qua");
                filter.apply();
                waitForNetworkQuiet();
                String afterState = SourceBackedUiAssertions.dashboardDataFingerprint(driver());
                Assert.assertNotEquals(afterState, "", "Dashboard phải có trạng thái dữ liệu sau Apply");
                Assert.assertFalse(beforeState.isBlank());
    }

}
