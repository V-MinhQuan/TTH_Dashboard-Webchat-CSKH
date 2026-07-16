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


public class TimeRangePresetTest extends BaseUiTest {

    /**
     * TC ID: FILTER-TC-01
     * Task name / test case lớn: DROPDOWN KHOẢNG THỜI GIAN
     * Tên test case nhỏ: Mở dropdown Khoảng thời gian hiển thị đủ 4 option
     * Expected Result chính: Dropdown hiển thị: Hôm nay, 7 ngày qua, 30 ngày qua, Tùy chỉnh. Không có option thừa.
     */
    @Test(
        description = "FILTER-TC-01 - Mở dropdown Khoảng thời gian hiển thị đủ 4 option",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc01MoDropdownKhoangThoiGianHienThiDu4Option() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                Assert.assertEquals(filter.optionTexts("Khoảng thời gian"), List.of("30 ngày qua", "7 ngày qua", "Hôm nay", "Tùy chỉnh"));
    }

    /**
     * TC ID: FILTER-TC-02
     * Task name / test case lớn: DROPDOWN KHOẢNG THỜI GIAN
     * Tên test case nhỏ: Chọn preset 'Hôm nay' – API gọi đúng date_from = date_to = hôm nay
     * Expected Result chính: API nhận date_from = date_to = ngày hiện tại (UTC+7). Dashboard hiển thị dữ liệu hôm nay.
     */
    @Test(
        description = "FILTER-TC-02 - Chọn preset 'Hôm nay' – API gọi đúng date_from = date_to = hôm nay",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc02ChonPresetHomNayAPIGoiDungDateFromDateToHom() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                filter.selectDateRange("Hôm nay");
                int before = apiRequestCount();
                filter.apply();
                Assert.assertEquals(filter.selectedDateRange(), "Hôm nay");
                Assert.assertTrue(waitForApiRequestAfter(before, "/api/dashboard"), "Apply phải gọi API dashboard");
    }

    /**
     * TC ID: FILTER-TC-03
     * Task name / test case lớn: DROPDOWN KHOẢNG THỜI GIAN
     * Tên test case nhỏ: Chọn preset '7 ngày qua' – API gọi date_from = hôm nay - 6 ngày
     * Expected Result chính: API nhận params tương ứng 7 ngày. KPI và biểu đồ hiển thị đúng khoảng.
     */
    @Test(
        description = "FILTER-TC-03 - Chọn preset '7 ngày qua' – API gọi date_from = hôm nay - 6 ngày",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc03ChonPreset7NgayQuaAPIGoiDateFromHomNay6() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                filter.selectDateRange("7 ngày qua");
                int before = apiRequestCount();
                filter.apply();
                Assert.assertEquals(filter.selectedDateRange(), "7 ngày qua");
                Assert.assertTrue(waitForApiRequestAfter(before, "/api/dashboard"), "Apply phải gọi API dashboard");
    }

    /**
     * TC ID: FILTER-TC-04
     * Task name / test case lớn: DROPDOWN KHOẢNG THỜI GIAN
     * Tên test case nhỏ: Chọn preset '30 ngày qua' – API gọi đúng 30 ngày
     * Expected Result chính: API nhận params 30 ngày. Chart hiển thị đủ 30 data point theo ngày.
     */
    @Test(
        description = "FILTER-TC-04 - Chọn preset '30 ngày qua' – API gọi đúng 30 ngày",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc04ChonPreset30NgayQuaAPIGoiDung30Ngay() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                filter.selectDateRange("30 ngày qua");
                int before = apiRequestCount();
                filter.apply();
                Assert.assertEquals(filter.selectedDateRange(), "30 ngày qua");
                Assert.assertTrue(waitForApiRequestAfter(before, "/api/dashboard"), "Apply phải gọi API dashboard");
    }

    /**
     * TC ID: FILTER-TC-05
     * Task name / test case lớn: DROPDOWN KHOẢNG THỜI GIAN
     * Tên test case nhỏ: Chọn 'Tùy chỉnh' – hiển thị ô Từ ngày và Đến ngày
     * Expected Result chính: Ô 'Từ ngày' và 'Đến ngày' xuất hiện dưới dropdown. Hai ô ban đầu có thể trống hoặc pre-fill.
     */
    @Test(
        description = "FILTER-TC-05 - Chọn 'Tùy chỉnh' – hiển thị ô Từ ngày và Đến ngày",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc05ChonTuyChinhHienThiOTuNgayVaDenNgay() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                filter.selectDateRange("Tùy chỉnh");
                Assert.assertTrue(filter.customDateInputsVisible());
    }

    /**
     * TC ID: FILTER-TC-06
     * Task name / test case lớn: DROPDOWN KHOẢNG THỜI GIAN
     * Tên test case nhỏ: Đổi từ preset '7 ngày' sang 'Tùy chỉnh' – ô ngày không crash
     * Expected Result chính: UI chuyển mượt mà sang chế độ Tùy chỉnh. Hai ô ngày có thể pre-fill theo giá trị 7 ngày hoặc trống.
     */
    @Test(
        description = "FILTER-TC-06 - Đổi từ preset '7 ngày' sang 'Tùy chỉnh' – ô ngày không crash",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc06DoiTuPreset7NgaySangTuyChinhONgayKhongCrash() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                filter.selectDateRange("7 ngày qua");
                filter.selectDateRange("Tùy chỉnh");
                Assert.assertTrue(filter.customDateInputsVisible());
    }

    /**
     * TC ID: FILTER-TC-07
     * Task name / test case lớn: DROPDOWN KHOẢNG THỜI GIAN
     * Tên test case nhỏ: Đổi từ Tùy chỉnh về preset – ô ngày ẩn đi
     * Expected Result chính: Ô Từ ngày và Đến ngày ẩn. Chip filter cập nhật theo preset mới.
     */
    @Test(
        description = "FILTER-TC-07 - Đổi từ Tùy chỉnh về preset – ô ngày ẩn đi",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc07DoiTuTuyChinhVePresetONgayAnDi() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                filter.selectDateRange("Tùy chỉnh");
                filter.selectDateRange("30 ngày qua");
                Assert.assertFalse(filter.customDateInputsVisible());
    }

}
