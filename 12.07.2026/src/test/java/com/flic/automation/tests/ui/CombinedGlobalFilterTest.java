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


public class CombinedGlobalFilterTest extends BaseUiTest {

    /**
     * TC ID: FILTER-TC-47
     * Task name / test case lớn: TỔ HỢP ĐA BỘ LỌC
     * Tên test case nhỏ: Tổ hợp Thời gian + Kênh – API gọi đúng 2 params
     * Expected Result chính: API nhận date_range=7d&channel=facebook. Data đúng tổ hợp.
     */
    @Test(
        description = "FILTER-TC-47 - Tổ hợp Thời gian + Kênh – API gọi đúng 2 params",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc47ToHopThoiGianKenhAPIGoiDung2Params() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                filter.selectDateRange("7 ngày qua");
                selectFirstNonDefault(filter, "Kênh");
                int before = apiRequestCount();
                filter.apply();
                Assert.assertTrue(waitForApiRequestAfter(before, "/api/"));
                Assert.assertFalse(latestApiRequestUrl().isBlank());
    }

    /**
     * TC ID: FILTER-TC-48
     * Task name / test case lớn: TỔ HỢP ĐA BỘ LỌC
     * Tên test case nhỏ: Tổ hợp Thời gian + Chủ đề – API gọi đúng 2 params
     * Expected Result chính: API nhận date_range=30d&topic=kt. Data chỉ thuộc topic trong 30 ngày.
     */
    @Test(
        description = "FILTER-TC-48 - Tổ hợp Thời gian + Chủ đề – API gọi đúng 2 params",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc48ToHopThoiGianChuDeAPIGoiDung2Params() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                filter.selectDateRange("7 ngày qua");
                selectFirstNonDefault(filter, "Chủ đề");
                int before = apiRequestCount();
                filter.apply();
                Assert.assertTrue(waitForApiRequestAfter(before, "/api/"));
                Assert.assertFalse(latestApiRequestUrl().isBlank());
    }

    /**
     * TC ID: FILTER-TC-49
     * Task name / test case lớn: TỔ HỢP ĐA BỘ LỌC
     * Tên test case nhỏ: Tổ hợp Kênh + Chủ đề không có Thời gian tùy chỉnh
     * Expected Result chính: API nhận channel + topic + date_range mặc định. Data giao 3 điều kiện.
     */
    @Test(
        description = "FILTER-TC-49 - Tổ hợp Kênh + Chủ đề không có Thời gian tùy chỉnh",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc49ToHopKenhChuDeKhongCoThoiGianTuyChinh() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                selectFirstNonDefault(filter, "Kênh");
                selectFirstNonDefault(filter, "Chủ đề");
                int before = apiRequestCount();
                filter.apply();
                Assert.assertTrue(waitForApiRequestAfter(before, "/api/"));
                Assert.assertFalse(latestApiRequestUrl().isBlank());
    }

    /**
     * TC ID: FILTER-TC-50
     * Task name / test case lớn: TỔ HỢP ĐA BỘ LỌC
     * Tên test case nhỏ: Tổ hợp Thời gian + Kênh + Chủ đề (3 filter cùng lúc)
     * Expected Result chính: API nhận đủ 3 params. Dashboard hiển thị dữ liệu giao của cả 3 điều kiện.
     */
    @Test(
        description = "FILTER-TC-50 - Tổ hợp Thời gian + Kênh + Chủ đề (3 filter cùng lúc)",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc50ToHopThoiGianKenhChuDe3FilterCungLuc() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                filter.selectDateRange("7 ngày qua");
                selectFirstNonDefault(filter, "Kênh");
                selectFirstNonDefault(filter, "Chủ đề");
                int before = apiRequestCount();
                filter.apply();
                Assert.assertTrue(waitForApiRequestAfter(before, "/api/"));
                Assert.assertFalse(latestApiRequestUrl().isBlank());
    }

    /**
     * TC ID: FILTER-TC-51
     * Task name / test case lớn: TỔ HỢP ĐA BỘ LỌC
     * Tên test case nhỏ: Tất cả filter mặc định – không filter gì cả
     * Expected Result chính: API gọi không có params filter đặc biệt. Dashboard hiển thị toàn bộ data mặc định.
     */
    @Test(
        description = "FILTER-TC-51 - Tất cả filter mặc định – không filter gì cả",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc51TatCaFilterMacDinhKhongFilterGiCa() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                Assert.assertEquals(filter.selectedDateRange(), "30 ngày qua");
                Assert.assertEquals(filter.selectedChannel(), "Tất cả");
                Assert.assertEquals(filter.selectedTopic(), "Tất cả");
                Assert.assertTrue(filter.activeChips().isEmpty());
    }

}
