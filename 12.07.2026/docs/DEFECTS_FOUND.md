# DEFECTS FOUND

Đây là defect log từ source inspection và automation execution ngày 2026-07-12. `API-TC-01` đã tái hiện defect health bằng TestNG; các TC Skip/Ignored không được suy diễn thành defect.

## FLIC-BUG-AUTO-001 — Health endpoint trả 503 dù DB và ML đều reported connected

| Trường | Giá trị |
|---|---|
| Severity | Major |
| Priority | P1 |
| Status | Open |
| Module | Backend API / Health |
| Environment | Windows; branch `main`; commit `8a4f805119fa58f1dc368fc4dde7f9e94ef296a8`; backend `127.0.0.1:5000`; ML `127.0.0.1:8001` |
| Role | Unauthenticated |
| Related TC | API-TC-01, API-TC-02, API-TC-03, API-TC-04 |
| Automation result | `API-TC-01` Fail: expected 200, actual 503 |

### Title

`GET /api/health` trả `503 Service Unavailable` trong khi payload ghi database và ML service đều connected/ok.

### Steps to reproduce

```powershell
curl.exe -sS -i --max-time 5 http://127.0.0.1:5000/api/health
```

### Actual result

- HTTP status: `503 Service Unavailable`.
- Payload chính:

```json
{
  "success": false,
  "message": "Service is not ready.",
  "status": "error",
  "database": "connected",
  "mlService": "connected",
  "details": {
    "database": { "status": "connected" },
    "ml": {
      "status": "ok",
      "mlServiceReachable": true,
      "modelLoaded": true,
      "phobertAvailable": true,
      "visobertAvailable": false,
      "requireVisobert": false
    }
  }
}
```

ML `/health` đồng thời trả HTTP 200 và `modelLoaded=true`.

### Expected result

Nếu tất cả dependency bắt buộc đều ready, health endpoint trả success/HTTP 200. Nếu còn điều kiện bắt buộc khác, response phải chỉ rõ dependency/condition làm readiness fail thay vì chỉ báo `Service is not ready` trong khi mọi dependency hiển thị connected.

### Impact

Load balancer, orchestrator hoặc monitoring có thể loại backend khỏi traffic dù dependency được báo healthy; automation health-check cũng không thể phân biệt lỗi thật với false negative.

### Recommendation

Kiểm tra điều kiện tổng hợp readiness và bổ sung field nguyên nhân fail. Xác nhận ViSoBERT optional vì payload hiện ghi `requireVisobert=false`.

## FLIC-BUG-AUTO-002 — TypeScript typecheck fail với 51 lỗi

| Trường | Giá trị |
|---|---|
| Severity | Major |
| Priority | P1 |
| Status | Open |
| Module | Frontend / Build quality gate |
| Environment | Node `v24.15.0`; npm `11.12.1`; branch `main`; commit `8a4f805119fa58f1dc368fc4dde7f9e94ef296a8` |
| Role | N/A |
| Related TC | Build prerequisite; nhiều module UI |

### Steps to reproduce

```powershell
npm run typecheck
```

### Actual result

`tsc --noEmit` fail với **51 lỗi trong 20 file**. Nhóm lỗi nổi bật:

- Thiếu namespace `React` trong nhiều component.
- Prop `key` bị truyền vào type không khai báo.
- `editValues` chưa được định nghĩa trong `ChartCard.tsx`.
- Import `../../../colors` không resolve trong `SourceChart.tsx`.
- `SheetChatbotCreatePayload` thiếu `source` nhưng caller không cung cấp.
- `getAIAnalyticsOverview` không được export.
- Các lỗi `unknown`, ErrorBoundary state/props và jsPDF typing.

File có nhiều lỗi nhất:

| File | Số lỗi |
|---|---:|
| `src/app/components/ChartCard.tsx` | 7 |
| `src/app/components/chartbuilder/DropZoneBar.tsx` | 7 |
| `src/app/components/screens/AIInsights.tsx` | 5 |
| `src/main.tsx` | 5 |
| `src/app/components/screens/SentimentAnalysis.tsx` | 4 |

### Expected result

`npm run typecheck` kết thúc exit code 0 trước khi dùng build/typecheck làm quality gate cho automation và release.

### Impact

Type drift làm giảm độ tin cậy của frontend contract và có thể che lỗi runtime ở Chart Builder, AI Insights, Sentiment, Login, Overview, Keyword và Feedback.

### Recommendation

Triage theo root cause chung, sửa source type thay vì tắt strictness hoặc bỏ qua error. Chạy lại typecheck, build, unit và focused E2E sau khi sửa.

## Không phải product defect

- Maven chưa có trên `PATH`: environment setup; automation đã được xác minh bằng Maven 3.9.16 cục bộ.
- Không có in-app browser tab gắn với phiên: không ảnh hưởng Selenium/Chrome execution đã chạy.
- Chưa có credential/test data: test prerequisite, không phải lỗi sản phẩm.
