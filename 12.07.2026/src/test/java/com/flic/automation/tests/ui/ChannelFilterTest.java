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


public class ChannelFilterTest extends BaseUiTest {

    /**
     * TC ID: FILTER-TC-32
     * Task name / test case lớn: DROPDOWN KÊNH
     * Tên test case nhỏ: Chọn 'Tất cả' kênh – hiển thị dữ liệu không lọc kênh
     * Expected Result chính: API gọi không có param channel hoặc channel=all. Dashboard tổng hợp mọi kênh.
     */
    @Test(
        description = "FILTER-TC-32 - Chọn 'Tất cả' kênh – hiển thị dữ liệu không lọc kênh",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc32ChonTatCaKenhHienThiDuLieuKhongLocKenh() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                filter.selectChannel("Tất cả");
                filter.apply();
                Assert.assertEquals(filter.selectedChannel(), "Tất cả");
    }

    /**
     * TC ID: FILTER-TC-33
     * Task name / test case lớn: DROPDOWN KÊNH
     * Tên test case nhỏ: Chọn kênh 'Zalo OA' – dữ liệu chỉ thuộc kênh Zalo OA
     * Expected Result chính: API nhận channel=zalo_oa. Dữ liệu chart/bảng chỉ gồm Zalo OA.
     */
    @Test(
        description = "FILTER-TC-33 - Chọn kênh 'Zalo OA' – dữ liệu chỉ thuộc kênh Zalo OA",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc33ChonKenhZaloOADuLieuChiThuocKenhZaloOA() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                requireOption(filter, "Kênh", "Zalo OA");
                filter.selectChannel("Zalo OA");
                filter.apply();
                Assert.assertEquals(filter.selectedChannel(), "Zalo OA");
    }

    /**
     * TC ID: FILTER-TC-34
     * Task name / test case lớn: DROPDOWN KÊNH
     * Tên test case nhỏ: Chọn kênh 'Zalo Business' – lọc đúng kênh
     * Expected Result chính: Dữ liệu hiển thị chỉ của kênh Zalo Business.
     */
    @Test(
        description = "FILTER-TC-34 - Chọn kênh 'Zalo Business' – lọc đúng kênh",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc34ChonKenhZaloBusinessLocDungKenh() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                requireOption(filter, "Kênh", "Zalo Business");
                filter.selectChannel("Zalo Business");
                filter.apply();
                Assert.assertEquals(filter.selectedChannel(), "Zalo Business");
    }

    /**
     * TC ID: FILTER-TC-35
     * Task name / test case lớn: DROPDOWN KÊNH
     * Tên test case nhỏ: Chọn kênh 'Facebook' – lọc đúng kênh
     * Expected Result chính: Dữ liệu hiển thị chỉ của kênh Facebook Messenger.
     */
    @Test(
        description = "FILTER-TC-35 - Chọn kênh 'Facebook' – lọc đúng kênh",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc35ChonKenhFacebookLocDungKenh() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                requireOption(filter, "Kênh", "Facebook");
                filter.selectChannel("Facebook");
                filter.apply();
                Assert.assertEquals(filter.selectedChannel(), "Facebook");
    }

    /**
     * TC ID: FILTER-TC-36
     * Task name / test case lớn: DROPDOWN KÊNH
     * Tên test case nhỏ: Chọn kênh 'Chat Widget' – lọc đúng kênh
     * Expected Result chính: Dữ liệu hiển thị chỉ của kênh Chat Widget tích hợp website.
     */
    @Test(
        description = "FILTER-TC-36 - Chọn kênh 'Chat Widget' – lọc đúng kênh",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc36ChonKenhChatWidgetLocDungKenh() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                requireOption(filter, "Kênh", "Chat Widget");
                filter.selectChannel("Chat Widget");
                filter.apply();
                Assert.assertEquals(filter.selectedChannel(), "Chat Widget");
    }

    /**
     * TC ID: FILTER-TC-37
     * Task name / test case lớn: DROPDOWN KÊNH
     * Tên test case nhỏ: Kênh không có dữ liệu trong khoảng ngày – hiển thị empty state
     * Expected Result chính: Dashboard hiển thị empty state thân thiện. KPI = 0 hoặc '--'. Không crash.
     */
    @Test(
        description = "FILTER-TC-37 - Kênh không có dữ liệu trong khoảng ngày – hiển thị empty state",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc37KenhKhongCoDuLieuTrongKhoangNgayHienThiEmptyState() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                selectConfiguredEmptyChannel(filter);
                filter.apply();
                Assert.assertTrue(SourceBackedUiAssertions.hasEmptyStateOrZeroData(driver()));
    }

}
