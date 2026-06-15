# Database Scripts — TTH Dashboard WebChat CSKH

## Cấu trúc thư mục

```
scripts/database/
├── README_database.md          # Tài liệu này
├── schema_check.sql            # Kiểm tra schema hiện tại
└── add_user_role_column.sql    # Thêm cột Role cho phân quyền
```

## Yêu cầu kết nối

Ứng dụng kết nối SQL Server qua các biến môi trường trong `backend/.env`:

```env
DB_SERVER=<địa chỉ SQL Server>
DB_PORT=1433
DB_DATABASE=<tên database>
DB_USER=<username>
DB_PASSWORD=<password>
DB_DRIVER=ODBC Driver 17 for SQL Server
```

## Các bảng chính

| Bảng | Mục đích | Ghi chú |
|------|----------|---------|
| `dbo.WebChat_Conversations` | Danh sách hội thoại | Khóa: `Id`, `CustomerId`, `Source` |
| `dbo.WebChat_ConversationStatus` | Trạng thái hội thoại (open/closed) | `NoResponseNeeded = 1` = closed |
| `dbo.WebChat_MessageLogs` | Nhật ký tin nhắn | `FromHost = 1` = bot, `0` = khách |
| `dbo.WebChat_MessageAnalytics` | Kết quả phân tích sentiment | Từ ML service |
| `dbo.WebChat_Messagelogs_User_Info` | Thông tin display name khách hàng | `SenderId` + `Source` |
| `dbo.[User]` | Tài khoản nhân viên CSKH | Dùng cho login |

## Mapping trạng thái

**Trạng thái hội thoại:**
- `NoResponseNeeded = 1` → `closed` (Hoàn thành)
- `NoResponseNeeded = 0` → `open` (Đang xử lý)
- Không có record trong ConversationStatus → `new` (Chưa xử lý)

**Nguồn kênh:**
- `facebook`, `fb`, `messenger` → Facebook
- `zalooa`, `zalo` → Zalo OA
- `zalobusiness`, `zalobiz` → Zalo Business
- `chatwidget`, `website`, `web` → Chat Widget

## Hướng dẫn thực thi SQL Scripts

### 1. Kiểm tra schema (chạy trước khi deploy)
```sql
-- Chạy trong SQL Server Management Studio (SSMS)
-- hoặc qua sqlcmd:
sqlcmd -S <server> -d <database> -U <user> -P <password> -i schema_check.sql
```

### 2. Thêm cột Role cho User (chạy 1 lần)
```sql
-- Chạy script này để hỗ trợ role-based access
-- Sẽ thêm cột Role với default = 'staff'
-- Cần cập nhật thủ công username của manager

-- Trước khi chạy: xác nhận username của manager với admin hệ thống
-- Sau khi chạy: restart FastAPI backend
sqlcmd -S <server> -d <database> -U <user> -P <password> -i add_user_role_column.sql
```

## Cơ chế phân quyền

Sau khi thêm cột Role:

| Role | Quyền | Endpoint |
|------|-------|---------|
| `manager` | Xem tất cả, duyệt FAQ, quản lý | Tất cả màn hình |
| `staff` | Xem hội thoại của mình, đề xuất FAQ | Giới hạn |

## Lưu ý về database driver

Phần mềm ODBC cần cài đặt trên máy chủ chạy Python:
- Tải: [Microsoft ODBC Driver for SQL Server](https://docs.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server)
- Phiên bản được cấu hình: `ODBC Driver 17 for SQL Server`
- Có thể thay đổi qua biến môi trường `DB_DRIVER` trong `.env`

## Backup trước khi thay đổi

```sql
-- Luôn backup bảng User trước khi thêm cột
SELECT * INTO [User_backup_YYYYMMDD] FROM [User];
```
