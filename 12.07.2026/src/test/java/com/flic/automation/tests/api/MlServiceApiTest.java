package com.flic.automation.tests.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.flic.automation.clients.ApiResponse;
import com.flic.automation.clients.MlClient;
import org.testng.Assert;
import org.testng.SkipException;
import org.testng.annotations.Test;

import java.util.List;
import java.util.Set;

public class MlServiceApiTest {
    private static final String REQUIREMENT_CONFIRMATION_REASON =
            "Expected Result của Excel xung đột với contract/source active; cần Product Owner xác nhận trước khi tự động hóa như một tiêu chí pass/fail.";
    private static final String NOT_APPLICABLE_REASON =
            "Control/endpoint/role được mô tả không tồn tại trong luồng active hiện tại.";
    private static final Set<String> SENTIMENT_LABELS = Set.of("positive", "neutral", "negative");

    private final MlClient mlClient = new MlClient();

    /**
     * TC ID: API-TC-20
     * Task name: ML SERVICE API
     * Tên test case nhỏ: GET /health (ML) trả status khi đang chạy
     * Expected Result chính: HTTP 200, status ok và modelLoaded=true.
     */
    @Test(
            description = "API-TC-20 - GET /health (ML) trả status khi đang chạy",
            groups = {"ml", "regression", "smoke", "api", "requires-ml", "requires-db"}
    )
    public void apitc20GETHealthMLTraStatusKhiDangChay() {
        ApiResponse response = mlClient.health();

        Assert.assertEquals(response.statusCode(), 200, response.body());
        JsonNode body = response.json();
        Assert.assertTrue(body.path("success").asBoolean());
        Assert.assertEquals(body.path("status").asText(), "ok");
        Assert.assertTrue(body.path("modelLoaded").asBoolean());
        Assert.assertFalse(body.path("modelName").asText("").isBlank());
        Assert.assertFalse(body.path("engine").asText("").isBlank());
    }

    /**
     * TC ID: API-TC-21
     * Task name: ML SERVICE API
     * Tên test case nhỏ: POST /predict câu tích cực – trả label positive
     * Expected Result chính: Model thật trả positive với confidence lớn hơn 0.5.
     */
    @Test(
            description = "API-TC-21 - POST /predict câu tích cực – trả label positive",
            groups = {"ml", "regression", "api", "requires-ml", "requires-db"}
    )
    public void apitc21POSTPredictCauTichCucTraLabelPositive() {
        String text = "Dịch vụ rất tốt";

        ApiResponse response = mlClient.predict(List.of(text));

        Assert.assertEquals(response.statusCode(), 200, response.body());
        JsonNode body = response.json();
        JsonNode result = firstPrediction(body);
        Assert.assertTrue(body.path("success").asBoolean());
        Assert.assertEquals(body.path("count").asInt(), 1);
        Assert.assertEquals(result.path("text").asText(), text);
        Assert.assertEquals(result.path("label").asText(), "positive");
        Assert.assertTrue(result.path("confidence").asDouble() > 0.5);
        assertProbabilityContract(result.path("probabilities"));
    }

    /**
     * TC ID: API-TC-22
     * Task name: ML SERVICE API
     * Tên test case nhỏ: POST /predict câu tiêu cực – trả label negative
     * Expected Result chính: Model thật trả negative với confidence lớn hơn 0.5.
     */
    @Test(
            description = "API-TC-22 - POST /predict câu tiêu cực – trả label negative",
            groups = {"ml", "regression", "api", "requires-ml", "requires-db"}
    )
    public void apitc22POSTPredictCauTieuCucTraLabelNegative() {
        String text = "Chất lượng quá tệ";

        ApiResponse response = mlClient.predict(List.of(text));

        Assert.assertEquals(response.statusCode(), 200, response.body());
        JsonNode body = response.json();
        JsonNode result = firstPrediction(body);
        Assert.assertTrue(body.path("success").asBoolean());
        Assert.assertEquals(body.path("count").asInt(), 1);
        Assert.assertEquals(result.path("text").asText(), text);
        Assert.assertEquals(result.path("label").asText(), "negative");
        Assert.assertTrue(result.path("confidence").asDouble() > 0.5);
        assertProbabilityContract(result.path("probabilities"));
    }

    /**
     * TC ID: API-TC-23
     * Task name: ML SERVICE API
     * Tên test case nhỏ: POST /predict với text rỗng – trả 422 validation
     * Expected Result chính: Excel yêu cầu 422 nhưng source texts=[""] trả neutral 200.
     * Trạng thái: NEEDS_REQUIREMENT_CONFIRMATION, không phải automated test.
     */
    @Test(
            description = "API-TC-23 - POST /predict với text rỗng – trả 422 validation",
            groups = {"ml", "regression", "api", "requires-ml", "requires-db"}
    )
    public void apitc23POSTPredictVoiTextRongTra422Validation() {
        throw new SkipException(REQUIREMENT_CONFIRMATION_REASON);
    }

    /**
     * TC ID: API-TC-24
     * Task name: ML SERVICE API
     * Tên test case nhỏ: POST /predict-ensemble – kết quả ensemble từ nhiều model
     * Expected Result chính: Response có final label/confidence và breakdown từng adapter.
     */
    @Test(
            description = "API-TC-24 - POST /predict-ensemble – kết quả ensemble từ nhiều model",
            groups = {"ml", "regression", "api", "requires-ml", "requires-db"}
    )
    public void apitc24POSTPredictEnsembleKetQuaEnsembleTuNhieuModel() {
        String text = "Sản phẩm ổn";

        ApiResponse response = mlClient.predictEnsemble(List.of(text));

        Assert.assertEquals(response.statusCode(), 200, response.body());
        JsonNode body = response.json();
        JsonNode result = firstPrediction(body);
        JsonNode finalResult = result.path("final");
        Assert.assertTrue(body.path("success").asBoolean());
        Assert.assertEquals(body.path("count").asInt(), 1);
        Assert.assertEquals(result.path("text").asText(), text);
        Assert.assertTrue(SENTIMENT_LABELS.contains(finalResult.path("label").asText()));
        Assert.assertTrue(finalResult.path("confidence").isNumber());
        Assert.assertTrue(result.path("rule").isObject());
        Assert.assertTrue(result.path("phobert").isObject());
        Assert.assertTrue(result.path("visobert").isObject());
        Assert.assertFalse(result.path("analyzerVersion").asText("").isBlank());
        Assert.assertFalse(result.path("actualAnalyzerVersion").asText("").isBlank());
    }

    /**
     * TC ID: API-TC-25
     * Task name: ML SERVICE API
     * Tên test case nhỏ: ML Service timeout – backend xử lý graceful fallback
     * Expected Result chính: Active public API phải trả 408/504 mà không treo, nhưng endpoint backend không tồn tại.
     * Trạng thái: NOT_APPLICABLE, không phải automated test.
     */
    @Test(
            description = "API-TC-25 - ML Service timeout – backend xử lý graceful fallback",
            groups = {"ml", "regression", "api", "requires-ml", "requires-db"}
    )
    public void apitc25MLServiceTimeoutBackendXuLyGracefulFallback() {
        throw new SkipException(NOT_APPLICABLE_REASON);
    }

    private static JsonNode firstPrediction(JsonNode body) {
        JsonNode results = body.path("results");
        Assert.assertTrue(results.isArray(), "results phải là array.");
        Assert.assertEquals(results.size(), 1, "Batch một text phải trả đúng một result.");
        return results.get(0);
    }

    private static void assertProbabilityContract(JsonNode probabilities) {
        Assert.assertTrue(probabilities.isObject());
        double positive = probabilities.path("positive").asDouble(-1);
        double neutral = probabilities.path("neutral").asDouble(-1);
        double negative = probabilities.path("negative").asDouble(-1);
        Assert.assertTrue(positive >= 0 && neutral >= 0 && negative >= 0);
        Assert.assertEquals(positive + neutral + negative, 1.0, 0.001);
    }
}
