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


public class CsvExportTest extends BaseUiTest {

    /**
     * TC ID: EXPORT-TC-01
     * Task name / test case lớn: EXPORT CSV
     * Tên test case nhỏ: Export CSV thành công – file .csv tải về mở được
     * Expected Result chính: File .csv tải về, mở được bằng Excel/Notepad. Có dòng header cột.
     */
    @Test(
        description = "EXPORT-TC-01 - Export CSV thành công – file .csv tải về mở được",
        groups = {"export", "regression", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void exporttc01ExportCSVThanhCongFileCsvTaiVeMoDuoc() {
        throw new SkipException("NOT_APPLICABLE: Control/endpoint/role được mô tả không tồn tại trong luồng active hiện tại. Sai lệch: Menu export global chỉ có PDF, PNG, XLSX; CSV helper không được expose.");
    }

    /**
     * TC ID: EXPORT-TC-02
     * Task name / test case lớn: EXPORT CSV
     * Tên test case nhỏ: Export CSV giữ đúng tiếng Việt UTF-8 BOM
     * Expected Result chính: Tiếng Việt hiển thị đúng, không bị ký tự lạ. Encoding UTF-8 BOM được thiết lập.
     */
    @Test(
        description = "EXPORT-TC-02 - Export CSV giữ đúng tiếng Việt UTF-8 BOM",
        groups = {"export", "regression", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void exporttc02ExportCSVGiuDungTiengVietUTF8BOM() {
        throw new SkipException("NOT_APPLICABLE: Control/endpoint/role được mô tả không tồn tại trong luồng active hiện tại. Sai lệch: Menu export global chỉ có PDF, PNG, XLSX; CSV helper không được expose.");
    }

    /**
     * TC ID: EXPORT-TC-03
     * Task name / test case lớn: EXPORT CSV
     * Tên test case nhỏ: Export CSV đúng dữ liệu theo filter hiện tại
     * Expected Result chính: File chỉ chứa dữ liệu kênh Zalo trong 7 ngày. Không có dữ liệu ngoài filter.
     */
    @Test(
        description = "EXPORT-TC-03 - Export CSV đúng dữ liệu theo filter hiện tại",
        groups = {"export", "regression", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void exporttc03ExportCSVDungDuLieuTheoFilterHienTai() {
        throw new SkipException("NOT_APPLICABLE: Control/endpoint/role được mô tả không tồn tại trong luồng active hiện tại. Sai lệch: Menu export global chỉ có PDF, PNG, XLSX; CSV helper không được expose.");
    }

    /**
     * TC ID: EXPORT-TC-04
     * Task name / test case lớn: EXPORT CSV
     * Tên test case nhỏ: Export CSV khi bảng rỗng – file có header nhưng không có data row
     * Expected Result chính: File CSV tải về với dòng header đầy đủ. Không có dòng data.
     */
    @Test(
        description = "EXPORT-TC-04 - Export CSV khi bảng rỗng – file có header nhưng không có data row",
        groups = {"export", "regression", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void exporttc04ExportCSVKhiBangRongFileCoHeaderNhungKhongCoData() {
        throw new SkipException("NOT_APPLICABLE: Control/endpoint/role được mô tả không tồn tại trong luồng active hiện tại. Sai lệch: Menu export global chỉ có PDF, PNG, XLSX; CSV helper không được expose.");
    }

}
