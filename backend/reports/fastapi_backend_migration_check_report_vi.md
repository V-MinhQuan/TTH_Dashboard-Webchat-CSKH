# Báo cáo kiểm tra migration FastAPI backend

## 1. Thời gian kiểm tra

- Thời điểm chạy kiểm tra: `2026-06-10 15:35:20 +07:00`
- Phạm vi: kiểm tra cấu trúc, môi trường, tests, runtime health, API parity, API validation và smoke frontend mức local server/build.
- Nguyên tắc: không chạy migration production, không reprocess DB, không ghi đè dữ liệu, không xóa Node.js backend.

## 2. Môi trường kiểm tra

- Workspace: `D:\FLIC\Project_FLIC\TTH_Dashboard-Webchat-CSKH`
- Node.js backend rollback: `http://localhost:5000`
- FastAPI backend: `http://localhost:8000`
- ml-service: `http://localhost:8001`
- Frontend Vite: `http://127.0.0.1:5173`
- Python backend venv: `backend/.venv`
- Python ml-service venv: `ml-service/.venv`
- SQL Server driver phát hiện: `ODBC Driver 17 for SQL Server`

## 3. Kiểm tra cấu trúc project

Tất cả file/folder bắt buộc đều tồn tại:

- `backend/app/main.py`
- `backend/app/core/`
- `backend/app/db/`
- `backend/app/routers/`
- `backend/app/repositories/`
- `backend/app/services/`
- `backend/app/schemas/`
- `backend/app/utils/`
- `backend/tests_fastapi/`
- `backend/scripts/api_parity_check.py`
- `backend/reports/api_inventory.md`
- `backend/reports/frontend_api_migration_guide.md`
- `backend/reports/api_parity_report.md`
- `backend/requirements.txt`
- `backend/.env.example`
- `ml-service/`
- `src/`
- `package.json`

## 4. Kiểm tra `.env`

`backend/.env` tồn tại và có các biến chính:

- `DB_SERVER`: có
- `DB_PORT`: có
- `DB_DATABASE`: có
- `DB_USER`: có
- `DB_PASSWORD`: có, đã redact trong báo cáo
- `DB_TRUST_SERVER_CERTIFICATE`: có
- `ML_SERVICE_URL=http://localhost:8001`

Các biến chưa có trực tiếp trong `backend/.env`:

- `DB_NAME`: thiếu, nhưng FastAPI config đang dùng alias `DB_DATABASE`.
- `DB_DRIVER`: thiếu, FastAPI dùng default `ODBC Driver 17 for SQL Server`.
- `CORS_ORIGINS`: thiếu, FastAPI dùng default localhost origins.

Root `.env` hiện chưa có dòng `VITE_API_URL=...`. Frontend smoke test được chạy bằng biến môi trường tạm trong process:

```text
VITE_API_URL=http://localhost:8000/api
```

Khuyến nghị thêm dòng này vào env frontend khi chuyển sang FastAPI trong môi trường dev/staging.

## 5. FastAPI backend status

- FastAPI backend chạy được trên port `8000`.
- `GET /api/health` trả HTTP 200.
- Kết quả runtime:

```text
status=ok
database=connected
mlService=connected
version=fastapi-v1
```

## 6. Node.js rollback backend status

- Node.js backend chạy được trên port `5000`.
- `GET /api/health` trả HTTP 200.
- Log Node cho thấy kết nối SQL Server thành công.
- Node.js backend vẫn còn khả dụng làm rollback.

## 7. SQL Server connection status

- FastAPI health báo `database=connected`.
- Node.js backend cũng báo kết nối DB thành công.
- Không phát hiện lỗi DB connection trong đợt kiểm tra này.
- Không chạy migration, không reprocess, không ghi dữ liệu production.

## 8. ml-service health status

`GET http://localhost:8001/health` và `GET http://localhost:8000/api/health/ml` đều trả HTTP 200.

Runtime ghi nhận:

```text
mlServiceReachable=true
status=ok
modelLoaded=true
phobertAvailable=true
visobertAvailable=true
visobertError=
actualAnalyzerVersion=ensemble-phobert-visobert-v1
activeAnalyzerVersion=ensemble-phobert-visobert-v1
issueDetectorAvailable=true
```

## 9. PhoBERT status

- PhoBERT đang available theo `/health`.
- `modelLoaded=true`.
- ml-service có thể phục vụ predict qua `/predict-ensemble`.

## 10. ViSoBERT status

- `/health` hiện xác nhận `visobertAvailable=true`.
- Runtime analyzer version hiện là `ensemble-phobert-visobert-v1`.
- ViSoBERT được ghi nhận là active trong runtime kiểm tra này.
- Không claim automation-ready hoặc production business automation; cần approval riêng trước khi dùng cho quyết định tự động.

## 11. Fallback status

Manual predict:

```text
POST /api/sentiment/predict
source=ml-service
analyzerVersion=ensemble-phobert-visobert-v1
sentiment.label=negative
issue.issueFlag=true
needStaffReview=true
fallbackSource=<empty>
```

Kết luận: tại thời điểm kiểm tra này, predict không dùng fallback. Fallback vẫn là cơ chế dự phòng nếu ml-service hoặc model lỗi.

## 12. FastAPI pytest result

Lệnh:

```bash
cd backend
.venv\Scripts\python -m pytest tests_fastapi -q
```

Kết quả:

```text
18 passed, 1 warning
```

Warning: `StarletteDeprecationWarning` từ FastAPI TestClient/httpx, không làm fail test.

## 13. ml-service pytest result

Lệnh:

```bash
cd ml-service
.venv\Scripts\python -m pytest tests -q
```

Kết quả:

```text
56 passed, 1 warning
```

Warning: `return_all_scores` của transformers đã deprecated; không làm fail test.

## 14. Node.js Jest result

Lệnh:

```bash
cd backend
npm test
```

Kết quả:

```text
12 test suites passed
238 tests passed
```

Các console warn trong test là case fallback/lỗi mô phỏng đã có trong test, không phải lỗi runtime của lần kiểm tra này.

## 15. API parity result

Lệnh:

```bash
cd backend
.venv\Scripts\python scripts\api_parity_check.py
```

Report cập nhật: `backend/reports/api_parity_report.md`

Kết quả tổng quan:

```text
7/7 checked read endpoints return HTTP 200 on both Node.js and FastAPI.
No important Node response keys are missing in FastAPI.
Important metrics match.
```

Metric đã xác nhận:

```text
totalConversations = 3437
sentiment summary total = 20183
need-review total = 299
```

Khác biệt hiện tại là additive fields từ FastAPI, ví dụ `totalMessages`, `needStaffReviewCount`, `metadata`, `issueFlag`, `needStaffReview`. Không thiếu key quan trọng từ response Node.

## 16. Manual API validation result

Các API FastAPI sau đều trả HTTP 200:

- `GET /api/health`
- `GET /api/health/ml`
- `GET /api/dashboard/kpi`
- `GET /api/analytics/sentiment-summary`
- `GET /api/analytics/sentiment-trend`
- `GET /api/analytics/need-review-conversations`
- `GET /api/analytics/negative-conversations`
- `GET /api/analytics/need-review-keywords?mode=needReview`
- `GET /api/conversations?page=1&pageSize=2`
- `POST /api/sentiment/predict`

Một số kết quả chính:

```text
/api/dashboard/kpi:
  totalConversations=3437
  totalMessages=44552
  needStaffReviewCount=299

/api/analytics/sentiment-summary:
  total=20183
  positive=1923
  neutral=17976
  negative=284
  issueMetadataAvailable=true

/api/analytics/need-review-conversations:
  pagination.total=299
  issueMetadataAvailable=true

/api/conversations?page=1&pageSize=2:
  pagination.total=3437
  records=2
```

## 17. Optional issue metadata columns

DB hiện có issue metadata columns theo response FastAPI:

```text
issueMetadataAvailable=true
```

Các API kiểm tra không crash:

- `/api/analytics/sentiment-summary`
- `/api/analytics/need-review-conversations`

Không chạy migration trong phase này.

## 18. Frontend smoke test result

Đã chạy frontend dev server bằng env tạm:

```bash
set VITE_API_URL=http://localhost:8000/api
npm run dev -- --host 127.0.0.1 --port 5173
```

Kết quả:

```text
Vite ready on http://127.0.0.1:5173/
GET / returned HTTP 200
Frontend build passed: npm run build
FastAPI dashboard API target returned HTTP 200
```

Giới hạn kiểm tra:

- Chưa chạy browser automation/Playwright vì repo hiện không có Playwright dependency.
- Chưa xác nhận trực tiếp browser console và Network tab cho từng màn hình.
- Vì vậy chưa kết luận `READY_FOR_STAGING_CUTOVER`.

Các màn hình cần smoke test thủ công hoặc bằng Playwright ở bước tiếp theo:

- Overview Dashboard
- Sentiment Analysis
- Sentiment Trend
- Satisfaction Summary
- Topics
- Need Review Conversations
- Need Review Keywords
- Negative Conversations legacy
- Conversation list
- Filter panel

## 19. Passed endpoints

Đã pass read API parity hoặc manual validation:

- `/api/health`
- `/api/health/ml`
- `/api/dashboard/kpi`
- `/api/analytics/sentiment-summary`
- `/api/analytics/sentiment-trend`
- `/api/analytics/need-review-conversations`
- `/api/analytics/negative-conversations`
- `/api/analytics/need-review-keywords`
- `/api/analytics/negative-keywords`
- `/api/conversations`
- `/api/sentiment/predict`

## 20. Pending hoặc chưa migrate

- `POST /api/analytics/run`: FastAPI trả controlled `501`; đây là write/reprocess flow và chưa migrate để tránh ghi dữ liệu ngoài approval.
- `/api/test-db`: chưa migrate riêng; thay thế bằng `/api/health.details.database`.
- Full browser frontend smoke test: pending.
- Production/staging cutover: chưa thực hiện.

## 21. Rủi ro còn lại

- Root `.env` chưa có `VITE_API_URL=http://localhost:8000/api`; nếu không set env khi chạy frontend, frontend có thể fallback về Node `http://localhost:5000/api`.
- ViSoBERT đang active trong runtime, nhưng chưa được phê duyệt cho automation/business decisions.
- `POST /api/analytics/run` vẫn cần thiết kế riêng nếu muốn migrate write/reprocess flow.
- Cần kiểm tra UI bằng browser thật hoặc Playwright để xác nhận console/network/filter behavior.
- FastAPI đang có thêm additive fields; hiện tương thích frontend, nhưng vẫn nên giữ parity check trong CI/staging.

## 22. Rollback plan

- Giữ Node.js backend trên port `5000`.
- Nếu FastAPI hoặc UI smoke test phát hiện lỗi, đổi frontend env về:

```env
VITE_API_URL=http://localhost:5000/api
```

- Không xóa Node.js backend cho đến khi API parity, UI smoke test và staging cutover được approve.

## 23. Final status

```text
READY_FOR_FRONTEND_SMOKE_TEST
```

Lý do:

- FastAPI chạy được.
- SQL Server connected.
- ml-service reachable và model loaded.
- PhoBERT available.
- ViSoBERT active theo `/health`.
- Predict đang dùng `source=ml-service`, không fallback.
- FastAPI pytest pass.
- ml-service pytest pass.
- Node Jest pass.
- Read API parity pass.
- Node rollback vẫn hoạt động.
- Frontend dev server/build pass ở mức local, nhưng full browser smoke test chưa hoàn tất.

## 24. Khuyến nghị tiếp theo

1. Thêm `VITE_API_URL=http://localhost:8000/api` vào env frontend dev/staging, không hard-code trong source.
2. Chạy smoke test UI thủ công hoặc thêm Playwright cho các màn hình dashboard chính.
3. Giữ Node.js và FastAPI chạy song song thêm một chu kỳ test.
4. Không migrate `POST /api/analytics/run` cho đến khi có plan riêng cho write/reprocess flow.
5. Không dùng kết quả sentiment/issue cho automation business decision cho đến khi có approval ngoài `PASS_WITH_MONITORING`.
6. Sau frontend smoke test pass, cân nhắc trạng thái `READY_FOR_STAGING_CUTOVER`, chưa phải production cutover.
