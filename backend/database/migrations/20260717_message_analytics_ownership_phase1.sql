SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.WebChat_MessageLogs', N'U') IS NULL
    THROW 51000, 'dbo.WebChat_MessageLogs does not exist.', 1;
IF OBJECT_ID(N'dbo.WebChat_MessageAnalytics', N'U') IS NULL
    THROW 51000, 'dbo.WebChat_MessageAnalytics does not exist.', 1;

/* Expand: keep legacy MessageLogs columns intact for compatibility/rollback. */
IF COL_LENGTH(N'dbo.WebChat_MessageAnalytics', N'keywordAnalyzedAt') IS NULL
BEGIN
    ALTER TABLE dbo.WebChat_MessageAnalytics
        ADD keywordAnalyzedAt DATETIME2(7) NULL;
END;

IF COL_LENGTH(N'dbo.WebChat_MessageAnalytics', N'classifierVersion') IS NULL
BEGIN
    ALTER TABLE dbo.WebChat_MessageAnalytics
        ADD classifierVersion VARCHAR(80) NULL;
END
ELSE IF EXISTS (
    SELECT 1
    FROM sys.columns c
    WHERE c.object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics')
      AND c.name = N'classifierVersion'
      AND c.max_length < 80
)
BEGIN
    ALTER TABLE dbo.WebChat_MessageAnalytics
        ALTER COLUMN classifierVersion VARCHAR(80) NULL;
END;

/* Create canonical analytics rows for legacy classified messages that do not
   have one yet. Customer rows stay eligible for the existing HF worker. */
INSERT INTO dbo.WebChat_MessageAnalytics
(
    messageId,
    conversationId,
    customerId,
    source,
    sentimentLabel,
    sentimentScore,
    messageAt,
    analyzedAt,
    sentimentSource,
    analysisStatus,
    analysisRetryCount,
    analysisStartedAt,
    analysisUpdatedAt,
    issueFlag,
    needStaffReview
)
SELECT
    m.id_webchat_messageLogs,
    conversation.Id,
    CASE WHEN m.FromHost = 0 THEN m.SenderId ELSE m.ReceiverId END,
    m.Source,
    NULL,
    NULL,
    m.SentAt,
    NULL,
    CASE WHEN m.FromHost = 0 THEN 'huggingface' ELSE 'topic-keyword' END,
    CASE WHEN m.FromHost = 0 THEN 'pending' ELSE 'completed' END,
    0,
    NULL,
    SYSUTCDATETIME(),
    NULL,
    0
FROM dbo.WebChat_MessageLogs m
LEFT JOIN dbo.WebChat_Conversations conversation
  ON conversation.Source = m.Source
 AND conversation.CustomerId = CASE WHEN m.FromHost = 0 THEN m.SenderId ELSE m.ReceiverId END
WHERE (
       m.primaryTopicId IS NOT NULL
    OR m.detectedTopics IS NOT NULL
    OR m.detectedKeywords IS NOT NULL
    OR m.topicConfidence IS NOT NULL
    OR m.topicSource IS NOT NULL
    OR m.contextMessageId IS NOT NULL
    OR m.contextDistance IS NOT NULL
    OR m.keywordClassifierVersion IS NOT NULL
    OR m.keywordAnalyzedAt IS NOT NULL
)
AND NOT EXISTS (
    SELECT 1
    FROM dbo.WebChat_MessageAnalytics existing WITH (UPDLOCK, HOLDLOCK)
    WHERE existing.messageId = m.id_webchat_messageLogs
);

/* Preserve current canonical Analytics values so existing dashboard metrics do
   not change during rollout. Legacy data only fills missing fields. Do not
   reuse analyzedAt: it belongs to the sentiment workflow. */
EXEC(N'
UPDATE analytics
SET primaryTopicId = COALESCE(analytics.primaryTopicId, legacy.primaryTopicId),
    detectedTopics = COALESCE(analytics.detectedTopics, legacy.detectedTopics),
    detectedKeywords = COALESCE(analytics.detectedKeywords, legacy.detectedKeywords),
    topicConfidence = COALESCE(analytics.topicConfidence, legacy.topicConfidence),
    topicSource = COALESCE(analytics.topicSource, legacy.topicSource),
    contextMessageId = COALESCE(analytics.contextMessageId, legacy.contextMessageId),
    contextDistance = COALESCE(analytics.contextDistance, legacy.contextDistance),
    classifierVersion = COALESCE(analytics.classifierVersion, legacy.keywordClassifierVersion),
    keywordAnalyzedAt = COALESCE(analytics.keywordAnalyzedAt, legacy.keywordAnalyzedAt),
    analysisUpdatedAt = SYSUTCDATETIME()
FROM dbo.WebChat_MessageAnalytics analytics
INNER JOIN dbo.WebChat_MessageLogs legacy
  ON legacy.id_webchat_messageLogs = analytics.messageId
WHERE legacy.keywordAnalyzedAt IS NOT NULL
  AND (
      analytics.keywordAnalyzedAt IS NULL
      OR (analytics.primaryTopicId IS NULL AND legacy.primaryTopicId IS NOT NULL)
      OR (analytics.detectedTopics IS NULL AND legacy.detectedTopics IS NOT NULL)
      OR (analytics.detectedKeywords IS NULL AND legacy.detectedKeywords IS NOT NULL)
      OR (analytics.topicConfidence IS NULL AND legacy.topicConfidence IS NOT NULL)
      OR (analytics.topicSource IS NULL AND legacy.topicSource IS NOT NULL)
      OR (analytics.contextMessageId IS NULL AND legacy.contextMessageId IS NOT NULL)
      OR (analytics.contextDistance IS NULL AND legacy.contextDistance IS NOT NULL)
      OR (analytics.classifierVersion IS NULL AND legacy.keywordClassifierVersion IS NOT NULL)
  );
');

/* Verification must be empty before the later contract/drop phase. */
DECLARE @VerificationFailed BIT = 0;
EXEC sys.sp_executesql N'
IF EXISTS (
    SELECT 1
    FROM dbo.WebChat_MessageLogs legacy
    LEFT JOIN dbo.WebChat_MessageAnalytics analytics
      ON analytics.messageId = legacy.id_webchat_messageLogs
    WHERE legacy.keywordAnalyzedAt IS NOT NULL
      AND (
          analytics.id IS NULL
          OR (legacy.primaryTopicId IS NOT NULL AND analytics.primaryTopicId IS NULL)
          OR (legacy.detectedTopics IS NOT NULL AND analytics.detectedTopics IS NULL)
          OR (legacy.detectedKeywords IS NOT NULL AND analytics.detectedKeywords IS NULL)
          OR (legacy.topicConfidence IS NOT NULL AND analytics.topicConfidence IS NULL)
          OR (legacy.topicSource IS NOT NULL AND analytics.topicSource IS NULL)
          OR (legacy.contextMessageId IS NOT NULL AND analytics.contextMessageId IS NULL)
          OR (legacy.contextDistance IS NOT NULL AND analytics.contextDistance IS NULL)
          OR (legacy.keywordClassifierVersion IS NOT NULL AND analytics.classifierVersion IS NULL)
          OR analytics.keywordAnalyzedAt IS NULL
      )
)
    SET @Failed = 1;
', N'@Failed BIT OUTPUT', @Failed = @VerificationFailed OUTPUT;

IF @VerificationFailed = 1
    THROW 51000, 'Topic/keyword analytics backfill verification failed.', 1;

COMMIT TRANSACTION;

EXEC(N'
SELECT
    COUNT_BIG(*) AS migratedClassifierRows,
    MIN(keywordAnalyzedAt) AS firstKeywordAnalyzedAt,
    MAX(keywordAnalyzedAt) AS lastKeywordAnalyzedAt
FROM dbo.WebChat_MessageAnalytics
WHERE keywordAnalyzedAt IS NOT NULL;
');
