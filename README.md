# FLIC – TTH Dashboard WebChat CSKH

Dashboard React/Vite với FastAPI Backend, Microsoft SQL Server và Hugging Face
Inference Providers. Production runtime không khởi động model local, Redis,
Celery hoặc service AI riêng.

## Kiến trúc runtime

```text
React/Vite (:5173)
        |
FastAPI Backend (:5000, 1 process)
        |
        +-- Microsoft SQL Server
        |
        +-- Hugging Face Inference Providers
```

Backend quản lý một Hugging Face client dùng chung và một background worker nhẹ
trong FastAPI lifespan. SQL Server lưu trạng thái `pending`, `processing`,
`completed`, `failed`, `quarantined`, nên restart Backend không làm mất hàng
đợi phân tích. Chỉ customer message (`FromHost=0`) được gửi sang Hugging Face.

Runtime/source `ml-service/` đã được loại khỏi working tree. Nếu cần rollback,
khôi phục đúng revision cũ từ Git trong môi trường tách biệt; Docker Compose và
quy trình production hiện không cài hoặc chạy service này.

## Yêu cầu

- Python 3.10+; Docker Compose dùng Python 3.11.
- Node.js 20+.
- Microsoft ODBC Driver 17 for SQL Server.
- SQL Server có schema/migration của dự án.
- Hugging Face User Access Token có quyền inference.

## Cấu hình

Frontend chỉ nhận biến công khai:

```powershell
Copy-Item .env.example .env
```

Backend giữ toàn bộ DB credential và provider token trong file riêng:

```powershell
Copy-Item backend/.env.example backend/.env
```

Điền kết nối SQL Server và một trong hai biến sau vào `backend/.env`:

```env
HF_TOKEN=
# Chỉ dùng khi HF_TOKEN không được cấu hình:
HUGGINGFACE_API_KEY=
```

Không thêm token vào `.env` của Frontend, biến `VITE_*`, source code, log hoặc
Docker Compose. `.env` và `backend/.env` đã được Git ignore.

Các giá trị AI mặc định:

```env
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

Backend vẫn khởi động khi thiếu token, nhưng readiness là `degraded` và dữ liệu
cần phân tích tiếp tục ở trạng thái `pending`.

## Chạy local

Cài Backend và test dependencies:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Chạy Backend đúng port của dự án và đúng một worker:

```powershell
python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 5000 --workers 1
```

Chạy Frontend ở terminal khác:

```powershell
npm ci
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
```

Không cần chạy Redis, Celery hoặc `ml-service :8001`.

## Chạy bằng Docker Compose

Tạo `backend/.env`, sau đó:

```powershell
docker compose up --build
```

Compose chỉ khởi động hai service `backend` và `frontend`. Production Backend
dùng `requirements.backend.txt` và lệnh Uvicorn `--workers 1`.

Mỗi Uvicorn worker là một process riêng. Dùng `--workers 4` sẽ tạo bốn lifespan
worker và có thể phân tích trùng. Nếu cần scale API nhiều process, phải tách
background worker thành process riêng hoặc thêm distributed lock trước.

## Health

```powershell
curl.exe http://127.0.0.1:5000/api/health/live
curl.exe http://127.0.0.1:5000/api/health/ready
curl.exe http://127.0.0.1:5000/api/health
```

- `live`: chỉ chứng minh process Backend đang chạy.
- `ready`: kiểm tra DB, cấu hình token, trạng thái lần gọi HF gần nhất và
  heartbeat của background worker; endpoint không gọi HF trực tiếp.
- `/api/health`: compatibility wrapper cho Frontend/deployment cũ.

## Kiểm thử

```powershell
python -m pytest backend/tests -v
python -m pytest backend/tests_fastapi -v
python -m compileall backend/app
npm run typecheck
npm run test:unit
```

Unit tests phải mock Hugging Face; không dùng token thật và không gọi provider
thật. Integration/E2E cần DB hoặc credential phải được báo
`BLOCKED_ENVIRONMENT` nếu môi trường không sẵn sàng.

## Tài liệu vận hành

- [Hugging Face migration và runbook](docs/HUGGINGFACE_MIGRATION.md)
- [WebChat ingestion contract](docs/WEBCHAT_INGESTION_CONTRACT.md)
- [Database scripts](scripts/database/README_database.md)
- [Backend](backend/README.md)

## Bảo mật

- Token chỉ tồn tại ở Backend và được ưu tiên theo thứ tự `HF_TOKEN`, sau đó
  `HUGGINGFACE_API_KEY`.
- Input được chuẩn hóa và che dữ liệu nhạy cảm trước khi gửi provider.
- Không log nội dung hội thoại đầy đủ, Authorization header hoặc raw token.
- Lỗi provider không được biến thành `neutral`; record giữ `pending` hoặc chuyển
  `failed` theo retry policy.
- Hãy rotate token ngay nếu nghi ngờ bị lộ.
