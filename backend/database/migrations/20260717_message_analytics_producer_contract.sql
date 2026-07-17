SET XACT_ABORT ON;

IF COL_LENGTH(N'dbo.WebChat_MessageAnalytics', N'keywordAnalyzedAt') IS NULL
    THROW 51000, 'Run 20260717_message_analytics_ownership_phase1.sql first.', 1;

/* Canonical write contract for the external topic/keyword producer.
   MessageLogs remains immutable; analysis is upserted by internal message id. */
IF OBJECT_ID(N'dbo.WebChat_UpsertMessageTopicAnalytics', N'P') IS NULL
    EXEC(N'CREATE PROCEDURE dbo.WebChat_UpsertMessageTopicAnalytics AS BEGIN SET NOCOUNT ON; END;');

EXEC(N'
ALTER PROCEDURE dbo.WebChat_UpsertMessageTopicAnalytics
    @MessageId INT,
    @PrimaryTopicId VARCHAR(50) = NULL,
    @DetectedTopics NVARCHAR(MAX) = NULL,
    @DetectedKeywords NVARCHAR(MAX) = NULL,
    @TopicConfidence FLOAT = NULL,
    @TopicSource VARCHAR(20) = NULL,
    @ContextMessageId BIGINT = NULL,
    @ContextDistance TINYINT = NULL,
    @ClassifierVersion VARCHAR(80) = NULL,
    @KeywordAnalyzedAt DATETIME2(7) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (
        SELECT 1 FROM dbo.WebChat_MessageLogs WHERE id_webchat_messageLogs = @MessageId
    )
        THROW 51000, ''MessageId does not exist in WebChat_MessageLogs.'', 1;

    DECLARE @EffectiveAnalyzedAt DATETIME2(7) = COALESCE(@KeywordAnalyzedAt, SYSUTCDATETIME());
    BEGIN TRANSACTION;

    UPDATE analytics WITH (UPDLOCK, SERIALIZABLE)
    SET primaryTopicId = @PrimaryTopicId,
        detectedTopics = @DetectedTopics,
        detectedKeywords = @DetectedKeywords,
        topicConfidence = @TopicConfidence,
        topicSource = @TopicSource,
        contextMessageId = @ContextMessageId,
        contextDistance = @ContextDistance,
        classifierVersion = @ClassifierVersion,
        keywordAnalyzedAt = @EffectiveAnalyzedAt,
        analysisUpdatedAt = SYSUTCDATETIME()
    FROM dbo.WebChat_MessageAnalytics analytics
    WHERE analytics.messageId = @MessageId
      AND (analytics.keywordAnalyzedAt IS NULL OR @EffectiveAnalyzedAt >= analytics.keywordAnalyzedAt);

    IF NOT EXISTS (SELECT 1 FROM dbo.WebChat_MessageAnalytics WHERE messageId = @MessageId)
    BEGIN
        INSERT INTO dbo.WebChat_MessageAnalytics
        (
            messageId, conversationId, customerId, source, messageAt,
            sentimentSource, analysisStatus, analysisRetryCount,
            analysisStartedAt, analysisUpdatedAt, issueFlag, needStaffReview,
            primaryTopicId, detectedTopics, detectedKeywords, topicConfidence,
            topicSource, contextMessageId, contextDistance, classifierVersion,
            keywordAnalyzedAt
        )
        SELECT
            message.id_webchat_messageLogs,
            conversation.Id,
            CASE WHEN message.FromHost = 0 THEN message.SenderId ELSE message.ReceiverId END,
            message.Source,
            message.SentAt,
            CASE WHEN message.FromHost = 0 THEN ''huggingface'' ELSE ''topic-keyword'' END,
            CASE WHEN message.FromHost = 0 THEN ''pending'' ELSE ''completed'' END,
            0,
            NULL,
            SYSUTCDATETIME(),
            NULL,
            0,
            @PrimaryTopicId,
            @DetectedTopics,
            @DetectedKeywords,
            @TopicConfidence,
            @TopicSource,
            @ContextMessageId,
            @ContextDistance,
            @ClassifierVersion,
            @EffectiveAnalyzedAt
        FROM dbo.WebChat_MessageLogs message
        LEFT JOIN dbo.WebChat_Conversations conversation
          ON conversation.Source = message.Source
         AND conversation.CustomerId = CASE WHEN message.FromHost = 0 THEN message.SenderId ELSE message.ReceiverId END
        WHERE message.id_webchat_messageLogs = @MessageId;
    END;

    COMMIT TRANSACTION;
END;
');
