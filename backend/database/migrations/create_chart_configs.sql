IF OBJECT_ID(N'dbo.ChartConfigs', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ChartConfigs (
        Id UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT PK_ChartConfigs PRIMARY KEY
            CONSTRAINT DF_ChartConfigs_Id DEFAULT NEWID(),
        Name NVARCHAR(200) NOT NULL,
        Description NVARCHAR(500) NULL,
        ConfigJson NVARCHAR(MAX) NOT NULL,
        CreatedAt DATETIME2(3) NOT NULL
            CONSTRAINT DF_ChartConfigs_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(3) NOT NULL
            CONSTRAINT DF_ChartConfigs_UpdatedAt DEFAULT SYSUTCDATETIME(),
        IsActive BIT NOT NULL
            CONSTRAINT DF_ChartConfigs_IsActive DEFAULT 1
    );

    CREATE INDEX IX_ChartConfigs_IsActive_UpdatedAt
        ON dbo.ChartConfigs (IsActive, UpdatedAt DESC);
END;
