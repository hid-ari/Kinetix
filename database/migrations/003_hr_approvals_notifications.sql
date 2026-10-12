/*
  Migración 003 — Motor de aprobaciones y notificaciones internas (Kinetix Core RRHH)
  - Flujos de aprobación configurables por tipo de solicitud.
  - Pasos de aprobación multietapa (Supervisor, Responsable depto, Rol específico o Usuario).
  - Solicitudes e historial inmutable de decisiones.
  - Sistema de notificaciones internas in-app.
  Idempotente: puede ejecutarse múltiples veces sin errores.
*/

-- 1. Tabla de Flujos de Aprobación
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'HrApprovalFlows')
BEGIN
    CREATE TABLE dbo.HrApprovalFlows (
        Id                  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HrApprovalFlows PRIMARY KEY,
        CompanyId           INT NOT NULL CONSTRAINT FK_HrApprovalFlows_Companies FOREIGN KEY REFERENCES dbo.Companies(Id),
        RequestType         NVARCHAR(50) NOT NULL, -- 'Vacaciones', 'Permiso', 'HorasExtras', 'CorreccionAsistencia', 'AjusteSalarial'
        Name                NVARCHAR(150) NOT NULL,
        Description         NVARCHAR(500) NULL,
        DepartmentId        INT NULL CONSTRAINT FK_HrApprovalFlows_Departments FOREIGN KEY REFERENCES dbo.HrDepartments(Id),
        IsActive            BIT NOT NULL CONSTRAINT DF_HrApprovalFlows_IsActive DEFAULT 1,
        CreatedAt           DATETIME2(0) NOT NULL CONSTRAINT DF_HrApprovalFlows_CreatedAt DEFAULT SYSUTCDATETIME()
    );

    CREATE INDEX IX_HrApprovalFlows_Company_Type ON dbo.HrApprovalFlows (CompanyId, RequestType, IsActive);
END
GO

-- 2. Pasos de Aprobación por Flujo
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'HrApprovalSteps')
BEGIN
    CREATE TABLE dbo.HrApprovalSteps (
        Id                  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HrApprovalSteps PRIMARY KEY,
        FlowId              INT NOT NULL CONSTRAINT FK_HrApprovalSteps_Flow FOREIGN KEY REFERENCES dbo.HrApprovalFlows(Id) ON DELETE CASCADE,
        StepNumber          INT NOT NULL,
        Name                NVARCHAR(100) NOT NULL,
        ApproverType        NVARCHAR(30) NOT NULL CONSTRAINT CK_HrApprovalSteps_Type CHECK (ApproverType IN (N'Supervisor', N'DepartmentManager', N'Role', N'SpecificUser')),
        ApproverRoleId      INT NULL CONSTRAINT FK_HrApprovalSteps_Role FOREIGN KEY REFERENCES dbo.Roles(Id),
        ApproverUserId      NVARCHAR(450) NULL CONSTRAINT FK_HrApprovalSteps_User FOREIGN KEY REFERENCES dbo.UserOrganizations(UserId),
        AutoApproveDays     INT NULL,
        CONSTRAINT UQ_HrApprovalSteps_Flow_Step UNIQUE (FlowId, StepNumber)
    );
END
GO

-- 3. Solicitudes de Aprobación en Proceso
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'HrApprovalRequests')
BEGIN
    CREATE TABLE dbo.HrApprovalRequests (
        Id                  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HrApprovalRequests PRIMARY KEY,
        CompanyId           INT NOT NULL CONSTRAINT FK_HrApprovalRequests_Companies FOREIGN KEY REFERENCES dbo.Companies(Id),
        FlowId              INT NOT NULL CONSTRAINT FK_HrApprovalRequests_Flow FOREIGN KEY REFERENCES dbo.HrApprovalFlows(Id),
        RequestType         NVARCHAR(50) NOT NULL,
        EntityName          NVARCHAR(50) NOT NULL, -- 'HrVacationRequests', 'HrLeaveRequests', 'HrAttendanceCorrections'
        EntityId            INT NOT NULL,
        RequesterEmployeeId INT NOT NULL CONSTRAINT FK_HrApprovalRequests_Employee FOREIGN KEY REFERENCES dbo.HrEmployees(Id),
        CurrentStepNumber   INT NOT NULL CONSTRAINT DF_HrApprovalRequests_Step DEFAULT 1,
        Status              NVARCHAR(30) NOT NULL CONSTRAINT DF_HrApprovalRequests_Status DEFAULT N'Pendiente'
                            CONSTRAINT CK_HrApprovalRequests_Status CHECK (Status IN (N'Pendiente', N'Aprobada', N'Rechazada', N'Cancelada')),
        CreatedAt           DATETIME2(0) NOT NULL CONSTRAINT DF_HrApprovalRequests_CreatedAt DEFAULT SYSUTCDATETIME(),
        ResolvedAt          DATETIME2(0) NULL
    );

    CREATE INDEX IX_HrApprovalRequests_Search ON dbo.HrApprovalRequests (CompanyId, Status, RequesterEmployeeId);
    CREATE INDEX IX_HrApprovalRequests_Entity ON dbo.HrApprovalRequests (EntityName, EntityId);
END
GO

-- 4. Historial de Decisiones de Aprobación
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'HrApprovalHistory')
BEGIN
    CREATE TABLE dbo.HrApprovalHistory (
        Id                  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HrApprovalHistory PRIMARY KEY,
        RequestId           INT NOT NULL CONSTRAINT FK_HrApprovalHistory_Request FOREIGN KEY REFERENCES dbo.HrApprovalRequests(Id) ON DELETE CASCADE,
        StepNumber          INT NOT NULL,
        ApproverUserId      NVARCHAR(450) NOT NULL CONSTRAINT FK_HrApprovalHistory_User FOREIGN KEY REFERENCES dbo.UserOrganizations(UserId),
        Action              NVARCHAR(30) NOT NULL CONSTRAINT CK_HrApprovalHistory_Action CHECK (Action IN (N'Aprobado', N'Rechazado')),
        Comments            NVARCHAR(1000) NULL,
        ActedAt             DATETIME2(0) NOT NULL CONSTRAINT DF_HrApprovalHistory_ActedAt DEFAULT SYSUTCDATETIME()
    );

    CREATE INDEX IX_HrApprovalHistory_Request ON dbo.HrApprovalHistory (RequestId, ActedAt DESC);
END
GO

-- 5. Notificaciones Internas (In-App)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'HrNotifications')
BEGIN
    CREATE TABLE dbo.HrNotifications (
        Id                  BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HrNotifications PRIMARY KEY,
        CompanyId           INT NOT NULL CONSTRAINT FK_HrNotifications_Companies FOREIGN KEY REFERENCES dbo.Companies(Id),
        UserId              NVARCHAR(450) NOT NULL CONSTRAINT FK_HrNotifications_User FOREIGN KEY REFERENCES dbo.UserOrganizations(UserId),
        Title               NVARCHAR(150) NOT NULL,
        Message             NVARCHAR(1000) NOT NULL,
        Category            NVARCHAR(50) NOT NULL CONSTRAINT DF_HrNotifications_Category DEFAULT N'Sistema', -- 'Aprobacion', 'Asistencia', 'Vacaciones', 'Permiso', 'Contrato', 'Sistema'
        ReferenceType       NVARCHAR(50) NULL,
        ReferenceId         NVARCHAR(100) NULL,
        IsRead              BIT NOT NULL CONSTRAINT DF_HrNotifications_IsRead DEFAULT 0,
        ReadAt              DATETIME2(0) NULL,
        CreatedAt           DATETIME2(0) NOT NULL CONSTRAINT DF_HrNotifications_CreatedAt DEFAULT SYSUTCDATETIME()
    );

    CREATE INDEX IX_HrNotifications_User_Read ON dbo.HrNotifications (UserId, IsRead, CreatedAt DESC);
END
GO

-- 6. Sembrar Permisos para Aprobaciones y Asistencia
INSERT INTO dbo.Permissions (ModuleName, PermissionName, Description)
SELECT v.ModuleName, v.PermissionName, v.Description
FROM (VALUES
    (N'RRHH Aprobaciones', N'Ver aprobaciones', N'Permite consultar bandejas de solicitudes pendientes y tramitadas'),
    (N'RRHH Aprobaciones', N'Aprobar solicitudes', N'Permite tomar decisiones de aprobación o rechazo en flujos de personal'),
    (N'RRHH Aprobaciones', N'Configurar flujos', N'Permite crear y editar flujos y etapas de aprobación'),
    (N'RRHH Asistencia', N'Ver asistencia', N'Permite consultar registros y calendarios de asistencia laboral'),
    (N'RRHH Asistencia', N'Registrar asistencia', N'Permite realizar marcas de entrada y salida o registro manual'),
    (N'RRHH Asistencia', N'Administrar turnos', N'Permite definir horarios y asignar turnos a colaboradores'),
    (N'RRHH Asistencia', N'Aprobar correcciones', N'Permite aprobar solicitudes de corrección de marca horaria'),
    (N'RRHH Asistencia', N'Exportar asistencia', N'Permite descargar reportes consolidados de asistencia'),
    (N'RRHH Vacaciones', N'Ver vacaciones', N'Permite consultar saldos y solicitudes de vacaciones'),
    (N'RRHH Vacaciones', N'Solicitar vacaciones', N'Permite emitir solicitudes formales de vacaciones'),
    (N'RRHH Vacaciones', N'Aprobar vacaciones', N'Permite autorizar o rechazar solicitudes de vacaciones'),
    (N'RRHH Vacaciones', N'Configurar políticas', N'Permite configurar escalas y días de vacaciones'),
    (N'RRHH Permisos', N'Ver permisos', N'Permite consultar solicitudes e historiales de licencias y permisos'),
    (N'RRHH Permisos', N'Solicitar permisos', N'Permite solicitar licencias médicas, personales y permisos laborales'),
    (N'RRHH Permisos', N'Aprobar permisos', N'Permite dictaminar sobre solicitudes de licencias y permisos')
) AS v(ModuleName, PermissionName, Description)
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Permissions AS p WHERE p.ModuleName = v.ModuleName AND p.PermissionName = v.PermissionName
);
GO

-- Asignar nuevos permisos al rol 'Company Admin'
INSERT INTO dbo.RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id
FROM dbo.Roles r
CROSS JOIN dbo.Permissions p
WHERE r.Name = N'Company Admin'
  AND p.ModuleName IN (N'RRHH Aprobaciones', N'RRHH Asistencia', N'RRHH Vacaciones', N'RRHH Permisos')
  AND NOT EXISTS (
      SELECT 1 FROM dbo.RolePermissions rp WHERE rp.RoleId = r.Id AND rp.PermissionId = p.Id
  );
GO

-- 7. Sembrar Flujos de Aprobación por Defecto para cada Empresa Existente
INSERT INTO dbo.HrApprovalFlows (CompanyId, RequestType, Name, Description, IsActive)
SELECT c.Id, N'Vacaciones', N'Flujo Estándar de Vacaciones', N'Aprobación de 2 etapas: Supervisor inmediato y Dirección de RRHH', 1
FROM dbo.Companies c
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.HrApprovalFlows f WHERE f.CompanyId = c.Id AND f.RequestType = N'Vacaciones'
);
GO

INSERT INTO dbo.HrApprovalFlows (CompanyId, RequestType, Name, Description, IsActive)
SELECT c.Id, N'Permiso', N'Flujo Estándar de Permisos y Licencias', N'Aprobación del Supervisor inmediato', 1
FROM dbo.Companies c
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.HrApprovalFlows f WHERE f.CompanyId = c.Id AND f.RequestType = N'Permiso'
);
GO

INSERT INTO dbo.HrApprovalFlows (CompanyId, RequestType, Name, Description, IsActive)
SELECT c.Id, N'CorreccionAsistencia', N'Flujo de Corrección de Asistencia', N'Revisión y autorización del Encargado / Supervisor', 1
FROM dbo.Companies c
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.HrApprovalFlows f WHERE f.CompanyId = c.Id AND f.RequestType = N'CorreccionAsistencia'
);
GO

-- Sembrar Pasos para los Flujos Estándar
-- Vacaciones: Paso 1 = Supervisor, Paso 2 = Rol 'Company Admin' o 'Director de RRHH'
INSERT INTO dbo.HrApprovalSteps (FlowId, StepNumber, Name, ApproverType)
SELECT f.Id, 1, N'Aprobación de Supervisor Inmediato', N'Supervisor'
FROM dbo.HrApprovalFlows f
WHERE f.RequestType = N'Vacaciones'
  AND NOT EXISTS (SELECT 1 FROM dbo.HrApprovalSteps s WHERE s.FlowId = f.Id AND s.StepNumber = 1);
GO

INSERT INTO dbo.HrApprovalSteps (FlowId, StepNumber, Name, ApproverType, ApproverRoleId)
SELECT f.Id, 2, N'Validación de Recursos Humanos', N'Role',
       (SELECT TOP 1 Id FROM dbo.Roles WHERE Name IN (N'Director de RRHH', N'Company Admin') ORDER BY CASE WHEN Name = N'Director de RRHH' THEN 1 ELSE 2 END)
FROM dbo.HrApprovalFlows f
WHERE f.RequestType = N'Vacaciones'
  AND NOT EXISTS (SELECT 1 FROM dbo.HrApprovalSteps s WHERE s.FlowId = f.Id AND s.StepNumber = 2);
GO

-- Permiso: Paso 1 = Supervisor
INSERT INTO dbo.HrApprovalSteps (FlowId, StepNumber, Name, ApproverType)
SELECT f.Id, 1, N'Aprobación de Supervisor', N'Supervisor'
FROM dbo.HrApprovalFlows f
WHERE f.RequestType = N'Permiso'
  AND NOT EXISTS (SELECT 1 FROM dbo.HrApprovalSteps s WHERE s.FlowId = f.Id AND s.StepNumber = 1);
GO

-- Corrección Asistencia: Paso 1 = Supervisor
INSERT INTO dbo.HrApprovalSteps (FlowId, StepNumber, Name, ApproverType)
SELECT f.Id, 1, N'Revisión de Marca Horaria', N'Supervisor'
FROM dbo.HrApprovalFlows f
WHERE f.RequestType = N'CorreccionAsistencia'
  AND NOT EXISTS (SELECT 1 FROM dbo.HrApprovalSteps s WHERE s.FlowId = f.Id AND s.StepNumber = 1);
GO
