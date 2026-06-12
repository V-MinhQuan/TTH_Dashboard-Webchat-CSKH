# Sprint 6: Phân tích Cảm xúc & Xu hướng Hội thoại

## Tổng quan

Module Sprint 6 bổ sung khả năng **phân tích cảm xúc, chủ đề và điểm hài lòng** cho từng tin nhắn khách hàng trong hệ thống WebChat CSKH của FLIC. Toàn bộ hoạt động trên dữ liệu hiện có trong SQL Server, **không thay đổi bảng gốc**.

---

## Bước 1: Chạy SQL Migration

Trước khi sử dụng API, chạy script tạo bảng một lần trên SQL Server:

```sql
-- Chạy file: backend/database/sprint6_message_analytics.sql
-- Có thể chạy nhiều lần (idempotent)
```

Script sẽ tạo:
- Bảng `dbo.WebChat_MessageAnalytics`
- 4 index tối ưu hiệu năng query

---

## Kiến trúc module

```
WebChat_MessageLogs (bảng gốc, chỉ đọc)
         │
         ▼
  analytics.repository.js   ← getUnanalyzedMessages()
         │
         ▼
  text-preprocessing         ← cleanText() — chuẩn hóa văn bản
         │
         ▼
  sentiment-analyzer         ← analyzeSentiment() → positive/negative/neutral
         │
         ▼
  topic-detector             ← detectTopics() → 12 nhóm chủ đề CSKH
         │
         ▼
  satisfaction-score         ← calculateSatisfactionScore() → 0-100
         │
         ▼
  WebChat_MessageAnalytics   ← saveMessageAnalytics() (bảng mới)
```

---

## API Reference

### POST `/api/analytics/run`

Kích hoạt pipeline phân tích. Nên chạy định kỳ (cron job) hoặc thủ công.

**Request Body:**
```json
{
  "limit": 500,
  "startDate": "2026-06-01",
  "endDate": "2026-06-30",
  "forceReanalyze": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Phân tích hoàn tất. Đã xử lý 100 tin nhắn, lưu 95 bản ghi.",
  "data": {
    "processed": 100,
    "saved": 95,
    "skipped": 5
  }
}
```

---

### GET `/api/analytics/sentiment-summary`

**Query params:** `startDate`, `endDate`, `source`

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "positive": 120,
      "negative": 45,
      "neutral": 85,
      "total": 250
    },
    "avgScores": {
      "positive": 0.62,
      "negative": -0.55,
      "neutral": 0.01
    }
  }
}
```

---

### GET `/api/analytics/sentiment-trend`

**Query params:** `startDate`, `endDate`, `source`

**Response:**
```json
{
  "success": true,
  "data": [
    { "date": "2026-06-01", "positive": 15, "negative": 5, "neutral": 10 },
    { "date": "2026-06-02", "positive": 20, "negative": 8, "neutral": 12 }
  ]
}
```

---

### GET `/api/analytics/satisfaction-summary`

**Response:**
```json
{
  "success": true,
  "data": {
    "avgSatisfactionScore": 68.4,
    "totalMessages": 250,
    "needReviewCount": 12,
    "levelDistribution": {
      "very_satisfied": 40,
      "satisfied": 80,
      "neutral": 85,
      "unsatisfied": 30,
      "very_unsatisfied": 15
    }
  }
}
```

---

### GET `/api/analytics/satisfaction-trend`

**Response:**
```json
{
  "success": true,
  "data": [
    { "date": "2026-06-01", "avgScore": 72.1, "count": 30, "needReviewCount": 2 }
  ]
}
```

---

### GET `/api/analytics/topics`

**Response:**
```json
{
  "success": true,
  "data": [
    { "topicKey": "shipping", "topicLabel": "Giao hàng & Vận chuyển", "count": 85 },
    { "topicKey": "billing", "topicLabel": "Thanh toán & Hóa đơn", "count": 62 },
    { "topicKey": "complaint", "topicLabel": "Khiếu nại & Phàn nàn", "count": 34 }
  ]
}
```

---

### GET `/api/analytics/negative-keywords`

**Response:**
```json
{
  "success": true,
  "data": [
    { "keyword": "chờ lâu", "count": 28 },
    { "keyword": "hàng bị lỗi", "count": 22 }
  ]
}
```

---

### GET `/api/analytics/negative-conversations`

**Query params:** `startDate`, `endDate`, `source`, `page` (mặc định 1), `pageSize` (mặc định 20, tối đa 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "records": [
      {
        "id": 42,
        "messageId": 12345,
        "conversationId": 678,
        "customerId": "CUST001",
        "source": "ZaloOA",
        "sentimentLabel": "negative",
        "sentimentScore": -0.75,
        "satisfactionScore": 18.5,
        "satisfactionLevel": "very_unsatisfied",
        "needStaffReview": true,
        "detectedTopics": ["complaint", "shipping"],
        "matchedNegativeKeywords": ["thất vọng", "mất hàng"],
        "messageAt": "2026-06-01T08:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 12
    }
  }
}
```

---

## 12 Chủ đề CSKH

| Key | Label |
|-----|-------|
| `billing` | Thanh toán & Hóa đơn |
| `shipping` | Giao hàng & Vận chuyển |
| `product_quality` | Chất lượng Sản phẩm |
| `return_exchange` | Đổi trả & Bảo hành |
| `account_technical` | Tài khoản & Kỹ thuật |
| `promotion_discount` | Khuyến mãi & Ưu đãi |
| `complaint` | Khiếu nại & Phàn nàn |
| `inquiry` | Hỏi thông tin & Tư vấn |
| `staff_attitude` | Thái độ Nhân viên |
| `response_time` | Thời gian Phản hồi |
| `positive_feedback` | Phản hồi Tích cực |
| `other` | Khác |

---

## Mức độ hài lòng

| Level | Score | Label |
|-------|-------|-------|
| `very_satisfied` | ≥ 80 | Rất hài lòng |
| `satisfied` | 60–79 | Hài lòng |
| `neutral` | 40–59 | Trung tính |
| `unsatisfied` | 20–39 | Chưa hài lòng |
| `very_unsatisfied` | < 20 | Rất không hài lòng |

---

## Trigger `needStaffReview = true`

Tin nhắn sẽ được đánh dấu cần xem xét khi phát hiện từ khóa khủng hoảng như:
- `lừa đảo`, `gian lận`, `tố cáo`, `kiện`, `khởi kiện`
- `rất thất vọng`, `rất bức xúc`, `không thể chấp nhận`
- `đăng lên mạng`, `review xấu`, `tẩy chay`
- Hoặc khi `satisfactionScore < 20`
