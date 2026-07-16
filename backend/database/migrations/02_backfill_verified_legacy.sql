SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @MigrationStep NVARCHAR(100) = N'02_backfill_verified_legacy';
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
   OR COL_LENGTH('dbo.WebChat_MessageAnalytics', 'analysisUpdatedAt') IS NULL
   OR COL_LENGTH('dbo.WebChat_MessageAnalytics', 'sentimentSource') IS NULL
   OR COL_LENGTH('dbo.WebChat_MessageAnalytics', 'analyzerVersion') IS NULL
BEGIN
    RAISERROR('Step 01 must be applied before step 02.', 16, 1);
    RETURN;
END;

-- Strict verified provenance requires a known source and a concrete analyzer
-- version. A label/score alone is not human or model provenance.
SELECT
    @MigrationStep AS migrationStep,
    N'before' AS auditPhase,
    COUNT_BIG(*) AS totalRows,
    SUM(CASE
        WHEN analysisStatus IS NULL
         AND sentimentLabel IN ('positive', 'neutral', 'negative')
         AND sentimentScore IS NOT NULL
         AND analyzedAt IS NOT NULL
         AND LOWER(LTRIM(RTRIM(sentimentSource))) IN ('ensemble', 'huggingface', 'manual', 'manual_review')
         AND NULLIF(LTRIM(RTRIM(analyzerVersion)), '') IS NOT NULL
         AND LOWER(LTRIM(RTRIM(analyzerVersion))) NOT IN ('unknown', 'legacy', 'n/a', 'na', 'none')
        THEN CAST(1 AS BIGINT) ELSE CAST(0 AS BIGINT)
    END) AS eligibleVerifiedRows
FROM dbo.WebChat_MessageAnalytics WITH (READUNCOMMITTED);

RAISERROR('Starting step 02 verified legacy backfill in bounded batches.', 10, 1) WITH NOWAIT;

WHILE @Changed > 0
BEGIN
    ;WITH verified_batch AS (
        SELECT TOP (@BatchSize) id
        FROM dbo.WebChat_MessageAnalytics WITH (UPDLOCK, READPAST, ROWLOCK)
        WHERE analysisStatus IS NULL
          AND sentimentLabel IN ('positive', 'neutral', 'negative')
          AND sentimentScore IS NOT NULL
          AND analyzedAt IS NOT NULL
          AND LOWER(LTRIM(RTRIM(sentimentSource))) IN ('ensemble', 'huggingface', 'manual', 'manual_review')
          AND NULLIF(LTRIM(RTRIM(analyzerVersion)), '') IS NOT NULL
          AND LOWER(LTRIM(RTRIM(analyzerVersion))) NOT IN ('unknown', 'legacy', 'n/a', 'na', 'none')
        ORDER BY id
    )
    UPDATE analytics
    SET analysisStatus = 'completed',
        analysisRetryCount = ISNULL(analysisRetryCount, 0),
        analysisError = NULL,
        analysisStartedAt = NULL,
        analysisUpdatedAt = CAST(analyzedAt AS DATETIME2(3))
    FROM dbo.WebChat_MessageAnalytics analytics
    INNER JOIN verified_batch batch ON batch.id = analytics.id;

    SET @Changed = @@ROWCOUNT;
    SET @TotalChanged += @Changed;

    IF @Changed > 0
        RAISERROR('Step 02 batch completed: batchRows=%d.', 10, 1, @Changed) WITH NOWAIT;
END;

SELECT
    @MigrationStep AS migrationStep,
    N'after' AS auditPhase,
    @StartedAt AS startedAtUtc,
    SYSUTCDATETIME() AS completedAtUtc,
    @TotalChanged AS rowsMarkedCompleted,
    SUM(CASE WHEN analysisStatus = 'completed' THEN CAST(1 AS BIGINT) ELSE CAST(0 AS BIGINT) END) AS completedRows,
    SUM(CASE WHEN analysisStatus IS NULL THEN CAST(1 AS BIGINT) ELSE CAST(0 AS BIGINT) END) AS unclassifiedRows
FROM dbo.WebChat_MessageAnalytics WITH (READUNCOMMITTED);

RAISERROR('Completed step 02. Only rows with strict provenance were marked completed.', 10, 1) WITH NOWAIT;
