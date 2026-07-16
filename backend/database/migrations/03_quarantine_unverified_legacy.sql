SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @MigrationStep NVARCHAR(100) = N'03_quarantine_unverified_legacy';
DECLARE @BatchSize INT = 1000;
DECLARE @Changed INT = 1;
DECLARE @TotalChanged BIGINT = 0;
DECLARE @StartedAt DATETIME2(3) = SYSUTCDATETIME();

IF OBJECT_ID(N'dbo.WebChat_MessageAnalytics', N'U') IS NULL
BEGIN
    RAISERROR('Required table dbo.WebChat_MessageAnalytics does not exist.', 16, 1);
    RETURN;
END;

IF COL_LENGTH('dbo.WebChat_MessageAnalytics', 'analysisStatus') IS NULL
   OR COL_LENGTH('dbo.WebChat_MessageAnalytics', 'analysisRetryCount') IS NULL
   OR COL_LENGTH('dbo.WebChat_MessageAnalytics', 'analysisError') IS NULL
   OR COL_LENGTH('dbo.WebChat_MessageAnalytics', 'analysisStartedAt') IS NULL
   OR COL_LENGTH('dbo.WebChat_MessageAnalytics', 'analysisUpdatedAt') IS NULL
   OR COL_LENGTH('dbo.WebChat_MessageAnalytics', 'sentimentSource') IS NULL
   OR COL_LENGTH('dbo.WebChat_MessageAnalytics', 'analyzerVersion') IS NULL
BEGIN
    RAISERROR('Steps 01 and 02 must be applied before step 03.', 16, 1);
    RETURN;
END;

SELECT
    @MigrationStep AS migrationStep,
    N'before' AS auditPhase,
    COUNT_BIG(*) AS totalRows,
    SUM(CASE WHEN analysisStatus IS NULL THEN CAST(1 AS BIGINT) ELSE CAST(0 AS BIGINT) END) AS unclassifiedRows,
    SUM(CASE
        WHEN analysisStatus = 'completed'
         AND NOT (
             sentimentLabel IN ('positive', 'neutral', 'negative')
             AND sentimentScore IS NOT NULL
             AND analyzedAt IS NOT NULL
             AND LOWER(LTRIM(RTRIM(sentimentSource))) IN ('ensemble', 'huggingface', 'manual', 'manual_review')
             AND NULLIF(LTRIM(RTRIM(analyzerVersion)), '') IS NOT NULL
             AND LOWER(LTRIM(RTRIM(analyzerVersion))) NOT IN ('unknown', 'legacy', 'n/a', 'na', 'none')
         )
        THEN CAST(1 AS BIGINT) ELSE CAST(0 AS BIGINT)
    END) AS invalidCompletedRows
FROM dbo.WebChat_MessageAnalytics WITH (READUNCOMMITTED);

RAISERROR('Starting step 03 quarantine backfill in bounded batches.', 10, 1) WITH NOWAIT;

WHILE @Changed > 0
BEGIN
    ;WITH quarantine_batch AS (
        SELECT TOP (@BatchSize) id
        FROM dbo.WebChat_MessageAnalytics WITH (UPDLOCK, READPAST, ROWLOCK)
        WHERE analysisStatus IS NULL
           OR analysisStatus NOT IN ('pending', 'processing', 'completed', 'failed', 'quarantined')
           OR (
                analysisStatus = 'completed'
                AND NOT (
                    sentimentLabel IN ('positive', 'neutral', 'negative')
                    AND sentimentScore IS NOT NULL
                    AND analyzedAt IS NOT NULL
                    AND LOWER(LTRIM(RTRIM(sentimentSource))) IN ('ensemble', 'huggingface', 'manual', 'manual_review')
                    AND NULLIF(LTRIM(RTRIM(analyzerVersion)), '') IS NOT NULL
                    AND LOWER(LTRIM(RTRIM(analyzerVersion))) NOT IN ('unknown', 'legacy', 'n/a', 'na', 'none')
                )
           )
        ORDER BY id
    )
    UPDATE analytics
    SET analysisStatus = 'quarantined',
        analysisRetryCount = ISNULL(analysisRetryCount, 0),
        analysisError = COALESCE(NULLIF(LTRIM(RTRIM(analysisError)), ''), 'legacy_unverified_provenance'),
        analysisStartedAt = NULL,
        analysisUpdatedAt = SYSUTCDATETIME()
    FROM dbo.WebChat_MessageAnalytics analytics
    INNER JOIN quarantine_batch batch ON batch.id = analytics.id;

    SET @Changed = @@ROWCOUNT;
    SET @TotalChanged += @Changed;

    IF @Changed > 0
        RAISERROR('Step 03 batch completed: batchRows=%d.', 10, 1, @Changed) WITH NOWAIT;
END;

BEGIN TRY
    BEGIN TRANSACTION;

    -- New rows should already receive defaults from step 01. These updates only
    -- close gaps from interrupted/older migrations before NOT NULL constraints.
    UPDATE dbo.WebChat_MessageAnalytics
    SET analysisStatus = 'quarantined',
        analysisError = COALESCE(NULLIF(LTRIM(RTRIM(analysisError)), ''), 'legacy_unverified_provenance'),
        analysisStartedAt = NULL,
        analysisUpdatedAt = COALESCE(analysisUpdatedAt, SYSUTCDATETIME())
    WHERE analysisStatus IS NULL;

    UPDATE dbo.WebChat_MessageAnalytics
    SET analysisRetryCount = 0
    WHERE analysisRetryCount IS NULL;

    UPDATE dbo.WebChat_MessageAnalytics
    SET analysisUpdatedAt = SYSUTCDATETIME()
    WHERE analysisUpdatedAt IS NULL;

    IF EXISTS (
        SELECT 1
        FROM dbo.WebChat_MessageAnalytics
        WHERE analysisStatus = 'completed'
          AND NOT (
              sentimentLabel IN ('positive', 'neutral', 'negative')
              AND sentimentScore IS NOT NULL
              AND analyzedAt IS NOT NULL
              AND LOWER(LTRIM(RTRIM(sentimentSource))) IN ('ensemble', 'huggingface', 'manual', 'manual_review')
              AND NULLIF(LTRIM(RTRIM(analyzerVersion)), '') IS NOT NULL
              AND LOWER(LTRIM(RTRIM(analyzerVersion))) NOT IN ('unknown', 'legacy', 'n/a', 'na', 'none')
          )
    )
    BEGIN
        RAISERROR('Unsafe finalization refused: invalid completed rows remain.', 16, 1);
    END;

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

    ALTER TABLE dbo.WebChat_MessageAnalytics ALTER COLUMN analysisStatus VARCHAR(20) NOT NULL;
    ALTER TABLE dbo.WebChat_MessageAnalytics ALTER COLUMN analysisRetryCount INT NOT NULL;
    ALTER TABLE dbo.WebChat_MessageAnalytics ALTER COLUMN analysisUpdatedAt DATETIME2(3) NOT NULL;

    ALTER TABLE dbo.WebChat_MessageAnalytics WITH CHECK
    ADD CONSTRAINT CK_WebChat_MessageAnalytics_AnalysisStatus
        CHECK (analysisStatus IN ('pending', 'processing', 'completed', 'failed', 'quarantined'));

    ALTER TABLE dbo.WebChat_MessageAnalytics WITH CHECK
    ADD CONSTRAINT CK_WebChat_MessageAnalytics_AnalysisRetryCount
        CHECK (analysisRetryCount >= 0);

    ALTER TABLE dbo.WebChat_MessageAnalytics WITH CHECK
    ADD CONSTRAINT CK_WebChat_MessageAnalytics_CompletedSentiment
        CHECK (
            analysisStatus <> 'completed'
            OR (
                sentimentLabel IS NOT NULL
                AND sentimentLabel IN ('positive', 'neutral', 'negative')
                AND sentimentScore IS NOT NULL
                AND analyzedAt IS NOT NULL
                AND LOWER(LTRIM(RTRIM(sentimentSource))) IN ('ensemble', 'huggingface', 'manual', 'manual_review')
                AND NULLIF(LTRIM(RTRIM(analyzerVersion)), '') IS NOT NULL
                AND LOWER(LTRIM(RTRIM(analyzerVersion))) NOT IN ('unknown', 'legacy', 'n/a', 'na', 'none')
            )
        );

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics')
          AND name = N'IX_WebChat_MessageAnalytics_AnalysisQueue'
    )
        CREATE INDEX IX_WebChat_MessageAnalytics_AnalysisQueue
            ON dbo.WebChat_MessageAnalytics (analysisStatus, analysisUpdatedAt, id)
            INCLUDE (messageId, analysisRetryCount, sentimentSource);

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
    @TotalChanged AS rowsQuarantinedByBatch,
    analysisStatus,
    COUNT_BIG(*) AS [rowCount]
FROM dbo.WebChat_MessageAnalytics WITH (READUNCOMMITTED)
GROUP BY analysisStatus
ORDER BY analysisStatus;

RAISERROR('Completed step 03. Unverified legacy values were preserved and quarantined.', 10, 1) WITH NOWAIT;
