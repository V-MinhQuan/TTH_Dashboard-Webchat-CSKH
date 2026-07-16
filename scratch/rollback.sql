SET NOCOUNT ON;
SET XACT_ABORT ON;

-- Safe by default. Review the blocker result set, stop every HF worker, then
-- set this flag to 1 only when a full legacy-schema rollback is intended.
DECLARE @ConfirmRollback BIT = 1;
DECLARE @MigrationStep NVARCHAR(100) = N'rollback_hf_analysis_schema';

IF OBJECT_ID(N'dbo.WebChat_MessageAnalytics', N'U') IS NULL
BEGIN
    RAISERROR('Required table dbo.WebChat_MessageAnalytics does not exist.', 16, 1);
    RETURN;
END;

IF COL_LENGTH('dbo.WebChat_MessageAnalytics', 'analysisStatus') IS NULL
BEGIN
    SELECT @MigrationStep AS migrationStep, N'not_required' AS auditPhase,
           N'analysisStatus is absent; schema is already in legacy mode.' AS message;
    RETURN;
END;

DECLARE @BlockingRows BIGINT;
SELECT @BlockingRows = COUNT_BIG(*)
FROM dbo.WebChat_MessageAnalytics WITH (READUNCOMMITTED)
WHERE analysisStatus IN ('pending', 'processing', 'failed')
   OR sentimentLabel IS NULL
   OR sentimentScore IS NULL
   OR analyzedAt IS NULL;

SELECT
    @MigrationStep AS migrationStep,
    N'preflight' AS auditPhase,
    @BlockingRows AS blockingRows,
    SUM(CASE WHEN analysisStatus = 'pending' THEN CAST(1 AS BIGINT) ELSE CAST(0 AS BIGINT) END) AS pendingRows,
    SUM(CASE WHEN analysisStatus = 'processing' THEN CAST(1 AS BIGINT) ELSE CAST(0 AS BIGINT) END) AS processingRows,
    SUM(CASE WHEN analysisStatus = 'failed' THEN CAST(1 AS BIGINT) ELSE CAST(0 AS BIGINT) END) AS failedRows,
    SUM(CASE WHEN analysisStatus = 'quarantined' THEN CAST(1 AS BIGINT) ELSE CAST(0 AS BIGINT) END) AS quarantinedRows,
    SUM(CASE WHEN sentimentLabel IS NULL OR sentimentScore IS NULL OR analyzedAt IS NULL THEN CAST(1 AS BIGINT) ELSE CAST(0 AS BIGINT) END) AS incompleteSentimentRows
FROM dbo.WebChat_MessageAnalytics WITH (READUNCOMMITTED);

IF @BlockingRows > 0
BEGIN
    RAISERROR('Unsafe rollback refused: resolve all pending, processing, failed, and incomplete rows first.', 16, 1);
    RETURN;
END;

IF @ConfirmRollback = 0
BEGIN
    RAISERROR('Rollback preflight passed, but no changes were made. Set @ConfirmRollback = 1 after stopping workers.', 10, 1) WITH NOWAIT;
    RETURN;
END;

BEGIN TRY
    BEGIN TRANSACTION;

    IF EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics')
          AND name = N'IX_WebChat_MessageAnalytics_AnalysisQueue'
    )
        DROP INDEX IX_WebChat_MessageAnalytics_AnalysisQueue ON dbo.WebChat_MessageAnalytics;

    IF EXISTS (
        SELECT 1 FROM sys.check_constraints
        WHERE parent_object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics')
          AND name = N'CK_WebChat_MessageAnalytics_CompletedSentiment'
    )
        ALTER TABLE dbo.WebChat_MessageAnalytics DROP CONSTRAINT CK_WebChat_MessageAnalytics_CompletedSentiment;

    IF EXISTS (
        SELECT 1 FROM sys.check_constraints
        WHERE parent_object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics')
          AND name = N'CK_WebChat_MessageAnalytics_AnalysisStatus'
    )
        ALTER TABLE dbo.WebChat_MessageAnalytics DROP CONSTRAINT CK_WebChat_MessageAnalytics_AnalysisStatus;

    IF EXISTS (
        SELECT 1 FROM sys.check_constraints
        WHERE parent_object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics')
          AND name = N'CK_WebChat_MessageAnalytics_AnalysisRetryCount'
    )
        ALTER TABLE dbo.WebChat_MessageAnalytics DROP CONSTRAINT CK_WebChat_MessageAnalytics_AnalysisRetryCount;

    DECLARE @DropAnalysisDefaults NVARCHAR(MAX) = N'';
    SELECT @DropAnalysisDefaults = @DropAnalysisDefaults
        + N'ALTER TABLE dbo.WebChat_MessageAnalytics DROP CONSTRAINT '
        + QUOTENAME(dc.name) + N';'
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c
      ON c.object_id = dc.parent_object_id
     AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics')
      AND c.name IN (N'analysisStatus', N'analysisRetryCount', N'analysisUpdatedAt');

    IF @DropAnalysisDefaults <> N''
        EXEC sys.sp_executesql @DropAnalysisDefaults;

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

    ALTER TABLE dbo.WebChat_MessageAnalytics ALTER COLUMN sentimentLabel NVARCHAR(20) NOT NULL;
    ALTER TABLE dbo.WebChat_MessageAnalytics ALTER COLUMN sentimentScore FLOAT NOT NULL;
    ALTER TABLE dbo.WebChat_MessageAnalytics ALTER COLUMN analyzedAt DATETIME NOT NULL;

    IF NOT EXISTS (
        SELECT 1 FROM sys.default_constraints dc
        INNER JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics') AND c.name = N'sentimentLabel'
    )
        ALTER TABLE dbo.WebChat_MessageAnalytics
        ADD CONSTRAINT DF_WebChat_MessageAnalytics_SentimentLabel DEFAULT 'neutral' FOR sentimentLabel;

    IF NOT EXISTS (
        SELECT 1 FROM sys.default_constraints dc
        INNER JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics') AND c.name = N'sentimentScore'
    )
        ALTER TABLE dbo.WebChat_MessageAnalytics
        ADD CONSTRAINT DF_WebChat_MessageAnalytics_SentimentScore DEFAULT 0.0 FOR sentimentScore;

    IF NOT EXISTS (
        SELECT 1 FROM sys.default_constraints dc
        INNER JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics') AND c.name = N'analyzedAt'
    )
        ALTER TABLE dbo.WebChat_MessageAnalytics
        ADD CONSTRAINT DF_WebChat_MessageAnalytics_AnalyzedAt DEFAULT GETDATE() FOR analyzedAt;

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

    -- Provenance columns are retained because they may predate this migration.
    ALTER TABLE dbo.WebChat_MessageAnalytics DROP COLUMN
        analysisStatus,
        analysisRetryCount,
        analysisError,
        analysisStartedAt,
        analysisUpdatedAt;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

SELECT
    @MigrationStep AS migrationStep,
    N'after' AS auditPhase,
    COUNT_BIG(*) AS preservedSentimentRows,
    SUM(CASE WHEN sentimentLabel = 'neutral' AND sentimentScore = 0 THEN CAST(1 AS BIGINT) ELSE CAST(0 AS BIGINT) END) AS preservedNeutralScoreZeroRows
FROM dbo.WebChat_MessageAnalytics WITH (READUNCOMMITTED);

RAISERROR('Rollback completed. Sentiment labels and scores were preserved.', 10, 1) WITH NOWAIT;
