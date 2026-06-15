# FastAPI Backend - FLIC WebChat Customer Support Dashboard

Thành phần backend chính thức của dự án FLIC WebChat Customer Support Dashboard, được xây dựng bằng **Python** và **FastAPI**, thay thế hoàn toàn Node.js backend cũ.

---

## 1. Cấu trúc thư mục hiện tại

```text
backend/
├── app/                        # Mã nguồn ứng dụng FastAPI chính
│   ├── core/                   # Cấu hình hệ thống, ghi log, xử lý ngoại lệ (exceptions)
│   ├── db/                     # Quản lý kết nối Database (SQL Server Connection Pool)
│   ├── repositories/           # Tương tác truy vấn SQL Server trực tiếp
│   ├── routers/                # Định nghĩa các Route / Endpoints của API (prefix: /api)
│   ├── schemas/                # Định nghĩa cấu trúc dữ liệu Pydantic (Request/Response validation)
│   ├── services/               # Lớp xử lý logic nghiệp vụ và đồng bộ dữ liệu
│   ├── utils/                  # Các hàm tiện ích dùng chung
│   └── main.py                 # File khởi tạo ứng dụng FastAPI chính
├── database/                   # Các script SQL migration
├── db/                         # Module tiện ích Python kết nối database dùng chung
├── docs/                       # Tài liệu thiết kế API
├── reports/                    # Báo cáo kỹ thuật và kiểm kê di chuyển backend
├── scripts/                    # Các script Python chạy tác vụ admin/tiện ích
├── tests_fastapi/              # Thư mục chứa bộ unit/integration test sử dụng pytest
├── .env.example                # Tệp cấu hình mẫu biến môi trường
├── .env                        # Tệp cấu hình biến môi trường thực tế (không commit)
└── requirements.txt            # Khai báo các thư viện Python phụ thuộc
```

---

## 2. Hướng dẫn cài đặt và cấu hình

### Bước 1: Di chuyển vào thư mục backend
Mở terminal/command prompt và chuyển hướng vào thư mục backend:
```bash
cd backend
```

### Bước 2: Khởi tạo và kích hoạt Virtual Environment (Môi trường ảo)
```bash
# Tạo môi trường ảo
python -m venv .venv

# Kích hoạt trên Windows (PowerShell/CMD):
.venv\Scripts\activate

# Hoặc kích hoạt trên Linux/macOS:
source .venv/bin/activate
```

### Bước 3: Cài đặt các thư viện phụ thuộc
Sau khi kích hoạt môi trường ảo, chạy lệnh cài đặt:
```bash
pip install -r requirements.txt
```
*Các thư viện chính bao gồm: `fastapi`, `uvicorn`, `pyodbc` (để kết nối SQL Server), `pydantic-settings`, `httpx`, `pytest`.*

### Bước 4: Cấu hình biến môi trường
Sao chép tệp mẫu và điền thông tin kết nối SQL Server của bạn vào `.env`:
```bash
copy .env.example .env
```
Nội dung tệp cấu hình `.env` mẫu:
```env
APP_ENV=development
APP_NAME="FLIC FastAPI Backend"
APP_VERSION="fastapi-v1"

# SQL Server Configuration
DB_SERVER=localhost
DB_PORT=1433
DB_NAME=dbFLIC_dev
DB_USER=sa
DB_PASSWORD=your_password
DB_DRIVER="ODBC Driver 17 for SQL Server"
DB_ENCRYPT=False
DB_TRUST_SERVER_CERTIFICATE=True
DB_TIMEOUT_SECONDS=5

# ML Service Integration
ML_SERVICE_URL=http://localhost:8001
ML_TIMEOUT_SECONDS=15.0

# CORS Configuration (phân cách bằng dấu phẩy)
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173
```

---

## 3. Khởi chạy Backend

Đảm bảo bạn đã kích hoạt virtual environment:
```bash
# Chạy uvicorn server trên cổng 5000
python -m uvicorn app.main:app --host 0.0.0.0 --port 5000 --reload
```

* **Trang chủ API**: `http://localhost:5000/`
* **Swagger UI (Interactive Docs)**: `http://localhost:5000/docs`
* **Health Check**: `http://localhost:5000/api/health`

---

## 4. Chạy kiểm thử tự động (Unit Tests)

Bộ test suite được cài đặt trong `tests_fastapi/` sử dụng `pytest`.

```bash
# Kích hoạt venv và chạy pytest
cd backend
.venv\Scripts\activate
python -m pytest tests_fastapi -v
```

---

## 5. Danh sách API Endpoints chính

### Nhóm Health Check
* `GET /api/health` — Trạng thái sức khỏe toàn bộ backend (kèm DB & ML Service).
* `GET /api/health/ml` — Trạng thái kết nối trực tiếp đến ml-service.

### Nhóm Dashboard
* `GET /api/dashboard/kpi` — Thống kê KPI cốt lõi (hội thoại, khách hàng mới, phân bổ kênh).

### Nhóm Sentiment & Analytics
* `GET /api/analytics/sentiment-summary` — Tổng hợp phân bổ cảm xúc (Tích cực, Trung lập, Tiêu cực).
* `GET /api/analytics/sentiment-trend` — Thống kê xu hướng cảm xúc theo ngày.
* `GET /api/analytics/satisfaction-summary` — Tổng hợp chỉ số CSAT thỏa mãn của khách hàng.
* `GET /api/analytics/satisfaction-trend` — Biểu đồ xu hướng CSAT theo ngày.
* `GET /api/analytics/topics` — Thống kê tần suất các chủ đề phổ biến.
* `GET /api/analytics/need-review-conversations` — Danh sách các hội thoại cần nhân viên xem xét (`needStaffReview = True`).
* `GET /api/analytics/negative-conversations` — Danh sách các hội thoại tiêu cực.
* `GET /api/analytics/need-review-keywords` — Phân tích từ khóa phổ biến trong hội thoại cần review.
* `GET /api/analytics/negative-keywords` — Phân tích từ khóa phổ biến trong hội thoại tiêu cực.
* `POST /api/sentiment/predict` — Dự đoán cảm xúc của văn bản nhập vào (gọi qua ml-service).
* `POST /api/analytics/run` — API tác vụ phân tích lại hàng loạt (Trả về `501 Not Implemented` do luồng reprocess/ghi DB yêu cầu phê duyệt riêng).

### Nhóm Conversations
* `GET /api/conversations` — Danh sách hội thoại phân trang (kèm bộ lọc khoảng ngày, kênh, nguồn).
* `GET /api/conversations/{conversation_id}` — Lấy thông tin chi tiết một hội thoại (bao gồm nội dung tin nhắn).
* `GET /api/conversations/by-message/{message_id}` — Tra cứu hội thoại tương ứng thông qua ID tin nhắn.

---

## 6. Lưu ý về Node.js Legacy

Toàn bộ mã nguồn Node.js cũ đã được di chuyển sang thư mục lưu trữ `/backend_legacy_node/` ở thư mục gốc của dự án. Không sử dụng hoặc chạy Node.js cho môi trường phát triển hay vận hành thông thường.
