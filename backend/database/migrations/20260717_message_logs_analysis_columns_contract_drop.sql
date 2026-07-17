/* CONTRACT PHASE — intentionally locked by default.
   Run only after producer deployment, application deployment, phase-1
   backfill, preflight, backup, and an observation window are complete. */
SET XACT_ABORT ON;
DECLARE @ConfirmContractDrop BIT = 0;

IF @ConfirmContractDrop <> 1
    THROW 51000, 'Contract drop is locked. Set @ConfirmContractDrop = 1 only after rollout approval.', 1;

IF COL_LENGTH(N'dbo.WebChat_MessageAnalytics', N'keywordAnalyzedAt') IS NULL
    THROW 51000, 'Canonical Analytics schema is not installed.', 1;

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
    THROW 51000, 'Legacy and canonical classifier data are not in parity.', 1;

BEGIN TRANSACTION;

ALTER TABLE dbo.WebChat_MessageLogs DROP COLUMN
    primaryTopicId,
    detectedTopics,
    detectedKeywords,
    topicConfidence,
    topicSource,
    contextMessageId,
    contextDistance,
    keywordClassifierVersion,
    keywordAnalyzedAt;

COMMIT TRANSACTION;
