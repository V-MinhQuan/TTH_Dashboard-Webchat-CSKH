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


public class SystemSettingsTest extends BaseUiTest {

    /**
     * TC ID: SETTINGS-TC-14
     * Task name / test case lớn: SETTINGS HỆ THỐNG
     * Tên test case nhỏ: Admin thay đổi cấu hình hệ thống và lưu thành công
     * Expected Result chính: API cập nhật thành công. Toast xanh. Config mới hiển thị khi vào lại Settings.
     */
    @Test(
        description = "SETTINGS-TC-14 - Admin thay đổi cấu hình hệ thống và lưu thành công",
        groups = {"settings", "regression", "requires-db", "skip-guard", "destructive"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void settingstc14AdminThayDoiCauHinhHeThongVaLuuThanhCong() {
        throw new SkipException("NEEDS_REQUIREMENT_CONFIRMATION: Expected Result của Excel xung đột với contract/source active; cần Product Owner xác nhận trước khi tự động hóa như một tiêu chí pass/fail. Sai lệch: Frontend chỉ có manager/staff; Admin được map về manager.");
    }

    /**
     * TC ID: SETTINGS-TC-15
     * Task name / test case lớn: SETTINGS HỆ THỐNG
     * Tên test case nhỏ: Non-Admin truy cập Settings hệ thống bị chặn
     * Expected Result chính: Redirect hoặc 403. Không hiển thị form cài đặt.
     */
    @Test(
        description = "SETTINGS-TC-15 - Non-Admin truy cập Settings hệ thống bị chặn",
        groups = {"settings", "regression", "requires-db", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void settingstc15NonAdminTruyCapSettingsHeThongBiChan() {
        throw new SkipException("NEEDS_REQUIREMENT_CONFIRMATION: Expected Result của Excel xung đột với contract/source active; cần Product Owner xác nhận trước khi tự động hóa như một tiêu chí pass/fail. Sai lệch: Frontend chỉ có manager/staff; Admin được map về manager.");
    }

    /**
     * TC ID: SETTINGS-TC-16
     * Task name / test case lớn: SETTINGS HỆ THỐNG
     * Tên test case nhỏ: Settings form validation – trường bắt buộc
     * Expected Result chính: Form báo lỗi trường bắt buộc. Không gọi API.
     */
    @Test(
        description = "SETTINGS-TC-16 - Settings form validation – trường bắt buộc",
        groups = {"settings", "regression", "requires-db", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void settingstc16SettingsFormValidationTruongBatBuoc() {
        throw new SkipException("NEEDS_REQUIREMENT_CONFIRMATION: Expected Result của Excel xung đột với contract/source active; cần Product Owner xác nhận trước khi tự động hóa như một tiêu chí pass/fail. Sai lệch: Frontend chỉ có manager/staff; Admin được map về manager.");
    }

}
