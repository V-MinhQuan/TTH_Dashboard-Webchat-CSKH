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


public class KeywordSearchTest extends BaseUiTest {

    /**
     * TC ID: KEYWORD-TC-06
     * Task name / test case lớn: TÌM KIẾM TỪ KHÓA
     * Tên test case nhỏ: Nhập text vào ô search – bảng lọc theo từ khóa chứa text
     * Expected Result chính: Bảng chỉ hiển thị các từ khóa chứa 'giao hàng'. Debounce ~300ms.
     */
    @Test(
        description = "KEYWORD-TC-06 - Nhập text vào ô search – bảng lọc theo từ khóa chứa text",
        groups = {"keyword", "regression", "requires-db", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void keywordtc06NhapTextVaoOSearchBangLocTheoTuKhoaChuaText() {
        throw new SkipException("NOT_APPLICABLE: Control/endpoint/role được mô tả không tồn tại trong luồng active hiện tại. Sai lệch: Source không có search/pagination/click-to-Conversations tương ứng.");
    }

    /**
     * TC ID: KEYWORD-TC-07
     * Task name / test case lớn: TÌM KIẾM TỪ KHÓA
     * Tên test case nhỏ: Tìm kiếm không có kết quả – hiển thị empty state tìm kiếm
     * Expected Result chính: Bảng hiển thị 'Không tìm thấy từ khóa phù hợp'.
     */
    @Test(
        description = "KEYWORD-TC-07 - Tìm kiếm không có kết quả – hiển thị empty state tìm kiếm",
        groups = {"keyword", "regression", "requires-db", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void keywordtc07TimKiemKhongCoKetQuaHienThiEmptyStateTimKiem() {
        throw new SkipException("NOT_APPLICABLE: Control/endpoint/role được mô tả không tồn tại trong luồng active hiện tại. Sai lệch: Source không có search/pagination/click-to-Conversations tương ứng.");
    }

    /**
     * TC ID: KEYWORD-TC-08
     * Task name / test case lớn: TÌM KIẾM TỪ KHÓA
     * Tên test case nhỏ: Xóa text search – bảng trở về đầy đủ danh sách
     * Expected Result chính: Bảng hiển thị lại đầy đủ list từ khóa.
     */
    @Test(
        description = "KEYWORD-TC-08 - Xóa text search – bảng trở về đầy đủ danh sách",
        groups = {"keyword", "regression", "requires-db", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void keywordtc08XoaTextSearchBangTroVeDayDuDanhSach() {
        throw new SkipException("NOT_APPLICABLE: Control/endpoint/role được mô tả không tồn tại trong luồng active hiện tại. Sai lệch: Source không có search/pagination/click-to-Conversations tương ứng.");
    }

    /**
     * TC ID: KEYWORD-TC-09
     * Task name / test case lớn: TÌM KIẾM TỪ KHÓA
     * Tên test case nhỏ: Tìm kiếm không case-sensitive
     * Expected Result chính: Bảng trả về từ khóa 'giao hàng' (lowercase). Search hoạt động không phân biệt hoa/thường.
     */
    @Test(
        description = "KEYWORD-TC-09 - Tìm kiếm không case-sensitive",
        groups = {"keyword", "regression", "requires-db", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void keywordtc09TimKiemKhongCaseSensitive() {
        throw new SkipException("NOT_APPLICABLE: Control/endpoint/role được mô tả không tồn tại trong luồng active hiện tại. Sai lệch: Source không có search/pagination/click-to-Conversations tương ứng.");
    }

}
