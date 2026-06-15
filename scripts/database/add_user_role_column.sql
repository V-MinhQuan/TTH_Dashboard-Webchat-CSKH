-- ==============================================================
-- add_user_role_column.sql
-- Thêm cột Role vào bảng [User] để hỗ trợ phân quyền
-- TTH Dashboard — WebChat CSKH (FLIC)
--
-- HƯỚNG DẪN:
-- 1. Chạy script schema_check.sql trước để kiểm tra schema hiện tại
-- 2. Chạy BƯỚC 1 để thêm cột Role
-- 3. Chạy BƯỚC 2 để gán role mặc định cho tất cả user
-- 4. Chạy BƯỚC 3 để cập nhật role cho manager/admin cụ thể
-- ==============================================================

-- BƯỚC 1: Kiểm tra và thêm cột Role nếu chưa tồn tại
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'User' AND COLUMN_NAME = 'Role'
)
BEGIN
    ALTER TABLE [User]
    ADD [Role] NVARCHAR(50) NOT NULL DEFAULT 'staff';

    PRINT 'Đã thêm cột Role vào bảng [User] với giá trị mặc định là ''staff''.';
END
ELSE
BEGIN
    PRINT 'Cột Role đã tồn tại trong bảng [User]. Bỏ qua bước này.';
END;

-- BƯỚC 2: Gán role mặc định 'staff' cho tất cả user hiện tại
-- (chỉ chạy nếu cột Role vừa được thêm và tất cả đang là NULL)
UPDATE [User]
SET [Role] = 'staff'
WHERE [Role] IS NULL OR [Role] = '';

PRINT 'Đã gán role ''staff'' cho tất cả user chưa có role.';

-- BƯỚC 3: Cập nhật role 'manager' cho các user quản lý
-- QUAN TRỌNG: Sửa danh sách username bên dưới cho phù hợp thực tế
-- Hiện tại hardcode trong code là: ('test', 'thuynt')
UPDATE [User]
SET [Role] = 'manager'
WHERE UserName IN (
    'test',       -- Account test (manager)
    'thuynt'      -- Thuy NT (manager)
    -- Thêm username khác nếu cần:
    -- 'username_manager_khac',
);

PRINT 'Đã gán role ''manager'' cho các user quản lý.';

-- BƯỚC 4: Kiểm tra kết quả
SELECT
    UserName,
    HoTen,
    DangHoatDong,
    [Role]
FROM [User]
ORDER BY [Role], UserName;

-- ==============================================================
-- LƯU Ý:
-- Sau khi chạy script này:
-- 1. Khởi động lại FastAPI backend
-- 2. Test login với tài khoản manager và staff
-- 3. Kiểm tra role trả về trong response /api/auth/login
-- ==============================================================
