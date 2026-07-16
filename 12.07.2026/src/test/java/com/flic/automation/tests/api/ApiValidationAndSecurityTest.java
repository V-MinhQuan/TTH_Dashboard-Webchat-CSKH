package com.flic.automation.tests.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.flic.automation.clients.ApiClient;
import com.flic.automation.clients.ApiResponse;
import com.flic.automation.config.ConfigManager;
import org.testng.Assert;
import org.testng.SkipException;
import org.testng.annotations.Test;

import java.util.Map;

public class ApiValidationAndSecurityTest {
    private static final String NOT_APPLICABLE_REASON =
            "Control/endpoint/role được mô tả không tồn tại trong luồng active hiện tại.";
    private static final String ENVIRONMENT_BLOCK_REASON =
            "Cần môi trường cô lập hoặc fault injection lặp lại được; không được dừng service/DB dùng chung hay sửa production để tạo lỗi.";
    private static final String TEST_DATA_REASON =
            "Có thể tự động hóa nhưng cần credential/fixture DB hoặc record định danh chưa được cung cấp.";

    private final ConfigManager config = ConfigManager.getInstance();
    private final ApiClient apiClient = new ApiClient();

    /**
     * TC ID: API-TC-16
     * Task name: VALIDATION & ERROR HANDLING
     * Tên test case nhỏ: POST API với body rỗng – FastAPI trả 422 Unprocessable Entity
     * Expected Result chính: Route /api/analytics/run phải validate body, nhưng route không tồn tại.
     * Trạng thái: NOT_APPLICABLE, không phải automated test.
     */
    @Test(
            description = "API-TC-16 - POST API với body rỗng – FastAPI trả 422 Unprocessable Entity",
            groups = {"api", "regression", "requires-db"}
    )
    public void apitc16POSTAPIVoiBodyRongFastAPITra422UnprocessableEntity() {
        throw new SkipException(NOT_APPLICABLE_REASON);
    }

    /**
     * TC ID: API-TC-17
     * Task name: VALIDATION & ERROR HANDLING
     * Tên test case nhỏ: GET API với query param sai kiểu – trả 422
     * Expected Result chính: Query integer sai kiểu bị từ chối bằng detail array HTTP 422.
     */
    @Test(
            description = "API-TC-17 - GET API với query param sai kiểu – trả 422",
            groups = {"api", "regression", "requires-db"}
    )
    public void apitc17GETAPIVoiQueryParamSaiKieuTra422() {
        String token = authenticatedManagerToken();

        ApiResponse response = apiClient.get("/api/conversations?pageSize=abc", token);

        Assert.assertEquals(response.statusCode(), 422);
        JsonNode detail = response.json().path("detail");
        Assert.assertTrue(detail.isArray(), "FastAPI validation error phải trả detail array.");
        Assert.assertFalse(detail.isEmpty(), "detail phải mô tả query field bị lỗi.");
        Assert.assertTrue(detail.toString().contains("pageSize"));
        Assert.assertTrue(detail.toString().contains("int"));
    }

    /**
     * TC ID: API-TC-18
     * Task name: VALIDATION & ERROR HANDLING
     * Tên test case nhỏ: API 500 Server Error – không lộ stack trace ra response
     * Expected Result chính: Generic 500 không lộ SQL, path hoặc traceback.
     * Trạng thái: BLOCKED_ENVIRONMENT, không phải automated test.
     */
    @Test(
            description = "API-TC-18 - API 500 Server Error – không lộ stack trace ra response",
            groups = {"api", "regression", "requires-db", "environment-dependent"}
    )
    public void apitc18API500ServerErrorKhongLoStackTraceRaResponse() {
        throw new SkipException(ENVIRONMENT_BLOCK_REASON);
    }

    /**
     * TC ID: API-TC-19
     * Task name: VALIDATION & ERROR HANDLING
     * Tên test case nhỏ: API CORS – chỉ cho phép origin đã cấu hình
     * Expected Result chính: Preflight origin lạ bị từ chối và không có allow-origin header.
     */
    @Test(
            description = "API-TC-19 - API CORS – chỉ cho phép origin đã cấu hình",
            groups = {"api", "regression", "smoke", "requires-db"}
    )
    public void apitc19APICORSChiChoPhepOriginDaCauHinh() {
        ApiResponse response = apiClient.options(
                "/api/health",
                Map.of(
                        "Origin", "https://untrusted.example.invalid",
                        "Access-Control-Request-Method", "GET",
                        "Access-Control-Request-Headers", "Content-Type"
                )
        );

        Assert.assertEquals(response.statusCode(), 400);
        Assert.assertTrue(response.firstHeader("Access-Control-Allow-Origin").isEmpty());
        Assert.assertTrue(response.body().contains("Disallowed CORS origin"));
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
