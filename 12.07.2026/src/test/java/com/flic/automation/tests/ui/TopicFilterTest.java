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


public class TopicFilterTest extends BaseUiTest {

    /**
     * TC ID: FILTER-TC-38
     * Task name / test case lớn: DROPDOWN CHỦ ĐỀ
     * Tên test case nhỏ: Mở dropdown Chủ đề – chỉ hiển thị chủ đề đang active
     * Expected Result chính: Chỉ hiển thị chủ đề active trong DB. Không có chủ đề bị xóa/deactivate.
     */
    @Test(
        description = "FILTER-TC-38 - Mở dropdown Chủ đề – chỉ hiển thị chủ đề đang active",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc38MoDropdownChuDeChiHienThiChuDeDangActive() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                Assert.assertEquals(filter.optionTexts("Chủ đề"), List.of("Tất cả", "Sát hạch CNTT", "TOEIC", "MOS", "Học Tiếng Anh", "Học Tin học"));
    }

    /**
     * TC ID: FILTER-TC-39
     * Task name / test case lớn: DROPDOWN CHỦ ĐỀ
     * Tên test case nhỏ: Chọn 'Tất cả' chủ đề – không filter theo topic
     * Expected Result chính: API gọi không có param topic. Dữ liệu bao gồm mọi chủ đề.
     */
    @Test(
        description = "FILTER-TC-39 - Chọn 'Tất cả' chủ đề – không filter theo topic",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc39ChonTatCaChuDeKhongFilterTheoTopic() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                filter.selectTopic("Tất cả");
                filter.apply();
                Assert.assertEquals(filter.selectedTopic(), "Tất cả");
    }

    /**
     * TC ID: FILTER-TC-40
     * Task name / test case lớn: DROPDOWN CHỦ ĐỀ
     * Tên test case nhỏ: Chọn 1 chủ đề cụ thể – lọc đúng topic ID
     * Expected Result chính: API nhận đúng topic_id. Dữ liệu chỉ thuộc chủ đề đó.
     */
    @Test(
        description = "FILTER-TC-40 - Chọn 1 chủ đề cụ thể – lọc đúng topic ID",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc40Chon1ChuDeCuTheLocDungTopicID() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                String topic = firstNonDefaultOption(filter, "Chủ đề");
                filter.selectTopic(topic);
                int before = apiRequestCount();
                filter.apply();
                Assert.assertTrue(waitForApiRequestAfter(before, "/api/"));
                Assert.assertTrue(latestApiRequestUrl().toLowerCase().contains("topic"));
    }

    /**
     * TC ID: FILTER-TC-41
     * Task name / test case lớn: DROPDOWN CHỦ ĐỀ
     * Tên test case nhỏ: Chủ đề không có dữ liệu trong khoảng ngày – empty state
     * Expected Result chính: Dashboard hiển thị empty state. Không hiển thị dữ liệu sai của chủ đề khác.
     */
    @Test(
        description = "FILTER-TC-41 - Chủ đề không có dữ liệu trong khoảng ngày – empty state",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc41ChuDeKhongCoDuLieuTrongKhoangNgayEmptyState() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                selectConfiguredEmptyTopic(filter);
                filter.apply();
                Assert.assertTrue(SourceBackedUiAssertions.hasEmptyStateOrZeroData(driver()));
    }

}
