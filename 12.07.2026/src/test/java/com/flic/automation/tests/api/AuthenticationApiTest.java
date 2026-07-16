package com.flic.automation.tests.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.flic.automation.clients.ApiClient;
import com.flic.automation.clients.ApiResponse;
import com.flic.automation.config.ConfigManager;
import org.testng.Assert;
import org.testng.SkipException;
import org.testng.annotations.Test;

import java.util.UUID;

public class AuthenticationApiTest {
    private static final String REQUIREMENT_CONFIRMATION_REASON =
            "Expected Result của Excel xung đột với contract/source active; cần Product Owner xác nhận trước khi tự động hóa như một tiêu chí pass/fail.";
    private static final String ENVIRONMENT_BLOCK_REASON =
            "Cần môi trường cô lập hoặc fault injection lặp lại được; không được dừng service/DB dùng chung hay sửa production để tạo lỗi.";
    private static final String TEST_DATA_REASON =
            "Có thể tự động hóa nhưng cần credential/fixture DB hoặc record định danh chưa được cung cấp.";

    private final ConfigManager config = ConfigManager.getInstance();
    private final ApiClient apiClient = new ApiClient();

    /**
     * TC ID: API-TC-05
     * Task name: AUTH API
     * Tên test case nhỏ: POST /api/auth/login credentials đúng – trả JWT token
     * Expected Result chính: Excel yêu cầu email/JWT, trong khi source dùng username/HMAC bearer.
     * Trạng thái: NEEDS_REQUIREMENT_CONFIRMATION, không phải automated test.
     */
    @Test(
            description = "API-TC-05 - POST /api/auth/login credentials đúng – trả JWT token",
            groups = {"api", "regression", "requires-db"}
    )
    public void apitc05POSTApiAuthLoginCredentialsDungTraJWTToken() {
        throw new SkipException(REQUIREMENT_CONFIRMATION_REASON);
    }

    /**
     * TC ID: API-TC-06
     * Task name: AUTH API
     * Tên test case nhỏ: POST /api/auth/login credentials sai – trả 401
     * Expected Result chính: HTTP 401 và thông báo lỗi rõ ràng, không phát hành token.
     */
    @Test(
            description = "API-TC-06 - POST /api/auth/login credentials sai – trả 401",
            groups = {"api", "regression", "requires-db"}
    )
    public void apitc06POSTApiAuthLoginCredentialsSaiTra401() {
        String username = requiredValue(config.managerUsername());
        String deliberatelyWrongPassword = "AUTO_API_TC_06_" + UUID.randomUUID();

        ApiResponse response = apiClient.login(username, deliberatelyWrongPassword);

        Assert.assertEquals(response.statusCode(), 401);
        JsonNode body = response.json();
        Assert.assertFalse(body.path("success").asBoolean(true));
        Assert.assertFalse(body.path("message").asText("").isBlank());
        Assert.assertTrue(body.path("data").isMissingNode() || body.path("data").isNull());
    }

    /**
     * TC ID: API-TC-07
     * Task name: AUTH API
     * Tên test case nhỏ: Gọi API protected không có Authorization header – trả 401
     * Expected Result chính: Excel yêu cầu /api/dashboard/kpi trả 401 nhưng route source đang public.
     * Trạng thái: NEEDS_REQUIREMENT_CONFIRMATION, không phải automated test.
     */
    @Test(
            description = "API-TC-07 - Gọi API protected không có Authorization header – trả 401",
            groups = {"api", "regression", "requires-db"}
    )
    public void apitc07GoiAPIProtectedKhongCoAuthorizationHeaderTra401() {
        throw new SkipException(REQUIREMENT_CONFIRMATION_REASON);
    }

    /**
     * TC ID: API-TC-08
     * Task name: AUTH API
     * Tên test case nhỏ: Gọi API protected với token hết hạn – trả 401
     * Expected Result chính: HMAC bearer đã hết hạn bị từ chối bằng HTTP 401.
     * Trạng thái: BLOCKED_ENVIRONMENT, không phải automated test.
     */
    @Test(
            description = "API-TC-08 - Gọi API protected với token hết hạn – trả 401",
            groups = {"api", "regression", "requires-db", "environment-dependent"}
    )
    public void apitc08GoiAPIProtectedVoiTokenHetHanTra401() {
        throw new SkipException(ENVIRONMENT_BLOCK_REASON);
    }

    /**
     * TC ID: API-TC-09
     * Task name: AUTH API
     * Tên test case nhỏ: Gọi API protected với token giả mạo – trả 401
     * Expected Result chính: Tampered bearer bị từ chối bằng 401, không trả 200 hoặc 500.
     */
    @Test(
            description = "API-TC-09 - Gọi API protected với token giả mạo – trả 401",
            groups = {"api", "regression", "smoke", "requires-db"}
    )
    public void apitc09GoiAPIProtectedVoiTokenGiaMaoTra401() {
        ApiResponse response = apiClient.get("/api/conversations", "fake.token.here");

        Assert.assertEquals(response.statusCode(), 401);
        JsonNode body = response.json();
        Assert.assertFalse(body.path("success").asBoolean(true));
        Assert.assertFalse(body.path("message").asText("").isBlank());
        Assert.assertTrue(body.path("data").isNull());
    }

    private String requiredValue(Object configuredValue) {
        String value = configuredValue == null ? "" : configuredValue.toString().trim();
        if (value.isEmpty() || "null".equalsIgnoreCase(value)) {
            throw new SkipException(TEST_DATA_REASON);
        }
        return value;
    }
}
