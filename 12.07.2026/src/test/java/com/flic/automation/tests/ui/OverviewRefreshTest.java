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


public class OverviewRefreshTest extends BaseUiTest {

    /**
     * TC ID: OVERVIEW-TC-12
     * Task name / test case lớn: REFRESH DỮ LIỆU
     * Tên test case nhỏ: Click nút Tải lại giữ nguyên filter và gọi API mới
     * Expected Result chính: API gọi lại với cùng params filter. Dữ liệu được lấy mới. Filter không bị reset.
     */
    @Test(
        description = "OVERVIEW-TC-12 - Click nút Tải lại giữ nguyên filter và gọi API mới",
        groups = {"overview", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void overviewtc12ClickNutTaiLaiGiuNguyenFilterVaGoiAPIMoi() {
        loginAsManager();
                openScreen("overview");
                OverviewPage page = new OverviewPage(driver()).waitUntilReady();
                String selected = page.filters().selectedDateRange();
                int before = apiRequestCount();
                page.refresh();
                Assert.assertTrue(waitForApiRequestAfter(before, "/api/dashboard"));
                Assert.assertEquals(page.filters().selectedDateRange(), selected);
    }

    /**
     * TC ID: OVERVIEW-TC-13
     * Task name / test case lớn: REFRESH DỮ LIỆU
     * Tên test case nhỏ: Timestamp 'Cập nhật lúc' cập nhật sau khi refresh
     * Expected Result chính: Timestamp 'Cập nhật lúc HH:MM' thay đổi sang giờ hiện tại sau khi refresh.
     */
    @Test(
        description = "OVERVIEW-TC-13 - Timestamp 'Cập nhật lúc' cập nhật sau khi refresh",
        groups = {"overview", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void overviewtc13TimestampCapNhatLucCapNhatSauKhiRefresh() {
        loginAsManager();
                openScreen("overview");
                OverviewPage page = new OverviewPage(driver()).waitUntilReady();
                String before = SourceBackedUiAssertions.textMatching(driver(), "Cập nhật lúc");
                page.refresh();
                Assert.assertNotEquals(SourceBackedUiAssertions.waitForTextChange(driver(), before), before);
    }

}
