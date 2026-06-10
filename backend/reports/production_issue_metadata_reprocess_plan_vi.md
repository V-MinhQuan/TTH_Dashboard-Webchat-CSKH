# KẾ HOẠCH BÀN GIAO & VẬN HÀNH TÁI XỬ LÝ DỮ LIỆU SỰ CỐ TRÊN MÔI TRƯỜNG PRODUCTION
## (PRODUCTION REPROCESS & DEPLOYMENT PLAN - INDEPENDENT ISSUE DETECTION)

> [!IMPORTANT]  
> Báo cáo này thiết lập kế hoạch triển khai và chạy lại (reprocess) dữ liệu sự cố (Issue Metadata) cho hệ thống **Sentiment Analysis & Independent Issue Detection** trên môi trường Production.  
> **Khuyến nghị hiện tại:** `PASS_WITH_MONITORING`. Không tự ý thực hiện thay đổi dữ liệu hoặc chạy reprocess trực tiếp trên Production mà không có sự giám sát và phê duyệt từ Hội đồng kỹ thuật / Vận hành nghiệp vụ.

---

## 1. MỤC TIÊU & PHẠM VI (GOALS & SCOPE)
* **Mục tiêu:** Cập nhật cấu trúc bảng `dbo.WebChat_MessageAnalytics` trên Production để lưu trữ bổ sung 4 trường siêu dữ liệu sự cố kỹ thuật/nghiệp vụ: `issueFlag`, `issueType`, `issueReason`, `issueConfidence`.
* **Phạm vi dữ liệu:** Tái xử lý toàn bộ hội thoại khách hàng lịch sử thông qua pipeline Ensemble (PhoBERT + Rule + ViSoBERT) để gán nhãn sự cố và cập nhật chỉ số `needStaffReview`.
* **Yêu cầu an toàn:** 
  - Đảm bảo 100% dữ liệu lịch sử được sao lưu toàn vẹn trước khi chạy.
  - Phân luồng cập nhật theo lô (batch size = 500) để không gây khóa bảng (table lock) hay quá tải tài nguyên RAM/CPU của database server Production.
  - Hỗ trợ cơ chế checkpoint để có thể tiếp tục chạy lại từ điểm lỗi (Resume Capability) mà không phải làm lại từ đầu.

---

## 2. BƯỚC 1: KIỂM TRA ĐIỀU KIỆN TIỀN ĐỀ (PRE-DEPLOYMENT CHECKS)

Trước khi thực hiện bất kỳ truy vấn SQL nào trên Production, kiểm tra các điều kiện sau:

1. **Kết nối Database:** Đảm bảo chuỗi kết nối từ Backend sang DB Production hoạt động tốt thông qua tài khoản có quyền `ALTER TABLE` và `CREATE INDEX`.
2. **Trạng thái ML Service:** Gọi endpoint Health Check của mô hình để đảm bảo các service AI đang trực tuyến (Online) và có tích hợp đầy đủ ONNX Runtime của ViSoBERT:
   ```bash
   curl -X GET http://localhost:8001/health
   ```
   *Yêu cầu phản hồi:* `visobertAvailable: true`, `sentimentMode: "ensemble"`.

---

## 3. BƯỚC 2: SAO LƯU DỮ LIỆU AN TOÀN (DATABASE BACKUP PLAN)

Thực hiện sao lưu bảng `dbo.WebChat_MessageAnalytics` sang một bảng tạm riêng trên cùng database bằng truy vấn SQL dưới đây:

### 2.1. Lấy tổng số dòng trước khi backup
```sql
SELECT COUNT(*) AS totalRowsBeforeBackup FROM dbo.WebChat_MessageAnalytics;
```

### 2.2. Tạo bảng backup (kèm timestamp)
Chạy script SQL tạo bảng sao lưu:
```sql
-- Ví dụ chạy tại thời điểm 2026-06-09 21:00:00
SELECT *
INTO dbo.WebChat_MessageAnalytics_Backup_Ensemble_20260609_210000
FROM dbo.WebChat_MessageAnalytics;
```

### 2.3. Xác minh tính toàn vẹn của Backup
Đảm bảo số dòng trong bảng backup bằng chính xác số dòng gốc:
```sql
SELECT COUNT(*) AS backupRows FROM dbo.WebChat_MessageAnalytics_Backup_Ensemble_20260609_210000;
```
> [!CAUTION]  
> Chỉ tiếp tục bước tiếp theo nếu `backupRows` trùng khớp hoàn toàn với `totalRowsBeforeBackup`. Nếu lệch dù chỉ 1 dòng, dừng khẩn cấp và kiểm tra lại transaction log.

---

## 4. BƯỚC 3: DI CƯ THỂ THỨC (SCHEMA MIGRATION ON PRODUCTION)

Áp dụng thay đổi cấu trúc bảng để thêm các cột lưu trữ dữ liệu sự cố. Do SQL Server không cho phép tạo cột mới và tạo chỉ mục (index) trỏ đến chúng trong cùng một lô phân tích (query batch) nếu chưa được biên dịch, ta thực hiện chia làm 2 lô truy vấn riêng biệt:

### Lô 1: Thêm cột mới
```sql
ALTER TABLE dbo.WebChat_MessageAnalytics
ADD 
  issueFlag BIT NULL,
  issueType NVARCHAR(100) NULL,
  issueReason NVARCHAR(500) NULL,
  issueConfidence FLOAT NULL;
```

### Lô 2: Tạo chỉ mục tối ưu hóa truy vấn tìm kiếm
```sql
CREATE NONCLUSTERED INDEX IX_WebChat_MessageAnalytics_IssueMetadata
ON dbo.WebChat_MessageAnalytics (issueFlag)
INCLUDE (messageId, issueType, issueConfidence);
```

---

## 5. BƯỚC 4: KỊCH BẢN CHẠY LẠI BẰNG BATCH (BATCH REPROCESS CONFIGURATION)

Quá trình chạy lại dữ liệu lịch sử sử dụng script `ensemble-reprocess.js` kèm theo các tham số cấu hình an toàn cho môi trường Production:

### 4.1. Thông số Cấu hình Khuyến nghị
* **Batch Size:** `500` dòng/lần. Đây là kích thước lô tối ưu đã qua kiểm thử trên môi trường Dev/Test nhằm cân bằng giữa tốc độ gọi API mô hình và giảm thiểu thời gian chiếm giữ khóa ghi của SQL Server.
* **Thời gian trễ giữa các lô:** `100ms` (nếu tải CPU của DB tăng cao > 70%).
* **Cơ chế khôi phục trạng thái (Checkpoint):** Lưu trạng thái xử lý vào file `.ensemble-reprocess-state.json`. Khi có lỗi mạng hoặc gián đoạn giữa chừng, chỉ cần chạy kèm cờ `--resume` để tiếp tục xử lý từ ID cuối cùng đã ghi nhận.

### 4.2. Lệnh Chạy trên Môi trường Production
```bash
# Thiết lập biến môi trường để kích hoạt ghi DB thực tế
$env:ENSEMBLE_WRITE_DB="true"
$env:REQUIRE_VISOBERT="true"

# Khởi chạy reprocess phân lô tự động
node scripts/ensemble-reprocess.js --batch-size=500 --state=./.ensemble-production-reprocess-state.json
```

---

## 6. BƯỚC 5: XÁC MINH SAU KHI TRIỂN KHAI (POST-DEPLOYMENT VALIDATION & AUDIT)

Sau khi quá trình reprocess kết thúc thành công, chạy các truy vấn SQL dưới đây để đối chiếu và kiểm tra tính nhất quán dữ liệu:

### 5.1. Kiểm tra dòng trống
Đảm bảo tất cả các dòng tin nhắn chứa nội dung hợp lệ đều đã được xử lý (không còn nhãn Cảm xúc hoặc thông tin sự cố nào bị `NULL`):
```sql
SELECT COUNT(*) AS remainingNullCount
FROM dbo.WebChat_MessageAnalytics
WHERE sentimentLabel IS NULL 
   OR issueFlag IS NULL;
```
*Kết quả kỳ vọng:* `0` dòng.

### 5.2. Thống kê phân phối nhãn Cảm xúc & Sự cố mới
```sql
SELECT sentimentLabel, issueFlag, COUNT(*) AS quantity
FROM dbo.WebChat_MessageAnalytics
GROUP BY sentimentLabel, issueFlag
ORDER BY sentimentLabel, issueFlag;
```

### 5.3. Rà soát tỷ lệ cảnh báo cần Nhân viên hỗ trợ xem xét (`needStaffReview`)
Đảm bảo các trường hợp có `issueFlag = 1` hoặc `sentimentLabel = 'negative'` đều phải được đánh dấu `needStaffReview = 1`:
```sql
SELECT COUNT(*) AS anomalyCount
FROM dbo.WebChat_MessageAnalytics
WHERE (sentimentLabel = 'negative' OR issueFlag = 1)
  AND needStaffReview = 0;
```
*Kết quả kỳ vọng:* `0` dòng (nếu lớn hơn 0, hệ thống logic nghiệp vụ đang bỏ sót cảnh báo).

---

## 7. BƯỚC 6: PHƯƠNG ÁN KHÔI PHỤC (ROLLBACK STRATEGY)

Trong trường hợp xảy ra sự cố nghiêm trọng (db bị lock, mô hình đưa ra nhãn sai hàng loạt gây sai lệch số liệu báo cáo, lỗi timeout ảnh hưởng đến trải nghiệm CSKH trực tiếp), thực hiện quy trình Rollback theo các bước sau:

### Bước 1: Dừng ngay tiến trình script reprocess đang chạy
Sử dụng Task Manager hoặc lệnh dòng lệnh để ngắt tiến trình Node.js:
```bash
# Tìm và dừng tiến trình node chạy reprocess
Stop-Process -Name "node" -Force
```

### Bước 2: Hoàn trả cấu trúc và dữ liệu bảng ban đầu
Sử dụng bảng Backup đã tạo ở Bước 2 để ghi đè phục hồi dữ liệu gốc:
```sql
BEGIN TRANSACTION;

-- 1. Xóa bảng hiện tại bị lỗi
DROP TABLE dbo.WebChat_MessageAnalytics;

-- 2. Khôi phục từ bảng sao lưu dự phòng
SELECT * 
INTO dbo.WebChat_MessageAnalytics 
FROM dbo.WebChat_MessageAnalytics_Backup_Ensemble_20260609_210000;

-- 3. Tạo lại các ràng buộc khóa ngoại và chỉ mục gốc (nếu có)
ALTER TABLE dbo.WebChat_MessageAnalytics
ADD CONSTRAINT PK_WebChat_MessageAnalytics PRIMARY KEY CLUSTERED (id);

CREATE NONCLUSTERED INDEX IX_WebChat_MessageAnalytics_MessageId
ON dbo.WebChat_MessageAnalytics (messageId);

COMMIT TRANSACTION;
```

> [!WARNING]  
> Quá trình Rollback sẽ xóa toàn bộ các trường dữ liệu sự cố mới và khôi phục nhãn cảm xúc cũ của các cuộc hội thoại. Hãy chắc chắn thông báo cho đội vận hành trước khi thực hiện để tạm dừng đồng bộ dữ liệu báo cáo PowerBI / Dashboard CSKH.
