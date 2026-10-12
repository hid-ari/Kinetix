/*
  Migración 002 — Recursos Humanos: núcleo (Fase 1)
  Empleados, expediente digital, departamentos, cargos, historial laboral,
  catálogos configurables, alcances de acceso y permisos del módulo.
  Idempotente: puede ejecutarse varias veces sin efectos adicionales.
*/

/* ── Configuración por empresa ───────────────────────────────────────── */
IF OBJECT_ID(N'dbo.HrSettings', N'U') IS NULL
CREATE TABLE dbo.HrSettings
(
    CompanyId               INT NOT NULL CONSTRAINT PK_HrSettings PRIMARY KEY,
    EmployeeCodePrefix      NVARCHAR(10) NOT NULL CONSTRAINT DF_HrSettings_Prefix DEFAULT (N'EMP-'),
    EmployeeCodeDigits      TINYINT NOT NULL CONSTRAINT DF_HrSettings_Digits DEFAULT (5),
    NextEmployeeNumber      INT NOT NULL CONSTRAINT DF_HrSettings_Next DEFAULT (1),
    AllowManualEmployeeCode BIT NOT NULL CONSTRAINT DF_HrSettings_Manual DEFAULT (0),
    BirthdaysEnabled        BIT NOT NULL CONSTRAINT DF_HrSettings_Birthdays DEFAULT (1),
    UpdatedAt               DATETIME2(0) NULL,
    UpdatedBy               NVARCHAR(450) NULL,
    CONSTRAINT FK_HrSettings_Companies FOREIGN KEY (CompanyId) REFERENCES dbo.Companies(Id),
    CONSTRAINT CK_HrSettings_Digits CHECK (EmployeeCodeDigits BETWEEN 3 AND 10),
    CONSTRAINT CK_HrSettings_Next CHECK (NextEmployeeNumber >= 1)
);
GO

/* ── Catálogos configurables (CompanyId NULL = valor global por defecto) ── */
IF OBJECT_ID(N'dbo.HrCatalogItems', N'U') IS NULL
CREATE TABLE dbo.HrCatalogItems
(
    Id          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HrCatalogItems PRIMARY KEY,
    CompanyId   INT NULL,
    CatalogType NVARCHAR(40) NOT NULL,
    Code        NVARCHAR(40) NOT NULL,
    Name        NVARCHAR(120) NOT NULL,
    SortOrder   INT NOT NULL CONSTRAINT DF_HrCatalogItems_Sort DEFAULT (0),
    IsActive    BIT NOT NULL CONSTRAINT DF_HrCatalogItems_IsActive DEFAULT (1),
    CreatedAt   DATETIME2(0) NOT NULL CONSTRAINT DF_HrCatalogItems_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_HrCatalogItems_Companies FOREIGN KEY (CompanyId) REFERENCES dbo.Companies(Id),
    CONSTRAINT UQ_HrCatalogItems UNIQUE (CompanyId, CatalogType, Code),
    CONSTRAINT CK_HrCatalogItems_Type CHECK (CatalogType IN (N'ContractType', N'WorkModality', N'DocumentType', N'TerminationReason'))
);
GO

/* ── Departamentos ────────────────────────────────────────────────────── */
IF OBJECT_ID(N'dbo.HrDepartments', N'U') IS NULL
CREATE TABLE dbo.HrDepartments
(
    Id                  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HrDepartments PRIMARY KEY,
    CompanyId           INT NOT NULL,
    BranchId            INT NULL,
    ParentDepartmentId  INT NULL,
    Code                NVARCHAR(30) NOT NULL,
    Name                NVARCHAR(150) NOT NULL,
    Description         NVARCHAR(500) NULL,
    ManagerEmployeeId   INT NULL,
    IsActive            BIT NOT NULL CONSTRAINT DF_HrDepartments_IsActive DEFAULT (1),
    CreatedAt           DATETIME2(0) NOT NULL CONSTRAINT DF_HrDepartments_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CreatedBy           NVARCHAR(450) NULL,
    UpdatedAt           DATETIME2(0) NULL,
    UpdatedBy           NVARCHAR(450) NULL,
    CONSTRAINT FK_HrDepartments_Companies FOREIGN KEY (CompanyId) REFERENCES dbo.Companies(Id),
    CONSTRAINT FK_HrDepartments_Branches FOREIGN KEY (BranchId) REFERENCES dbo.Branches(Id),
    CONSTRAINT FK_HrDepartments_Parent FOREIGN KEY (ParentDepartmentId) REFERENCES dbo.HrDepartments(Id),
    CONSTRAINT UQ_HrDepartments_Company_Code UNIQUE (CompanyId, Code),
    CONSTRAINT CK_HrDepartments_Parent CHECK (ParentDepartmentId IS NULL OR ParentDepartmentId <> Id)
);
GO

/* ── Cargos ───────────────────────────────────────────────────────────── */
IF OBJECT_ID(N'dbo.HrPositions', N'U') IS NULL
CREATE TABLE dbo.HrPositions
(
    Id                  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HrPositions PRIMARY KEY,
    CompanyId           INT NOT NULL,
    DepartmentId        INT NOT NULL,
    Code                NVARCHAR(30) NOT NULL,
    Title               NVARCHAR(150) NOT NULL,
    Description         NVARCHAR(1000) NULL,
    Responsibilities    NVARCHAR(MAX) NULL,
    HierarchyLevel      TINYINT NOT NULL CONSTRAINT DF_HrPositions_Level DEFAULT (5),
    SalaryMin           DECIMAL(18,2) NULL,
    SalaryMax           DECIMAL(18,2) NULL,
    IsActive            BIT NOT NULL CONSTRAINT DF_HrPositions_IsActive DEFAULT (1),
    CreatedAt           DATETIME2(0) NOT NULL CONSTRAINT DF_HrPositions_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CreatedBy           NVARCHAR(450) NULL,
    UpdatedAt           DATETIME2(0) NULL,
    UpdatedBy           NVARCHAR(450) NULL,
    CONSTRAINT FK_HrPositions_Companies FOREIGN KEY (CompanyId) REFERENCES dbo.Companies(Id),
    CONSTRAINT FK_HrPositions_Departments FOREIGN KEY (DepartmentId) REFERENCES dbo.HrDepartments(Id),
    CONSTRAINT UQ_HrPositions_Company_Code UNIQUE (CompanyId, Code),
    CONSTRAINT CK_HrPositions_Level CHECK (HierarchyLevel BETWEEN 1 AND 15),
    CONSTRAINT CK_HrPositions_Salary CHECK (SalaryMin IS NULL OR SalaryMax IS NULL OR SalaryMin <= SalaryMax),
    CONSTRAINT CK_HrPositions_SalaryPositive CHECK ((SalaryMin IS NULL OR SalaryMin >= 0) AND (SalaryMax IS NULL OR SalaryMax >= 0))
);
GO

/* ── Archivos (metadatos; el contenido vive fuera de /public) ─────────── */
IF OBJECT_ID(N'dbo.HrFiles', N'U') IS NULL
CREATE TABLE dbo.HrFiles
(
    Id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_HrFiles PRIMARY KEY CONSTRAINT DF_HrFiles_Id DEFAULT (NEWID()),
    CompanyId       INT NOT NULL,
    StorageKey      NVARCHAR(300) NOT NULL,
    OriginalName    NVARCHAR(255) NOT NULL,
    MimeType        NVARCHAR(100) NOT NULL,
    SizeBytes       BIGINT NOT NULL,
    Sha256          CHAR(64) NOT NULL,
    UploadedBy      NVARCHAR(450) NULL,
    UploadedAt      DATETIME2(0) NOT NULL CONSTRAINT DF_HrFiles_UploadedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_HrFiles_Companies FOREIGN KEY (CompanyId) REFERENCES dbo.Companies(Id),
    CONSTRAINT FK_HrFiles_Users FOREIGN KEY (UploadedBy) REFERENCES dbo.UserOrganizations(UserId),
    CONSTRAINT CK_HrFiles_Size CHECK (SizeBytes > 0)
);
GO

/* ── Empleados ────────────────────────────────────────────────────────── */
IF OBJECT_ID(N'dbo.HrEmployees', N'U') IS NULL
CREATE TABLE dbo.HrEmployees
(
    Id                      INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HrEmployees PRIMARY KEY,
    CompanyId               INT NOT NULL,
    BranchId                INT NULL,
    EmployeeCode            NVARCHAR(30) NOT NULL,
    FirstName               NVARCHAR(100) NOT NULL,
    LastName                NVARCHAR(100) NOT NULL,
    DocumentType            NVARCHAR(20) NOT NULL,
    DocumentNumber          NVARCHAR(30) NOT NULL,
    BirthDate               DATE NULL,
    Sex                     CHAR(1) NULL,
    Nationality             NVARCHAR(80) NULL,
    MaritalStatus           NVARCHAR(20) NULL,
    Phone                   NVARCHAR(30) NULL,
    Email                   NVARCHAR(254) NULL,
    Address                 NVARCHAR(400) NULL,
    PhotoFileId             UNIQUEIDENTIFIER NULL,
    DepartmentId            INT NULL,
    PositionId              INT NULL,
    SupervisorEmployeeId    INT NULL,
    HireDate                DATE NOT NULL,
    ContractTypeId          INT NULL,
    WorkModalityId          INT NULL,
    BaseSalary              DECIMAL(18,2) NOT NULL CONSTRAINT DF_HrEmployees_Salary DEFAULT (0),
    SalaryCurrency          CHAR(3) NOT NULL CONSTRAINT DF_HrEmployees_Currency DEFAULT ('DOP'),
    PayFrequency            NVARCHAR(20) NOT NULL CONSTRAINT DF_HrEmployees_PayFrequency DEFAULT (N'Mensual'),
    Status                  NVARCHAR(20) NOT NULL CONSTRAINT DF_HrEmployees_Status DEFAULT (N'Activo'),
    StatusChangedAt         DATETIME2(0) NULL,
    TerminationDate         DATE NULL,
    TerminationReasonId     INT NULL,
    TerminationNotes        NVARCHAR(1000) NULL,
    UserId                  NVARCHAR(450) NULL,
    CreatedAt               DATETIME2(0) NOT NULL CONSTRAINT DF_HrEmployees_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CreatedBy               NVARCHAR(450) NULL,
    UpdatedAt               DATETIME2(0) NULL,
    UpdatedBy               NVARCHAR(450) NULL,
    RowVer                  ROWVERSION NOT NULL,
    CONSTRAINT FK_HrEmployees_Companies FOREIGN KEY (CompanyId) REFERENCES dbo.Companies(Id),
    CONSTRAINT FK_HrEmployees_Branches FOREIGN KEY (BranchId) REFERENCES dbo.Branches(Id),
    CONSTRAINT FK_HrEmployees_Departments FOREIGN KEY (DepartmentId) REFERENCES dbo.HrDepartments(Id),
    CONSTRAINT FK_HrEmployees_Positions FOREIGN KEY (PositionId) REFERENCES dbo.HrPositions(Id),
    CONSTRAINT FK_HrEmployees_Supervisor FOREIGN KEY (SupervisorEmployeeId) REFERENCES dbo.HrEmployees(Id),
    CONSTRAINT FK_HrEmployees_ContractType FOREIGN KEY (ContractTypeId) REFERENCES dbo.HrCatalogItems(Id),
    CONSTRAINT FK_HrEmployees_WorkModality FOREIGN KEY (WorkModalityId) REFERENCES dbo.HrCatalogItems(Id),
    CONSTRAINT FK_HrEmployees_TerminationReason FOREIGN KEY (TerminationReasonId) REFERENCES dbo.HrCatalogItems(Id),
    CONSTRAINT FK_HrEmployees_Photo FOREIGN KEY (PhotoFileId) REFERENCES dbo.HrFiles(Id),
    CONSTRAINT FK_HrEmployees_Users FOREIGN KEY (UserId) REFERENCES dbo.UserOrganizations(UserId),
    CONSTRAINT UQ_HrEmployees_Company_Code UNIQUE (CompanyId, EmployeeCode),
    CONSTRAINT UQ_HrEmployees_Company_Document UNIQUE (CompanyId, DocumentType, DocumentNumber),
    CONSTRAINT CK_HrEmployees_Status CHECK (Status IN (N'Activo', N'Suspendido', N'Licencia', N'Desvinculado')),
    CONSTRAINT CK_HrEmployees_DocumentType CHECK (DocumentType IN (N'Cedula', N'Pasaporte', N'Otro')),
    CONSTRAINT CK_HrEmployees_Sex CHECK (Sex IS NULL OR Sex IN ('M', 'F', 'X')),
    CONSTRAINT CK_HrEmployees_MaritalStatus CHECK (MaritalStatus IS NULL OR MaritalStatus IN (N'Soltero', N'Casado', N'Union libre', N'Divorciado', N'Viudo')),
    CONSTRAINT CK_HrEmployees_PayFrequency CHECK (PayFrequency IN (N'Mensual', N'Quincenal', N'Semanal')),
    CONSTRAINT CK_HrEmployees_Salary CHECK (BaseSalary >= 0),
    CONSTRAINT CK_HrEmployees_Supervisor CHECK (SupervisorEmployeeId IS NULL OR SupervisorEmployeeId <> Id),
    CONSTRAINT CK_HrEmployees_Termination CHECK (Status <> N'Desvinculado' OR TerminationDate IS NOT NULL)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_HrEmployees_UserId' AND object_id = OBJECT_ID(N'dbo.HrEmployees'))
    CREATE UNIQUE INDEX UX_HrEmployees_UserId ON dbo.HrEmployees (UserId) WHERE UserId IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_HrEmployees_Company_Status' AND object_id = OBJECT_ID(N'dbo.HrEmployees'))
    CREATE INDEX IX_HrEmployees_Company_Status ON dbo.HrEmployees (CompanyId, Status) INCLUDE (BranchId, DepartmentId, PositionId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_HrEmployees_Supervisor' AND object_id = OBJECT_ID(N'dbo.HrEmployees'))
    CREATE INDEX IX_HrEmployees_Supervisor ON dbo.HrEmployees (SupervisorEmployeeId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_HrEmployees_Department' AND object_id = OBJECT_ID(N'dbo.HrEmployees'))
    CREATE INDEX IX_HrEmployees_Department ON dbo.HrEmployees (DepartmentId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_HrEmployees_Name' AND object_id = OBJECT_ID(N'dbo.HrEmployees'))
    CREATE INDEX IX_HrEmployees_Name ON dbo.HrEmployees (CompanyId, LastName, FirstName);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_HrDepartments_Manager')
    ALTER TABLE dbo.HrDepartments ADD CONSTRAINT FK_HrDepartments_Manager FOREIGN KEY (ManagerEmployeeId) REFERENCES dbo.HrEmployees(Id);
GO

/* ── Contactos de emergencia ──────────────────────────────────────────── */
IF OBJECT_ID(N'dbo.HrEmergencyContacts', N'U') IS NULL
CREATE TABLE dbo.HrEmergencyContacts
(
    Id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HrEmergencyContacts PRIMARY KEY,
    EmployeeId      INT NOT NULL,
    FullName        NVARCHAR(150) NOT NULL,
    Relationship    NVARCHAR(60) NULL,
    Phone           NVARCHAR(30) NOT NULL,
    AltPhone        NVARCHAR(30) NULL,
    IsPrimary       BIT NOT NULL CONSTRAINT DF_HrEmergencyContacts_Primary DEFAULT (0),
    CreatedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_HrEmergencyContacts_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_HrEmergencyContacts_Employees FOREIGN KEY (EmployeeId) REFERENCES dbo.HrEmployees(Id)
);
GO

/* ── Historial laboral (inmutable) ────────────────────────────────────── */
IF OBJECT_ID(N'dbo.HrEmployeeMovements', N'U') IS NULL
CREATE TABLE dbo.HrEmployeeMovements
(
    Id                  BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HrEmployeeMovements PRIMARY KEY,
    EmployeeId          INT NOT NULL,
    CompanyId           INT NOT NULL,
    MovementType        NVARCHAR(30) NOT NULL,
    EffectiveDate       DATE NOT NULL,
    FromBranchId        INT NULL,
    ToBranchId          INT NULL,
    FromDepartmentId    INT NULL,
    ToDepartmentId      INT NULL,
    FromPositionId      INT NULL,
    ToPositionId        INT NULL,
    FromSupervisorId    INT NULL,
    ToSupervisorId      INT NULL,
    FromSalary          DECIMAL(18,2) NULL,
    ToSalary            DECIMAL(18,2) NULL,
    FromStatus          NVARCHAR(20) NULL,
    ToStatus            NVARCHAR(20) NULL,
    Reason              NVARCHAR(1000) NULL,
    CreatedBy           NVARCHAR(450) NULL,
    CreatedAt           DATETIME2(0) NOT NULL CONSTRAINT DF_HrEmployeeMovements_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_HrEmployeeMovements_Employees FOREIGN KEY (EmployeeId) REFERENCES dbo.HrEmployees(Id),
    CONSTRAINT FK_HrEmployeeMovements_Companies FOREIGN KEY (CompanyId) REFERENCES dbo.Companies(Id),
    CONSTRAINT FK_HrEmployeeMovements_Users FOREIGN KEY (CreatedBy) REFERENCES dbo.UserOrganizations(UserId),
    CONSTRAINT CK_HrEmployeeMovements_Type CHECK (MovementType IN (
        N'Ingreso', N'Transferencia', N'Ascenso', N'CambioCargo', N'AjusteSalarial',
        N'Suspension', N'Reactivacion', N'Licencia', N'Desvinculacion'))
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_HrEmployeeMovements_Employee' AND object_id = OBJECT_ID(N'dbo.HrEmployeeMovements'))
    CREATE INDEX IX_HrEmployeeMovements_Employee ON dbo.HrEmployeeMovements (EmployeeId, EffectiveDate DESC, Id DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_HrEmployeeMovements_Company_Date' AND object_id = OBJECT_ID(N'dbo.HrEmployeeMovements'))
    CREATE INDEX IX_HrEmployeeMovements_Company_Date ON dbo.HrEmployeeMovements (CompanyId, MovementType, EffectiveDate);
GO

CREATE OR ALTER TRIGGER dbo.TR_HrEmployeeMovements_Immutable
ON dbo.HrEmployeeMovements
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 50002, N'El historial laboral es inmutable.', 1;
END;
GO

/* ── Expediente digital ───────────────────────────────────────────────── */
IF OBJECT_ID(N'dbo.HrEmployeeDocuments', N'U') IS NULL
CREATE TABLE dbo.HrEmployeeDocuments
(
    Id                  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HrEmployeeDocuments PRIMARY KEY,
    EmployeeId          INT NOT NULL,
    CompanyId           INT NOT NULL,
    DocumentTypeId      INT NOT NULL,
    Title               NVARCHAR(200) NOT NULL,
    Description         NVARCHAR(500) NULL,
    FileId              UNIQUEIDENTIFIER NOT NULL,
    VersionNumber       INT NOT NULL CONSTRAINT DF_HrEmployeeDocuments_Version DEFAULT (1),
    RootDocumentId      INT NULL,
    IsCurrent           BIT NOT NULL CONSTRAINT DF_HrEmployeeDocuments_Current DEFAULT (1),
    IsConfidential      BIT NOT NULL CONSTRAINT DF_HrEmployeeDocuments_Confidential DEFAULT (0),
    IssueDate           DATE NULL,
    ExpiryDate          DATE NULL,
    IsDeleted           BIT NOT NULL CONSTRAINT DF_HrEmployeeDocuments_Deleted DEFAULT (0),
    DeletedAt           DATETIME2(0) NULL,
    DeletedBy           NVARCHAR(450) NULL,
    CreatedAt           DATETIME2(0) NOT NULL CONSTRAINT DF_HrEmployeeDocuments_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CreatedBy           NVARCHAR(450) NULL,
    CONSTRAINT FK_HrEmployeeDocuments_Employees FOREIGN KEY (EmployeeId) REFERENCES dbo.HrEmployees(Id),
    CONSTRAINT FK_HrEmployeeDocuments_Companies FOREIGN KEY (CompanyId) REFERENCES dbo.Companies(Id),
    CONSTRAINT FK_HrEmployeeDocuments_Type FOREIGN KEY (DocumentTypeId) REFERENCES dbo.HrCatalogItems(Id),
    CONSTRAINT FK_HrEmployeeDocuments_Files FOREIGN KEY (FileId) REFERENCES dbo.HrFiles(Id),
    CONSTRAINT FK_HrEmployeeDocuments_Root FOREIGN KEY (RootDocumentId) REFERENCES dbo.HrEmployeeDocuments(Id),
    CONSTRAINT CK_HrEmployeeDocuments_Dates CHECK (IssueDate IS NULL OR ExpiryDate IS NULL OR IssueDate <= ExpiryDate)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_HrEmployeeDocuments_Employee' AND object_id = OBJECT_ID(N'dbo.HrEmployeeDocuments'))
    CREATE INDEX IX_HrEmployeeDocuments_Employee ON dbo.HrEmployeeDocuments (EmployeeId, IsDeleted, IsCurrent);
GO

/* ── Alcance de acceso a datos de RRHH por usuario ────────────────────── */
IF OBJECT_ID(N'dbo.HrAccessScopes', N'U') IS NULL
CREATE TABLE dbo.HrAccessScopes
(
    Id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HrAccessScopes PRIMARY KEY,
    UserId          NVARCHAR(450) NOT NULL,
    ScopeType       NVARCHAR(20) NOT NULL,
    CompanyId       INT NOT NULL,
    BranchId        INT NULL,
    DepartmentId    INT NULL,
    CreatedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_HrAccessScopes_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CreatedBy       NVARCHAR(450) NULL,
    CONSTRAINT FK_HrAccessScopes_Users FOREIGN KEY (UserId) REFERENCES dbo.UserOrganizations(UserId),
    CONSTRAINT FK_HrAccessScopes_Companies FOREIGN KEY (CompanyId) REFERENCES dbo.Companies(Id),
    CONSTRAINT FK_HrAccessScopes_Branches FOREIGN KEY (BranchId) REFERENCES dbo.Branches(Id),
    CONSTRAINT FK_HrAccessScopes_Departments FOREIGN KEY (DepartmentId) REFERENCES dbo.HrDepartments(Id),
    CONSTRAINT CK_HrAccessScopes_Type CHECK (
        (ScopeType = N'Empresa' AND BranchId IS NULL AND DepartmentId IS NULL) OR
        (ScopeType = N'Sucursal' AND BranchId IS NOT NULL AND DepartmentId IS NULL) OR
        (ScopeType = N'Departamento' AND DepartmentId IS NOT NULL AND BranchId IS NULL))
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_HrAccessScopes' AND object_id = OBJECT_ID(N'dbo.HrAccessScopes'))
    CREATE UNIQUE INDEX UX_HrAccessScopes ON dbo.HrAccessScopes (UserId, ScopeType, CompanyId, BranchId, DepartmentId);
GO

/*
  Empleados visibles para un usuario. Centraliza las reglas de alcance:
  global, administrador de empresa, alcances explícitos (empresa, sucursal,
  departamento con sus subdepartamentos), equipo a cargo (directo e indirecto)
  y ficha propia.
*/
CREATE OR ALTER FUNCTION dbo.fn_HrVisibleEmployees
(
    @UserId         NVARCHAR(450),
    @IsGlobal       BIT,
    @IsCompanyAdmin BIT
)
RETURNS TABLE
AS
RETURN
WITH SelfEmployee AS (
    SELECT e.Id FROM dbo.HrEmployees AS e WHERE e.UserId = @UserId
),
Team AS (
    SELECT e.Id FROM dbo.HrEmployees AS e INNER JOIN SelfEmployee AS s ON e.SupervisorEmployeeId = s.Id
    UNION ALL
    SELECT e.Id FROM dbo.HrEmployees AS e INNER JOIN Team AS t ON e.SupervisorEmployeeId = t.Id
),
ScopeDepartments AS (
    SELECT d.Id FROM dbo.HrDepartments AS d
    INNER JOIN dbo.HrAccessScopes AS s ON s.ScopeType = N'Departamento' AND s.DepartmentId = d.Id
    WHERE s.UserId = @UserId
    UNION ALL
    SELECT d.Id FROM dbo.HrDepartments AS d INNER JOIN ScopeDepartments AS p ON d.ParentDepartmentId = p.Id
)
SELECT e.Id AS EmployeeId
FROM dbo.HrEmployees AS e
WHERE @IsGlobal = 1
   OR (@IsCompanyAdmin = 1 AND e.CompanyId = (SELECT u.CompanyId FROM dbo.UserOrganizations AS u WHERE u.UserId = @UserId))
   OR EXISTS (SELECT 1 FROM dbo.HrAccessScopes AS s WHERE s.UserId = @UserId AND s.ScopeType = N'Empresa' AND s.CompanyId = e.CompanyId)
   OR EXISTS (SELECT 1 FROM dbo.HrAccessScopes AS s WHERE s.UserId = @UserId AND s.ScopeType = N'Sucursal' AND s.BranchId = e.BranchId)
   OR e.DepartmentId IN (SELECT Id FROM ScopeDepartments)
   OR e.Id IN (SELECT Id FROM Team)
   OR e.Id IN (SELECT Id FROM SelfEmployee);
GO

/* Empresas sobre las que un usuario puede operar en RRHH. */
CREATE OR ALTER FUNCTION dbo.fn_HrAccessibleCompanies
(
    @UserId     NVARCHAR(450),
    @IsGlobal   BIT
)
RETURNS TABLE
AS
RETURN
SELECT c.Id AS CompanyId
FROM dbo.Companies AS c
WHERE @IsGlobal = 1
   OR c.Id = (SELECT u.CompanyId FROM dbo.UserOrganizations AS u WHERE u.UserId = @UserId)
   OR EXISTS (SELECT 1 FROM dbo.HrAccessScopes AS s WHERE s.UserId = @UserId AND s.CompanyId = c.Id);
GO

/* ── Catálogos globales por defecto (República Dominicana) ────────────── */
INSERT INTO dbo.HrCatalogItems (CompanyId, CatalogType, Code, Name, SortOrder)
SELECT NULL, v.CatalogType, v.Code, v.Name, v.SortOrder
FROM (VALUES
    (N'ContractType', N'INDEFINIDO', N'Por tiempo indefinido', 1),
    (N'ContractType', N'DEFINIDO', N'Por cierto tiempo', 2),
    (N'ContractType', N'OBRA', N'Para obra o servicio determinado', 3),
    (N'ContractType', N'PASANTIA', N'Pasantía', 4),
    (N'WorkModality', N'PRESENCIAL', N'Presencial', 1),
    (N'WorkModality', N'REMOTO', N'Remoto', 2),
    (N'WorkModality', N'HIBRIDO', N'Híbrido', 3),
    (N'DocumentType', N'CONTRATO', N'Contrato laboral', 1),
    (N'DocumentType', N'IDENTIFICACION', N'Documento de identidad', 2),
    (N'DocumentType', N'CERTIFICACION', N'Certificación', 3),
    (N'DocumentType', N'TITULO', N'Título académico', 4),
    (N'DocumentType', N'CV', N'Currículum', 5),
    (N'DocumentType', N'MEDICO', N'Certificado médico', 6),
    (N'DocumentType', N'OTRO', N'Otro documento', 99),
    (N'TerminationReason', N'RENUNCIA', N'Renuncia (desahucio del trabajador)', 1),
    (N'TerminationReason', N'DESAHUCIO', N'Desahucio por el empleador', 2),
    (N'TerminationReason', N'DESPIDO', N'Despido justificado', 3),
    (N'TerminationReason', N'DIMISION', N'Dimisión', 4),
    (N'TerminationReason', N'MUTUO_ACUERDO', N'Mutuo acuerdo', 5),
    (N'TerminationReason', N'FIN_CONTRATO', N'Terminación de contrato', 6),
    (N'TerminationReason', N'PENSION', N'Pensión o jubilación', 7),
    (N'TerminationReason', N'FALLECIMIENTO', N'Fallecimiento', 8),
    (N'TerminationReason', N'OTRO', N'Otro motivo', 99)
) AS v(CatalogType, Code, Name, SortOrder)
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.HrCatalogItems AS c
    WHERE c.CompanyId IS NULL AND c.CatalogType = v.CatalogType AND c.Code = v.Code
);
GO

/* ── Permisos del módulo ──────────────────────────────────────────────── */
INSERT INTO dbo.Permissions (ModuleName, PermissionName, Description)
SELECT v.ModuleName, v.PermissionName, v.Description
FROM (VALUES
    (N'RRHH Empleados', N'Ver empleados', N'Consultar empleados dentro del alcance asignado'),
    (N'RRHH Empleados', N'Crear empleados', N'Registrar nuevos empleados'),
    (N'RRHH Empleados', N'Editar empleados', N'Actualizar datos de empleados y vincular usuarios'),
    (N'RRHH Empleados', N'Gestionar movimientos', N'Transferencias, ascensos y cambios de cargo'),
    (N'RRHH Empleados', N'Cambiar estado laboral', N'Suspender, reactivar y desvincular empleados'),
    (N'RRHH Empleados', N'Ver información salarial', N'Consultar y ajustar salarios'),
    (N'RRHH Empleados', N'Ver datos sensibles', N'Consultar documento de identidad, dirección y datos personales'),
    (N'RRHH Empleados', N'Exportar empleados', N'Exportar listados y fichas de empleados'),
    (N'RRHH Expedientes', N'Ver documentos', N'Consultar el expediente digital'),
    (N'RRHH Expedientes', N'Cargar documentos', N'Adjuntar documentos y nuevas versiones'),
    (N'RRHH Expedientes', N'Ver documentos confidenciales', N'Consultar documentos marcados como confidenciales'),
    (N'RRHH Expedientes', N'Eliminar documentos', N'Eliminar documentos del expediente (eliminación lógica)'),
    (N'RRHH Estructura', N'Ver estructura', N'Consultar departamentos, cargos y organigrama'),
    (N'RRHH Estructura', N'Administrar departamentos y cargos', N'Crear, editar y desactivar departamentos y cargos'),
    (N'RRHH Configuración', N'Configurar políticas de RRHH', N'Catálogos, codificación y alcances de acceso')
) AS v(ModuleName, PermissionName, Description)
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Permissions AS p WHERE p.ModuleName = v.ModuleName AND p.PermissionName = v.PermissionName
);
GO

/* ── Roles de referencia (configurables) ──────────────────────────────── */
INSERT INTO dbo.Roles (Name, Description, RoleType)
SELECT v.Name, v.Description, N'Personalizado'
FROM (VALUES
    (N'Director de RRHH', N'Dirige la gestión de personal con acceso completo al módulo de RRHH'),
    (N'Analista de RRHH', N'Gestiona expedientes y movimientos sin acceso salarial'),
    (N'Encargado de Nómina', N'Consulta empleados e información salarial'),
    (N'Supervisor', N'Consulta la información de su equipo')
) AS v(Name, Description)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Roles AS r WHERE r.Name = v.Name);
GO

INSERT INTO dbo.RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id
FROM (VALUES
    (N'Company Admin', N'*'),
    (N'Director de RRHH', N'*'),
    (N'Analista de RRHH', N'RRHH Empleados|Ver empleados'),
    (N'Analista de RRHH', N'RRHH Empleados|Crear empleados'),
    (N'Analista de RRHH', N'RRHH Empleados|Editar empleados'),
    (N'Analista de RRHH', N'RRHH Empleados|Gestionar movimientos'),
    (N'Analista de RRHH', N'RRHH Empleados|Ver datos sensibles'),
    (N'Analista de RRHH', N'RRHH Empleados|Exportar empleados'),
    (N'Analista de RRHH', N'RRHH Expedientes|Ver documentos'),
    (N'Analista de RRHH', N'RRHH Expedientes|Cargar documentos'),
    (N'Analista de RRHH', N'RRHH Estructura|Ver estructura'),
    (N'Encargado de Nómina', N'RRHH Empleados|Ver empleados'),
    (N'Encargado de Nómina', N'RRHH Empleados|Ver información salarial'),
    (N'Encargado de Nómina', N'RRHH Empleados|Ver datos sensibles'),
    (N'Encargado de Nómina', N'RRHH Empleados|Exportar empleados'),
    (N'Encargado de Nómina', N'RRHH Estructura|Ver estructura'),
    (N'Supervisor', N'RRHH Empleados|Ver empleados'),
    (N'Supervisor', N'RRHH Expedientes|Ver documentos'),
    (N'Supervisor', N'RRHH Estructura|Ver estructura')
) AS g(RoleName, PermissionKey)
INNER JOIN dbo.Roles AS r ON r.Name = g.RoleName
INNER JOIN dbo.Permissions AS p
    ON p.ModuleName LIKE N'RRHH %'
   AND (g.PermissionKey = N'*' OR CONCAT(p.ModuleName, N'|', p.PermissionName) = g.PermissionKey)
WHERE NOT EXISTS (SELECT 1 FROM dbo.RolePermissions AS rp WHERE rp.RoleId = r.Id AND rp.PermissionId = p.Id);
GO
