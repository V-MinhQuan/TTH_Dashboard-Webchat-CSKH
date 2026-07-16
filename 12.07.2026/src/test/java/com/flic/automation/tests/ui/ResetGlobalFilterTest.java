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


public class ResetGlobalFilterTest extends BaseUiTest {

    /**
     * TC ID: FILTER-TC-28
     * Task name / test case lớn: NÚT ĐẶT LẠI
     * Tên test case nhỏ: Đặt lại sau preset – dropdown về mặc định và dữ liệu reload
     * Expected Result chính: Dropdown Thời gian về '30 ngày qua' (hoặc mặc định). API gọi với params mặc định.
     */
    @Test(
        description = "FILTER-TC-28 - Đặt lại sau preset – dropdown về mặc định và dữ liệu reload",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc28DatLaiSauPresetDropdownVeMacDinhVaDuLieuReload() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                filter.selectDateRange("Tùy chỉnh");
                filter.setCustomDateRange(LocalDate.of(2025, 6, 1), LocalDate.of(2025, 6, 2));
                selectFirstNonDefault(filter, "Kênh");
                filter.apply();
                int before = apiRequestCount();
                filter.reset();
                Assert.assertEquals(filter.selectedDateRange(), "30 ngày qua");
                Assert.assertEquals(filter.selectedChannel(), "Tất cả");
                Assert.assertTrue(filter.activeChips().isEmpty());
                Assert.assertTrue(waitForApiRequestAfter(before, "/api/"));
    }

    /**
     * TC ID: FILTER-TC-29
     * Task name / test case lớn: NÚT ĐẶT LẠI
     * Tên test case nhỏ: Đặt lại sau Tùy chỉnh – ô ngày bị xóa
     * Expected Result chính: Ô Từ ngày và Đến ngày bị xóa. Dropdown về preset mặc định.
     */
    @Test(
        description = "FILTER-TC-29 - Đặt lại sau Tùy chỉnh – ô ngày bị xóa",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc29DatLaiSauTuyChinhONgayBiXoa() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                filter.selectDateRange("Tùy chỉnh");
                filter.setCustomDateRange(LocalDate.of(2025, 6, 1), LocalDate.of(2025, 6, 2));
                selectFirstNonDefault(filter, "Kênh");
                filter.apply();
                int before = apiRequestCount();
                filter.reset();
                Assert.assertEquals(filter.selectedDateRange(), "30 ngày qua");
                Assert.assertEquals(filter.selectedChannel(), "Tất cả");
                Assert.assertTrue(filter.activeChips().isEmpty());
                Assert.assertTrue(waitForApiRequestAfter(before, "/api/"));
    }

    /**
     * TC ID: FILTER-TC-30
     * Task name / test case lớn: NÚT ĐẶT LẠI
     * Tên test case nhỏ: Đặt lại xóa tất cả chip filter trên thanh
     * Expected Result chính: Tất cả chip filter biến mất. Bộ lọc trở về mặc định. Dữ liệu reload.
     */
    @Test(
        description = "FILTER-TC-30 - Đặt lại xóa tất cả chip filter trên thanh",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc30DatLaiXoaTatCaChipFilterTrenThanh() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                filter.selectDateRange("Tùy chỉnh");
                filter.setCustomDateRange(LocalDate.of(2025, 6, 1), LocalDate.of(2025, 6, 2));
                selectFirstNonDefault(filter, "Kênh");
                filter.apply();
                int before = apiRequestCount();
                filter.reset();
                Assert.assertEquals(filter.selectedDateRange(), "30 ngày qua");
                Assert.assertEquals(filter.selectedChannel(), "Tất cả");
                Assert.assertTrue(filter.activeChips().isEmpty());
                Assert.assertTrue(waitForApiRequestAfter(before, "/api/"));
    }

    /**
     * TC ID: FILTER-TC-31
     * Task name / test case lớn: NÚT ĐẶT LẠI
     * Tên test case nhỏ: Đặt lại gọi lại API với params mặc định
     * Expected Result chính: API được gọi với params mặc định (không có channel/topic filter hoặc date=30days).
     */
    @Test(
        description = "FILTER-TC-31 - Đặt lại gọi lại API với params mặc định",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc31DatLaiGoiLaiAPIVoiParamsMacDinh() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                filter.selectDateRange("Tùy chỉnh");
                filter.setCustomDateRange(LocalDate.of(2025, 6, 1), LocalDate.of(2025, 6, 2));
                selectFirstNonDefault(filter, "Kênh");
                filter.apply();
                int before = apiRequestCount();
                filter.reset();
                Assert.assertEquals(filter.selectedDateRange(), "30 ngày qua");
                Assert.assertEquals(filter.selectedChannel(), "Tất cả");
                Assert.assertTrue(filter.activeChips().isEmpty());
                Assert.assertTrue(waitForApiRequestAfter(before, "/api/"));
    }

}
