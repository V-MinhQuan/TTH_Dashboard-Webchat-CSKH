IF COL_LENGTH('dbo.WebChat_MessageAnalytics', 'analyzerVersion') IS NULL
BEGIN
    ALTER TABLE dbo.WebChat_MessageAnalytics
    ADD analyzerVersion NVARCHAR(50) NULL;
END;

IF COL_LENGTH('dbo.WebChat_MessageAnalytics', 'sentimentSource') IS NULL
BEGIN
    ALTER TABLE dbo.WebChat_MessageAnalytics
    ADD sentimentSource NVARCHAR(50) NULL;
END;
