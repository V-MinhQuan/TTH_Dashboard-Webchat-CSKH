# Hugging Face migration and operations runbook

## 1. Kiến trúc mới

```text
Frontend React/Vite
        |
FastAPI Backend :5000 --workers 1
        |
        +-- Microsoft SQL Server (data + durable analysis state)
        |
        +-- Hugging Face Inference Providers
```

Production không chạy Redis, Celery, Torch, ONNX Runtime hoặc `ml-service`.
Hugging Face client và background worker được quản lý bởi FastAPI lifespan.

Luồng background:

1. Phát hiện `WebChat_MessageLogs.FromHost=0` mới và tạo `pending`. Backend chỉ
   phân tích `TextContent` của customer row; không dùng câu trả lời AI Assistant.
2. Khôi phục record `processing` quá thời gian stale.
3. Claim một batch `pending` trong transaction SQL ngắn.
4. Commit trạng thái `processing`.
5. Gọi Hugging Face ngoài transaction.
6. Thành công: ghi sentiment và `completed`.
7. Lỗi tạm thời: tăng retry count và trả record về `pending`.
8. Hết retry budget: ghi `failed`.

Legacy thiếu provenance có trạng thái `quarantined`; worker không claim và
Dashboard không tính chúng vào POS/NEG/NEU.

Không có lỗi provider nào được tự động chuyển thành `neutral`.

## 2. Tạo Hugging Face token

1. Đăng nhập Hugging Face và mở
   [User Access Tokens](https://huggingface.co/settings/tokens).
2. Tạo token riêng cho ứng dụng production.
3. Ưu tiên token `fine-grained` với quyền nhỏ nhất đủ để gọi Inference Providers
   và đọc đúng model cần dùng. Token `read` cũng hỗ trợ inference nhưng có phạm vi
   rộng hơn.
4. Nếu model gated/private, tài khoản tạo token phải được cấp quyền model trước.
5. Lưu token trong secret store hoặc `backend/.env`; không gửi qua chat/email và
   không commit Git.

Tham khảo chính thức:

- [Hugging Face User Access Tokens](https://huggingface.co/docs/hub/main/security-tokens)
- [Hugging Face Inference client](https://huggingface.co/docs/huggingface_hub/package_reference/inference_client)

Nếu token bị lộ, revoke/rotate ngay và kiểm tra log/deployment history.

## 3. Environment variables

Tạo file local, không commit:

```powershell
Copy-Item backend/.env.example backend/.env
```

```env
# Ưu tiên; để trống nếu dùng fallback bên dưới.
HF_TOKEN=
HUGGINGFACE_API_KEY=

HF_MODEL=wonrax/phobert-base-vietnamese-sentiment
HF_PROVIDER=hf-inference
HF_TIMEOUT_SECONDS=15
HF_MAX_RETRIES=2
HF_MAX_CONCURRENCY=3
HF_BATCH_SIZE=10
HF_BACKGROUND_ENABLED=false
HF_ANALYSIS_CUTOVER_MESSAGE_ID=
HF_BACKGROUND_INTERVAL_SECONDS=10
HF_PROCESSING_STALE_MINUTES=10
HF_PREDICT_RATE_LIMIT_PER_MINUTE=30
HF_PILOT_MAX_RECORDS=3
HF_PILOT_ENVIRONMENT=
HF_PILOT_BACKUP_VERIFIED=false
```

Quy tắc:

- `HF_TOKEN` được ưu tiên trước `HUGGINGFACE_API_KEY`.
- Không đặt secret trong `.env` Frontend hoặc biến `VITE_*`.
- Không log token, Authorization header hoặc toàn bộ nội dung hội thoại.
- Thiếu token không chặn startup. Readiness là `degraded`, worker giữ record ở
  `pending` và không gọi provider.
- `HF_BACKGROUND_ENABLED=false` tắt hẳn vòng lặp worker: không claim SQL,
  không reprocess backlog và health báo `disabled`. Chỉ đặt `true` sau khi
  migration staging, quota và watermark cutover đã được duyệt.
- `HF_ANALYSIS_CUTOVER_MESSAGE_ID` là watermark cố định lấy một lần bằng
  `MAX(id_webchat_messageLogs)` trước khi bật worker. Thiếu biến này thì worker
  fail-closed, không discover/claim SQL và không gọi Hugging Face. Chỉ record có
  `messageId` lớn hơn watermark mới được xử lý; không tự tính lại sau restart.

## 4. Cài dependency

Local/test:

```powershell
python -m pip install -r requirements.txt
```

Production:

```powershell
python -m pip install -r requirements.backend.txt
```

Hai file trên không chứa Celery, Redis client, Torch, Transformers, Optimum hoặc
ONNX Runtime. `requirements.ml.txt` và source `ml-service/` đã được loại khỏi
checkout hiện tại; chỉ khôi phục chúng từ revision Git cũ trong một rollback có
kiểm soát, tuyệt đối không cài trên server production mới.

## 5. Database migration

Migration trạng thái phân tích phải được review và chạy thủ công trên từng môi
trường; application không tự chạy DDL khi startup.

- Compatibility apply wrapper:
  `backend/database/migrations/20260715_huggingface_analysis_state.sql`.
- Staged scripts: `01_add_hf_analysis_schema.sql`,
  `02_backfill_verified_legacy.sql`,
  `03_quarantine_unverified_legacy.sql`.
- Controlled requeue, không nằm trong apply wrapper:
  `04_requeue_quarantined_batch.sql`.
- Rollback wrapper: `rollback_20260715_huggingface_analysis_state.sql`.
- Cột mới: `analysisStatus`, `analysisRetryCount`, `analysisError`,
  `analysisStartedAt`, `analysisUpdatedAt`.
- Tái sử dụng `sentimentSource`, `analyzerVersion` và `analyzedAt`; nếu hai cột
  provenance chưa tồn tại thì migration bổ sung chúng trước khi backfill.
- Chỉ bản ghi có label/score/time hợp lệ, nguồn đã biết và analyzer version cụ
  thể mới được đánh dấu `completed`.
- Bản ghi thiếu provenance, bao gồm neutral/0 cũ gắn Assistant row, được giữ
  nguyên label/score nhưng đánh dấu `quarantined`. Chúng không vào KPI và không
  được tự động requeue.
- Queue index: `IX_WebChat_MessageAnalytics_AnalysisQueue`.

Chụp watermark bằng truy vấn read-only trước khi bật worker:

```sql
SELECT COALESCE(MAX(id_webchat_messageLogs), 0) AS cutoverMessageId
FROM dbo.WebChat_MessageLogs;
```

Lưu đúng giá trị này một lần vào `HF_ANALYSIS_CUTOVER_MESSAGE_ID`, giữ
`HF_BACKGROUND_ENABLED=false` trong lúc apply migration và kiểm tra số lượng
legacy. Watermark không được tự tăng sau restart.

Trước khi apply:

1. Backup database hoặc bảo đảm có restore point.
2. Kiểm tra tên database và schema `dbo`.
3. Chạy ngoài giờ cao điểm nếu bảng analytics lớn.
4. Review cả phần apply và rollback trong SQL migration được phát hành cùng bản
   deploy.

Chạy apply bằng `sqlcmd`:

```powershell
sqlcmd -S <server> -d <database> -U <user> -P <password> -b `
  -i backend/database/migrations/20260715_huggingface_analysis_state.sql
```

Không truyền password trên command line ở môi trường có process-history dùng
chung; ưu tiên Windows authentication (`-E`) hoặc secret injection của nền tảng.

Backfill theo batch 1.000 row. Migration không xóa hoặc đặt NULL label/score cũ.
Script requeue mặc định `@Apply=0`, giới hạn tối đa 50 và chỉ chuyển
`quarantined -> pending` theo filter ID/time/channel đã review.

## 6. Chạy Backend

Từ repository root:

```powershell
python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 5000 --workers 1
```

Hoặc:

```powershell
docker compose up --build
```

Không dùng `--reload` trên server. Mỗi Uvicorn worker có lifecycle và background
task riêng; `--workers 4` có thể tạo bốn loop. Nếu cần scale API ngang, tách
worker thành process riêng hoặc triển khai distributed lock trước.

## 7. Health và readiness

```powershell
curl.exe -i http://127.0.0.1:5000/api/health/live
curl.exe -i http://127.0.0.1:5000/api/health/ready
curl.exe -i http://127.0.0.1:5000/api/health
```

`live` chỉ kiểm tra process. `ready` phản ánh:

- DB connectivity;
- token configured hay không;
- kết quả và thời điểm HF call gần nhất;
- background worker running/heartbeat;
- pending count nếu query đủ nhẹ;
- trạng thái `ready`, `degraded` hoặc `not_ready`.

Health không gọi Hugging Face thật mỗi lần. DB bắt buộc mất kết nối phải là
`not_ready`, không được trả false green. `/api/health` được giữ cho Frontend cũ.

## 8. Kiểm tra background worker

1. Gọi `/api/health/ready` và kiểm tra worker state/heartbeat.
2. Chờ ít nhất một `HF_BACKGROUND_INTERVAL_SECONDS` rồi gọi lại; heartbeat phải
   tiến lên dù không có record pending.
3. Kiểm tra log có startup/shutdown và batch summary, nhưng không có message text
   hoặc token.
4. Restart Backend trong lúc có record `processing`; record phải được recovery sau
   `HF_PROCESSING_STALE_MINUTES`.

Không kết luận worker khỏe chỉ từ HTTP `200`; phải xác minh heartbeat và chuyển
trạng thái SQL.

## 9. Xem pending và failed

Sau khi migration thực tế xác nhận tên cột, dùng query read-only tương ứng. Với
naming convention camelCase của `WebChat_MessageAnalytics`, mẫu vận hành là:

```sql
SELECT analysisStatus, COUNT_BIG(*) AS total
FROM dbo.WebChat_MessageAnalytics
GROUP BY analysisStatus;
```

```sql
SELECT TOP (100)
    messageId,
    analysisStatus,
    analysisRetryCount,
    analysisError,
    analysisUpdatedAt
FROM dbo.WebChat_MessageAnalytics
WHERE analysisStatus IN ('pending', 'processing', 'failed', 'quarantined')
ORDER BY analysisUpdatedAt ASC, messageId ASC;
```

Nếu migration chọn tên cột khác, phải dùng đúng tên trong migration; không tạo
thêm cột trùng chức năng chỉ để khớp ví dụ tài liệu.

## 10. Retry record failed và requeue quarantined

Ưu tiên endpoint/admin workflow hiện hữu nếu có. Nếu cần requeue bằng SQL, chỉ
thực hiện sau backup, trong transaction ngắn, với `WHERE` giới hạn rõ ràng:

```sql
BEGIN TRANSACTION;

UPDATE TOP (100) dbo.WebChat_MessageAnalytics
SET analysisStatus = 'pending',
    analysisRetryCount = 0,
    analysisError = NULL,
    analysisStartedAt = NULL,
    analysisUpdatedAt = SYSUTCDATETIME()
WHERE analysisStatus = 'failed'
  AND messageId IN (<reviewed-message-id-list>);

COMMIT TRANSACTION;
```

Không requeue toàn bảng và không retry vô hạn. Xác nhận tên cột thực tế trước khi
chạy câu lệnh mẫu.

Không dùng câu SQL mẫu trên cho `quarantined`. Review và chạy riêng
`04_requeue_quarantined_batch.sql`; script mặc định preview, hard-cap 50 và xuất
danh sách record được chọn. Trước cả preview phải đặt `@CutoverMessageId` bằng
đúng `HF_ANALYSIS_CUTOVER_MESSAGE_ID`. Script chỉ nhận row customer
(`FromHost=0`) sau cutover; legacy assistant/unverified trước cutover cần một
luồng mapping customer-message riêng đã audit và không được requeue trực tiếp.

Pilot DB một lần dùng `backend/scripts/pilot_hf_db_flow.py`. Script yêu cầu ID
cụ thể, schema đã migrate, background disabled, môi trường an toàn và backup đã
xác nhận. Ví dụ dry-run sau khi các safety gate đã được đặt:

```powershell
python backend/scripts/pilot_hf_db_flow.py --dry-run --max-records 3 `
  --message-ids <customer-message-id-1> <customer-message-id-2>
```

## 11. Quota, latency và Internet

- Inference Providers có quota/rate limit theo tài khoản và provider; HTTP 429
  phải retry có exponential backoff rồi giữ `pending`/chuyển `failed` theo budget.
- Endpoint tương thích `POST /api/sentiment/predict` yêu cầu HMAC Bearer session
  hiện có và áp dụng giới hạn theo user/process qua
  `HF_PREDICT_RATE_LIMIT_PER_MINUTE`.
- Các script đánh giá trong `backend/scripts` cần `FASTAPI_BEARER_TOKEN` là
  session token HMAC lấy từ API đăng nhập hiện tại. Script chỉ gửi token trong
  header `Authorization`, không log token và fail-fast nếu biến này bị thiếu.
- Internet hoặc provider outage làm tăng backlog nhưng không được làm block API
  Dashboard chính.
- Theo dõi pending age, retry rate, provider latency và tỷ lệ failed.
- Nếu backlog tăng liên tục, giảm batch/concurrency không luôn giúp; cần kiểm tra
  quota, network và provider availability trước.

## 12. Độ chính xác và word segmentation

Model mặc định được fine-tune từ dữ liệu review thương mại điện tử, khác miền hội
thoại CSKH. Cần đánh giá tập dữ liệu FLIC riêng trước khi dùng KPI cho quyết định
nghiệp vụ.

[Model card](https://huggingface.co/wonrax/phobert-base-vietnamese-sentiment)
ghi rõ input PhoBERT cần được word-segmented. Runtime mới không thêm Torch,
Transformers hoặc một model tách từ local chỉ để đáp ứng việc này; hiện chỉ làm
Unicode/whitespace/control-character normalization và masking PII. Đây là giới
hạn độ chính xác cần theo dõi. Nếu bổ sung segmentation sau này, chọn giải pháp
nhẹ và đánh giá latency/accuracy trước khi bật production.

Mapping đã xác minh cho đúng model mặc định là `LABEL_0=NEG`, `LABEL_1=POS`,
`LABEL_2=NEU`. Không áp dụng mapping số này cho model khác nếu chưa đọc model
config; tuyệt đối không đoán hoặc fallback nhãn lạ thành neutral.

## 13. Dữ liệu nhạy cảm

Trước khi gửi provider, Backend phải chuẩn hóa và che email, số điện thoại, access
token, password, mã sinh viên và định danh rõ ràng. Vẫn cần đánh giá pháp lý và
data-processing policy của tổ chức vì masking theo pattern không bảo đảm loại bỏ
mọi PII trong ngôn ngữ tự do.

Không lưu full provider payload hoặc full conversation vào error/log. Database
chỉ lưu lỗi rút gọn như `timeout`, `rate_limited`, `authentication_failed` hoặc
`invalid_response`.

## 14. Rollback

1. Dừng Backend mới để không có worker tiếp tục claim record.
2. Review rồi chạy rollback nếu dữ liệu trạng thái mới không còn cần phục hồi:

   ```powershell
   sqlcmd -S <server> -d <database> -U <user> -P <password> -b `
     -i backend/database/migrations/rollback_20260715_huggingface_analysis_state.sql
   ```
   Rollback mặc định chỉ chạy preflight (`@ConfirmRollback=0`) và từ chối nếu
   còn pending/processing/failed/quarantined hoặc sentiment không đầy đủ. Chỉ
   sau backup, dừng worker và review mới đổi flag xác nhận để gỡ metadata trạng
   thái. Label/score legacy luôn được giữ nguyên.
3. Restore source/runtime cũ từ revision Git đã biết là tốt, ví dụ:

   ```powershell
   git restore --source=<pre-hf-revision> -- ml-service requirements.ml.txt docker-compose.yml
   ```

4. Cài môi trường legacy trong host/container tách biệt; không cài requirements
   ML nặng vào Backend mới.
5. Khôi phục cấu hình `ML_SERVICE_URL` và startup order từ cùng revision cũ.
6. Chạy health, mock/integration tests và dry-run trước khi cho phép ghi DB.

Không rollback bằng cách gán record lỗi thành neutral. Giữ backup DB và artifact
deployment trước migration để rollback có thể tái lập.

## 15. Checklist sau deploy

- [ ] `docker compose config --services` chỉ có `backend`, `frontend`.
- [ ] Backend command có `--port 5000 --workers 1` và không có `--reload`.
- [ ] Không có container Redis, Celery hoặc ML service.
- [ ] Token chỉ có trong backend secret store/`backend/.env`.
- [ ] `/live` thành công; `/ready` phản ánh đúng DB/token/worker.
- [ ] Thiếu hoặc sai token không làm Backend crash.
- [ ] Pending không bị tính thành neutral trên Dashboard.
- [ ] Quarantined hiển thị riêng và không bị tính thành neutral.
- [ ] Job mới liên kết customer row (`FromHost=0`), không phải Assistant row.
- [ ] Restart recovery không xử lý trùng record.
- [ ] Log không chứa token, Authorization header hoặc full conversation.
- [ ] Quota, pending age, failed count và provider latency có người theo dõi.
