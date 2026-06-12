# Báo cáo triển khai Sentiment Proxy + Independent Issue Detection

Ngày thực hiện: 2026-06-10

Trạng thái module giữ nguyên: `PASS_WITH_MONITORING`.

## 1. Files đã sửa/thêm

- `backend/services/ai-sentiment.service.js`
- `backend/controllers/analytics.controller.js`
- `backend/tests/dashboard.api.test.js`
- `backend/tests/sentiment-proxy.service.test.js`
- `ml-service/tests/test_issue_detector.py`
- `ml-service/tests/test_ensemble_api.py`
- `ml-service/tests/test_visobert_fallback.py`

## 2. API mới/được chuẩn hóa

- `POST /api/sentiment/predict`
- `GET /api/health/ml`

Hai route này đang được gắn qua Express Gateway hiện tại. Không tạo `backend-fastapi/` và không xóa Node.js backend.

## 3. Cách `/api/sentiment/predict` hoạt động

Luồng xử lý:

```text
Frontend
-> Express Gateway
-> ml-service POST /predict-ensemble
-> Express normalize response
-> Frontend
```

Response chuẩn hóa gồm:

- `sentiment.label`
- `sentiment.confidence`
- `issue.issueFlag`
- `issue.issueType`
- `issue.issueReason`
- `issue.issueConfidence`
- `needStaffReview`
- `analyzerVersion`
- `actualAnalyzerVersion`

Endpoint này luôn ưu tiên `/predict-ensemble`, không dùng `/predict` cho dashboard workflow cần issue metadata.

Nếu ml-service lỗi hoặc model chưa load, response fallback có các trường rõ ràng:

- `source: "fallback"`
- `fallbackSource: "backend-rule-based"`
- `fallbackReason`
- `analyzerVersion: "rule-based-fallback-v1"`

## 4. Cách `/api/health/ml` hoạt động

Luồng xử lý:

```text
Frontend
-> Express Gateway
-> ml-service GET /health
-> Express normalize runtime status
-> Frontend
```

Response chuẩn hóa gồm:

- `status`
- `mlServiceReachable`
- `sentimentMode`
- `phobertAvailable`
- `visobertAvailable`
- `visobertError`
- `activeAnalyzerVersion`
- `actualAnalyzerVersion`
- `issueDetectorAvailable`
- `visobertStatus`
- `visobertNote`

Nếu ViSoBERT không active, response nêu rõ ViSoBERT vẫn là experimental và không phải production runtime.

## 5. Kết quả test ml-service

Lệnh:

```bash
cd ml-service
python -m pytest tests -q
```

Kết quả:

```text
56 passed in 1.06s
```

## 6. Kết quả test backend

Lệnh:

```bash
cd backend
npm test
```

Kết quả:

```text
12 passed test suites
238 passed tests
```

## 7. Manual API validation

Đã chạy tạm:

- ml-service: `http://127.0.0.1:8001`
- backend: `http://localhost:5000`

Kết quả tóm tắt:

| Endpoint | Kết quả |
|---|---|
| `GET /api/health/ml` | 200, `status=model_not_loaded`, `mlServiceReachable=true`, `actualAnalyzerVersion=ensemble-phobert-rule-v1` |
| `POST /api/sentiment/predict` | 200, `sentiment=neutral`, `issueFlag=true`, `needStaffReview=true`, fallback rõ ràng |
| `GET /api/analytics/sentiment-summary` | 200, total = 20,183 |
| `GET /api/analytics/sentiment-trend` | 200, 218 ngày, từ 2025-10-12 đến 2026-05-17 |
| `GET /api/analytics/need-review-conversations?page=1&pageSize=1` | 200, total = 299, canonical |
| `GET /api/analytics/need-review-keywords` | 200, 45 keywords, top keyword = `rot` |

Manual predict dùng fallback vì ml-service reachable nhưng model chưa load.

## 8. Trạng thái ViSoBERT thực tế

Kết quả `/api/health/ml` khi validate:

```json
{
  "status": "model_not_loaded",
  "mlServiceReachable": true,
  "phobertAvailable": false,
  "visobertAvailable": false,
  "visobertError": "No module named 'transformers'",
  "actualAnalyzerVersion": "ensemble-phobert-rule-v1"
}
```

Kết luận: ViSoBERT chưa active, vẫn experimental, không production-approved.

## 9. Việc không làm

- Không chạy production migration.
- Không reprocess DB.
- Không overwrite dữ liệu production.
- Không xóa endpoint cũ.
- Không tạo `backend-fastapi/`.
- Không xóa Node.js backend.
- Không claim full PASS.
- Không claim automation-ready.
- Không claim ViSoBERT production.

## 10. Rủi ro còn lại

- Runtime hiện tại thiếu `transformers`, làm PhoBERT/ViSoBERT model không load trong manual validation.
- `POST /api/sentiment/predict` hoạt động an toàn nhờ fallback, nhưng kết quả này không phải ML success.
- Dữ liệu production cũ có thể chưa có issue metadata đầy đủ nếu migration/reprocess chưa được duyệt.
- IssueDetector vẫn là rule/pattern-based, cần monitoring false positive/false negative với slang mới.

## 11. Khuyến nghị tiếp theo

1. Cài đúng dependency/runtime cho ml-service rồi kiểm lại `/health`.
2. Chỉ xem ViSoBERT là active nếu `/health` trả `visobertAvailable=true`.
3. Giữ trạng thái `PASS_WITH_MONITORING` cho dashboard và hàng đợi Need Staff Review.
4. Sau khi migration được duyệt, chạy dry-run trước khi reprocess dữ liệu production.
