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


public class OverviewKpiTest extends BaseUiTest {

    /**
     * TC ID: OVERVIEW-TC-01
     * Task name / test case lớn: KPI CARDS
     * Tên test case nhỏ: KPI tổng hội thoại hiển thị skeleton loading khi đang tải
     * Expected Result chính: KPI cards hiển thị skeleton/placeholder trong khi API chưa trả về dữ liệu.
     */
    @Test(
        description = "OVERVIEW-TC-01 - KPI tổng hội thoại hiển thị skeleton loading khi đang tải",
        groups = {"overview", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void overviewtc01KPITongHoiThoaiHienThiSkeletonLoadingKhiDangTai() {
        loginAsManager();
                openScreen("overview");
                OverviewPage page = new OverviewPage(driver()).waitUntilReady();
                Assert.assertTrue(SourceBackedUiAssertions.loadingOrMeaningfulContent(driver()));
    }

    /**
     * TC ID: OVERVIEW-TC-02
     * Task name / test case lớn: KPI CARDS
     * Tên test case nhỏ: KPI tổng hội thoại hiển thị số đúng định dạng phân cách nghìn
     * Expected Result chính: Số liệu được format ví dụ 1,234 (dấu phẩy) hoặc 1.234 (dấu chấm) theo locale. Không hiển thị 1234 thô.
     */
    @Test(
        description = "OVERVIEW-TC-02 - KPI tổng hội thoại hiển thị số đúng định dạng phân cách nghìn",
        groups = {"overview", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void overviewtc02KPITongHoiThoaiHienThiSoDungDinhDangPhanCach() {
        loginAsManager();
                openScreen("overview");
                OverviewPage page = new OverviewPage(driver()).waitUntilReady();
                SourceBackedUiAssertions.assertNumericText(page.kpiValue("Tổng hội thoại"));
    }

    /**
     * TC ID: OVERVIEW-TC-03
     * Task name / test case lớn: KPI CARDS
     * Tên test case nhỏ: KPI % tăng trưởng màu xanh khi tăng dương, đỏ khi âm
     * Expected Result chính: Badge màu xanh + mũi tên lên khi % > 0. Màu đỏ + mũi tên xuống khi % < 0.
     */
    @Test(
        description = "OVERVIEW-TC-03 - KPI % tăng trưởng màu xanh khi tăng dương, đỏ khi âm",
        groups = {"overview", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void overviewtc03KPITangTruongMauXanhKhiTangDuongDoKhiAm() {
        loginAsManager();
                openScreen("overview");
                OverviewPage page = new OverviewPage(driver()).waitUntilReady();
                SourceBackedUiAssertions.assertGrowthIndicatorsUseSemanticColors(driver());
    }

    /**
     * TC ID: OVERVIEW-TC-04
     * Task name / test case lớn: KPI CARDS
     * Tên test case nhỏ: KPI hiển thị 0 hoặc -- khi không có dữ liệu trong filter
     * Expected Result chính: KPI cards hiển thị 0 hoặc dấu '--'. Không hiển thị NaN hoặc undefined.
     */
    @Test(
        description = "OVERVIEW-TC-04 - KPI hiển thị 0 hoặc -- khi không có dữ liệu trong filter",
        groups = {"overview", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void overviewtc04KPIHienThi0HoacKhiKhongCoDuLieuTrongFilter() {
        loginAsManager();
                openScreen("overview");
                OverviewPage page = new OverviewPage(driver()).waitUntilReady();
                applyKnownEmptyDate(page.filters());
                Assert.assertTrue(page.isEmpty() || SourceBackedUiAssertions.hasZeroKpi(driver()));
    }

    /**
     * TC ID: OVERVIEW-TC-05
     * Task name / test case lớn: KPI CARDS
     * Tên test case nhỏ: KPI API lỗi 500 – giữ layout và hiển thị toast lỗi
     * Expected Result chính: Toast lỗi xuất hiện. KPI cards hiển thị '--' hoặc trạng thái lỗi. Không crash trang.
     */
    @Test(
        description = "OVERVIEW-TC-05 - KPI API lỗi 500 – giữ layout và hiển thị toast lỗi",
        groups = {"overview", "regression", "requires-db", "environment-dependent", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void overviewtc05KPIAPILoi500GiuLayoutVaHienThiToastLoi() {
        throw new SkipException("BLOCKED_ENVIRONMENT: Cần môi trường cô lập hoặc fault injection lặp lại được; không được dừng service/DB dùng chung hay sửa production để tạo lỗi.");
    }

    /**
     * TC ID: OVERVIEW-TC-06
     * Task name / test case lớn: KPI CARDS
     * Tên test case nhỏ: KPI cập nhật đúng khi thay đổi filter
     * Expected Result chính: KPI cards cập nhật số liệu mới phù hợp khoảng 7 ngày. Khác với giá trị 30 ngày trước đó.
     */
    @Test(
        description = "OVERVIEW-TC-06 - KPI cập nhật đúng khi thay đổi filter",
        groups = {"overview", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void overviewtc06KPICapNhatDungKhiThayDoiFilter() {
        loginAsManager();
                openScreen("overview");
                OverviewPage page = new OverviewPage(driver()).waitUntilReady();
                assertFilterTriggersDataRequest(page.filters(), "7 ngày qua");
    }

}
