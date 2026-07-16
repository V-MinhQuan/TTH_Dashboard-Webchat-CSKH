# FLIC FastAPI Backend

Backend chính thức chạy tại port `5000`, kết nối Microsoft SQL Server và gọi
Hugging Face Inference Providers. Backend không cần Redis, Celery, model local
hoặc một ML HTTP service ở port `8001`.

## Cài đặt

Từ thư mục gốc repository:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item backend/.env.example backend/.env
```

`requirements.txt` gồm Backend và test dependencies.
`requirements.backend.txt` là tập production tối thiểu được Docker Compose dùng.
`requirements.ml.txt` và local ML runtime không còn thuộc deployment hiện tại;
chỉ khôi phục từ revision Git cũ trong rollback tách biệt.

## Environment

Điền DB credential trong `backend/.env`. Với Hugging Face, Backend ưu tiên
`HF_TOKEN`; chỉ dùng `HUGGINGFACE_API_KEY` khi `HF_TOKEN` rỗng.

```env
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

Không đặt token trong root Frontend `.env`, biến `VITE_*`, image layer, source
code hoặc log. Thiếu token không chặn startup; readiness chuyển `degraded` và
worker không lấy record mới để gửi provider.

## Chạy

Từ thư mục gốc:

```powershell
python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 5000 --workers 1
```

Hoặc từ `backend/`:

```powershell
python -m uvicorn app.main:app --host 0.0.0.0 --port 5000 --workers 1
```

Không dùng `--reload` trên server. Không tăng `--workers` khi background loop
còn nằm trong lifespan của Backend.

## Runtime lifecycle

FastAPI lifespan sở hữu:

- một async Hugging Face client dùng chung;
- semaphore giới hạn concurrency;
- một background worker task;
- heartbeat/readiness state;
- shutdown cancellation và đóng HTTP client.

SQL/pyodbc là blocking và phải chạy qua `asyncio.to_thread`. Worker claim batch
trong transaction ngắn, commit `processing`, gọi Hugging Face ngoài transaction,
rồi ghi `completed`, `pending` hoặc `failed`. Worker chỉ discover/claim customer
message (`FromHost=0`); legacy thiếu provenance giữ `quarantined` và không được
tính KPI hay tự động requeue.

## Health API

| Endpoint | Ý nghĩa |
| --- | --- |
| `GET /api/health/live` | Process liveness; không gọi DB/HF |
| `GET /api/health/ready` | DB, token, HF last result, worker heartbeat, pending count |
| `GET /api/health` | Compatibility wrapper cho Frontend cũ |

Readiness không gọi Hugging Face thật. DB bắt buộc bị mất kết nối phải trả
`not_ready`; token thiếu hoặc provider tạm lỗi được phản ánh là `degraded`.

## Test

```powershell
python -m pytest backend/tests -v
python -m pytest backend/tests_fastapi -v
python -m compileall backend/app
```

Unit tests mock SDK/provider. Không gọi Hugging Face thật, không dùng token thật
và không sửa assertion để che lỗi.

Xem runbook đầy đủ tại
[`../docs/HUGGINGFACE_MIGRATION.md`](../docs/HUGGINGFACE_MIGRATION.md).
