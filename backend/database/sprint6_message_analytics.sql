-- ============================================================
-- Sprint 6: Phân tích Cảm xúc & Xu hướng Hội thoại
-- Script tạo bảng: dbo.WebChat_MessageAnalytics
-- Có thể chạy lại nhiều lần (idempotent - IF NOT EXISTS)
-- ============================================================

-- 1. Tạo bảng lưu kết quả phân tích từng tin nhắn
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'WebChat_MessageAnalytics'
)
BEGIN
    CREATE TABLE dbo.WebChat_MessageAnalytics (
        -- Primary key tự tăng
        id                      INT             IDENTITY(1,1) NOT NULL,

        -- Liên kết về tin nhắn gốc (FK logic, không tạo constraint để tránh ảnh hưởng bảng gốc)
        messageId               BIGINT          NOT NULL,   -- id_webchat_messagelogs
        conversationId          BIGINT          NULL,       -- Có thể NULL nếu chưa có Conversation
        customerId              NVARCHAR(200)   NULL,       -- Suy ra từ FromHost logic
        source                  NVARCHAR(100)   NULL,       -- Kênh: ZaloOA, Facebook, v.v.

        -- Kết quả phân tích cảm xúc
        sentimentLabel          NVARCHAR(20)    NOT NULL DEFAULT 'neutral',
                                                            -- 'positive' | 'negative' | 'neutral'
        sentimentScore          FLOAT           NOT NULL DEFAULT 0.0,
                                                            -- Khoảng [-1.0, 1.0]
        sentimentReason         NVARCHAR(500)   NULL,       -- Giải thích ngắn gọn tại sao

        -- Các từ khóa đã match (JSON array dạng string)
        matchedPositiveKeywords NVARCHAR(MAX)   NULL,       -- VD: '["tốt","hài lòng"]'
        matchedNegativeKeywords NVARCHAR(MAX)   NULL,       -- VD: '["tệ","chờ lâu"]'

        -- Chủ đề và từ khóa phát hiện được (JSON array dạng string)
        detectedTopics          NVARCHAR(MAX)   NULL,       -- VD: '["billing","shipping"]'
        detectedKeywords        NVARCHAR(MAX)   NULL,       -- VD: '["hóa đơn","giao hàng"]'

        -- Chỉ số hài lòng
        satisfactionScore       FLOAT           NULL,       -- Khoảng [0, 100]
        satisfactionLevel       NVARCHAR(20)    NULL,       -- 'very_satisfied'|'satisfied'|'neutral'|'unsatisfied'|'very_unsatisfied'
        satisfactionReason      NVARCHAR(500)   NULL,       -- Giải thích

        -- Cờ cần nhân viên xem xét thủ công
        needStaffReview         BIT             NOT NULL DEFAULT 0,

        -- Metadata thời gian
        messageAt               DATETIME        NULL,       -- Thời điểm tin nhắn gốc được gửi
        analyzedAt              DATETIME        NOT NULL DEFAULT GETDATE(), -- Thời điểm phân tích

        CONSTRAINT PK_WebChat_MessageAnalytics PRIMARY KEY CLUSTERED (id ASC)
    );

    PRINT 'Tạo bảng dbo.WebChat_MessageAnalytics thành công.';
END
ELSE
BEGIN
    PRINT 'Bảng dbo.WebChat_MessageAnalytics đã tồn tại — bỏ qua bước tạo bảng.';
END
GO

-- 2. Index cho messageId (tránh phân tích lại cùng 1 tin nhắn)
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.WebChat_MessageAnalytics')
      AND name = 'IX_MsgAnalytics_MessageId'
)
BEGIN
    CREATE UNIQUE INDEX IX_MsgAnalytics_MessageId
        ON dbo.WebChat_MessageAnalytics (messageId);
    PRINT 'Tạo unique index IX_MsgAnalytics_MessageId thành công.';
END
GO

-- 3. Index cho sentimentLabel + messageAt để query trend nhanh
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.WebChat_MessageAnalytics')
      AND name = 'IX_MsgAnalytics_Sentiment_Time'
)
BEGIN
    CREATE INDEX IX_MsgAnalytics_Sentiment_Time
        ON dbo.WebChat_MessageAnalytics (sentimentLabel, messageAt DESC);
    PRINT 'Tạo index IX_MsgAnalytics_Sentiment_Time thành công.';
END
GO

-- 4. Index cho source + messageAt (lọc theo kênh)
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.WebChat_MessageAnalytics')
      AND name = 'IX_MsgAnalytics_Source_Time'
)
BEGIN
    CREATE INDEX IX_MsgAnalytics_Source_Time
        ON dbo.WebChat_MessageAnalytics (source, messageAt DESC);
    PRINT 'Tạo index IX_MsgAnalytics_Source_Time thành công.';
END
GO

-- 5. Index cho needStaffReview (để lọc nhanh các hội thoại cần review)
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.WebChat_MessageAnalytics')
      AND name = 'IX_MsgAnalytics_NeedReview'
)
BEGIN
    CREATE INDEX IX_MsgAnalytics_NeedReview
        ON dbo.WebChat_MessageAnalytics (needStaffReview, messageAt DESC)
        WHERE needStaffReview = 1;
    PRINT 'Tạo filtered index IX_MsgAnalytics_NeedReview thành công.';
END
GO

PRINT '=== Sprint 6 SQL migration hoàn thành ===';
GO
