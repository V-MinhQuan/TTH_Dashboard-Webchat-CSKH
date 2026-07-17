/* Read-only preflight. Run after all producers and consumers use Analytics.
   This script does not alter or delete data. All result counts must be zero
   before approving the separate contract/drop migration. */
SET NOCOUNT ON;

SELECT COUNT_BIG(*) AS missingAnalyticsRows
FROM dbo.WebChat_MessageLogs legacy
LEFT JOIN dbo.WebChat_MessageAnalytics analytics
  ON analytics.messageId = legacy.id_webchat_messageLogs
WHERE legacy.keywordAnalyzedAt IS NOT NULL
  AND analytics.id IS NULL;

SELECT COUNT_BIG(*) AS incompleteCanonicalClassifierRows
FROM dbo.WebChat_MessageLogs legacy
INNER JOIN dbo.WebChat_MessageAnalytics analytics
  ON analytics.messageId = legacy.id_webchat_messageLogs
WHERE legacy.keywordAnalyzedAt IS NOT NULL
  AND (
      (legacy.primaryTopicId IS NOT NULL AND analytics.primaryTopicId IS NULL)
      OR (legacy.detectedTopics IS NOT NULL AND analytics.detectedTopics IS NULL)
      OR (legacy.detectedKeywords IS NOT NULL AND analytics.detectedKeywords IS NULL)
      OR (legacy.topicConfidence IS NOT NULL AND analytics.topicConfidence IS NULL)
      OR (legacy.topicSource IS NOT NULL AND analytics.topicSource IS NULL)
      OR (legacy.contextMessageId IS NOT NULL AND analytics.contextMessageId IS NULL)
      OR (legacy.contextDistance IS NOT NULL AND analytics.contextDistance IS NULL)
      OR (legacy.keywordClassifierVersion IS NOT NULL AND analytics.classifierVersion IS NULL)
      OR analytics.keywordAnalyzedAt IS NULL
  );

SELECT COUNT_BIG(*) AS legacyWritesInLast24Hours
FROM dbo.WebChat_MessageLogs
WHERE keywordAnalyzedAt >= DATEADD(hour, -24, SYSUTCDATETIME());

SELECT COUNT_BIG(*) AS canonicalClassifierRows
FROM dbo.WebChat_MessageAnalytics
WHERE keywordAnalyzedAt IS NOT NULL;
