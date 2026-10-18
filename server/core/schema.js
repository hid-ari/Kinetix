/**
 * Ensures runtime operational schema (Products, Inventory, Finance, Sessions, Default Permissions).
 */
export async function ensureOperationsSchema(pool) {
  await pool.request().query(`
    IF OBJECT_ID(N'dbo.Products', N'U') IS NULL
    CREATE TABLE dbo.Products (
      Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY, CompanyId INT NOT NULL, Sku NVARCHAR(50) NOT NULL,
      Name NVARCHAR(180) NOT NULL, Category NVARCHAR(100) NULL, UnitName NVARCHAR(30) NOT NULL DEFAULT (N'und.'),
      MinimumStock DECIMAL(18,3) NOT NULL DEFAULT (0), UnitCost DECIMAL(18,4) NOT NULL DEFAULT (0),
      IsActive BIT NOT NULL DEFAULT (1), CreatedAt DATETIME2(0) NOT NULL DEFAULT (SYSUTCDATETIME()), UpdatedAt DATETIME2(0) NULL,
      CONSTRAINT FK_Products_Companies_Runtime FOREIGN KEY (CompanyId) REFERENCES dbo.Companies(Id),
      CONSTRAINT UQ_Products_Company_Sku_Runtime UNIQUE (CompanyId, Sku)
    );
    IF OBJECT_ID(N'dbo.InventoryStock', N'U') IS NULL
    CREATE TABLE dbo.InventoryStock (
      Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY, CompanyId INT NOT NULL, ProductId INT NOT NULL, BranchId INT NOT NULL,
      Quantity DECIMAL(18,3) NOT NULL DEFAULT (0), UpdatedAt DATETIME2(0) NOT NULL DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT FK_InventoryStock_Companies_Runtime FOREIGN KEY (CompanyId) REFERENCES dbo.Companies(Id),
      CONSTRAINT FK_InventoryStock_Products_Runtime FOREIGN KEY (ProductId) REFERENCES dbo.Products(Id),
      CONSTRAINT FK_InventoryStock_Branches_Runtime FOREIGN KEY (BranchId) REFERENCES dbo.Branches(Id),
      CONSTRAINT UQ_InventoryStock_Product_Branch_Runtime UNIQUE (ProductId, BranchId)
    );
    IF OBJECT_ID(N'dbo.InventoryMovements', N'U') IS NULL
    CREATE TABLE dbo.InventoryMovements (
      Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY, CompanyId INT NOT NULL, ProductId INT NOT NULL, BranchId INT NOT NULL,
      MovementType NVARCHAR(10) NOT NULL, Quantity DECIMAL(18,3) NOT NULL, UnitCost DECIMAL(18,4) NULL,
      Notes NVARCHAR(300) NULL, CreatedBy NVARCHAR(450) NULL, CreatedAt DATETIME2(0) NOT NULL DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT FK_InventoryMovements_Companies_Runtime FOREIGN KEY (CompanyId) REFERENCES dbo.Companies(Id),
      CONSTRAINT FK_InventoryMovements_Products_Runtime FOREIGN KEY (ProductId) REFERENCES dbo.Products(Id),
      CONSTRAINT FK_InventoryMovements_Branches_Runtime FOREIGN KEY (BranchId) REFERENCES dbo.Branches(Id),
      CONSTRAINT FK_InventoryMovements_Users_Runtime FOREIGN KEY (CreatedBy) REFERENCES dbo.UserOrganizations(UserId),
      CONSTRAINT CK_InventoryMovements_Type_Runtime CHECK (MovementType IN (N'Entrada', N'Salida')),
      CONSTRAINT CK_InventoryMovements_Quantity_Runtime CHECK (Quantity > 0)
    );
    IF OBJECT_ID(N'dbo.FinanceTransactions', N'U') IS NULL
    CREATE TABLE dbo.FinanceTransactions (
      Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY, CompanyId INT NOT NULL, TransactionType NVARCHAR(20) NOT NULL,
      Category NVARCHAR(100) NOT NULL, Description NVARCHAR(300) NULL, Amount DECIMAL(18,2) NOT NULL,
      TransactionDate DATE NOT NULL DEFAULT (CONVERT(date, SYSUTCDATETIME())), Status NVARCHAR(20) NOT NULL DEFAULT (N'Pendiente'),
      CreatedBy NVARCHAR(450) NULL, CreatedAt DATETIME2(0) NOT NULL DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT FK_FinanceTransactions_Companies_Runtime FOREIGN KEY (CompanyId) REFERENCES dbo.Companies(Id),
      CONSTRAINT FK_FinanceTransactions_Users_Runtime FOREIGN KEY (CreatedBy) REFERENCES dbo.UserOrganizations(UserId),
      CONSTRAINT CK_FinanceTransactions_Type_Runtime CHECK (TransactionType IN (N'Ingreso', N'Gasto')),
      CONSTRAINT CK_FinanceTransactions_Amount_Runtime CHECK (Amount > 0)
    );
    IF COL_LENGTH(N'dbo.FinanceTransactions', N'TaxRate') IS NULL ALTER TABLE dbo.FinanceTransactions ADD TaxRate DECIMAL(9,4) NOT NULL CONSTRAINT DF_FinanceTransactions_TaxRate DEFAULT (0);
    IF COL_LENGTH(N'dbo.FinanceTransactions', N'TaxAmount') IS NULL ALTER TABLE dbo.FinanceTransactions ADD TaxAmount DECIMAL(18,2) NOT NULL CONSTRAINT DF_FinanceTransactions_TaxAmount DEFAULT (0);
    IF COL_LENGTH(N'dbo.FinanceTransactions', N'DueDate') IS NULL ALTER TABLE dbo.FinanceTransactions ADD DueDate DATE NULL;
    IF COL_LENGTH(N'dbo.FinanceTransactions', N'ApprovedBy') IS NULL ALTER TABLE dbo.FinanceTransactions ADD ApprovedBy NVARCHAR(450) NULL, ApprovedAt DATETIME2(0) NULL, ReversedAt DATETIME2(0) NULL;
    IF OBJECT_ID(N'dbo.FinanceContacts', N'U') IS NULL
    CREATE TABLE dbo.FinanceContacts (
      Id INT IDENTITY(1,1) PRIMARY KEY, CompanyId INT NOT NULL, ContactType NVARCHAR(20) NOT NULL,
      Name NVARCHAR(180) NOT NULL, TaxId NVARCHAR(40) NULL, Email NVARCHAR(254) NULL, Phone NVARCHAR(40) NULL,
      IsActive BIT NOT NULL DEFAULT (1), CreatedAt DATETIME2(0) NOT NULL DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT FK_FinanceContacts_Companies FOREIGN KEY (CompanyId) REFERENCES dbo.Companies(Id),
      CONSTRAINT CK_FinanceContacts_Type CHECK (ContactType IN (N'Cliente', N'Proveedor'))
    );
    IF OBJECT_ID(N'dbo.FinanceInvoices', N'U') IS NULL
    CREATE TABLE dbo.FinanceInvoices (
      Id BIGINT IDENTITY(1,1) PRIMARY KEY, CompanyId INT NOT NULL, ContactId INT NULL, InvoiceNumber NVARCHAR(50) NOT NULL,
      InvoiceType NVARCHAR(20) NOT NULL, IssueDate DATE NOT NULL DEFAULT (CONVERT(date, SYSUTCDATETIME())), DueDate DATE NULL,
      Subtotal DECIMAL(18,2) NOT NULL, TaxRate DECIMAL(9,4) NOT NULL DEFAULT (0), TaxAmount DECIMAL(18,2) NOT NULL DEFAULT (0),
      Total DECIMAL(18,2) NOT NULL, Status NVARCHAR(20) NOT NULL DEFAULT (N'Pendiente'), CreatedBy NVARCHAR(450) NULL,
      CreatedAt DATETIME2(0) NOT NULL DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT FK_FinanceInvoices_Companies FOREIGN KEY (CompanyId) REFERENCES dbo.Companies(Id),
      CONSTRAINT FK_FinanceInvoices_Contacts FOREIGN KEY (ContactId) REFERENCES dbo.FinanceContacts(Id),
      CONSTRAINT FK_FinanceInvoices_Users FOREIGN KEY (CreatedBy) REFERENCES dbo.UserOrganizations(UserId),
      CONSTRAINT CK_FinanceInvoices_Type CHECK (InvoiceType IN (N'Venta', N'Compra'))
    );
    IF COL_LENGTH(N'dbo.FinanceInvoices', N'Ncf') IS NULL ALTER TABLE dbo.FinanceInvoices ADD Ncf NVARCHAR(19) NULL;
    IF COL_LENGTH(N'dbo.UserOrganizations', N'ResetToken') IS NULL ALTER TABLE dbo.UserOrganizations ADD ResetToken CHAR(64) NULL, ResetTokenExpiresAt DATETIME2(0) NULL;
    IF OBJECT_ID(N'dbo.FinancePayments', N'U') IS NULL
    CREATE TABLE dbo.FinancePayments (
      Id BIGINT IDENTITY(1,1) PRIMARY KEY, CompanyId INT NOT NULL, InvoiceId BIGINT NULL, TransactionId BIGINT NULL,
      Amount DECIMAL(18,2) NOT NULL, PaymentDate DATE NOT NULL DEFAULT (CONVERT(date, SYSUTCDATETIME())),
      Method NVARCHAR(40) NOT NULL, Reference NVARCHAR(100) NULL, CreatedBy NVARCHAR(450) NULL,
      CreatedAt DATETIME2(0) NOT NULL DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT FK_FinancePayments_Companies FOREIGN KEY (CompanyId) REFERENCES dbo.Companies(Id),
      CONSTRAINT FK_FinancePayments_Invoices FOREIGN KEY (InvoiceId) REFERENCES dbo.FinanceInvoices(Id),
      CONSTRAINT FK_FinancePayments_Transactions FOREIGN KEY (TransactionId) REFERENCES dbo.FinanceTransactions(Id),
      CONSTRAINT FK_FinancePayments_Users FOREIGN KEY (CreatedBy) REFERENCES dbo.UserOrganizations(UserId)
    );
    IF OBJECT_ID(N'dbo.FinanceBankTransactions', N'U') IS NULL
    CREATE TABLE dbo.FinanceBankTransactions (
      Id BIGINT IDENTITY(1,1) PRIMARY KEY, CompanyId INT NOT NULL, TransactionDate DATE NOT NULL,
      Description NVARCHAR(300) NOT NULL, Amount DECIMAL(18,2) NOT NULL, Reference NVARCHAR(100) NULL,
      Status NVARCHAR(20) NOT NULL DEFAULT (N'Pendiente'), ReconciledAt DATETIME2(0) NULL, ReconciledBy NVARCHAR(450) NULL,
      CreatedAt DATETIME2(0) NOT NULL DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT FK_FinanceBankTransactions_Companies FOREIGN KEY (CompanyId) REFERENCES dbo.Companies(Id),
      CONSTRAINT FK_FinanceBankTransactions_Users FOREIGN KEY (ReconciledBy) REFERENCES dbo.UserOrganizations(UserId)
    );
    IF OBJECT_ID(N'dbo.UserSessions', N'U') IS NULL
    CREATE TABLE dbo.UserSessions (
      TokenHash CHAR(64) NOT NULL PRIMARY KEY, UserId NVARCHAR(450) NOT NULL,
      ExpiresAt DATETIME2(0) NOT NULL, CreatedAt DATETIME2(0) NOT NULL DEFAULT (SYSUTCDATETIME()),
      LastSeenAt DATETIME2(0) NOT NULL DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT FK_UserSessions_Users FOREIGN KEY (UserId) REFERENCES dbo.UserOrganizations(UserId)
    );
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_UserSessions_ExpiresAt' AND object_id = OBJECT_ID(N'dbo.UserSessions'))
      CREATE INDEX IX_UserSessions_ExpiresAt ON dbo.UserSessions (ExpiresAt);
    DELETE FROM dbo.UserSessions WHERE ExpiresAt < SYSUTCDATETIME();
    INSERT INTO dbo.Permissions (ModuleName, PermissionName, Description)
    SELECT v.ModuleName, v.PermissionName, v.Description
    FROM (VALUES
      (N'Empresas',    N'Ver empresas',           N'Consultar el listado de empresas'),
      (N'Empresas',    N'Crear empresas',          N'Crear nuevas empresas'),
      (N'Empresas',    N'Editar empresas',         N'Editar información de empresas'),
      (N'Usuarios',    N'Ver usuarios',            N'Consultar el listado de usuarios'),
      (N'Usuarios',    N'Crear usuarios',          N'Crear nuevos usuarios'),
      (N'Usuarios',    N'Editar usuarios',         N'Editar datos de usuarios'),
      (N'Usuarios',    N'Desactivar usuarios',     N'Activar o desactivar usuarios'),
      (N'Sucursales',  N'Ver sucursales',          N'Consultar el listado de sucursales'),
      (N'Sucursales',  N'Crear sucursales',        N'Crear nuevas sucursales'),
      (N'Sucursales',  N'Editar sucursales',       N'Editar y desactivar sucursales'),
      (N'Auditoría',   N'Ver auditoría',           N'Consultar los registros de auditoría'),
      (N'Inventario',  N'Ver inventario',          N'Consultar el módulo de inventario'),
      (N'Productos',   N'Ver productos',           N'Consultar el catálogo de productos'),
      (N'Productos',   N'Crear productos',         N'Crear productos'),
      (N'Productos',   N'Editar productos',        N'Editar productos'),
      (N'Existencias', N'Ver existencias',         N'Consultar existencias por sucursal'),
      (N'Movimientos', N'Ver movimientos',         N'Consultar movimientos de inventario'),
      (N'Movimientos', N'Registrar movimientos',   N'Registrar entradas y salidas'),
      (N'Alertas',     N'Ver alertas',             N'Consultar alertas de inventario'),
      (N'Finanzas',    N'Ver finanzas',            N'Consultar el resumen financiero'),
      (N'Finanzas',    N'Registrar transacciones', N'Registrar ingresos y gastos'),
      (N'Roles',       N'Ver roles',               N'Consultar roles y permisos'),
      (N'Roles',       N'Administrar roles',       N'Crear roles y asignar permisos')
    ) AS v(ModuleName, PermissionName, Description)
    WHERE NOT EXISTS (
      SELECT 1 FROM dbo.Permissions AS p
      WHERE p.ModuleName = v.ModuleName AND p.PermissionName = v.PermissionName
    );
    INSERT INTO dbo.RolePermissions (RoleId, PermissionId)
    SELECT r.Id, p.Id
    FROM dbo.Roles AS r CROSS JOIN dbo.Permissions AS p
    WHERE r.Name = N'Company Admin'
      AND NOT EXISTS (SELECT 1 FROM dbo.RolePermissions AS rp WHERE rp.RoleId = r.Id AND rp.PermissionId = p.Id);
  `);
}
