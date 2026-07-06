SET XACT_ABORT ON;
BEGIN TRANSACTION;

-- Align base WebChat relationships with the received ERD where the current
-- schema can support trusted SQL Server foreign keys without adding columns.

IF OBJECT_ID(N'dbo.WebChat_Messagelogs_User_Info', N'U') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.WebChat_Messagelogs_User_Info')
          AND name = N'UX_WebChat_Messagelogs_User_Info_Sender_Source'
   )
BEGIN
    CREATE UNIQUE INDEX UX_WebChat_Messagelogs_User_Info_Sender_Source
        ON dbo.WebChat_Messagelogs_User_Info (SenderId, Source);
END;

IF OBJECT_ID(N'dbo.WebChat_MessageLogs', N'U') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.WebChat_MessageLogs')
          AND name = N'IX_WebChat_MessageLogs_Sender_Source'
   )
BEGIN
    CREATE INDEX IX_WebChat_MessageLogs_Sender_Source
        ON dbo.WebChat_MessageLogs (SenderId, Source)
        INCLUDE (id_webchat_messageLogs, SentAt, FromHost, ReceiverId);
END;

IF OBJECT_ID(N'dbo.WebChat_MessageLogs', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.WebChat_Messagelogs_User_Info', N'U') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1
        FROM sys.foreign_keys
        WHERE name = N'FK_WebChat_MessageLogs_UserInfo_Sender_Source'
          AND parent_object_id = OBJECT_ID(N'dbo.WebChat_MessageLogs')
   )
BEGIN
    ALTER TABLE dbo.WebChat_MessageLogs WITH CHECK
    ADD CONSTRAINT FK_WebChat_MessageLogs_UserInfo_Sender_Source
        FOREIGN KEY (SenderId, Source)
        REFERENCES dbo.WebChat_Messagelogs_User_Info (SenderId, Source);

    ALTER TABLE dbo.WebChat_MessageLogs
    CHECK CONSTRAINT FK_WebChat_MessageLogs_UserInfo_Sender_Source;
END;

IF OBJECT_ID(N'dbo.WebChat_MessageReadStatus', N'U') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.WebChat_MessageReadStatus')
          AND name = N'IX_WebChat_MessageReadStatus_Customer_Source'
   )
BEGIN
    CREATE INDEX IX_WebChat_MessageReadStatus_Customer_Source
        ON dbo.WebChat_MessageReadStatus (CustomerId, Source)
        INCLUDE (UserName, LastReadMessageId);
END;

IF OBJECT_ID(N'dbo.WebChat_MessageReadStatus', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.WebChat_Conversations', N'U') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1
        FROM sys.foreign_keys
        WHERE name = N'FK_WebChat_MessageReadStatus_Conversations_Customer_Source'
          AND parent_object_id = OBJECT_ID(N'dbo.WebChat_MessageReadStatus')
   )
BEGIN
    ALTER TABLE dbo.WebChat_MessageReadStatus WITH CHECK
    ADD CONSTRAINT FK_WebChat_MessageReadStatus_Conversations_Customer_Source
        FOREIGN KEY (CustomerId, Source)
        REFERENCES dbo.WebChat_Conversations (CustomerId, Source);

    ALTER TABLE dbo.WebChat_MessageReadStatus
    CHECK CONSTRAINT FK_WebChat_MessageReadStatus_Conversations_Customer_Source;
END;

COMMIT TRANSACTION;
