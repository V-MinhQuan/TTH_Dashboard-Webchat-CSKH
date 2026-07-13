SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.WebChat_MessageLogs', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.WebChat_MessageLogs', 'primaryTopicId') IS NULL
        ALTER TABLE dbo.WebChat_MessageLogs ADD primaryTopicId VARCHAR(50) NULL;
    IF COL_LENGTH('dbo.WebChat_MessageLogs', 'detectedTopics') IS NULL
        ALTER TABLE dbo.WebChat_MessageLogs ADD detectedTopics NVARCHAR(MAX) NULL;
    IF COL_LENGTH('dbo.WebChat_MessageLogs', 'detectedKeywords') IS NULL
        ALTER TABLE dbo.WebChat_MessageLogs ADD detectedKeywords NVARCHAR(MAX) NULL;
    IF COL_LENGTH('dbo.WebChat_MessageLogs', 'topicConfidence') IS NULL
        ALTER TABLE dbo.WebChat_MessageLogs ADD topicConfidence FLOAT NULL;
    IF COL_LENGTH('dbo.WebChat_MessageLogs', 'topicSource') IS NULL
        ALTER TABLE dbo.WebChat_MessageLogs ADD topicSource VARCHAR(20) NULL;
    IF COL_LENGTH('dbo.WebChat_MessageLogs', 'contextMessageId') IS NULL
        ALTER TABLE dbo.WebChat_MessageLogs ADD contextMessageId BIGINT NULL;
    IF COL_LENGTH('dbo.WebChat_MessageLogs', 'contextDistance') IS NULL
        ALTER TABLE dbo.WebChat_MessageLogs ADD contextDistance TINYINT NULL;
    IF COL_LENGTH('dbo.WebChat_MessageLogs', 'keywordClassifierVersion') IS NULL
        ALTER TABLE dbo.WebChat_MessageLogs ADD keywordClassifierVersion VARCHAR(80) NULL;
    IF COL_LENGTH('dbo.WebChat_MessageLogs', 'keywordAnalyzedAt') IS NULL
        ALTER TABLE dbo.WebChat_MessageLogs ADD keywordAnalyzedAt DATETIME2 NULL;
END;

COMMIT TRANSACTION;

-- No index is created automatically. This preserves current insert cost.
-- Add an index only after comparing live execution plans for real date ranges.
