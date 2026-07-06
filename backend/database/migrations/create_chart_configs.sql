IF OBJECT_ID(N'dbo.WebChat_ChartConfigs', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.WebChat_ChartConfigs (
        Id UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT PK_WebChat_ChartConfigs PRIMARY KEY
            CONSTRAINT DF_WebChat_ChartConfigs_Id DEFAULT NEWID(),
        Name NVARCHAR(200) NOT NULL,
        Description NVARCHAR(500) NULL,
        ConfigJson NVARCHAR(MAX) NOT NULL,
        CreatedAt DATETIME2(3) NOT NULL
            CONSTRAINT DF_WebChat_ChartConfigs_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(3) NOT NULL
            CONSTRAINT DF_WebChat_ChartConfigs_UpdatedAt DEFAULT SYSUTCDATETIME(),
        IsActive BIT NOT NULL
            CONSTRAINT DF_WebChat_ChartConfigs_IsActive DEFAULT 1
    );

    CREATE INDEX IX_WebChat_ChartConfigs_IsActive_UpdatedAt
        ON dbo.WebChat_ChartConfigs (IsActive, UpdatedAt DESC);
END;
