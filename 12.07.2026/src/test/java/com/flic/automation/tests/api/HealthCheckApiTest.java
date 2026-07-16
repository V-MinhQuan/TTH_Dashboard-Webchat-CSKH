package com.flic.automation.tests.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.flic.automation.clients.ApiClient;
import com.flic.automation.clients.ApiResponse;
import org.testng.Assert;
import org.testng.SkipException;
import org.testng.annotations.Test;

public class HealthCheckApiTest {
    private static final String ENVIRONMENT_BLOCK_REASON =
            "Cần môi trường cô lập hoặc fault injection lặp lại được; không được dừng service/DB dùng chung hay sửa production để tạo lỗi.";

    private final ApiClient apiClient = new ApiClient();

    /**
     * TC ID: API-TC-01
     * Task name: HEALTH CHECK
     * Tên test case nhỏ: GET /api/health trả 200 khi tất cả service bình thường
     * Expected Result chính: HTTP 200 và trạng thái Database/ML đều connected.
     */
    @Test(
            description = "API-TC-01 - GET /api/health trả 200 khi tất cả service bình thường",
            groups = {"api", "regression", "smoke", "requires-db"}
    )
    public void apitc01GETApiHealthTra200KhiTatCaServiceBinhThuong() {
        ApiResponse response = apiClient.get("/api/health");

        Assert.assertEquals(
                response.statusCode(),
                200,
                "Backend phải trả 200 khi Database và ML đều sẵn sàng; source hiện có known defect connected/ok."
        );
        JsonNode body = response.json();
        Assert.assertTrue(body.path("success").asBoolean(), "Health response phải là ready.");
        Assert.assertEquals(body.path("database").asText(), "connected");
        Assert.assertEquals(body.path("mlService").asText(), "connected");
        Assert.assertEquals(body.at("/details/database/status").asText(), "connected");
        Assert.assertTrue(body.at("/details/ml/modelLoaded").asBoolean());
    }

    /**
     * TC ID: API-TC-02
     * Task name: HEALTH CHECK
     * Tên test case nhỏ: GET /api/health không trả false green khi DB tắt
     * Expected Result chính: HTTP 503 hoặc error và Database không được báo healthy giả.
     * Trạng thái: BLOCKED_ENVIRONMENT, không phải automated test.
     */
    @Test(
            description = "API-TC-02 - GET /api/health không trả false green khi DB tắt",
            groups = {"api", "regression", "requires-db", "environment-dependent"}
    )
    public void apitc02GETApiHealthKhongTraFalseGreenKhiDBTat() {
        throw new SkipException(ENVIRONMENT_BLOCK_REASON);
    }

    /**
     * TC ID: API-TC-03
     * Task name: HEALTH CHECK
     * Tên test case nhỏ: GET /api/health/ml trả đúng trạng thái ML
     * Expected Result chính: Phân biệt chính xác ML running và ML disconnected.
     * Trạng thái: BLOCKED_ENVIRONMENT, không phải automated test.
     */
    @Test(
            description = "API-TC-03 - GET /api/health/ml trả đúng trạng thái ML",
            groups = {"api", "regression", "requires-db", "environment-dependent"}
    )
    public void apitc03GETApiHealthMlTraDungTrangThaiML() {
        throw new SkipException(ENVIRONMENT_BLOCK_REASON);
    }

    /**
     * TC ID: API-TC-04
     * Task name: HEALTH CHECK
     * Tên test case nhỏ: GET /api/health response có field chi tiết (details.ml.modelLoaded)
     * Expected Result chính: details.ml.modelLoaded luôn có mặt và là boolean.
     */
    @Test(
            description = "API-TC-04 - GET /api/health response có field chi tiết (details.ml.modelLoaded)",
            groups = {"api", "regression", "smoke", "requires-db"}
    )
    public void apitc04GETApiHealthResponseCoFieldChiTietDetailsMlModelLoaded() {
        ApiResponse response = apiClient.get("/api/health");
        JsonNode modelLoaded = response.json().at("/details/ml/modelLoaded");

        Assert.assertFalse(modelLoaded.isMissingNode(), "Thiếu details.ml.modelLoaded.");
        Assert.assertTrue(modelLoaded.isBoolean(), "details.ml.modelLoaded phải là boolean.");
    }
}
