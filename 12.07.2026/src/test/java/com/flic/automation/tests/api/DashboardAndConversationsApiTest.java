package com.flic.automation.tests.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.flic.automation.clients.ApiClient;
import com.flic.automation.clients.ApiResponse;
import com.flic.automation.config.ConfigManager;
import org.testng.Assert;
import org.testng.SkipException;
import org.testng.annotations.Test;

public class DashboardAndConversationsApiTest {
    private static final String REQUIREMENT_CONFIRMATION_REASON =
            "Expected Result của Excel xung đột với contract/source active; cần Product Owner xác nhận trước khi tự động hóa như một tiêu chí pass/fail.";
    private static final String TEST_DATA_REASON =
            "Có thể tự động hóa nhưng cần credential/fixture DB hoặc record định danh chưa được cung cấp.";

    private final ConfigManager config = ConfigManager.getInstance();
    private final ApiClient apiClient = new ApiClient();

    /**
     * TC ID: API-TC-10
     * Task name: DASHBOARD & ANALYTICS API
     * Tên test case nhỏ: GET /api/dashboard/kpi trả đúng cấu trúc data
     * Expected Result chính: Excel yêu cầu csat/resolutionRate nhưng response source không có hai field này.
     * Trạng thái: NEEDS_REQUIREMENT_CONFIRMATION, không phải automated test.
     */
    @Test(
            description = "API-TC-10 - GET /api/dashboard/kpi trả đúng cấu trúc data",
            groups = {"api", "regression", "requires-db"}
    )
    public void apitc10GETApiDashboardKpiTraDungCauTrucData() {
        throw new SkipException(REQUIREMENT_CONFIRMATION_REASON);
    }

    /**
     * TC ID: API-TC-11
     * Task name: DASHBOARD & ANALYTICS API
     * Tên test case nhỏ: GET /api/analytics/sentiment-summary trả tỉ lệ cảm xúc
     * Expected Result chính: Excel yêu cầu percentage fields nhưng source trả counts.
     * Trạng thái: NEEDS_REQUIREMENT_CONFIRMATION, không phải automated test.
     */
    @Test(
            description = "API-TC-11 - GET /api/analytics/sentiment-summary trả tỉ lệ cảm xúc",
            groups = {"api", "regression", "requires-db"}
    )
    public void apitc11GETApiAnalyticsSentimentSummaryTraTiLeCamXuc() {
        throw new SkipException(REQUIREMENT_CONFIRMATION_REASON);
    }

    /**
     * TC ID: API-TC-12
     * Task name: DASHBOARD & ANALYTICS API
     * Tên test case nhỏ: GET /api/analytics/sentiment-trend trả dữ liệu theo ngày
     * Expected Result chính: Excel yêu cầu percentages theo ngày nhưng source trả counts theo ngày.
     * Trạng thái: NEEDS_REQUIREMENT_CONFIRMATION, không phải automated test.
     */
    @Test(
            description = "API-TC-12 - GET /api/analytics/sentiment-trend trả dữ liệu theo ngày",
            groups = {"api", "regression", "requires-db"}
    )
    public void apitc12GETApiAnalyticsSentimentTrendTraDuLieuTheoNgay() {
        throw new SkipException(REQUIREMENT_CONFIRMATION_REASON);
    }

    /**
     * TC ID: API-TC-13
     * Task name: DASHBOARD & ANALYTICS API
     * Tên test case nhỏ: GET /api/conversations trả danh sách hội thoại phân trang
     * Expected Result chính: HTTP 200, tối đa 10 records và metadata phân trang chính xác.
     */
    @Test(
            description = "API-TC-13 - GET /api/conversations trả danh sách hội thoại phân trang",
            groups = {"api", "regression", "requires-db"}
    )
    public void apitc13GETApiConversationsTraDanhSachHoiThoaiPhanTrang() {
        String token = authenticatedManagerToken();

        ApiResponse response = apiClient.get("/api/conversations?page=1&pageSize=10", token);

        Assert.assertEquals(response.statusCode(), 200);
        JsonNode data = response.json().path("data");
        JsonNode records = data.path("records");
        JsonNode pagination = data.path("pagination");
        Assert.assertTrue(records.isArray(), "data.records phải là array.");
        Assert.assertTrue(records.size() <= 10, "pageSize=10 không được trả quá 10 records.");
        Assert.assertEquals(pagination.path("page").asInt(), 1);
        Assert.assertEquals(pagination.path("pageSize").asInt(), 10);
        Assert.assertTrue(pagination.path("total").asLong() >= records.size());
    }

    /**
     * TC ID: API-TC-14
     * Task name: DASHBOARD & ANALYTICS API
     * Tên test case nhỏ: GET /api/conversations/{id} trả chi tiết 1 hội thoại
     * Expected Result chính: Conversation đúng ID và có messages array.
     */
    @Test(
            description = "API-TC-14 - GET /api/conversations/{id} trả chi tiết 1 hội thoại",
            groups = {"api", "regression", "requires-db"}
    )
    public void apitc14GETApiConversationsIdTraChiTiet1HoiThoai() {
        String conversationId = requiredValue(config.conversationId());
        String token = authenticatedManagerToken();

        ApiResponse response = apiClient.get("/api/conversations/" + conversationId, token);

        Assert.assertEquals(response.statusCode(), 200);
        JsonNode data = response.json().path("data");
        Assert.assertEquals(data.path("id").asText(), conversationId);
        Assert.assertTrue(data.path("messages").isArray(), "Conversation detail phải có messages array.");
    }

    /**
     * TC ID: API-TC-15
     * Task name: DASHBOARD & ANALYTICS API
     * Tên test case nhỏ: GET /api/conversations/{id} với ID không tồn tại – trả 404
     * Expected Result chính: HTTP 404 cùng response lỗi rõ ràng.
     */
    @Test(
            description = "API-TC-15 - GET /api/conversations/{id} với ID không tồn tại – trả 404",
            groups = {"api", "regression", "requires-db"}
    )
    public void apitc15GETApiConversationsIdVoiIDKhongTonTaiTra404() {
        String unknownConversationId = requiredValue(config.unknownConversationId());
        String token = authenticatedManagerToken();

        ApiResponse response = apiClient.get(
                "/api/conversations/" + unknownConversationId,
                token
        );

        Assert.assertEquals(response.statusCode(), 404);
        JsonNode body = response.json();
        Assert.assertFalse(body.path("success").asBoolean(true));
        Assert.assertFalse(body.path("message").asText("").isBlank());
        Assert.assertTrue(body.path("data").isNull());
    }

    private String authenticatedManagerToken() {
        String username = requiredValue(config.managerUsername());
        String password = requiredValue(config.managerPassword());
        ApiResponse login = apiClient.login(username, password);
        Assert.assertEquals(login.statusCode(), 200, "Không thể tạo authenticated API precondition.");
        return apiClient.accessToken(login);
    }

    private String requiredValue(Object configuredValue) {
        String value = configuredValue == null ? "" : configuredValue.toString().trim();
        if (value.isEmpty() || "null".equalsIgnoreCase(value)) {
            throw new SkipException(TEST_DATA_REASON);
        }
        return value;
    }
}
