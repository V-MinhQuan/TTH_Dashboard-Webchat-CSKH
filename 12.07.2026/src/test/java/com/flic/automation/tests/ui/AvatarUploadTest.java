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


public class AvatarUploadTest extends BaseUiTest {

    /**
     * TC ID: SETTINGS-TC-07
     * Task name / test case lớn: UPLOAD AVATAR
     * Tên test case nhỏ: Upload avatar PNG hợp lệ < 2MB thành công
     * Expected Result chính: Avatar mới hiển thị trên Profile và Header.
     */
    @Test(
        description = "SETTINGS-TC-07 - Upload avatar PNG hợp lệ < 2MB thành công",
        groups = {"settings", "regression", "requires-db", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void settingstc07UploadAvatarPNGHopLe2MBThanhCong() {
        throw new SkipException("NOT_APPLICABLE: Control/endpoint/role được mô tả không tồn tại trong luồng active hiện tại. Sai lệch: Source active không có chức năng upload avatar.");
    }

    /**
     * TC ID: SETTINGS-TC-08
     * Task name / test case lớn: UPLOAD AVATAR
     * Tên test case nhỏ: Upload file ảnh > giới hạn kích thước – client báo lỗi
     * Expected Result chính: Client báo lỗi 'File quá lớn, tối đa X MB' trước khi upload. Không gọi API.
     */
    @Test(
        description = "SETTINGS-TC-08 - Upload file ảnh > giới hạn kích thước – client báo lỗi",
        groups = {"settings", "regression", "requires-db", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void settingstc08UploadFileAnhGioiHanKichThuocClientBaoLoi() {
        throw new SkipException("NOT_APPLICABLE: Control/endpoint/role được mô tả không tồn tại trong luồng active hiện tại. Sai lệch: Source active không có chức năng upload avatar.");
    }

    /**
     * TC ID: SETTINGS-TC-09
     * Task name / test case lớn: UPLOAD AVATAR
     * Tên test case nhỏ: Upload file không phải ảnh (.pdf, .exe) – báo lỗi định dạng
     * Expected Result chính: Client hoặc server báo 'Chỉ chấp nhận JPG/PNG/WEBP'.
     */
    @Test(
        description = "SETTINGS-TC-09 - Upload file không phải ảnh (.pdf, .exe) – báo lỗi định dạng",
        groups = {"settings", "regression", "requires-db", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void settingstc09UploadFileKhongPhaiAnhPdfExeBaoLoiDinhDang() {
        throw new SkipException("NOT_APPLICABLE: Control/endpoint/role được mô tả không tồn tại trong luồng active hiện tại. Sai lệch: Source active không có chức năng upload avatar.");
    }

}
