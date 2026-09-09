/*
  Kinetix Core
  Esquema SQL Server para reemplazar la data hardcodeada del prototipo.
  La aplicación debe leer estas entidades mediante una API o servicio de datos.
*/

IF DB_ID(N'KinetixCore') IS NULL
BEGIN
    CREATE DATABASE KinetixCore;
END;
GO

USE KinetixCore;
GO

CREATE TABLE dbo.Companies
(
    Id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Companies PRIMARY KEY,
    Name            NVARCHAR(150) NOT NULL,
    Rnc             VARCHAR(20) NOT NULL,
    LogoUrl         NVARCHAR(500) NULL,
    ContactEmail    NVARCHAR(254) NULL,
    Phone           NVARCHAR(30) NULL,
    Address         NVARCHAR(300) NULL,
    IsActive        BIT NOT NULL CONSTRAINT DF_Companies_IsActive DEFAULT (1),
    CreatedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_Companies_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt       DATETIME2(0) NULL,
    CONSTRAINT UQ_Companies_Rnc UNIQUE (Rnc)
);
GO

CREATE TABLE dbo.Branches
(
    Id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Branches PRIMARY KEY,
    CompanyId       INT NOT NULL,
    Name            NVARCHAR(150) NOT NULL,
    Code            NVARCHAR(30) NOT NULL,
    Address         NVARCHAR(300) NULL,
    Phone           NVARCHAR(30) NULL,
    Email           NVARCHAR(254) NULL,
    ManagerUserId   NVARCHAR(450) NULL,
    IsActive        BIT NOT NULL CONSTRAINT DF_Branches_IsActive DEFAULT (1),
    CreatedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_Branches_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt       DATETIME2(0) NULL,
    CONSTRAINT FK_Branches_Companies FOREIGN KEY (CompanyId) REFERENCES dbo.Companies(Id),
    CONSTRAINT UQ_Branches_Company_Code UNIQUE (CompanyId, Code)
);
GO

/*
  Estos campos representan la relación de negocio. En producción, UserId debe
  apuntar a AspNetUsers.Id de ASP.NET Core Identity.
*/
CREATE TABLE dbo.UserOrganizations
(
    UserId          NVARCHAR(450) NOT NULL CONSTRAINT PK_UserOrganizations PRIMARY KEY,
    CompanyId       INT NOT NULL,
    BranchId        INT NULL,
    FirstName       NVARCHAR(100) NOT NULL,
    LastName        NVARCHAR(100) NOT NULL,
    Email           NVARCHAR(254) NOT NULL,
    PasswordHash    NVARCHAR(500) NULL,
    Phone           NVARCHAR(30) NULL,
    IsActive        BIT NOT NULL CONSTRAINT DF_UserOrganizations_IsActive DEFAULT (1),
    LastLoginAt     DATETIME2(0) NULL,
    CreatedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_UserOrganizations_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt       DATETIME2(0) NULL,
    CONSTRAINT FK_UserOrganizations_Companies FOREIGN KEY (CompanyId) REFERENCES dbo.Companies(Id),
    CONSTRAINT FK_UserOrganizations_Branches FOREIGN KEY (BranchId) REFERENCES dbo.Branches(Id),
    CONSTRAINT UQ_UserOrganizations_Email UNIQUE (Email)
);
GO

CREATE TABLE dbo.Roles
(
    Id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Roles PRIMARY KEY,
    Name            NVARCHAR(100) NOT NULL,
    Description     NVARCHAR(300) NULL,
    RoleType        NVARCHAR(30) NOT NULL CONSTRAINT DF_Roles_RoleType DEFAULT (N'Personalizado'),
    IsActive        BIT NOT NULL CONSTRAINT DF_Roles_IsActive DEFAULT (1),
    CreatedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_Roles_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_Roles_Name UNIQUE (Name)
);
GO

CREATE TABLE dbo.UserRoles
(
    UserId          NVARCHAR(450) NOT NULL,
    RoleId          INT NOT NULL,
    AssignedAt      DATETIME2(0) NOT NULL CONSTRAINT DF_UserRoles_AssignedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_UserRoles PRIMARY KEY (UserId, RoleId),
    CONSTRAINT FK_UserRoles_Users FOREIGN KEY (UserId) REFERENCES dbo.UserOrganizations(UserId),
    CONSTRAINT FK_UserRoles_Roles FOREIGN KEY (RoleId) REFERENCES dbo.Roles(Id)
);
GO

CREATE TABLE dbo.Permissions
(
    Id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Permissions PRIMARY KEY,
    ModuleName      NVARCHAR(80) NOT NULL,
    PermissionName  NVARCHAR(120) NOT NULL,
    Description     NVARCHAR(300) NULL,
    CONSTRAINT UQ_Permissions_Module_Name UNIQUE (ModuleName, PermissionName)
);
GO

CREATE TABLE dbo.RolePermissions
(
    RoleId          INT NOT NULL,
    PermissionId    INT NOT NULL,
    CONSTRAINT PK_RolePermissions PRIMARY KEY (RoleId, PermissionId),
    CONSTRAINT FK_RolePermissions_Roles FOREIGN KEY (RoleId) REFERENCES dbo.Roles(Id),
    CONSTRAINT FK_RolePermissions_Permissions FOREIGN KEY (PermissionId) REFERENCES dbo.Permissions(Id)
);
GO

CREATE TABLE dbo.AuditLogs
(
    Id              BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AuditLogs PRIMARY KEY,
    UserId          NVARCHAR(450) NULL,
    CompanyId       INT NULL,
    ActionName      NVARCHAR(40) NOT NULL,
    ModuleName      NVARCHAR(80) NOT NULL,
    EntityName      NVARCHAR(80) NULL,
    EntityId        NVARCHAR(100) NULL,
    IpAddress       VARCHAR(45) NULL,
    UserAgent       NVARCHAR(500) NULL,
    OldValues       NVARCHAR(MAX) NULL,
    NewValues       NVARCHAR(MAX) NULL,
    CreatedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_AuditLogs_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_AuditLogs_Users FOREIGN KEY (UserId) REFERENCES dbo.UserOrganizations(UserId),
    CONSTRAINT FK_AuditLogs_Companies FOREIGN KEY (CompanyId) REFERENCES dbo.Companies(Id),
    CONSTRAINT CK_AuditLogs_ActionName CHECK (ActionName IN (N'LOGIN', N'LOGIN_FAILED', N'CREATE', N'UPDATE', N'DEACTIVATE', N'ACTIVATE', N'PASSWORD_CHANGE', N'DELETE'))
);
GO

CREATE INDEX IX_Companies_Name ON dbo.Companies (Name);
CREATE INDEX IX_Companies_IsActive ON dbo.Companies (IsActive);
CREATE INDEX IX_Branches_CompanyId ON dbo.Branches (CompanyId);
CREATE INDEX IX_UserOrganizations_CompanyId ON dbo.UserOrganizations (CompanyId);
CREATE INDEX IX_UserOrganizations_BranchId ON dbo.UserOrganizations (BranchId);
CREATE INDEX IX_AuditLogs_CreatedAt ON dbo.AuditLogs (CreatedAt DESC);
CREATE INDEX IX_AuditLogs_Filters ON dbo.AuditLogs (CompanyId, ModuleName, ActionName, UserId);
GO

IF OBJECT_ID(N'dbo.UserSessions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.UserSessions
    (
        TokenHash       CHAR(64) NOT NULL CONSTRAINT PK_UserSessions PRIMARY KEY,
        UserId          NVARCHAR(450) NOT NULL,
        ExpiresAt       DATETIME2(0) NOT NULL,
        CreatedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_UserSessions_CreatedAt DEFAULT (SYSUTCDATETIME()),
        LastSeenAt      DATETIME2(0) NOT NULL CONSTRAINT DF_UserSessions_LastSeenAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_UserSessions_Users FOREIGN KEY (UserId) REFERENCES dbo.UserOrganizations(UserId)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_UserSessions_ExpiresAt' AND object_id = OBJECT_ID(N'dbo.UserSessions'))
    CREATE INDEX IX_UserSessions_ExpiresAt ON dbo.UserSessions (ExpiresAt);
GO

IF OBJECT_ID(N'dbo.Products', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Products
    (
        Id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Products PRIMARY KEY,
        CompanyId       INT NOT NULL,
        Sku             NVARCHAR(50) NOT NULL,
        Name            NVARCHAR(180) NOT NULL,
        Category        NVARCHAR(100) NULL,
        UnitName        NVARCHAR(30) NOT NULL CONSTRAINT DF_Products_UnitName DEFAULT (N'und.'),
        MinimumStock    DECIMAL(18, 3) NOT NULL CONSTRAINT DF_Products_MinimumStock DEFAULT (0),
        UnitCost        DECIMAL(18, 4) NOT NULL CONSTRAINT DF_Products_UnitCost DEFAULT (0),
        IsActive        BIT NOT NULL CONSTRAINT DF_Products_IsActive DEFAULT (1),
        CreatedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_Products_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt       DATETIME2(0) NULL,
        CONSTRAINT FK_Products_Companies FOREIGN KEY (CompanyId) REFERENCES dbo.Companies(Id),
        CONSTRAINT UQ_Products_Company_Sku UNIQUE (CompanyId, Sku)
    );
END;
GO

IF OBJECT_ID(N'dbo.InventoryStock', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.InventoryStock
    (
        Id              BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_InventoryStock PRIMARY KEY,
        CompanyId       INT NOT NULL,
        ProductId       INT NOT NULL,
        BranchId        INT NOT NULL,
        Quantity        DECIMAL(18, 3) NOT NULL CONSTRAINT DF_InventoryStock_Quantity DEFAULT (0),
        UpdatedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_InventoryStock_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_InventoryStock_Companies FOREIGN KEY (CompanyId) REFERENCES dbo.Companies(Id),
        CONSTRAINT FK_InventoryStock_Products FOREIGN KEY (ProductId) REFERENCES dbo.Products(Id),
        CONSTRAINT FK_InventoryStock_Branches FOREIGN KEY (BranchId) REFERENCES dbo.Branches(Id),
        CONSTRAINT UQ_InventoryStock_Product_Branch UNIQUE (ProductId, BranchId)
    );
END;
GO

IF OBJECT_ID(N'dbo.InventoryMovements', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.InventoryMovements
    (
        Id              BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_InventoryMovements PRIMARY KEY,
        CompanyId       INT NOT NULL,
        ProductId       INT NOT NULL,
        BranchId        INT NOT NULL,
        MovementType    NVARCHAR(10) NOT NULL,
        Quantity        DECIMAL(18, 3) NOT NULL,
        UnitCost        DECIMAL(18, 4) NULL,
        Notes           NVARCHAR(300) NULL,
        CreatedBy       NVARCHAR(450) NULL,
        CreatedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_InventoryMovements_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_InventoryMovements_Companies FOREIGN KEY (CompanyId) REFERENCES dbo.Companies(Id),
        CONSTRAINT FK_InventoryMovements_Products FOREIGN KEY (ProductId) REFERENCES dbo.Products(Id),
        CONSTRAINT FK_InventoryMovements_Branches FOREIGN KEY (BranchId) REFERENCES dbo.Branches(Id),
        CONSTRAINT FK_InventoryMovements_Users FOREIGN KEY (CreatedBy) REFERENCES dbo.UserOrganizations(UserId),
        CONSTRAINT CK_InventoryMovements_Type CHECK (MovementType IN (N'Entrada', N'Salida')),
        CONSTRAINT CK_InventoryMovements_Quantity CHECK (Quantity > 0)
    );
END;
GO

IF OBJECT_ID(N'dbo.FinanceTransactions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.FinanceTransactions
    (
        Id              BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_FinanceTransactions PRIMARY KEY,
        CompanyId       INT NOT NULL,
        TransactionType NVARCHAR(20) NOT NULL,
        Category        NVARCHAR(100) NOT NULL,
        Description     NVARCHAR(300) NULL,
        Amount          DECIMAL(18, 2) NOT NULL,
        TransactionDate DATE NOT NULL CONSTRAINT DF_FinanceTransactions_Date DEFAULT (CONVERT(date, SYSUTCDATETIME())),
        Status          NVARCHAR(20) NOT NULL CONSTRAINT DF_FinanceTransactions_Status DEFAULT (N'Pendiente'),
        CreatedBy       NVARCHAR(450) NULL,
        CreatedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_FinanceTransactions_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_FinanceTransactions_Companies FOREIGN KEY (CompanyId) REFERENCES dbo.Companies(Id),
        CONSTRAINT FK_FinanceTransactions_Users FOREIGN KEY (CreatedBy) REFERENCES dbo.UserOrganizations(UserId),
        CONSTRAINT CK_FinanceTransactions_Type CHECK (TransactionType IN (N'Ingreso', N'Gasto')),
        CONSTRAINT CK_FinanceTransactions_Amount CHECK (Amount > 0)
    );
END;
GO

CREATE INDEX IX_Products_Company ON dbo.Products (CompanyId, IsActive);
CREATE INDEX IX_InventoryStock_Company ON dbo.InventoryStock (CompanyId, BranchId);
CREATE INDEX IX_InventoryMovements_CompanyDate ON dbo.InventoryMovements (CompanyId, CreatedAt DESC);
CREATE INDEX IX_FinanceTransactions_CompanyDate ON dbo.FinanceTransactions (CompanyId, TransactionDate DESC);
GO

/* Datos base de roles y permisos. No contiene usuarios ni empresas de demo. */
INSERT INTO dbo.Roles (Name, Description, RoleType)
VALUES
    (N'Super Admin', N'Acceso global a todas las empresas', N'Sistema'),
    (N'Company Admin', N'Administra su empresa y sus usuarios', N'Personalizado'),
    (N'Manager', N'Gestiona la operación de su sucursal', N'Personalizado'),
    (N'Employee', N'Acceso a módulos autorizados', N'Personalizado');
GO

INSERT INTO dbo.Permissions (ModuleName, PermissionName, Description)
VALUES
    (N'Dashboard', N'Ver Dashboard', N'Consultar el dashboard según el alcance del usuario'),
    (N'Empresas', N'Ver empresas', N'Consultar empresas autorizadas'),
    (N'Empresas', N'Crear empresas', N'Crear empresas'),
    (N'Empresas', N'Editar empresas', N'Editar empresas'),
    (N'Empresas', N'Desactivar empresas', N'Activar o desactivar empresas'),
    (N'Usuarios', N'Ver usuarios', N'Consultar usuarios autorizados'),
    (N'Usuarios', N'Crear usuarios', N'Crear usuarios'),
    (N'Usuarios', N'Editar usuarios', N'Editar usuarios'),
    (N'Usuarios', N'Desactivar usuarios', N'Activar o desactivar usuarios'),
    (N'Sucursales', N'Ver sucursales', N'Consultar sucursales autorizadas'),
    (N'Sucursales', N'Crear sucursales', N'Crear sucursales'),
    (N'Sucursales', N'Editar sucursales', N'Editar sucursales'),
    (N'Auditoría', N'Ver auditoría', N'Consultar registros de auditoría');
GO

/* Consulta principal para alimentar el listado de empresas. */
CREATE OR ALTER VIEW dbo.vw_CompaniesList
AS
SELECT
    c.Id,
    c.Name,
    c.Rnc,
    c.IsActive,
    c.CreatedAt,
    COUNT(DISTINCT u.UserId) AS UserCount,
    COUNT(DISTINCT b.Id) AS BranchCount,
    COUNT(DISTINCT CASE WHEN u.IsActive = 1 THEN u.UserId END) AS ActiveUserCount,
    COUNT(DISTINCT CASE WHEN u.IsActive = 0 THEN u.UserId END) AS InactiveUserCount
FROM dbo.Companies AS c
LEFT JOIN dbo.UserOrganizations AS u ON u.CompanyId = c.Id
LEFT JOIN dbo.Branches AS b ON b.CompanyId = c.Id
GROUP BY c.Id, c.Name, c.Rnc, c.IsActive, c.CreatedAt;
GO

/*
  EJECUTAR SOLO EN LA BASE DE DATOS DEL PROTOTIPO.
  Elimina únicamente los registros demo conocidos, respetando el orden de FK.
*/
-- BEGIN TRANSACTION;
-- DELETE FROM dbo.AuditLogs WHERE UserId IN (N'demo-laura', N'demo-juan', N'demo-sofia', N'demo-carlos');
-- DELETE FROM dbo.UserRoles WHERE UserId IN (N'demo-laura', N'demo-juan', N'demo-sofia', N'demo-carlos');
-- DELETE FROM dbo.UserOrganizations WHERE UserId IN (N'demo-laura', N'demo-juan', N'demo-sofia', N'demo-carlos');
-- DELETE FROM dbo.Branches WHERE Code IN (N'ALT-001', N'ALT-002', N'NOR-001');
-- DELETE FROM dbo.Companies WHERE Rnc IN (N'1-31-88420-6', N'1-01-44219-3', N'1-24-77840-1');
-- COMMIT TRANSACTION;

/* Consultas que sustituyen los arrays hardcodeados del frontend. */
-- Empresas: SELECT * FROM dbo.vw_CompaniesList ORDER BY Name OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
-- Usuarios: SELECT * FROM dbo.UserOrganizations WHERE CompanyId = @CompanyId ORDER BY LastName, FirstName;
-- Sucursales: SELECT * FROM dbo.Branches WHERE CompanyId = @CompanyId AND IsActive = 1 ORDER BY Name;
-- Auditoría: SELECT * FROM dbo.AuditLogs WHERE CompanyId = @CompanyId ORDER BY CreatedAt DESC OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
