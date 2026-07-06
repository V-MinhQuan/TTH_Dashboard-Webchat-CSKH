IF OBJECT_ID(N'dbo.WebChat_AiQuestionGroupCache', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.WebChat_AiQuestionGroupCache (
        Id UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT PK_WebChat_AiQuestionGroupCache PRIMARY KEY
            CONSTRAINT DF_WebChat_AiQuestionGroupCache_Id DEFAULT NEWID(),
        CacheKey NVARCHAR(450) NOT NULL,
        Status VARCHAR(30) NOT NULL,
        SourceFromDate DATE NULL,
        SourceToDate DATE NULL,
        SourceFiltersJson NVARCHAR(MAX) NULL,
        SourceRowCount INT NOT NULL
            CONSTRAINT DF_WebChat_AiQuestionGroupCache_SourceRowCount DEFAULT 0,
        GeneratedAt DATETIME2(3) NOT NULL
            CONSTRAINT DF_WebChat_AiQuestionGroupCache_GeneratedAt DEFAULT SYSUTCDATETIME(),
        ExpiresAt DATETIME2(3) NOT NULL,
        Provider NVARCHAR(50) NULL,
        Model NVARCHAR(100) NULL,
        PromptVersion NVARCHAR(50) NOT NULL
            CONSTRAINT DF_WebChat_AiQuestionGroupCache_PromptVersion DEFAULT N'dashboard-top-questions-v1',
        ResultJson NVARCHAR(MAX) NOT NULL,
        ValidationJson NVARCHAR(MAX) NULL,
        ErrorMessage NVARCHAR(1000) NULL,
        CreatedAt DATETIME2(3) NOT NULL
            CONSTRAINT DF_WebChat_AiQuestionGroupCache_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(3) NOT NULL
            CONSTRAINT DF_WebChat_AiQuestionGroupCache_UpdatedAt DEFAULT SYSUTCDATETIME(),
        IsActive BIT NOT NULL
            CONSTRAINT DF_WebChat_AiQuestionGroupCache_IsActive DEFAULT 1,
        CONSTRAINT CK_WebChat_AiQuestionGroupCache_Status
            CHECK (Status IN ('ok', 'fallback', 'stale', 'ai_overloaded'))
    );
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.WebChat_AiQuestionGroupCache')
      AND name = N'UX_WebChat_AiQuestionGroupCache_CacheKey'
)
BEGIN
    CREATE UNIQUE INDEX UX_WebChat_AiQuestionGroupCache_CacheKey
        ON dbo.WebChat_AiQuestionGroupCache (CacheKey);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.WebChat_AiQuestionGroupCache')
      AND name = N'IX_WebChat_AiQuestionGroupCache_Active_ExpiresAt'
)
BEGIN
    CREATE INDEX IX_WebChat_AiQuestionGroupCache_Active_ExpiresAt
        ON dbo.WebChat_AiQuestionGroupCache (IsActive, ExpiresAt DESC, UpdatedAt DESC);
END;
