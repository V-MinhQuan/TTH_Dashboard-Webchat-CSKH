IF COL_LENGTH(N'dbo.WebChat_ChartConfigs', N'OwnerUsername') IS NULL
BEGIN
    ALTER TABLE dbo.WebChat_ChartConfigs ADD OwnerUsername NVARCHAR(255) NULL;
END;

IF COL_LENGTH(N'dbo.WebChat_ChartConfigs', N'Scope') IS NULL
BEGIN
    ALTER TABLE dbo.WebChat_ChartConfigs ADD Scope VARCHAR(20) NULL;
END;

GO

UPDATE dbo.WebChat_ChartConfigs
SET OwnerUsername = COALESCE(OwnerUsername, N'legacy'),
    Scope = CASE
        WHEN Scope IN ('personal', 'shared') THEN Scope
        ELSE 'shared'
    END
WHERE OwnerUsername IS NULL OR Scope IS NULL OR Scope NOT IN ('personal', 'shared');

ALTER TABLE dbo.WebChat_ChartConfigs ALTER COLUMN OwnerUsername NVARCHAR(255) NOT NULL;
ALTER TABLE dbo.WebChat_ChartConfigs ALTER COLUMN Scope VARCHAR(20) NOT NULL;

IF NOT EXISTS (
    SELECT 1
    FROM sys.default_constraints dc
    JOIN sys.columns c
      ON c.object_id = dc.parent_object_id
     AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID(N'dbo.WebChat_ChartConfigs')
      AND c.name = N'Scope'
)
BEGIN
    ALTER TABLE dbo.WebChat_ChartConfigs
        ADD CONSTRAINT DF_WebChat_ChartConfigs_Scope DEFAULT 'personal' FOR Scope;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.WebChat_ChartConfigs')
      AND name = N'CK_WebChat_ChartConfigs_Scope'
)
BEGIN
    ALTER TABLE dbo.WebChat_ChartConfigs WITH CHECK
        ADD CONSTRAINT CK_WebChat_ChartConfigs_Scope CHECK (Scope IN ('personal', 'shared'));
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.WebChat_ChartConfigs')
      AND name = N'IX_WebChat_ChartConfigs_Owner_Scope_Active'
)
BEGIN
    CREATE INDEX IX_WebChat_ChartConfigs_Owner_Scope_Active
        ON dbo.WebChat_ChartConfigs (OwnerUsername, Scope, IsActive, UpdatedAt DESC);
END;
