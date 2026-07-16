SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @MigrationStep NVARCHAR(100) = N'01_add_hf_analysis_schema';
DECLARE @StartedAt DATETIME2(3) = SYSUTCDATETIME();

IF OBJECT_ID(N'dbo.WebChat_MessageAnalytics', N'U') IS NULL
BEGIN
    RAISERROR('Required table dbo.WebChat_MessageAnalytics does not exist.', 16, 1);
    RETURN;
END;

IF COL_LENGTH('dbo.WebChat_MessageAnalytics', 'sentimentLabel') IS NULL
   OR COL_LENGTH('dbo.WebChat_MessageAnalytics', 'sentimentScore') IS NULL
   OR COL_LENGTH('dbo.WebChat_MessageAnalytics', 'analyzedAt') IS NULL
BEGIN
    RAISERROR('Required legacy sentiment columns are missing.', 16, 1);
    RETURN;
END;

RAISERROR('Starting migration step 01: additive schema and nullable sentiment fields.', 10, 1) WITH NOWAIT;

SELECT
    @MigrationStep AS migrationStep,
    N'before' AS auditPhase,
    COUNT_BIG(*) AS totalRows,
    SUM(CASE WHEN sentimentLabel = 'neutral' AND sentimentScore = 0 THEN CAST(1 AS BIGINT) ELSE CAST(0 AS BIGINT) END) AS neutralScoreZeroRows
FROM dbo.WebChat_MessageAnalytics WITH (READUNCOMMITTED);

BEGIN TRY
    BEGIN TRANSACTION;

    IF COL_LENGTH('dbo.WebChat_MessageAnalytics', 'analysisStatus') IS NULL
        ALTER TABLE dbo.WebChat_MessageAnalytics ADD analysisStatus VARCHAR(20) NULL;

    IF COL_LENGTH('dbo.WebChat_MessageAnalytics', 'analysisRetryCount') IS NULL
        ALTER TABLE dbo.WebChat_MessageAnalytics ADD analysisRetryCount INT NULL;

    IF COL_LENGTH('dbo.WebChat_MessageAnalytics', 'analysisError') IS NULL
        ALTER TABLE dbo.WebChat_MessageAnalytics ADD analysisError NVARCHAR(500) NULL;

    IF COL_LENGTH('dbo.WebChat_MessageAnalytics', 'analysisStartedAt') IS NULL
        ALTER TABLE dbo.WebChat_MessageAnalytics ADD analysisStartedAt DATETIME2(3) NULL;

    IF COL_LENGTH('dbo.WebChat_MessageAnalytics', 'analysisUpdatedAt') IS NULL
        ALTER TABLE dbo.WebChat_MessageAnalytics ADD analysisUpdatedAt DATETIME2(3) NULL;

    -- Older installations may not have provenance columns. They remain nullable;
    -- backfill scripts never invent an analyzer version.
    IF COL_LENGTH('dbo.WebChat_MessageAnalytics', 'sentimentSource') IS NULL
        ALTER TABLE dbo.WebChat_MessageAnalytics ADD sentimentSource NVARCHAR(50) NULL;

    IF COL_LENGTH('dbo.WebChat_MessageAnalytics', 'analyzerVersion') IS NULL
        ALTER TABLE dbo.WebChat_MessageAnalytics ADD analyzerVersion NVARCHAR(200) NULL;

    -- Remove defaults that fabricated neutral/0/GETDATE values for unanalyzed rows.
    DECLARE @DropLegacyDefaults NVARCHAR(MAX) = N'';
    SELECT @DropLegacyDefaults = @DropLegacyDefaults
        + N'ALTER TABLE dbo.WebChat_MessageAnalytics DROP CONSTRAINT '
        + QUOTENAME(dc.name) + N';'
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c
      ON c.object_id = dc.parent_object_id
     AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics')
      AND c.name IN (N'sentimentLabel', N'sentimentScore', N'analyzedAt');

    IF @DropLegacyDefaults <> N''
        EXEC sys.sp_executesql @DropLegacyDefaults;

    -- SQL Server can require dependent indexes to be rebuilt when nullability changes.
    IF EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics')
          AND name = N'IX_MsgAnalytics_Sentiment_Time'
    )
        DROP INDEX IX_MsgAnalytics_Sentiment_Time ON dbo.WebChat_MessageAnalytics;

    IF EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics')
          AND name = N'IX_WebChat_MessageAnalytics_Conversation_MessageAt'
    )
        DROP INDEX IX_WebChat_MessageAnalytics_Conversation_MessageAt ON dbo.WebChat_MessageAnalytics;

    IF EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics')
          AND name = N'IX_WebChat_MessageAnalytics_MessageAt'
    )
        DROP INDEX IX_WebChat_MessageAnalytics_MessageAt ON dbo.WebChat_MessageAnalytics;

    ALTER TABLE dbo.WebChat_MessageAnalytics ALTER COLUMN sentimentLabel NVARCHAR(20) NULL;
    ALTER TABLE dbo.WebChat_MessageAnalytics ALTER COLUMN sentimentScore FLOAT NULL;
    ALTER TABLE dbo.WebChat_MessageAnalytics ALTER COLUMN analyzedAt DATETIME NULL;

    -- Defaults apply only to new rows. Existing rows stay NULL until steps 02/03 classify them.
    IF NOT EXISTS (
        SELECT 1 FROM sys.default_constraints dc
        INNER JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics') AND c.name = N'analysisStatus'
    )
        EXEC(N'ALTER TABLE dbo.WebChat_MessageAnalytics
               ADD CONSTRAINT DF_WebChat_MessageAnalytics_AnalysisStatus
               DEFAULT ''pending'' FOR analysisStatus;');

    IF NOT EXISTS (
        SELECT 1 FROM sys.default_constraints dc
        INNER JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics') AND c.name = N'analysisRetryCount'
    )
        EXEC(N'ALTER TABLE dbo.WebChat_MessageAnalytics
               ADD CONSTRAINT DF_WebChat_MessageAnalytics_AnalysisRetryCount
               DEFAULT 0 FOR analysisRetryCount;');

    IF NOT EXISTS (
        SELECT 1 FROM sys.default_constraints dc
        INNER JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics') AND c.name = N'analysisUpdatedAt'
    )
        EXEC(N'ALTER TABLE dbo.WebChat_MessageAnalytics
               ADD CONSTRAINT DF_WebChat_MessageAnalytics_AnalysisUpdatedAt
               DEFAULT SYSUTCDATETIME() FOR analysisUpdatedAt;');

    -- An older monolithic migration allowed only four statuses. Widen the
    -- temporary check before step 03 moves unverifiable rows to quarantined.
    IF EXISTS (
        SELECT 1 FROM sys.check_constraints
        WHERE parent_object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics')
          AND name = N'CK_WebChat_MessageAnalytics_AnalysisStatus'
    )
        ALTER TABLE dbo.WebChat_MessageAnalytics DROP CONSTRAINT CK_WebChat_MessageAnalytics_AnalysisStatus;

    EXEC(N'ALTER TABLE dbo.WebChat_MessageAnalytics WITH NOCHECK
           ADD CONSTRAINT CK_WebChat_MessageAnalytics_AnalysisStatus
           CHECK (analysisStatus IN (''pending'', ''processing'', ''completed'', ''failed'', ''quarantined''));');

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics') AND name = N'IX_MsgAnalytics_Sentiment_Time'
    )
        CREATE INDEX IX_MsgAnalytics_Sentiment_Time
            ON dbo.WebChat_MessageAnalytics (sentimentLabel, messageAt);

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics') AND name = N'IX_WebChat_MessageAnalytics_Conversation_MessageAt'
    )
        CREATE INDEX IX_WebChat_MessageAnalytics_Conversation_MessageAt
            ON dbo.WebChat_MessageAnalytics (conversationId, messageAt DESC, id DESC)
            INCLUDE (messageId, source, sentimentLabel, issueFlag, needStaffReview, satisfactionScore);

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics') AND name = N'IX_WebChat_MessageAnalytics_MessageAt'
    )
        CREATE INDEX IX_WebChat_MessageAnalytics_MessageAt
            ON dbo.WebChat_MessageAnalytics (messageAt DESC, id DESC)
            INCLUDE (messageId, conversationId, source, sentimentLabel, issueFlag, needStaffReview);

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

SELECT
    @MigrationStep AS migrationStep,
    N'after' AS auditPhase,
    @StartedAt AS startedAtUtc,
    SYSUTCDATETIME() AS completedAtUtc,
    COL_LENGTH('dbo.WebChat_MessageAnalytics', 'analysisStatus') AS analysisStatusBytes,
    COL_LENGTH('dbo.WebChat_MessageAnalytics', 'analysisRetryCount') AS analysisRetryCountBytes,
    COL_LENGTH('dbo.WebChat_MessageAnalytics', 'analysisError') AS analysisErrorBytes,
    COL_LENGTH('dbo.WebChat_MessageAnalytics', 'analysisStartedAt') AS analysisStartedAtBytes,
    COL_LENGTH('dbo.WebChat_MessageAnalytics', 'analysisUpdatedAt') AS analysisUpdatedAtBytes;

RAISERROR('Completed migration step 01. No legacy label or score was changed.', 10, 1) WITH NOWAIT;
