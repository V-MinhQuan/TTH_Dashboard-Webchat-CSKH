/*
  Purpose:
    Prepare WebChat_MessageAnalytics to persist Independent Issue Detection
    metadata returned by ml-service /predict-ensemble.

  Safety:
    - This migration is nullable and additive.
    - Do not run this directly on production without DBA approval and a backup.
    - This task only prepares the migration; it does not reprocess data.
*/

IF COL_LENGTH('dbo.WebChat_MessageAnalytics', 'issueFlag') IS NULL
BEGIN
    ALTER TABLE dbo.WebChat_MessageAnalytics
    ADD issueFlag BIT NULL;
END;

IF COL_LENGTH('dbo.WebChat_MessageAnalytics', 'issueType') IS NULL
BEGIN
    ALTER TABLE dbo.WebChat_MessageAnalytics
    ADD issueType NVARCHAR(100) NULL;
END;

IF COL_LENGTH('dbo.WebChat_MessageAnalytics', 'issueReason') IS NULL
BEGIN
    ALTER TABLE dbo.WebChat_MessageAnalytics
    ADD issueReason NVARCHAR(1000) NULL;
END;

IF COL_LENGTH('dbo.WebChat_MessageAnalytics', 'issueConfidence') IS NULL
BEGIN
    ALTER TABLE dbo.WebChat_MessageAnalytics
    ADD issueConfidence FLOAT NULL;
END;

IF COL_LENGTH('dbo.WebChat_MessageAnalytics', 'issueFlag') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE name = 'IX_WebChat_MessageAnalytics_IssueFlag_MessageAt'
          AND object_id = OBJECT_ID('dbo.WebChat_MessageAnalytics')
   )
BEGIN
    CREATE INDEX IX_WebChat_MessageAnalytics_IssueFlag_MessageAt
        ON dbo.WebChat_MessageAnalytics (issueFlag, messageAt DESC)
        WHERE issueFlag = 1;
END;
