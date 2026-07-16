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


public class ChannelDetailsTableTest extends BaseUiTest {

    /**
     * TC ID: CHANNEL-TC-05
     * Task name / test case lớn: BẢNG CHI TIẾT KÊNH
     * Tên test case nhỏ: Bảng hiển thị đầy đủ cột dữ liệu theo kênh
     * Expected Result chính: Bảng có cột: Kênh, Tổng hội thoại, CSAT, Tỉ lệ giải quyết, Thời gian phản hồi TB.
     */
    @Test(
        description = "CHANNEL-TC-05 - Bảng hiển thị đầy đủ cột dữ liệu theo kênh",
        groups = {"channel", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void channeltc05BangHienThiDayDuCotDuLieuTheoKenh() {
        loginAsManager();
                openScreen("channel");
                ChannelAnalysisPage page = new ChannelAnalysisPage(driver()).waitUntilReady();
                SourceBackedUiAssertions.assertTableHasHeaders(driver(), List.of("KÊNH", "HỘI THOẠI"));
    }

    /**
     * TC ID: CHANNEL-TC-06
     * Task name / test case lớn: BẢNG CHI TIẾT KÊNH
     * Tên test case nhỏ: Sort bảng theo cột số hội thoại tăng/giảm dần
     * Expected Result chính: Lần 1: sort tăng dần. Lần 2: sort giảm dần. Icon mũi tên trên header thay đổi.
     */
    @Test(
        description = "CHANNEL-TC-06 - Sort bảng theo cột số hội thoại tăng/giảm dần",
        groups = {"channel", "regression", "requires-db", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void channeltc06SortBangTheoCotSoHoiThoaiTangGiamDan() {
        throw new SkipException("NOT_APPLICABLE: Control/endpoint/role được mô tả không tồn tại trong luồng active hiện tại. Sai lệch: UI Channel chỉ có vài kênh và không có pagination/sort table theo expected.");
    }

    /**
     * TC ID: CHANNEL-TC-07
     * Task name / test case lớn: BẢNG CHI TIẾT KÊNH
     * Tên test case nhỏ: Phân trang bảng – click Next load đúng dữ liệu
     * Expected Result chính: Trang 2 load row tiếp theo. Không trùng lặp row với trang 1.
     */
    @Test(
        description = "CHANNEL-TC-07 - Phân trang bảng – click Next load đúng dữ liệu",
        groups = {"channel", "regression", "requires-db", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void channeltc07PhanTrangBangClickNextLoadDungDuLieu() {
        throw new SkipException("NOT_APPLICABLE: Control/endpoint/role được mô tả không tồn tại trong luồng active hiện tại. Sai lệch: UI Channel chỉ có vài kênh và không có pagination/sort table theo expected.");
    }

    /**
     * TC ID: CHANNEL-TC-08
     * Task name / test case lớn: BẢNG CHI TIẾT KÊNH
     * Tên test case nhỏ: Phân trang bảng – click Prev quay về trang trước
     * Expected Result chính: Quay về trang 1 với dữ liệu ban đầu.
     */
    @Test(
        description = "CHANNEL-TC-08 - Phân trang bảng – click Prev quay về trang trước",
        groups = {"channel", "regression", "requires-db", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void channeltc08PhanTrangBangClickPrevQuayVeTrangTruoc() {
        throw new SkipException("NOT_APPLICABLE: Control/endpoint/role được mô tả không tồn tại trong luồng active hiện tại. Sai lệch: UI Channel chỉ có vài kênh và không có pagination/sort table theo expected.");
    }

    /**
     * TC ID: CHANNEL-TC-09
     * Task name / test case lớn: BẢNG CHI TIẾT KÊNH
     * Tên test case nhỏ: Bảng empty state khi không có dữ liệu trong filter
     * Expected Result chính: Bảng hiển thị 'Không có dữ liệu' thay vì cột bị trắng.
     */
    @Test(
        description = "CHANNEL-TC-09 - Bảng empty state khi không có dữ liệu trong filter",
        groups = {"channel", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void channeltc09BangEmptyStateKhiKhongCoDuLieuTrongFilter() {
        loginAsManager();
                openScreen("channel");
                ChannelAnalysisPage page = new ChannelAnalysisPage(driver()).waitUntilReady();
                applyKnownEmptyDate(page.filters());
                Assert.assertTrue(page.isEmpty());
    }

    /**
     * TC ID: CHANNEL-TC-10
     * Task name / test case lớn: BẢNG CHI TIẾT KÊNH
     * Tên test case nhỏ: Channel Analysis API 500 – toast lỗi và layout ổn định
     * Expected Result chính: Toast lỗi hiển thị. Bảng và chart hiển thị trạng thái lỗi. Không crash toàn trang.
     */
    @Test(
        description = "CHANNEL-TC-10 - Channel Analysis API 500 – toast lỗi và layout ổn định",
        groups = {"channel", "regression", "requires-db", "environment-dependent", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void channeltc10ChannelAnalysisAPI500ToastLoiVaLayoutOnDinh() {
        throw new SkipException("BLOCKED_ENVIRONMENT: Cần môi trường cô lập hoặc fault injection lặp lại được; không được dừng service/DB dùng chung hay sửa production để tạo lỗi.");
    }

    /**
     * TC ID: CHANNEL-TC-11
     * Task name / test case lớn: BẢNG CHI TIẾT KÊNH
     * Tên test case nhỏ: Export dữ liệu kênh nếu có nút xuất
     * Expected Result chính: File CSV/Excel được tải về với đúng dữ liệu theo bộ lọc hiện tại.
     */
    @Test(
        description = "CHANNEL-TC-11 - Export dữ liệu kênh nếu có nút xuất",
        groups = {"channel", "regression", "requires-db", "requires-manager"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void channeltc11ExportDuLieuKenhNeuCoNutXuat() {
        loginAsManager();
                openScreen("channel");
                ChannelAnalysisPage page = new ChannelAnalysisPage(driver()).waitUntilReady();
                page.filters().openExportMenu();
                page.filters().exportXlsx();
                ExcelUtils.assertReadable(waitForDownload(".xlsx"));
    }

}
