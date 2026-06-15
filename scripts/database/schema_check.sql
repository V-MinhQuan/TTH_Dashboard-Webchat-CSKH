-- ==============================================================
-- schema_check.sql
-- Kiểm tra schema database trước khi chạy ứng dụng
-- TTH Dashboard — WebChat CSKH (FLIC)
-- ==============================================================

-- 1. Liệt kê tất cả bảng trong database hiện tại
SELECT
    TABLE_SCHEMA,
    TABLE_NAME,
    TABLE_TYPE
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_SCHEMA, TABLE_NAME;

-- 2. Kiểm tra các bảng quan trọng mà ứng dụng sử dụng
SELECT
    CASE WHEN EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'WebChat_Conversations') THEN 'OK' ELSE 'MISSING' END AS WebChat_Conversations,
    CASE WHEN EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'WebChat_ConversationStatus') THEN 'OK' ELSE 'MISSING' END AS WebChat_ConversationStatus,
    CASE WHEN EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'WebChat_MessageLogs') THEN 'OK' ELSE 'MISSING' END AS WebChat_MessageLogs,
    CASE WHEN EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'WebChat_MessageAnalytics') THEN 'OK' ELSE 'MISSING' END AS WebChat_MessageAnalytics,
    CASE WHEN EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'WebChat_MessageReadStatus') THEN 'OK' ELSE 'MISSING' END AS WebChat_MessageReadStatus,
    CASE WHEN EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'WebChat_Messagelogs_User_Info') THEN 'OK' ELSE 'MISSING' END AS WebChat_Messagelogs_User_Info,
    CASE WHEN EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'User') THEN 'OK' ELSE 'MISSING' END AS [User];

-- 3. Kiểm tra cột trong bảng [User]
SELECT
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'User'
ORDER BY ORDINAL_POSITION;

-- 4. Kiểm tra cột trong bảng WebChat_Conversations
SELECT
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'WebChat_Conversations'
ORDER BY ORDINAL_POSITION;

-- 5. Kiểm tra cột trong bảng WebChat_MessageLogs
SELECT
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'WebChat_MessageLogs'
ORDER BY ORDINAL_POSITION;

-- 6. Kiểm tra cột trong bảng WebChat_MessageAnalytics
SELECT
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'WebChat_MessageAnalytics'
ORDER BY ORDINAL_POSITION;

-- 7. Kiểm tra cột trong bảng WebChat_ConversationStatus
SELECT
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'WebChat_ConversationStatus'
ORDER BY ORDINAL_POSITION;

-- 8. Xem mẫu dữ liệu User (để kiểm tra có tồn tại cột Role chưa)
SELECT TOP 5
    UserName,
    DangHoatDong,
    HoTen,
    ShortName
FROM [User];
