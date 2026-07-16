SET NOCOUNT ON;
SET XACT_ABORT ON;

-- Safety defaults: preview only, maximum 50 quarantined rows per execution.
-- Keep HF_BACKGROUND_ENABLED=false while previewing. Set @Apply = 1 only after
-- reviewing the preview and intentionally preparing a controlled worker run.
DECLARE @Apply BIT = 0;
DECLARE @BatchSize INT = 50;
DECLARE @MinAnalyticsId INT = NULL;
DECLARE @MaxAnalyticsId INT = NULL;
DECLARE @FromMessageAt DATETIME2(3) = NULL;
DECLARE @ToMessageAt DATETIME2(3) = NULL;
DECLARE @Source NVARCHAR(50) = NULL;
-- Required: must match HF_ANALYSIS_CUTOVER_MESSAGE_ID. Pre-cutover legacy
-- rows need a separate audited customer-message mapping and are never requeued here.
DECLARE @CutoverMessageId INT = NULL;
DECLARE @MigrationStep NVARCHAR(100) = N'04_requeue_quarantined_batch';

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
BEGIN
    RAISERROR('HF analysis schema is not installed.', 16, 1);
    RETURN;
END;

IF @BatchSize < 1 OR @BatchSize > 50
BEGIN
    RAISERROR('Batch size must be between 1 and 50.', 16, 1);
    RETURN;
END;

IF @CutoverMessageId IS NULL OR @CutoverMessageId < 0
BEGIN
    RAISERROR('Set @CutoverMessageId to the verified HF analysis cutover before preview or apply.', 16, 1);
    RETURN;
END;

IF @Apply = 0
BEGIN
    RAISERROR('Dry run only. Set @Apply = 1 to requeue the previewed batch.', 10, 1) WITH NOWAIT;

    SELECT TOP (@BatchSize)
        @MigrationStep AS migrationStep,
        N'preview' AS auditPhase,
        analytics.id AS analyticsId,
        analytics.messageId,
        analytics.analysisRetryCount,
        analytics.analysisUpdatedAt
    FROM dbo.WebChat_MessageAnalytics analytics WITH (READUNCOMMITTED)
    INNER JOIN dbo.WebChat_MessageLogs customer_message WITH (READUNCOMMITTED)
      ON customer_message.id_webchat_messageLogs = analytics.messageId
    WHERE analytics.analysisStatus = 'quarantined'
      AND analytics.messageId > @CutoverMessageId
      AND customer_message.FromHost = 0
      AND customer_message.TextContent IS NOT NULL
      AND NULLIF(LTRIM(RTRIM(customer_message.TextContent)), '') IS NOT NULL
      AND customer_message.Source IS NOT NULL
      AND customer_message.Source NOT IN (N'', N'unknown', N'Unknown', N'UNKNOWN', N'missing', N'Missing', N'MISSING', N'null', N'Null', N'NULL', N'none', N'None', N'NONE', N'n/a', N'N/A', N'na', N'NA', N'không xác định', N'Không xác định', N'KHÔNG XÁC ĐỊNH', N'khong xac dinh', N'Khong xac dinh', N'KHONG XAC DINH')
      AND customer_message.SenderId IS NOT NULL
      AND customer_message.SenderId NOT IN (N'', N'unknown', N'Unknown', N'UNKNOWN', N'missing', N'Missing', N'MISSING', N'null', N'Null', N'NULL', N'none', N'None', N'NONE', N'n/a', N'N/A', N'na', N'NA', N'không xác định', N'Không xác định', N'KHÔNG XÁC ĐỊNH', N'khong xac dinh', N'Khong xac dinh', N'KHONG XAC DINH')
      AND (@MinAnalyticsId IS NULL OR analytics.id >= @MinAnalyticsId)
      AND (@MaxAnalyticsId IS NULL OR analytics.id <= @MaxAnalyticsId)
      AND (@FromMessageAt IS NULL OR analytics.messageAt >= @FromMessageAt)
      AND (@ToMessageAt IS NULL OR analytics.messageAt < @ToMessageAt)
      AND (@Source IS NULL OR analytics.source = @Source)
    ORDER BY analytics.id;

    SELECT
        @MigrationStep AS migrationStep,
        N'preview_summary' AS auditPhase,
        COUNT_BIG(*) AS totalQuarantinedRows,
        CASE WHEN COUNT_BIG(*) > @BatchSize THEN @BatchSize ELSE COUNT_BIG(*) END AS rowsEligibleThisRun
    FROM dbo.WebChat_MessageAnalytics analytics WITH (READUNCOMMITTED)
    INNER JOIN dbo.WebChat_MessageLogs customer_message WITH (READUNCOMMITTED)
      ON customer_message.id_webchat_messageLogs = analytics.messageId
    WHERE analytics.analysisStatus = 'quarantined'
      AND analytics.messageId > @CutoverMessageId
      AND customer_message.FromHost = 0
      AND customer_message.TextContent IS NOT NULL
      AND NULLIF(LTRIM(RTRIM(customer_message.TextContent)), '') IS NOT NULL
      AND customer_message.Source IS NOT NULL
      AND customer_message.Source NOT IN (N'', N'unknown', N'Unknown', N'UNKNOWN', N'missing', N'Missing', N'MISSING', N'null', N'Null', N'NULL', N'none', N'None', N'NONE', N'n/a', N'N/A', N'na', N'NA', N'không xác định', N'Không xác định', N'KHÔNG XÁC ĐỊNH', N'khong xac dinh', N'Khong xac dinh', N'KHONG XAC DINH')
      AND customer_message.SenderId IS NOT NULL
      AND customer_message.SenderId NOT IN (N'', N'unknown', N'Unknown', N'UNKNOWN', N'missing', N'Missing', N'MISSING', N'null', N'Null', N'NULL', N'none', N'None', N'NONE', N'n/a', N'N/A', N'na', N'NA', N'không xác định', N'Không xác định', N'KHÔNG XÁC ĐỊNH', N'khong xac dinh', N'Khong xac dinh', N'KHONG XAC DINH')
      AND (@MinAnalyticsId IS NULL OR analytics.id >= @MinAnalyticsId)
      AND (@MaxAnalyticsId IS NULL OR analytics.id <= @MaxAnalyticsId)
      AND (@FromMessageAt IS NULL OR analytics.messageAt >= @FromMessageAt)
      AND (@ToMessageAt IS NULL OR analytics.messageAt < @ToMessageAt)
      AND (@Source IS NULL OR analytics.source = @Source);

    RETURN;
END;

DECLARE @Requeued TABLE (
    analyticsId INT NOT NULL,
    messageId INT NOT NULL,
    previousRetryCount INT NULL,
    previousSentimentSource NVARCHAR(50) NULL,
    requeuedAtUtc DATETIME2(3) NOT NULL
);

BEGIN TRY
    BEGIN TRANSACTION;

    ;WITH candidates AS (
        SELECT TOP (@BatchSize) analytics.id
        FROM dbo.WebChat_MessageAnalytics analytics WITH (UPDLOCK, READPAST, ROWLOCK)
        INNER JOIN dbo.WebChat_MessageLogs customer_message WITH (READPAST)
          ON customer_message.id_webchat_messageLogs = analytics.messageId
        WHERE analytics.analysisStatus = 'quarantined'
          AND analytics.messageId > @CutoverMessageId
          AND customer_message.FromHost = 0
          AND customer_message.TextContent IS NOT NULL
          AND NULLIF(LTRIM(RTRIM(customer_message.TextContent)), '') IS NOT NULL
          AND customer_message.Source IS NOT NULL
          AND customer_message.Source NOT IN (N'', N'unknown', N'Unknown', N'UNKNOWN', N'missing', N'Missing', N'MISSING', N'null', N'Null', N'NULL', N'none', N'None', N'NONE', N'n/a', N'N/A', N'na', N'NA', N'không xác định', N'Không xác định', N'KHÔNG XÁC ĐỊNH', N'khong xac dinh', N'Khong xac dinh', N'KHONG XAC DINH')
          AND customer_message.SenderId IS NOT NULL
          AND customer_message.SenderId NOT IN (N'', N'unknown', N'Unknown', N'UNKNOWN', N'missing', N'Missing', N'MISSING', N'null', N'Null', N'NULL', N'none', N'None', N'NONE', N'n/a', N'N/A', N'na', N'NA', N'không xác định', N'Không xác định', N'KHÔNG XÁC ĐỊNH', N'khong xac dinh', N'Khong xac dinh', N'KHONG XAC DINH')
          AND (@MinAnalyticsId IS NULL OR analytics.id >= @MinAnalyticsId)
          AND (@MaxAnalyticsId IS NULL OR analytics.id <= @MaxAnalyticsId)
          AND (@FromMessageAt IS NULL OR analytics.messageAt >= @FromMessageAt)
          AND (@ToMessageAt IS NULL OR analytics.messageAt < @ToMessageAt)
          AND (@Source IS NULL OR analytics.source = @Source)
        ORDER BY analytics.id
    )
    UPDATE analytics
    SET analysisStatus = 'pending',
        sentimentSource = 'huggingface',
        analysisRetryCount = 0,
        analysisError = NULL,
        analysisStartedAt = NULL,
        analysisUpdatedAt = SYSUTCDATETIME()
    OUTPUT
        INSERTED.id,
        INSERTED.messageId,
        DELETED.analysisRetryCount,
        DELETED.sentimentSource,
        INSERTED.analysisUpdatedAt
    INTO @Requeued (analyticsId, messageId, previousRetryCount, previousSentimentSource, requeuedAtUtc)
    FROM dbo.WebChat_MessageAnalytics analytics
    INNER JOIN candidates ON candidates.id = analytics.id
    WHERE analytics.analysisStatus = 'quarantined';

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

SELECT
    @MigrationStep AS migrationStep,
    N'applied' AS auditPhase,
    analyticsId,
    messageId,
    previousRetryCount,
    previousSentimentSource,
    requeuedAtUtc
FROM @Requeued
ORDER BY analyticsId;

SELECT
    @MigrationStep AS migrationStep,
    N'applied_summary' AS auditPhase,
    COUNT(*) AS rowsRequeued,
    @BatchSize AS requestedBatchSize
FROM @Requeued;

RAISERROR('Completed step 04. Only quarantined rows were requeued; sentiment values were preserved.', 10, 1) WITH NOWAIT;
