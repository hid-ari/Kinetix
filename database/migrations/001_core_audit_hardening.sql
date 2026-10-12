/*
  Migración 001 — Refuerzo de auditoría (Kinetix Core)
  - Amplía el catálogo de acciones auditables.
  - Añade sucursal y contexto a cada registro.
  - Protege la tabla contra modificaciones y eliminaciones.
  Idempotente: puede ejecutarse varias veces sin efectos adicionales.
*/

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_AuditLogs_ActionName' AND parent_object_id = OBJECT_ID(N'dbo.AuditLogs'))
    ALTER TABLE dbo.AuditLogs DROP CONSTRAINT CK_AuditLogs_ActionName;
GO

ALTER TABLE dbo.AuditLogs WITH CHECK ADD CONSTRAINT CK_AuditLogs_ActionName CHECK (ActionName IN (
    N'LOGIN', N'LOGIN_FAILED', N'LOGOUT', N'CREATE', N'UPDATE', N'DELETE', N'ACTIVATE', N'DEACTIVATE',
    N'PASSWORD_CHANGE', N'PASSWORD_RESET',
    N'TRANSFER', N'PROMOTE', N'POSITION_CHANGE', N'SALARY_CHANGE', N'SUSPEND', N'LEAVE', N'REACTIVATE', N'TERMINATE',
    N'UPLOAD', N'DOWNLOAD', N'VIEW_SENSITIVE', N'EXPORT', N'APPROVE', N'REJECT', N'LINK_USER', N'UNLINK_USER'
));
GO

IF COL_LENGTH(N'dbo.AuditLogs', N'BranchId') IS NULL
    ALTER TABLE dbo.AuditLogs ADD BranchId INT NULL;
GO

IF COL_LENGTH(N'dbo.AuditLogs', N'Context') IS NULL
    ALTER TABLE dbo.AuditLogs ADD Context NVARCHAR(1000) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AuditLogs_Entity' AND object_id = OBJECT_ID(N'dbo.AuditLogs'))
    CREATE INDEX IX_AuditLogs_Entity ON dbo.AuditLogs (EntityName, EntityId, CreatedAt DESC);
GO

/* Los registros de auditoría no pueden modificarse ni eliminarse desde la aplicación. */
CREATE OR ALTER TRIGGER dbo.TR_AuditLogs_Immutable
ON dbo.AuditLogs
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 50001, N'Los registros de auditoría son inmutables.', 1;
END;
GO
