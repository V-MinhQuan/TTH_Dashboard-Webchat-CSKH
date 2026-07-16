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


public class FilterChipSynchronizationTest extends BaseUiTest {

    /**
     * TC ID: FILTER-TC-42
     * Task name / test case lớn: CHIP FILTER
     * Tên test case nhỏ: Chip filter hiển thị sau khi áp dụng bộ lọc có kênh và chủ đề
     * Expected Result chính: Chip 'Zalo' và chip 'Tư vấn' xuất hiện trên thanh filter active.
     */
    @Test(
        description = "FILTER-TC-42 - Chip filter hiển thị sau khi áp dụng bộ lọc có kênh và chủ đề",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc42ChipFilterHienThiSauKhiApDungBoLocCoKenh() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                selectFirstNonDefault(filter, "Kênh");
                selectFirstNonDefault(filter, "Chủ đề");
                filter.apply();
                Assert.assertTrue(filter.activeChips().stream().anyMatch(v -> v.contains("Kênh")));
                Assert.assertTrue(filter.activeChips().stream().anyMatch(v -> v.contains("Chủ đề")));
    }

    /**
     * TC ID: FILTER-TC-43
     * Task name / test case lớn: CHIP FILTER
     * Tên test case nhỏ: Xóa chip kênh – dropdown Kênh trở về 'Tất cả'
     * Expected Result chính: Chip kênh biến mất. Dropdown Kênh reset về 'Tất cả'. API gọi lại không có channel filter.
     */
    @Test(
        description = "FILTER-TC-43 - Xóa chip kênh – dropdown Kênh trở về 'Tất cả'",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc43XoaChipKenhDropdownKenhTroVeTatCa() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                filter.selectDateRange("7 ngày qua");
                selectFirstNonDefault(filter, "Kênh");
                selectFirstNonDefault(filter, "Chủ đề");
                filter.apply();
                filter.removeFirstChip("Kênh");
                Assert.assertFalse(filter.activeChips().stream().anyMatch(v -> v.startsWith("Kênh:")));
                Assert.assertEquals(filter.selectedValueForChip("Kênh"), filter.defaultValueForChip("Kênh"));
    }

    /**
     * TC ID: FILTER-TC-44
     * Task name / test case lớn: CHIP FILTER
     * Tên test case nhỏ: Xóa chip chủ đề – dropdown Chủ đề trở về 'Tất cả'
     * Expected Result chính: Chip chủ đề biến mất. Dropdown về 'Tất cả'. Data reload.
     */
    @Test(
        description = "FILTER-TC-44 - Xóa chip chủ đề – dropdown Chủ đề trở về 'Tất cả'",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc44XoaChipChuDeDropdownChuDeTroVeTatCa() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                filter.selectDateRange("7 ngày qua");
                selectFirstNonDefault(filter, "Kênh");
                selectFirstNonDefault(filter, "Chủ đề");
                filter.apply();
                filter.removeFirstChip("Chủ đề");
                Assert.assertFalse(filter.activeChips().stream().anyMatch(v -> v.startsWith("Chủ đề:")));
                Assert.assertEquals(filter.selectedValueForChip("Chủ đề"), filter.defaultValueForChip("Chủ đề"));
    }

    /**
     * TC ID: FILTER-TC-45
     * Task name / test case lớn: CHIP FILTER
     * Tên test case nhỏ: Xóa chip thời gian – filter trở về preset mặc định
     * Expected Result chính: Chip thời gian biến mất. Dropdown Thời gian về mặc định (30 ngày qua).
     */
    @Test(
        description = "FILTER-TC-45 - Xóa chip thời gian – filter trở về preset mặc định",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc45XoaChipThoiGianFilterTroVePresetMacDinh() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                filter.selectDateRange("7 ngày qua");
                selectFirstNonDefault(filter, "Kênh");
                selectFirstNonDefault(filter, "Chủ đề");
                filter.apply();
                filter.removeFirstChip("Thời gian");
                Assert.assertFalse(filter.activeChips().stream().anyMatch(v -> v.startsWith("Thời gian:")));
                Assert.assertEquals(filter.selectedValueForChip("Thời gian"), filter.defaultValueForChip("Thời gian"));
    }

    /**
     * TC ID: FILTER-TC-46
     * Task name / test case lớn: CHIP FILTER
     * Tên test case nhỏ: Chip đồng bộ lại với filter panel khi xóa chip
     * Expected Result chính: Panel filter hiển thị đúng trạng thái hiện tại (đã mất điều kiện vừa xóa chip).
     */
    @Test(
        description = "FILTER-TC-46 - Chip đồng bộ lại với filter panel khi xóa chip",
        groups = {"filter", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void filtertc46ChipDongBoLaiVoiFilterPanelKhiXoaChip() {
        loginAsManager();
                openScreen("overview");
                GlobalFilterComponent filter = globalFilter();
                filter.expand();
                filter.selectDateRange("7 ngày qua");
                selectFirstNonDefault(filter, "Kênh");
                selectFirstNonDefault(filter, "Chủ đề");
                filter.apply();
                filter.removeFirstChip("Kênh");
                Assert.assertFalse(filter.activeChips().stream().anyMatch(v -> v.startsWith("Kênh:")));
                Assert.assertEquals(filter.selectedValueForChip("Kênh"), filter.defaultValueForChip("Kênh"));
    }

}
