SET XACT_ABORT ON;
BEGIN TRANSACTION;

-- Add real diagram-visible FK links for the analytics table without adding
-- columns. The FK columns must match the referenced int keys, so the existing
-- bigint analytics ids are narrowed after validating all live values.

IF OBJECT_ID(N'dbo.WebChat_MessageAnalytics', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.WebChat_MessageLogs', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.WebChat_Conversations', N'U') IS NOT NULL
BEGIN
    IF EXISTS (
        SELECT 1
        FROM dbo.WebChat_MessageAnalytics
        WHERE messageId IS NULL
           OR messageId < -2147483648
           OR messageId > 2147483647
    )
    BEGIN
        ROLLBACK TRANSACTION;
        RAISERROR('Cannot convert WebChat_MessageAnalytics.messageId to int safely.', 16, 1);
        RETURN;
    END;

    IF EXISTS (
        SELECT 1
        FROM dbo.WebChat_MessageAnalytics
        WHERE conversationId IS NOT NULL
          AND (conversationId < -2147483648 OR conversationId > 2147483647)
    )
    BEGIN
        ROLLBACK TRANSACTION;
        RAISERROR('Cannot convert WebChat_MessageAnalytics.conversationId to int safely.', 16, 1);
        RETURN;
    END;

    IF EXISTS (
        SELECT 1
        FROM dbo.WebChat_MessageAnalytics a
        LEFT JOIN dbo.WebChat_MessageLogs m
          ON m.id_webchat_messageLogs = a.messageId
        WHERE m.id_webchat_messageLogs IS NULL
    )
    BEGIN
        ROLLBACK TRANSACTION;
        RAISERROR('Cannot add FK: WebChat_MessageAnalytics.messageId has orphan rows.', 16, 1);
        RETURN;
    END;

    IF EXISTS (
        SELECT 1
        FROM dbo.WebChat_MessageAnalytics a
        LEFT JOIN dbo.WebChat_Conversations c
          ON c.Id = a.conversationId
        WHERE a.conversationId IS NOT NULL
          AND c.Id IS NULL
    )
    BEGIN
        ROLLBACK TRANSACTION;
        RAISERROR('Cannot add FK: WebChat_MessageAnalytics.conversationId has orphan rows.', 16, 1);
        RETURN;
    END;

    IF EXISTS (
        SELECT 1
        FROM sys.foreign_keys
        WHERE parent_object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics')
          AND name = N'FK_WebChat_MessageAnalytics_MessageLogs_MessageId'
    )
    BEGIN
        ALTER TABLE dbo.WebChat_MessageAnalytics
        DROP CONSTRAINT FK_WebChat_MessageAnalytics_MessageLogs_MessageId;
    END;

    IF EXISTS (
        SELECT 1
        FROM sys.foreign_keys
        WHERE parent_object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics')
          AND name = N'FK_WebChat_MessageAnalytics_Conversations_ConversationId'
    )
    BEGIN
        ALTER TABLE dbo.WebChat_MessageAnalytics
        DROP CONSTRAINT FK_WebChat_MessageAnalytics_Conversations_ConversationId;
    END;

    IF EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics')
          AND name = N'IX_WebChat_MessageAnalytics_Conversation_MessageAt'
    )
    BEGIN
        DROP INDEX IX_WebChat_MessageAnalytics_Conversation_MessageAt
            ON dbo.WebChat_MessageAnalytics;
    END;

    IF EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics')
          AND name = N'IX_WebChat_MessageAnalytics_MessageAt'
    )
    BEGIN
        DROP INDEX IX_WebChat_MessageAnalytics_MessageAt
            ON dbo.WebChat_MessageAnalytics;
    END;

    IF EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics')
          AND name = N'IX_MsgAnalytics_MessageId'
    )
    BEGIN
        DROP INDEX IX_MsgAnalytics_MessageId
            ON dbo.WebChat_MessageAnalytics;
    END;

    IF EXISTS (
        SELECT 1
        FROM sys.columns c
        JOIN sys.types ty ON ty.user_type_id = c.user_type_id
        WHERE c.object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics')
          AND c.name = N'messageId'
          AND ty.name = N'bigint'
    )
    BEGIN
        ALTER TABLE dbo.WebChat_MessageAnalytics
        ALTER COLUMN messageId INT NOT NULL;
    END;

    IF EXISTS (
        SELECT 1
        FROM sys.columns c
        JOIN sys.types ty ON ty.user_type_id = c.user_type_id
        WHERE c.object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics')
          AND c.name = N'conversationId'
          AND ty.name = N'bigint'
    )
    BEGIN
        ALTER TABLE dbo.WebChat_MessageAnalytics
        ALTER COLUMN conversationId INT NULL;
    END;

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics')
          AND name = N'IX_MsgAnalytics_MessageId'
    )
    BEGIN
        CREATE UNIQUE INDEX IX_MsgAnalytics_MessageId
            ON dbo.WebChat_MessageAnalytics (messageId);
    END;

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics')
          AND name = N'IX_WebChat_MessageAnalytics_Conversation_MessageAt'
    )
    BEGIN
        CREATE INDEX IX_WebChat_MessageAnalytics_Conversation_MessageAt
            ON dbo.WebChat_MessageAnalytics (conversationId, messageAt DESC, id DESC)
            INCLUDE (messageId, source, sentimentLabel, issueFlag, needStaffReview, satisfactionScore);
    END;

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics')
          AND name = N'IX_WebChat_MessageAnalytics_MessageAt'
    )
    BEGIN
        CREATE INDEX IX_WebChat_MessageAnalytics_MessageAt
            ON dbo.WebChat_MessageAnalytics (messageAt DESC, id DESC)
            INCLUDE (messageId, conversationId, source, sentimentLabel, issueFlag, needStaffReview);
    END;

    IF NOT EXISTS (
        SELECT 1
        FROM sys.foreign_keys
        WHERE parent_object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics')
          AND name = N'FK_WebChat_MessageAnalytics_MessageLogs_MessageId'
    )
    BEGIN
        ALTER TABLE dbo.WebChat_MessageAnalytics WITH CHECK
        ADD CONSTRAINT FK_WebChat_MessageAnalytics_MessageLogs_MessageId
            FOREIGN KEY (messageId)
            REFERENCES dbo.WebChat_MessageLogs (id_webchat_messageLogs);

        ALTER TABLE dbo.WebChat_MessageAnalytics
        CHECK CONSTRAINT FK_WebChat_MessageAnalytics_MessageLogs_MessageId;
    END;

    IF NOT EXISTS (
        SELECT 1
        FROM sys.foreign_keys
        WHERE parent_object_id = OBJECT_ID(N'dbo.WebChat_MessageAnalytics')
          AND name = N'FK_WebChat_MessageAnalytics_Conversations_ConversationId'
    )
    BEGIN
        ALTER TABLE dbo.WebChat_MessageAnalytics WITH CHECK
        ADD CONSTRAINT FK_WebChat_MessageAnalytics_Conversations_ConversationId
            FOREIGN KEY (conversationId)
            REFERENCES dbo.WebChat_Conversations (Id);

        ALTER TABLE dbo.WebChat_MessageAnalytics
        CHECK CONSTRAINT FK_WebChat_MessageAnalytics_Conversations_ConversationId;
    END;
END;

COMMIT TRANSACTION;
