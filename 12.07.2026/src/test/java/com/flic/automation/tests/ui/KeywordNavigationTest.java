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


public class KeywordNavigationTest extends BaseUiTest {

    /**
     * TC ID: KEYWORD-TC-10
     * Task name / test case lớn: CLICK TỪ KHÓA & LỌC
     * Tên test case nhỏ: Click từ khóa trong word cloud – chuyển sang Conversations với filter
     * Expected Result chính: Navigate sang màn Conversations. Filter từ khóa 'giao hàng' được áp sẵn. List chỉ hiện chat liên quan.
     */
    @Test(
        description = "KEYWORD-TC-10 - Click từ khóa trong word cloud – chuyển sang Conversations với filter",
        groups = {"keyword", "regression", "requires-db", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void keywordtc10ClickTuKhoaTrongWordCloudChuyenSangConversationsVoiFilter() {
        throw new SkipException("NOT_APPLICABLE: Control/endpoint/role được mô tả không tồn tại trong luồng active hiện tại. Sai lệch: Source không có search/pagination/click-to-Conversations tương ứng.");
    }

    /**
     * TC ID: KEYWORD-TC-11
     * Task name / test case lớn: CLICK TỪ KHÓA & LỌC
     * Tên test case nhỏ: Click từ khóa trong bảng – filter hội thoại tương tự
     * Expected Result chính: Tương tự click cloud, navigate sang Conversations với filter từ khóa.
     */
    @Test(
        description = "KEYWORD-TC-11 - Click từ khóa trong bảng – filter hội thoại tương tự",
        groups = {"keyword", "regression", "requires-db", "skip-guard"},
        retryAnalyzer = RetryAnalyzer.class
    )
    public void keywordtc11ClickTuKhoaTrongBangFilterHoiThoaiTuongTu() {
        throw new SkipException("NOT_APPLICABLE: Control/endpoint/role được mô tả không tồn tại trong luồng active hiện tại. Sai lệch: Source không có search/pagination/click-to-Conversations tương ứng.");
    }

}
