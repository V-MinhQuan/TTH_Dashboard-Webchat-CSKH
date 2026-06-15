# TTH Dashboard — WebChat CSKH (FLIC)

Dashboard phân tích hội thoại và cảm xúc cho hệ thống WebChat Chăm Sóc Khách Hàng.

## Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────┐
│  Frontend  React/TypeScript + Vite          :5173 (dev) │
├─────────────────────────────────────────────────────────┤
│  FastAPI Backend  (backend/app/)            :5000        │
├─────────────────────────────────────────────────────────┤
│  ML Service  FastAPI + PhoBERT ONNX         :8001        │
├─────────────────────────────────────────────────────────┤
│  Database  Microsoft SQL Server             :1433        │
├─────────────────────────────────────────────────────────┤
│  Legacy Node.js Backend  (backend_legacy_node/) - :5000  │
│  (Lưu trữ làm rollback, không chạy mặc định)            │
└─────────────────────────────────────────────────────────┘
```

> **Lưu ý:** Backend chính thức hoạt động là **FastAPI :5000** kết nối với **ML Service :8001** và database.
> Node.js backend đã được di chuyển sang thư mục lưu trữ `backend_legacy_node/` để rollback khi cần thiết.

---

## Yêu cầu môi trường

| Công cụ | Phiên bản tối thiểu | Ghi chú |
|---------|-------------------|---------|
| Node.js | 18+ | Khởi chạy frontend React |
| Python | 3.10+ | Chạy FastAPI backend + ml-service |
| npm | 9+ | Quản lý package frontend |
| SQL Server | 2019+ | Có thể dùng SQL Server Express |
| ODBC Driver 17 | — | Bắt buộc để kết nối SQL Server từ Python |

---

## Cài đặt lần đầu

### 1. Clone và cài frontend

```bash
# Cài dependencies frontend (chạy ở thư mục gốc)
npm install
```

### 2. Cấu hình biến môi trường

Tạo các file `.env` từ file mẫu:

```bash
# Backend (Node.js + FastAPI dùng chung)
copy backend\.env.example backend\.env

# ML Service
copy ml-service\.env.example ml-service\.env
```

Mở `backend/.env` và điền thông tin SQL Server:

```env
DB_SERVER=localhost
DB_PORT=1433
DB_DATABASE=dbFLIC_dev
DB_USER=sa
DB_PASSWORD=your_password
```

### 3. Tạo virtual environment và cài dependencies cho FastAPI backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
pip install -r requirements.txt
deactivate

cd ..
```

### 4. Tạo virtual environment và cài dependencies cho ml-service

```bash
cd ml-service
python -m venv .venv

# Windows
.venv\Scripts\activate
pip install -r requirements.txt
deactivate

cd ..
```

### 5. Tải model PhoBERT (chỉ cần chạy một lần)

Model PhoBERT sẽ được tải từ HuggingFace và export sang ONNX (~500 MB, mất 5–15 phút lần đầu):

```bash
cd ml-service
.venv\Scripts\activate
python download_model.py
deactivate
cd ..
```

Model sẽ được lưu tại `ml-service/models/phobert-sentiment-onnx/`.

---

## Chạy project (Development)

Cần mở **3 terminal riêng biệt**, khởi động theo thứ tự:

### Terminal 1 — ML Service (cổng 8001)

```bash
cd ml-service
.venv\Scripts\activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

Hoặc dùng script sẵn có (Windows):

```bash
cd ml-service
run_windows.bat
```

Kiểm tra: http://localhost:8001/health

---

### Terminal 2 — FastAPI Backend (cổng 5000)

```bash
cd backend
.venv\Scripts\activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 5000 --reload
```

Kiểm tra: http://localhost:5000/api/health
Swagger UI: http://localhost:5000/docs

---

### Terminal 3 — Frontend (cổng 5173)

```bash
# Chạy ở thư mục gốc
npm run dev
```

Mở trình duyệt: http://localhost:5173

---

## Chạy Tests

### Frontend build check

```bash
npm run build
```

### FastAPI backend tests

```bash
cd backend
.venv\Scripts\activate
python -m pytest tests_fastapi -q
```

### ML Service tests

```bash
cd ml-service
.venv\Scripts\activate
python -m pytest tests -q
```

### Legacy Node.js backend tests (chỉ chạy khi rollback)

```bash
cd backend_legacy_node
npm test
```

---

## Cấu trúc thư mục

```
TTH_Dashboard-Webchat-CSKH/
├── src/                        # Frontend React/TypeScript
│   └── app/
│       ├── components/         # UI components
│       ├── screens/            # Các màn hình chính
│       ├── services/           # API service layer
│       └── types/              # TypeScript types
│
├── backend/                    # FastAPI Backend (active runtime)
│   ├── app/                    # Mã nguồn FastAPI
│   │   ├── core/               # Config, logging, exceptions
│   │   ├── db/                 # Database session pool
│   │   ├── repositories/       # Data access layer
│   │   ├── routers/            # API endpoints
│   │   ├── schemas/            # Pydantic validation
│   │   ├── services/           # Business logic
│   │   └── main.py             # FastAPI entrypoint
│   ├── database/               # SQL migration scripts
│   ├── db/                     # Module Python kết nối DB dùng chung
│   ├── docs/                   # Tài liệu API
│   ├── reports/                # Báo cáo kỹ thuật
│   ├── scripts/                # Tác vụ tiện ích admin
│   ├── tests_fastapi/          # Bộ unit/integration test (pytest)
│   ├── .env.example            # Mẫu biến môi trường
│   └── requirements.txt        # Python dependencies
│
├── backend_legacy_node/        # Archived Node.js backend (rollback/reference only)
│   ├── controllers/            # Express controllers
│   ├── routes/                 # Express routes
│   ├── services/               # Node.js services
│   ├── repositories/           # Node.js repositories
│   ├── tests/                  # Jest test suite
│   ├── server.js               # Entry point Express
│   └── package.json            # Node.js package
│
├── ml-service/                 # AI Sentiment Analysis service
│   ├── app/                    # FastAPI app
│   │   ├── main.py             # Entrypoint
│   │   ├── model_loader.py     # Load PhoBERT ONNX
│   │   ├── sentiment_predictor.py
│   │   └── ensemble.py         # Ensemble logic
│   ├── models/                 # PhoBERT ONNX (không commit)
│   ├── tests/                  # pytest tests
│   ├── download_model.py       # Script tải model lần đầu
│   ├── run_windows.bat         # Script chạy trên Windows
│   ├── .env.example            # Mẫu biến môi trường
│   └── requirements.txt        # Python dependencies
│
├── docs/                       # Tài liệu kỹ thuật
├── guidelines/                 # Hướng dẫn phát triển
├── .env.example                # (không có, dùng backend/.env.example)
├── .gitignore
├── package.json                # Frontend dependencies
├── vite.config.ts              # Vite config + code splitting
└── README.md
```

---

## API Endpoints chính

### FastAPI Backend (:5000)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/health` | Kiểm tra sức khỏe toàn hệ thống (kèm DB & ML) |
| GET | `/api/health/ml` | Kiểm tra kết nối tới ml-service |
| GET | `/api/dashboard/kpi` | Chỉ số KPI cốt lõi trên Dashboard |
| GET | `/api/analytics/sentiment-summary` | Tổng quan phân bổ cảm xúc |
| GET | `/api/analytics/sentiment-trend` | Biểu đồ xu hướng cảm xúc |
| GET | `/api/analytics/satisfaction-summary` | Điểm CSAT/thỏa mãn khách hàng |
| GET | `/api/analytics/satisfaction-trend` | Biểu đồ xu hướng CSAT |
| GET | `/api/analytics/topics` | Thống kê tần suất chủ đề |
| GET | `/api/analytics/need-review-conversations` | Danh sách cuộc hội thoại cần xem xét |
| GET | `/api/analytics/negative-conversations` | Danh sách cuộc hội thoại tiêu cực |
| GET | `/api/analytics/need-review-keywords` | Phân tích từ khóa cần xem xét |
| GET | `/api/analytics/negative-keywords` | Phân tích từ khóa tiêu cực |
| GET | `/api/conversations` | Danh sách hội thoại có phân trang & lọc |
| GET | `/api/conversations/{conversation_id}` | Chi tiết hội thoại (lịch sử tin nhắn) |
| POST | `/api/sentiment/predict` | Phân tích cảm xúc văn bản real-time |
| POST | `/api/analytics/run` | Chạy lại phân tích (Trả về 501 do luồng reprocess cần duyệt riêng) |

### ML Service (:8001)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/health` | Health + model status |
| POST | `/predict` | Dự đoán cảm xúc (PhoBERT) |
| POST | `/predict-ensemble` | Dự đoán ensemble đầy đủ |
| GET | `/metrics` | Metrics thống kê |

---

## Biến môi trường quan trọng

### `backend/.env`

```env
# Cổng backend FastAPI
FASTAPI_PORT=5000       # FastAPI (uvicorn tự đọc khi chạy)

# SQL Server Configuration
DB_SERVER=localhost
DB_PORT=1433
DB_NAME=dbFLIC_dev
DB_USER=sa
DB_PASSWORD=your_password
DB_DRIVER="ODBC Driver 17 for SQL Server"

# ML Service URL
ML_SERVICE_URL=http://localhost:8001
ML_TIMEOUT_SECONDS=15.0

# CORS Configuration
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173
```

### `ml-service/.env`

```env
# Cho phép backend gọi ml-service
ML_ALLOWED_ORIGINS=http://localhost:5000,http://127.0.0.1:5000

# Chế độ phân tích: ensemble | phobert
SENTIMENT_MODE=ensemble

# Bảo vệ DB
ENSEMBLE_DRY_RUN=true
ENSEMBLE_WRITE_DB=false
```

---

## Xử lý lỗi thường gặp

**Lỗi kết nối SQL Server**
```
Kiểm tra: DB_SERVER, DB_USER, DB_PASSWORD trong backend/.env
Đảm bảo ODBC Driver 17 for SQL Server đã được cài đặt.
```

**ml-service không khởi động được**
```
Kiểm tra thư mục ml-service/models/ đã có model chưa.
Nếu chưa, chạy: python download_model.py
```

**Frontend không gọi được API**
```
Đảm bảo FastAPI backend đang chạy ở cổng 5000.
Kiểm tra CORS_ORIGINS trong backend/.env có chứa http://localhost:5173.
```

**`python` không nhận ra lệnh**
```
Dùng đường dẫn tuyệt đối đến .venv:
  backend/.venv/Scripts/python.exe
  ml-service/.venv/Scripts/python.exe
```
