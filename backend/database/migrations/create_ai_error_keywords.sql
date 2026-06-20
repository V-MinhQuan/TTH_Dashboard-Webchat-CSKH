IF OBJECT_ID(N'dbo.AiErrorKeywords', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AiErrorKeywords (
        Id UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT PK_AiErrorKeywords PRIMARY KEY
            CONSTRAINT DF_AiErrorKeywords_Id DEFAULT NEWID(),
        Keyword NVARCHAR(200) NOT NULL,
        KeywordNormalized NVARCHAR(400) COLLATE Latin1_General_100_BIN2 NOT NULL,
        ErrorGroup NVARCHAR(100) NOT NULL,
        Topic NVARCHAR(100) NULL,
        CareHub NVARCHAR(100) NULL,
        Description NVARCHAR(1000) NULL,
        Status VARCHAR(20) NOT NULL
            CONSTRAINT DF_AiErrorKeywords_Status DEFAULT 'active',
        CreatedBy NVARCHAR(100) NOT NULL,
        CreatedAt DATETIME2(3) NOT NULL
            CONSTRAINT DF_AiErrorKeywords_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(3) NOT NULL
            CONSTRAINT DF_AiErrorKeywords_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_AiErrorKeywords_Status
            CHECK (Status IN ('active', 'inactive')),
        CONSTRAINT CK_AiErrorKeywords_ErrorGroup
            CHECK (ErrorGroup IN (
                N'AI có nguy cơ tự tạo thông tin',
                N'AI không chắc chắn',
                N'Không tìm thấy dữ liệu',
                N'Câu hỏi ngoài phạm vi'
            )),
        CONSTRAINT CK_AiErrorKeywords_Taxonomy
            CHECK (
                (Topic IS NOT NULL AND CareHub IS NULL)
                OR (Topic IS NULL AND CareHub IS NOT NULL)
            )
    );
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.AiErrorKeywords')
      AND name = N'UX_AiErrorKeywords_KeywordNormalized'
)
BEGIN
    CREATE UNIQUE INDEX UX_AiErrorKeywords_KeywordNormalized
        ON dbo.AiErrorKeywords (KeywordNormalized);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.AiErrorKeywords')
      AND name = N'IX_AiErrorKeywords_Status_ErrorGroup_UpdatedAt'
)
BEGIN
    CREATE INDEX IX_AiErrorKeywords_Status_ErrorGroup_UpdatedAt
        ON dbo.AiErrorKeywords (Status, ErrorGroup, UpdatedAt DESC);
END;
