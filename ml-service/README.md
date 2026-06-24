# ml-service — FLIC PhoBERT Sentiment Service

## 1. Mục đích

`ml-service` là một microservice Python riêng biệt, tách rời khỏi backend chính.

- FastAPI backend gọi service này qua HTTP để phân tích cảm xúc bằng PhoBERT.
- **Nếu service này không chạy**, FastAPI backend sẽ **tự động chuyển sang rule-based sentiment** (không có lỗi, không crash).
- Frontend và các API không bị ảnh hưởng dù service này có chạy hay không.

Model sử dụng: [`wonrax/phobert-base-vietnamese-sentiment`](https://huggingface.co/wonrax/phobert-base-vietnamese-sentiment)  
Engine: ONNX Runtime (qua `optimum[onnxruntime]`) — nhanh hơn PyTorch thuần túy.

---

## 2. Yêu cầu môi trường

| Yêu cầu | Chi tiết |
|---------|---------|
| Python | 3.10 trở lên |
| pip | Phiên bản mới nhất |
| RAM | Tối thiểu 2 GB (khuyến nghị 4 GB+) |
| CPU | Được hỗ trợ đầy đủ (GPU không bắt buộc) |
| GPU | Không cần thiết — ONNX Runtime chạy CPU tốt |
| Internet | Cần khi chạy `download_model.py` lần đầu |

> **Lưu ý về `torch`**: PyTorch chỉ cần thiết khi export model lần đầu (`download_model.py`). Sau khi export xong, inference chạy hoàn toàn qua ONNX Runtime — không cần PyTorch nữa. Nếu muốn giảm dung lượng môi trường production, có thể gỡ `torch` sau khi đã export model.

---

## 3. Cài đặt

### Bước 1: Di chuyển vào thư mục ml-service

```bash
cd ml-service
```

### Bước 2: Tạo virtual environment

```bash
python -m venv .venv
```

### Bước 3: Kích hoạt virtual environment

**Windows:**
```powershell
.venv\Scripts\activate
```

**Linux / macOS:**
```bash
source .venv/bin/activate
```

### Bước 4: Cài đặt dependencies

```bash
# Chạy từ thư mục gốc repo, dùng venv chung
pip install -r requirements.txt
```

> Quá trình này có thể mất 5–15 phút tùy tốc độ mạng và tốc độ máy.

---

## 4. Tải và export model

Chạy lệnh sau để tải model PhoBERT từ HuggingFace và export sang ONNX:

```bash
python download_model.py
```

- Lệnh này **chỉ cần chạy một lần** khi cài đặt lần đầu.
- Model sẽ được lưu vào thư mục: `models/phobert-sentiment-onnx/`
- Nếu thư mục model đã tồn tại, script sẽ hỏi xác nhận trước khi ghi đè.

> Dung lượng model ONNX khoảng ~400–500 MB. Cần kết nối internet ổn định.

---

## 5. Cấu hình biến môi trường

Tạo file `.env` trong thư mục `ml-service/` hoặc đặt biến môi trường trực tiếp trước khi chạy service.

| Biến | Mặc định | Mô tả |
|------|---------|-------|
| `ML_ALLOWED_ORIGINS` | `http://localhost:8000,http://127.0.0.1:8000` | Danh sách origin CORS cho phép, phân cách bằng dấu phẩy |

### Ví dụ cấu hình CORS

```env
# Cho phép FastAPI backend gọi từ port 8000 và 8010
ML_ALLOWED_ORIGINS=http://localhost:8000,http://127.0.0.1:8000,http://localhost:8010
```

> **Lưu ý bảo mật**: Không dùng `allow_origins=["*"]` vì service gọi nội bộ (FastAPI → ml-service). Chỉ liệt kê đúng origin cần thiết.

---

## 6. Khởi động service

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

Service sẽ chạy tại: `http://localhost:8001`

### Chạy trên Windows (khuyến nghị)

```bat
run_windows.bat
```

Hoặc thủ công:

```bat
cd ml-service
.venv\Scripts\activate
set PYTHONIOENCODING=utf-8
set ML_ALLOWED_ORIGINS=http://localhost:8000,http://127.0.0.1:8000
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

---

## 7. Kiểm tra service

### Health check

```bash
curl http://localhost:8001/health
```

Kết quả mong đợi khi model đã tải:
```json
{
  "success": true,
  "status": "ok",
  "modelLoaded": true,
  "modelName": "wonrax/phobert-base-vietnamese-sentiment",
  "engine": "onnxruntime"
}
```

### Metrics (giám sát in-memory)

```bash
curl http://localhost:8001/metrics
```

Kết quả mong đợi:
```json
{
  "success": true,
  "totalRequests": 10,
  "totalTexts": 320,
  "totalErrors": 0,
  "avgLatencyMs": 450.5,
  "totalLatencyMs": 4505.0,
  "lastRequestAt": "2026-06-05T10:00:00Z",
  "modelLoaded": true,
  "engine": "onnxruntime",
  "modelName": "wonrax/phobert-base-vietnamese-sentiment"
}
```

> Metrics reset về 0 khi service restart. Không cần APM tool bên ngoài cho monitoring cơ bản.

### Dự đoán cảm xúc (Predict)

```bash
curl -X POST http://localhost:8001/predict \
  -H "Content-Type: application/json" \
  -d '{
    "texts": [
      "em không đăng nhập được",
      "cảm ơn tư vấn rõ rồi",
      null,
      "",
      "   "
    ]
  }'
```

Kết quả mong đợi:
```json
{
  "success": true,
  "model": "wonrax/phobert-base-vietnamese-sentiment",
  "engine": "onnxruntime",
  "count": 5,
  "results": [
    {
      "text": "em không đăng nhập được",
      "label": "negative",
      "score": -0.93,
      "confidence": 0.93,
      "source": "phobert",
      "rawLabel": "NEG",
      "probabilities": { "positive": 0.02, "neutral": 0.05, "negative": 0.93 }
    },
    {
      "text": "cảm ơn tư vấn rõ rồi",
      "label": "positive",
      "score": 0.87,
      "confidence": 0.87,
      "source": "phobert",
      "rawLabel": "POS",
      "probabilities": { "positive": 0.87, "neutral": 0.10, "negative": 0.03 }
    },
    {
      "text": "",
      "label": "neutral",
      "score": 0.0,
      "confidence": 0.0,
      "source": "phobert",
      "rawLabel": "NEU",
      "probabilities": { "positive": 0.0, "neutral": 1.0, "negative": 0.0 }
    },
    {
      "text": "",
      "label": "neutral",
      "score": 0.0,
      "confidence": 0.0,
      "source": "phobert",
      "rawLabel": "NEU",
      "probabilities": { "positive": 0.0, "neutral": 1.0, "negative": 0.0 }
    },
    {
      "text": "   ",
      "label": "neutral",
      "score": 0.0,
      "confidence": 0.0,
      "source": "phobert",
      "rawLabel": "NEU",
      "probabilities": { "positive": 0.0, "neutral": 1.0, "negative": 0.0 }
    }
  ]
}
```

> **Lưu ý**: `null`, `""`, và whitespace được chuyển thành chuỗi rỗng và trả về neutral. Tokenizer không bao giờ nhận `None`.

---

## 8. Chạy cùng FastAPI backend bằng PM2

### Cài đặt PM2 (nếu chưa có)

```bash
npm install -g pm2
```

### Khởi động cả hai service

```bash
# Khởi động ml-service Python
pm2 start "uvicorn app.main:app --host 0.0.0.0 --port 8001" --name flic-ml-service

# Khởi động FastAPI backend (từ thư mục backend/)
pm2 start "python -m uvicorn app.main:app --host 0.0.0.0 --port 8000" --name flic-dashboard-backend
```

### Xem trạng thái

```bash
pm2 status
pm2 logs flic-ml-service
pm2 logs flic-dashboard-backend
```

### Khởi động lại khi reboot

```bash
pm2 save
pm2 startup
```

---

## 9. Cấu hình trong FastAPI backend

Thêm vào file `backend/.env`:

```env
ML_SERVICE_URL=http://localhost:8001
ML_TIMEOUT_SECONDS=15.0
```

Xem chi tiết tại `backend/.env.example`.

---

## 10. Cơ chế fallback

Khi `ml-service` không chạy hoặc gặp lỗi:

- FastAPI backend **không crash** và **không báo lỗi ra frontend**.
- Hệ thống tự động dùng lại **rule-based sentiment analyzer** (hệ thống cũ).
- Kết quả vẫn được lưu vào DB với `source = "rule-based-fallback"`.
- Frontend và các API không bị ảnh hưởng.

Khi backend khởi động, nó tự động gọi `checkHealth()` một lần để log trạng thái PhoBERT.

---

## 11. Chính sách logging — Bảo mật dữ liệu người dùng

> **QUAN TRỌNG**: Service này **không bao giờ log nội dung đầy đủ của tin nhắn**.

Chỉ được log các trường kỹ thuật:

| Trường được log | Ví dụ |
|----------------|-------|
| `event` | `predict_request`, `predict_response` |
| `batch_size` | `32` |
| `latency_ms` | `420` |
| `success` | `true` / `false` |
| `error_type` | `RuntimeError` |

**Không được log**:
- Nội dung tin nhắn của khách hàng
- Thông tin định danh người dùng
- Token, session, credentials

Log được ghi dưới dạng JSON line (UTF-8 an toàn):
```json
{"event": "predict_batch", "batch_size": 32, "latency_ms": 420, "success": true}
```

---

## 12. Chạy test tự động (Python)

```bash
# Cần cài pytest
pip install pytest

# Chạy từ thư mục ml-service/
pytest tests/test_api.py -v
```

> Các test này dùng mock, không cần tải model thật.

---

## 13. Lỗi thường gặp

### ❌ Lỗi: `ONNX model not found`

**Nguyên nhân**: Chưa chạy `download_model.py`.  
**Giải pháp**: Chạy `python download_model.py` và đợi hoàn tất.

---

### ❌ Lỗi: `ImportError: No module named 'optimum'` hoặc `'torch'`

**Nguyên nhân**: Chưa cài đủ dependencies.  
**Giải pháp**:
```bash
# Chạy từ thư mục gốc repo
pip install -r requirements.txt
```

---

### ❌ Lỗi: `Connection refused` khi Node.js gọi ml-service

**Nguyên nhân**: ml-service chưa chạy hoặc sai port.  
**Giải pháp**:
1. Kiểm tra service đang chạy: `curl http://localhost:8001/health`
2. Kiểm tra `ML_SERVICE_URL` trong `backend/.env` trỏ đúng port `8001`.
3. Node.js sẽ tự động fallback sang rule-based — không cần lo lắng.

---

### ❌ Inference chậm trên máy yếu

**Nguyên nhân**: ONNX Runtime chạy trên CPU với RAM ít.  
**Giải pháp**:
- Tăng `ML_TIMEOUT_FIRST_MS` (mặc định 15000ms) trong `backend/.env`.
- Tăng `ML_TIMEOUT_MS` (mặc định 5000ms) nếu batch thường xuyên timeout.
- Giảm batch size nếu cần (mặc định 32 văn bản/batch).
- Đảm bảo máy có ít nhất 4 GB RAM.

---

### ❌ Lỗi build package trên Windows

**Nguyên nhân**: Một số thư viện cần Visual C++ Build Tools.  
**Giải pháp**:
1. Tải [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/).
2. Cài đặt "Desktop development with C++".
3. Từ thư mục gốc repo, thử lại `pip install -r requirements.txt`.

---

## 14. Cấu trúc thư mục

```
ml-service/
├── app/
│   ├── __init__.py
│   ├── main.py               # FastAPI app, endpoints /health, /metrics, /predict
│   ├── model_loader.py       # Tải ONNX model một lần khi startup
│   ├── sentiment_predictor.py # Batch inference + softmax + label mapping
│   └── schemas.py            # Pydantic schemas cho request/response
├── models/
│   └── phobert-sentiment-onnx/  # Tạo ra sau khi chạy download_model.py
├── tests/
│   ├── __init__.py
│   └── test_api.py           # Test tự động (pytest + mock)
├── download_model.py         # Script tải và export model ONNX
├── .gitignore                # Bỏ qua .venv và models/ khi commit
└── README.md                 # File này
```

---

## 15. Kiểm tra backend đang dùng analyzer nào

FastAPI backend đọc cấu hình:

```env
ML_SERVICE_URL=http://localhost:8001
```

Kỳ vọng:

- `ml-service` đang chạy: backend dùng PhoBERT cho các tin đủ điều kiện.
- `ml-service` tắt hoặc lỗi: backend tự fallback về rule-based, không làm hỏng API/frontend.
- Frontend không cần thay đổi.

Sau khi chạy migration `backend/database/sprint6_add_analyzer_version.sql`, kiểm tra nguồn analyzer bằng:

```sql
SELECT TOP 20
  id,
  messageId,
  sentimentLabel,
  sentimentScore,
  sentimentReason,
  analyzerVersion,
  sentimentSource
FROM dbo.WebChat_MessageAnalytics
ORDER BY id DESC;
```

Giá trị mong đợi cho bản ghi mới:

- `sentimentSource = 'phobert'` hoặc `'cache'`, `analyzerVersion = 'phobert-onnx-v1'` khi dùng PhoBERT.
- `sentimentSource = 'rule-based'`, `analyzerVersion = 'rule-based-v1'` khi dùng rule-based trực tiếp.
- `sentimentSource = 'rule-based-fallback'`, `analyzerVersion = 'rule-based-fallback-v1'` khi `ml-service` lỗi hoặc không chạy.
