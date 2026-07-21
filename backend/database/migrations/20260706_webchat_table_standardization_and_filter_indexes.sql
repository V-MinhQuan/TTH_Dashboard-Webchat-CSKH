SET XACT_ABORT ON;
BEGIN TRANSACTION;

-- 1) Standardize table names to WebChat_[Name].
IF OBJECT_ID(N'dbo.[User]', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.WebChat_User', N'U') IS NULL
BEGIN
    EXEC sp_rename N'dbo.[User]', N'WebChat_User';
END;

IF OBJECT_ID(N'dbo.ChartConfigs', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.WebChat_ChartConfigs', N'U') IS NULL
BEGIN
    EXEC sp_rename N'dbo.ChartConfigs', N'WebChat_ChartConfigs';
END;

IF OBJECT_ID(N'dbo.AiQuestionGroupCache', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.WebChat_AiQuestionGroupCache', N'U') IS NULL
BEGIN
    EXEC sp_rename N'dbo.AiQuestionGroupCache', N'WebChat_AiQuestionGroupCache';
END;

-- 2) Clean status rows that block a trusted FK/unique child key.
IF OBJECT_ID(N'dbo.WebChat_ConversationStatus', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.WebChat_Conversations', N'U') IS NOT NULL
BEGIN
    DELETE s
    FROM dbo.WebChat_ConversationStatus s
    WHERE NOT EXISTS (
        SELECT 1
        FROM dbo.WebChat_Conversations c
        WHERE c.CustomerId = s.CustomerId
          AND c.Source = s.Source
    );

    ;WITH ranked AS (
        SELECT
            s.Id,
            ROW_NUMBER() OVER (
                PARTITION BY s.CustomerId, s.Source
                ORDER BY
                    CASE WHEN s.MarkedAt IS NULL THEN 0 ELSE 1 END DESC,
                    s.MarkedAt DESC,
                    s.Id DESC
            ) AS rn
        FROM dbo.WebChat_ConversationStatus s
    )
    DELETE s
    FROM dbo.WebChat_ConversationStatus s
    INNER JOIN ranked r ON r.Id = s.Id
    WHERE r.rn > 1;
END;

-- 3) Indexes used by dashboard/global filters and latest-row lookups.
IF OBJECT_ID(N'dbo.WebChat_Conversations', N'U') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.WebChat_Conversations')
          AND name = N'UX_WebChat_Conversations_CustomerId_Source'
   )
BEGIN
    CREATE UNIQUE INDEX UX_WebChat_Conversations_CustomerId_Source
        ON dbo.WebChat_Conversations (CustomerId, Source);
END;

IF OBJECT_ID(N'dbo.WebChat_ConversationStatus', N'U') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.WebChat_ConversationStatus')
          AND name = N'UX_WebChat_ConversationStatus_CustomerId_Source'
   )
BEGIN
    CREATE UNIQUE INDEX UX_WebChat_ConversationStatus_CustomerId_Source
        ON dbo.WebChat_ConversationStatus (CustomerId, Source)
        INCLUDE (NoResponseNeeded, MarkedAt, MarkedBy);
END;

IF OBJECT_ID(N'dbo.WebChat_Conversations', N'U') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.WebChat_Conversations')
          AND name = N'IX_WebChat_Conversations_Source_LastCustomerMessageAt'
   )
BEGIN
    CREATE INDEX IX_WebChat_Conversations_Source_LastCustomerMessageAt
        ON dbo.WebChat_Conversations (Source, LastCustomerMessageAt DESC, Id DESC)
        INCLUDE (CustomerId, LastHostMessageAt, LastMessageAt);
END;

IF OBJECT_ID(N'dbo.WebChat_Conversations', N'U') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.WebChat_Conversations')
          AND name = N'IX_WebChat_Conversations_LastCustomerMessageAt'
   )
BEGIN
    CREATE INDEX IX_WebChat_Conversations_LastCustomerMessageAt
        ON dbo.WebChat_Conversations (LastCustomerMessageAt DESC, Id DESC)
        INCLUDE (CustomerId, Source, LastHostMessageAt, LastMessageAt);
END;

IF OBJECT_ID(N'dbo.WebChat_MessageAnalytics', N'U') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics')
          AND name = N'IX_WebChat_MessageAnalytics_Conversation_MessageAt'
   )
BEGIN
    CREATE INDEX IX_WebChat_MessageAnalytics_Conversation_MessageAt
        ON dbo.WebChat_MessageAnalytics (conversationId, messageAt DESC, id DESC)
        INCLUDE (messageId, source, sentimentLabel, issueFlag, needStaffReview, satisfactionScore);
END;

IF OBJECT_ID(N'dbo.WebChat_MessageAnalytics', N'U') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics')
          AND name = N'IX_WebChat_MessageAnalytics_MessageAt'
   )
BEGIN
    CREATE INDEX IX_WebChat_MessageAnalytics_MessageAt
        ON dbo.WebChat_MessageAnalytics (messageAt DESC, id DESC)
        INCLUDE (messageId, conversationId, source, sentimentLabel, issueFlag, needStaffReview);
END;

IF OBJECT_ID(N'dbo.WebChat_MessageLogs', N'U') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.WebChat_MessageLogs')
          AND name = N'IX_WebChat_MessageLogs_Source_Sender_FromHost_SentAt'
   )
BEGIN
    CREATE INDEX IX_WebChat_MessageLogs_Source_Sender_FromHost_SentAt
        ON dbo.WebChat_MessageLogs (Source, SenderId, FromHost, SentAt DESC)
        INCLUDE (id_webchat_messageLogs, ReceiverId);
END;

-- 4) Trusted FK for the logical status-to-conversation relationship.
IF OBJECT_ID(N'dbo.WebChat_ConversationStatus', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.WebChat_Conversations', N'U') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1
        FROM sys.foreign_keys
        WHERE name = N'FK_WebChat_ConversationStatus_Conversations_Customer_Source'
          AND parent_object_id = OBJECT_ID(N'dbo.WebChat_ConversationStatus')
   )
BEGIN
    ALTER TABLE dbo.WebChat_ConversationStatus WITH CHECK
    ADD CONSTRAINT FK_WebChat_ConversationStatus_Conversations_Customer_Source
        FOREIGN KEY (CustomerId, Source)
        REFERENCES dbo.WebChat_Conversations (CustomerId, Source);

    ALTER TABLE dbo.WebChat_ConversationStatus
    CHECK CONSTRAINT FK_WebChat_ConversationStatus_Conversations_Customer_Source;
END;

COMMIT TRANSACTION;
