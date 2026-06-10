# Báo cáo smoke test frontend với FastAPI backend

## 1. Thời gian kiểm tra

- Thời điểm chạy: `2026-06-10 15:51:19 +07:00`
- Phạm vi: chỉ kiểm tra, test, smoke report; không đổi business logic, không chạy migration, không reprocess DB.

## 2. Môi trường kiểm tra

- Workspace: `d:\FLIC\Project_FLIC\TTH_Dashboard-Webchat-CSKH`
- Node.js rollback backend: `http://127.0.0.1:5000`
- FastAPI backend: `http://127.0.0.1:8000`
- ml-service: `http://127.0.0.1:8001`
- Frontend Vite test với FastAPI: `http://127.0.0.1:5173`
- Frontend Vite rollback test với Node.js: `http://127.0.0.1:5174`
- Frontend env dùng khi test FastAPI: `VITE_API_URL=http://localhost:8000/api`
- Frontend env dùng khi test rollback: `VITE_API_URL=http://localhost:5000/api`

Ghi chú: biến `VITE_API_URL` được set tạm bằng process env khi chạy `npm run dev/build`; không hard-code vào source.

## 3. Health backend và database

| Hạng mục | Kết quả |
| --- | --- |
| Node.js rollback `/api/health` | HTTP 200 |
| FastAPI `/api/health` | HTTP 200 |
| FastAPI status | `ok` |
| SQL Server | `connected` |
| ml-service qua FastAPI | `connected` |
| FastAPI version | `fastapi-v1` |

## 4. Health ml-service

| Field | Giá trị |
| --- | --- |
| `status` | `ok` |
| `mlServiceReachable` | `true` |
| `sentimentMode` | `ensemble` |
| `modelLoaded` | `true` |
| `phobertAvailable` | `true` |
| `visobertAvailable` | `true` |
| `visobertError` | `null` |
| `actualAnalyzerVersion` | `ensemble-phobert-visobert-v1` |
| `activeAnalyzerVersion` | `ensemble-phobert-visobert-v1` |
| `issueDetectorAvailable` | `true` qua `/api/health/ml` |
| `visobertNote` | ViSoBERT reachable nhưng vẫn experimental cho production automation |

Kết luận ML: không dùng fallback trong lần kiểm tra predict này. Không claim ViSoBERT production-ready.

## 5. Build frontend

Command:

```bash
cmd.exe /c "set VITE_API_URL=http://localhost:8000/api&& npm run build"
```

Kết quả:

- `vite build` pass.
- `2250 modules transformed`.
- Build hoàn tất trong khoảng `3.92s`.
- Không thấy build error.

## 6. Dev server frontend

| Mục | Kết quả |
| --- | --- |
| FastAPI frontend smoke server | `http://127.0.0.1:5173/` |
| HTTP index | 200 |
| Vite stderr | rỗng |
| Node rollback frontend smoke server | `http://127.0.0.1:5174/` |
| HTTP index rollback | 200 |

Repo hiện không có Playwright/Cypress config hoặc dependency sẵn có. Tôi không cài thêm browser automation, nên chưa xác thực được browser console/Network tab bằng công cụ E2E.

## 7. Các màn hình được smoke theo API backing

| Màn hình | API backing | Kết quả |
| --- | --- | --- |
| Overview Dashboard | `/api/dashboard/kpi` | HTTP 200 |
| Sentiment Analysis | `/api/analytics/sentiment-summary` | HTTP 200 |
| Sentiment Trend | `/api/analytics/sentiment-trend` | HTTP 200 |
| Satisfaction Summary | `/api/analytics/satisfaction-summary` | HTTP 200 |
| Satisfaction Trend | `/api/analytics/satisfaction-trend` | HTTP 200 |
| Topics | `/api/analytics/topics` | HTTP 200 |
| Need Review Conversations | `/api/analytics/need-review-conversations` | HTTP 200 |
| Need Review Keywords | `/api/analytics/need-review-keywords?mode=needReview` | HTTP 200 |
| Negative Conversations legacy | `/api/analytics/negative-conversations` | HTTP 200 |
| Negative Keywords legacy | `/api/analytics/negative-keywords` | HTTP 200 |
| Conversation List | `/api/conversations?page=1&pageSize=2` | HTTP 200 |
| Filter Panel | date filters + pagination/search APIs | HTTP 200 |

Ghi chú: đây là smoke theo build/dev server và API network. Chưa có kết quả visual click-through trong browser thật.

## 8. Network API validation

Tất cả read API chính qua FastAPI trả HTTP 200:

- `GET /api/dashboard/kpi`
- `GET /api/analytics/sentiment-summary`
- `GET /api/analytics/sentiment-trend`
- `GET /api/analytics/satisfaction-summary`
- `GET /api/analytics/satisfaction-trend`
- `GET /api/analytics/topics`
- `GET /api/analytics/need-review-conversations`
- `GET /api/analytics/negative-conversations`
- `GET /api/analytics/need-review-keywords?mode=needReview`
- `GET /api/analytics/negative-keywords`
- `GET /api/conversations?page=1&pageSize=2`

Các chỉ số chính:

| Metric | Kết quả |
| --- | ---: |
| `dashboard.totalConversations` | 3437 |
| `dashboard.totalMessages` | 44552 |
| `dashboard.needStaffReviewCount` | 299 |
| `sentiment.summary.total` | 20183 |
| `sentiment.positive` | 1923 |
| `sentiment.neutral` | 17976 |
| `sentiment.negative` | 284 |
| `need-review.pagination.total` | 299 |
| `conversations.pagination.total` | 3437 |

## 9. Optional issue metadata columns

FastAPI không crash và DB hiện có issue metadata:

```json
{
  "issueMetadataAvailable": true,
  "optionalColumns": {
    "analyzerVersion": true,
    "sentimentSource": true,
    "issueFlag": true,
    "issueType": true,
    "issueReason": true,
    "issueConfidence": true
  }
}
```

`need-review-conversations` trả các field issue metadata trong record: `issueFlag`, `issueType`, `issueReason`, `issueConfidence`.

## 10. Filter test

Các filter/pagination được gọi và đều trả HTTP 200:

- `/api/dashboard/kpi?dateRange=all_time`
- `/api/dashboard/kpi?dateRange=today`
- `/api/dashboard/kpi?dateRange=last7days`
- `/api/dashboard/kpi?dateRange=custom&fromDate=2026-06-01&toDate=2026-06-10`
- `/api/analytics/need-review-conversations?page=2&pageSize=5`
- `/api/analytics/need-review-conversations?page=1&pageSize=5&search=email`

Chưa có browser automation để xác nhận thao tác click Apply/Reset trực tiếp trong UI.

## 11. Need-review validation

- Canonical API: `/api/analytics/need-review-conversations`
- Kết quả: HTTP 200.
- Tổng record: `299`.
- Record trả issue metadata khi DB có cột issue.
- Logic vẫn tách riêng `needStaffReview`, `issueFlag`, và `sentimentLabel`; không đồng nhất negative sentiment với need-review.

## 12. Sentiment predict validation

Command tương đương:

```bash
curl -X POST http://localhost:8000/api/sentiment/predict ^
  -H "Content-Type: application/json" ^
  -d "{\"text\":\"em chưa nhận được email xác nhận\"}"
```

Kết quả:

- HTTP 200.
- `source = ml-service`.
- `endpoint = /predict-ensemble`.
- `sentiment.label = negative`.
- `sentiment.confidence = 0.95`.
- `issue.issueFlag = true`.
- `issue.issueType = missing_email_or_notification`.
- `issue.issueConfidence = 0.9`.
- `needStaffReview = true`.
- `analyzerVersion = ensemble-phobert-visobert-v1`.

Fallback: không được dùng trong lần kiểm tra này.

## 13. Controlled write-flow check

`POST /api/analytics/run` trên FastAPI trả controlled 501:

```json
{
  "success": false,
  "message": "FastAPI migration stage does not run analytics reprocess. Use the Node.js backend rollback path until this write flow is approved.",
  "data": null
}
```

Đây là pending write/reprocess flow, không xem là blocking cho read API migration.

## 14. Rollback-to-Node validation

| Mục | Kết quả |
| --- | --- |
| Node backend `/api/health` | HTTP 200 |
| Vite frontend với `VITE_API_URL=http://localhost:5000/api` | HTTP 200 |
| Node `/api/dashboard/kpi` | HTTP 200 |
| Node `totalConversations` | 3437 |

Ghi chú: Node.js KPI response là shape cũ hơn FastAPI, không có `needStaffReviewCount` tại key top-level của `data`. Node vẫn đủ vai trò rollback backend hiện tại.

## 15. Console warnings/errors

- `npm run build`: không có error.
- Vite dev server stderr: rỗng.
- Browser console: chưa kiểm tra được vì repo không có Playwright/Cypress và không có browser CLI/headless trong `PATH`; không cài thêm dependency theo phạm vi kiểm tra.
- Có mojibake trong output PowerShell khi in title/log tiếng Việt; đây là vấn đề encoding console, không phải bằng chứng lỗi runtime frontend.

## 16. Blocking issues

Không phát hiện blocking issue ở tầng build, FastAPI health, DB connection, read API, predict proxy, hoặc Node rollback.

## 17. Non-blocking issues

- Chưa có browser automation để xác nhận visual UI, console errors, và Network tab thật sự.
- `POST /api/analytics/run` vẫn là controlled 501 trên FastAPI, cần xử lý riêng nếu muốn chuyển write/reprocess flow.
- Node rollback KPI giữ shape cũ; FastAPI đang có thêm metric `needStaffReviewCount`.

## 18. Pending/unmigrated items

- Full browser click-through smoke test cho các màn hình dashboard.
- E2E setup nếu team muốn repeatable smoke test.
- Write/reprocess flow `POST /api/analytics/run`.
- Quyết định chính thức về frontend cutover sau khi có QA browser smoke test.

## 19. Những việc không thực hiện

- Không chạy production migration.
- Không reprocess production DB.
- Không overwrite production data.
- Không xóa Node.js backend.
- Không xóa legacy endpoints.
- Không force production frontend cutover.
- Không claim full PASS hoặc automation-ready.

## 20. Trạng thái cuối cùng

`FRONTEND_SMOKE_TEST_PASSED_WITH_NOTES`

FastAPI backend đã đủ điều kiện cho frontend read API smoke ở mức HTTP/build/dev-server: health OK, SQL Server connected, ml-service reachable, read APIs trả 200, chỉ số chính khớp, sentiment predict đi qua ml-service, và Node.js vẫn chạy được làm rollback. Chưa nên nâng lên `READY_FOR_STAGING_CUTOVER` cho tới khi có browser smoke test thật sự hoặc E2E automation xác nhận console/Network/UI không lỗi.

## 21. Khuyến nghị tiếp theo

1. Tiếp tục chạy song song FastAPI và Node.js rollback.
2. Thực hiện manual browser smoke test hoặc bổ sung Playwright/Cypress trước staging cutover.
3. Giữ `POST /api/analytics/run` ở Node.js hoặc lập plan riêng cho write-flow migration.
4. Không dùng ViSoBERT cho automation production cho tới khi có phê duyệt riêng, dù runtime hiện đang reachable.
5. Sau browser smoke pass, cân nhắc chuyển frontend dev/staging sang `VITE_API_URL=http://localhost:8000/api`.
