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


public class EndDateValidationTest extends BaseUiTest {

    /**
     * TC ID: FILTER-TC-13
     * Task name / test case lớn: Ô ĐẾN NGÀY – VALIDATION
     * Tên test case nhỏ: Bỏ trống ô Đến ngày khi Tùy chỉnh và click Áp dụng – báo lỗi bắt buộc
     * Expected Result chính: Hiển thị lỗi 'Vui lòng chọn Đến ngày'. Không gọi API.
     */
    @Test(
        description = "FILTER-TC-13 - Bỏ trống ô Đến ngày khi Tùy chỉnh và click Áp dụng – báo lỗi bắt buộc",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc13BoTrongODenNgayKhiTuyChinhVaClickApDung() {
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
     * TC ID: FILTER-TC-14
     * Task name / test case lớn: Ô ĐẾN NGÀY – VALIDATION
     * Tên test case nhỏ: Nhập Đến ngày nhỏ hơn Từ ngày – bị từ chối
     * Expected Result chính: Hệ thống hiển thị lỗi 'Đến ngày phải lớn hơn hoặc bằng Từ ngày'. Không gọi API.
     */
    @Test(
        description = "FILTER-TC-14 - Nhập Đến ngày nhỏ hơn Từ ngày – bị từ chối",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc14NhapDenNgayNhoHonTuNgayBiTuChoi() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                filter.selectDateRange("Tùy chỉnh");
                filter.setCustomDateRange(LocalDate.of(2025, 6, 15), LocalDate.of(2025, 6, 10));
                filter.apply();
                Assert.assertTrue(toastText().contains("trước"), "Range đảo phải bị từ chối");
    }

    /**
     * TC ID: FILTER-TC-15
     * Task name / test case lớn: Ô ĐẾN NGÀY – VALIDATION
     * Tên test case nhỏ: Nhập Đến ngày bằng Từ ngày (cùng ngày) – hợp lệ
     * Expected Result chính: Bộ lọc áp dụng thành công với date_from = date_to = 10/06/2025. Trả dữ liệu trong ngày đó.
     */
    @Test(
        description = "FILTER-TC-15 - Nhập Đến ngày bằng Từ ngày (cùng ngày) – hợp lệ",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc15NhapDenNgayBangTuNgayCungNgayHopLe() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                filter.selectDateRange("Tùy chỉnh");
                filter.setCustomDateRange(LocalDate.of(2025, 6, 10), LocalDate.of(2025, 6, 10));
                filter.apply();
                Assert.assertTrue(toastText().contains("Đã áp dụng"));
    }

    /**
     * TC ID: FILTER-TC-16
     * Task name / test case lớn: Ô ĐẾN NGÀY – VALIDATION
     * Tên test case nhỏ: Nhập Đến ngày sai định dạng – datepicker chặn
     * Expected Result chính: Input không nhận ký tự không phải số/slash. Nếu nhập được thì báo lỗi format.
     */
    @Test(
        description = "FILTER-TC-16 - Nhập Đến ngày sai định dạng – datepicker chặn",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc16NhapDenNgaySaiDinhDangDatepickerChan() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                filter.selectDateRange("Tùy chỉnh");
                filter.setRawCustomDates("2025-06-01", "abc");
                Assert.assertNotEquals(filter.customDateTo(), "abc");
    }

    /**
     * TC ID: FILTER-TC-17
     * Task name / test case lớn: Ô ĐẾN NGÀY – VALIDATION
     * Tên test case nhỏ: Nhập Đến ngày hợp lệ sau Từ ngày – áp dụng thành công
     * Expected Result chính: API nhận đúng params, dashboard render data từ 01/06 đến 30/06.
     */
    @Test(
        description = "FILTER-TC-17 - Nhập Đến ngày hợp lệ sau Từ ngày – áp dụng thành công",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc17NhapDenNgayHopLeSauTuNgayApDungThanhCong() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                filter.selectDateRange("Tùy chỉnh");
                filter.setCustomDateRange(LocalDate.of(2025, 6, 1), LocalDate.of(2025, 6, 30));
                filter.apply();
                Assert.assertTrue(toastText().contains("Đã áp dụng"));
    }

}
