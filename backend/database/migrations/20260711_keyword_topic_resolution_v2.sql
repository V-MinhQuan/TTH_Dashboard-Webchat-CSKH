SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.WebChat_MessageAnalytics', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.WebChat_MessageAnalytics', 'primaryTopicId') IS NULL
        ALTER TABLE dbo.WebChat_MessageAnalytics ADD primaryTopicId VARCHAR(50) NULL;
    IF COL_LENGTH('dbo.WebChat_MessageAnalytics', 'topicConfidence') IS NULL
        ALTER TABLE dbo.WebChat_MessageAnalytics ADD topicConfidence FLOAT NULL;
    IF COL_LENGTH('dbo.WebChat_MessageAnalytics', 'topicSource') IS NULL
        ALTER TABLE dbo.WebChat_MessageAnalytics ADD topicSource VARCHAR(20) NULL;
    IF COL_LENGTH('dbo.WebChat_MessageAnalytics', 'contextMessageId') IS NULL
        ALTER TABLE dbo.WebChat_MessageAnalytics ADD contextMessageId BIGINT NULL;
    IF COL_LENGTH('dbo.WebChat_MessageAnalytics', 'contextDistance') IS NULL
        ALTER TABLE dbo.WebChat_MessageAnalytics ADD contextDistance TINYINT NULL;
    IF COL_LENGTH('dbo.WebChat_MessageAnalytics', 'classifierVersion') IS NULL
        ALTER TABLE dbo.WebChat_MessageAnalytics ADD classifierVersion VARCHAR(50) NULL;
END;

COMMIT TRANSACTION;

-- Deliberately no new index here. Existing dashboard queries keep using the
-- established columns, so the migration adds no write/index maintenance cost.
-- Add a primaryTopicId/messageAt index only after a live execution-plan benchmark.
