import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import sql from 'mssql/msnodesqlv8.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// M-05: rate limiting para protección contra fuerza bruta
import { rateLimit } from 'express-rate-limit';
import { registerHrModule } from './server/modules/hr/index.js';
import { runMigrations } from './server/modules/hr/migrate.js';

// M-09: Logger estructurado JSON
const originalLog = console.log;
const originalError = console.error;
console.log = (...args) => originalLog(JSON.stringify({ level: 'INFO', timestamp: new Date().toISOString(), message: args.join(' ') }));
console.error = (...args) => originalError(JSON.stringify({ level: 'ERROR', timestamp: new Date().toISOString(), message: args.join(' ') }));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);
const sessionTtlMs = 8 * 60 * 60 * 1000;

const dbConfig = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_DATABASE || 'KinetixCore',
  ...(process.env.DB_AUTH === 'windows' ? {
    driver: 'msnodesqlv8',
    connectionString: `Driver={ODBC Driver 18 for SQL Server};Server=${process.env.DB_SERVER || '(localdb)\\MSSQLLocalDB'};Database=${process.env.DB_DATABASE || 'KinetixCore'};Trusted_Connection=Yes;Encrypt=No;TrustServerCertificate=Yes;`,
    options: {
      trustedConnection: true,
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false'
    }
  } : {
    port: Number(process.env.DB_PORT || 1433),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false'
    }
  }),
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let poolPromise;
function getPool() {
  if (process.env.DB_AUTH !== 'windows' && (!dbConfig.user || !dbConfig.password)) {
    throw new Error('Faltan DB_USER o DB_PASSWORD en el archivo .env');
  }
  if (!poolPromise) {
    poolPromise = sql.connect(dbConfig).catch(error => {
      poolPromise = undefined;
      throw error;
    });
  }
  return poolPromise;
}

async function ensureOperationsSchema() {
  const pool = await getPool();
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

app.use(express.json({ limit: '256kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (_request, response) => response.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/index.html', (_request, response) => response.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/app.js', (_request, response) => response.sendFile(path.join(__dirname, 'public', 'js', 'app.js')));
app.get('/styles.css', (_request, response) => response.sendFile(path.join(__dirname, 'public', 'styles.css')));
app.use((_request, response, next) => {
  // M-06: Content-Security-Policy
  response.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self';");
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'same-origin');
  // S-04: HSTS solo en producción
  if (process.env.NODE_ENV === 'production') {
    response.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  }
  next();
});

function parseCookies(request) {
  return Object.fromEntries((request.headers.cookie || '').split(';').filter(Boolean).map(cookie => {
    const separator = cookie.indexOf('=');
    return [cookie.slice(0, separator).trim(), decodeURIComponent(cookie.slice(separator + 1).trim())];
  }));
}

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function createPersistentSession(userId, token) {
  await (await getPool()).request()
    .input('tokenHash', sql.Char(64), hashSessionToken(token)).input('userId', sql.NVarChar(450), userId)
    .input('expiresAt', sql.DateTime2, new Date(Date.now() + sessionTtlMs))
    .query('INSERT INTO dbo.UserSessions (TokenHash, UserId, ExpiresAt) VALUES (@tokenHash, @userId, @expiresAt);');
}

async function findPersistentSession(token) {
  if (!token) return null;
  const result = await (await getPool()).request().input('tokenHash', sql.Char(64), hashSessionToken(token)).query(`
    SELECT TOP 1 UserId AS userId, ExpiresAt AS expiresAt FROM dbo.UserSessions WHERE TokenHash = @tokenHash;
  `);
  const session = result.recordset[0];
  if (session && new Date(session.expiresAt).getTime() < Date.now()) {
    await deletePersistentSession(token);
    return null;
  }
  if (session) {
    await (await getPool()).request().input('tokenHash', sql.Char(64), hashSessionToken(token)).query('UPDATE dbo.UserSessions SET LastSeenAt = SYSUTCDATETIME() WHERE TokenHash = @tokenHash;');
  }
  return session;
}

async function deletePersistentSession(token) {
  if (!token) return;
  await (await getPool()).request().input('tokenHash', sql.Char(64), hashSessionToken(token)).query('DELETE FROM dbo.UserSessions WHERE TokenHash = @tokenHash;');
}

async function findUserById(userId) {
  const pool = await getPool();
  const result = await pool.request()
    .input('userId', sql.NVarChar(450), userId)
    .query(`
      SELECT TOP 1 u.UserId AS userId, u.Email AS email, u.PasswordHash AS passwordHash, u.IsActive AS isActive,
             COALESCE(r.Name, N'Employee') AS role, u.CompanyId AS companyId,
             u.BranchId AS branchId
      FROM dbo.UserOrganizations AS u
      OUTER APPLY (
        SELECT TOP 1 r.Name FROM dbo.UserRoles AS ur
        INNER JOIN dbo.Roles AS r ON r.Id = ur.RoleId
        WHERE ur.UserId = u.UserId ORDER BY r.Name
      ) AS r
      WHERE u.UserId = @userId;
    `);
  return result.recordset[0];
}

function verifyPassword(password, encodedHash) {
  const [algorithm, digest, iterations, saltValue, hashValue] = String(encodedHash || '').split('$');
  if (algorithm !== 'pbkdf2' || digest !== 'sha512' || !iterations || !saltValue || !hashValue) return false;
  const salt = Buffer.from(saltValue, 'base64');
  const expected = Buffer.from(hashValue, 'base64');
  const actual = crypto.pbkdf2Sync(password, salt, Number(iterations), expected.length, digest);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha512');
  return ['pbkdf2', 'sha512', '310000', salt.toString('base64'), hash.toString('base64')].join('$');
}

async function requireAuth(request, response, next) {
  try {
    const token = parseCookies(request).kinetix_session;
    const session = await findPersistentSession(token);
    if (!session) {
      return response.status(401).json({ message: 'La sesión no es válida o ha expirado.' });
    }
    const user = await findUserById(session.userId);
    if (!user?.isActive) return response.status(403).json({ message: 'El usuario está inactivo.' });
    // Solo exponer campos necesarios — no incluir passwordHash (S-09)
    request.user = {
      userId: user.userId,
      email: user.email,
      isActive: user.isActive,
      role: user.role,
      companyId: user.companyId,
      branchId: user.branchId
    };
    next();
  } catch (error) {
    console.error('Authentication failed:', error.message);
    response.status(503).json({ message: 'No fue posible validar la sesión.' });
  }
}


function isGlobalAdmin(request) {
  return request.user?.role === 'Super Admin';
}

function requireGlobalAdmin(request, response, next) {
  if (!isGlobalAdmin(request)) return response.status(403).json({ message: 'Solo un Super Admin puede administrar organizaciones.' });
  next();
}

function requireRoleAdministration(request, response, next) {
  if (!['Super Admin', 'Company Admin'].includes(request.user?.role)) {
    return response.status(403).json({ message: 'No tienes acceso a roles y permisos.' });
  }
  next();
}

function requirePermission(moduleName, permissionName) {
  return async (request, response, next) => {
    if (isGlobalAdmin(request)) return next();
    try {
      const result = await (await getPool()).request()
        .input('userId', sql.NVarChar(450), request.user.userId)
        .input('moduleName', sql.NVarChar(80), moduleName)
        .input('permissionName', sql.NVarChar(120), permissionName)
        .query(`
          SELECT TOP 1 1 AS allowed
          FROM dbo.UserRoles AS ur
          INNER JOIN dbo.RolePermissions AS rp ON rp.RoleId = ur.RoleId
          INNER JOIN dbo.Permissions AS p ON p.Id = rp.PermissionId
          WHERE ur.UserId = @userId AND p.ModuleName = @moduleName AND p.PermissionName = @permissionName;
        `);
      if (!result.recordset[0]) return response.status(403).json({ message: 'No tienes permiso para realizar esta operación.' });
      next();
    } catch (error) {
      console.error('Permission check failed:', error.message);
      response.status(503).json({ message: 'No fue posible validar los permisos.' });
    }
  };
}

async function writeAudit(request, action, moduleName, entityName, entityId, companyId = request.user?.companyId, options = {}) {
  const pool = await getPool();
  await pool.request()
    .input('userId', sql.NVarChar(450), request.user?.userId || null)
    .input('companyId', sql.Int, companyId || null)
    .input('branchId', sql.Int, options.branchId || null)
    .input('action', sql.NVarChar(40), action)
    .input('module', sql.NVarChar(80), moduleName)
    .input('entity', sql.NVarChar(80), entityName || null)
    .input('entityId', sql.NVarChar(100), entityId == null ? null : String(entityId))
    .input('oldValues', sql.NVarChar(sql.MAX), options.oldValues ? (typeof options.oldValues === 'string' ? options.oldValues : JSON.stringify(options.oldValues)) : null)
    .input('newValues', sql.NVarChar(sql.MAX), options.newValues ? (typeof options.newValues === 'string' ? options.newValues : JSON.stringify(options.newValues)) : null)
    .input('context', sql.NVarChar(1000), options.context || null)
    .input('ip', sql.VarChar(45), request.ip)
    .input('userAgent', sql.NVarChar(500), request.get('user-agent') || null)
    .query(`
      INSERT INTO dbo.AuditLogs (UserId, CompanyId, BranchId, ActionName, ModuleName, EntityName, EntityId, OldValues, NewValues, Context, IpAddress, UserAgent)
      VALUES (@userId, @companyId, @branchId, @action, @module, @entity, @entityId, @oldValues, @newValues, @context, @ip, @userAgent);
    `);
}

app.use('/api', (request, response, next) => {
  if (request.path === '/health' || request.path.startsWith('/auth/')) return next();
  return requireAuth(request, response, next);
});

// M-05: Rate limiting — Permisivo en desarrollo para pruebas fluidas de usuarios
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 20 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiados intentos de acceso. Inténtalo de nuevo en 15 minutos.' }
});

app.post('/api/auth/login', loginLimiter, async (request, response) => {
  const { email, password } = request.body;
  if (!email?.trim() || !password) return response.status(400).json({ message: 'Email y contraseña son obligatorios.' });
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('email', sql.NVarChar(254), email.trim())
      .query('SELECT TOP 1 UserId, PasswordHash, IsActive FROM dbo.UserOrganizations WHERE Email = @email;');
    const account = result.recordset[0];
    if (!account?.IsActive || !verifyPassword(password, account.PasswordHash)) {
      // M-04: Auditar login fallido
      try {
        const failedRequest = pool.request()
          .input('userId', sql.NVarChar(450), account?.UserId || null)
          .input('action', sql.NVarChar(40), 'LOGIN_FAILED')
          .input('module', sql.NVarChar(80), 'Acceso')
          .input('entity', sql.NVarChar(80), 'User')
          .input('entityId', sql.NVarChar(100), email.trim())
          .input('ip', sql.VarChar(45), request.ip)
          .input('userAgent', sql.NVarChar(500), request.get('user-agent') || null);
        await failedRequest.query(`INSERT INTO dbo.AuditLogs (UserId, ActionName, ModuleName, EntityName, EntityId, IpAddress, UserAgent)
                VALUES (@userId, @action, @module, @entity, @entityId, @ip, @userAgent);`);
      } catch (_auditError) { /* no bloquear el flujo por error de auditoría */ }
      return response.status(401).json({ message: 'Email o contraseña incorrectos.' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    await createPersistentSession(account.UserId, token);
    await pool.request().input('userId', sql.NVarChar(450), account.UserId)
      .query('UPDATE dbo.UserOrganizations SET LastLoginAt = SYSUTCDATETIME() WHERE UserId = @userId;');
    await pool.request().input('userId', sql.NVarChar(450), account.UserId)
      .input('action', sql.NVarChar(40), 'LOGIN').input('module', sql.NVarChar(80), 'Acceso')
      .input('ip', sql.VarChar(45), request.ip).input('userAgent', sql.NVarChar(500), request.get('user-agent') || null)
      .query(`INSERT INTO dbo.AuditLogs (UserId, ActionName, ModuleName, IpAddress, UserAgent)
              VALUES (@userId, @action, @module, @ip, @userAgent);`);
    const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    response.setHeader('Set-Cookie', `kinetix_session=${encodeURIComponent(token)}; Max-Age=${sessionTtlMs / 1000}; Path=/; HttpOnly; SameSite=Lax${secureFlag}`);
    response.json({ authenticated: true });
  } catch (error) {
    console.error('Login failed:', error.message);
    response.status(500).json({ message: 'No fue posible iniciar sesión.' });
  }
});

app.post('/api/auth/change-password', async (request, response) => {
  const { currentPassword, newPassword } = request.body;
  if (!currentPassword || !newPassword || newPassword.length < 10) {
    return response.status(400).json({ message: 'La nueva contraseña debe tener al menos 10 caracteres.' });
  }
  try {
    const user = await findUserById(request.user.userId);
    if (!verifyPassword(currentPassword, user?.passwordHash || request.user.passwordHash)) {
      return response.status(401).json({ message: 'La contraseña actual es incorrecta.' });
    }
    const pool = await getPool();
    await pool.request().input('userId', sql.NVarChar(450), request.user.userId)
      .input('passwordHash', sql.NVarChar(500), createPasswordHash(newPassword))
      .query('UPDATE dbo.UserOrganizations SET PasswordHash = @passwordHash, UpdatedAt = SYSUTCDATETIME() WHERE UserId = @userId;');
    await writeAudit(request, 'PASSWORD_CHANGE', 'Acceso', 'User', request.user.userId);
    response.status(204).end();
  } catch (error) {
    console.error('Password change failed:', error.message);
    response.status(500).json({ message: 'No fue posible cambiar la contraseña.' });
  }
});

app.post('/api/auth/logout', async (request, response) => {
  await deletePersistentSession(parseCookies(request).kinetix_session);
  response.clearCookie('kinetix_session');
  response.status(204).end();
});

// M-03: Recuperación de contraseña
app.post('/api/auth/forgot-password', async (request, response) => {
  const { email } = request.body;
  if (!email) return response.status(400).json({ message: 'Email es obligatorio.' });
  const pool = await getPool();
  const result = await pool.request().input('email', sql.NVarChar(254), email.trim()).query('SELECT UserId, FirstName FROM dbo.UserOrganizations WHERE Email = @email AND IsActive = 1;');
  const user = result.recordset[0];
  if (user) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
    await pool.request().input('userId', sql.NVarChar(450), user.UserId).input('token', sql.Char(64), tokenHash).input('expires', sql.DateTime2, expires)
      .query('UPDATE dbo.UserOrganizations SET ResetToken = @token, ResetTokenExpiresAt = @expires WHERE UserId = @userId;');
    // Simular envío de correo escribiendo en el logger
    console.log(`[EMAIL] To: ${email} | Subject: Recuperación de contraseña | Link: /reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`);
  }
  // Respondemos 200 siempre para no enumerar usuarios
  response.json({ message: 'Si el correo existe, recibirás un enlace de recuperación.' });
});

app.post('/api/auth/reset-password', async (request, response) => {
  const { email, token, newPassword } = request.body;
  if (!email || !token || !newPassword || newPassword.length < 10) return response.status(400).json({ message: 'Datos incompletos o contraseña muy corta.' });
  const pool = await getPool();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const result = await pool.request().input('email', sql.NVarChar(254), email).input('token', sql.Char(64), tokenHash)
    .query('SELECT UserId, ResetTokenExpiresAt FROM dbo.UserOrganizations WHERE Email = @email AND ResetToken = @token AND IsActive = 1;');
  const user = result.recordset[0];
  if (!user || new Date(user.ResetTokenExpiresAt) < new Date()) {
    return response.status(400).json({ message: 'Token inválido o expirado.' });
  }
  const passwordHash = await crypto.promises.pbkdf2(newPassword, crypto.randomBytes(16), 100000, 64, 'sha512').then(h => h.toString('hex'));
  await pool.request().input('userId', sql.NVarChar(450), user.UserId).input('hash', sql.VarChar(255), passwordHash)
    .query('UPDATE dbo.UserOrganizations SET PasswordHash = @hash, ResetToken = NULL, ResetTokenExpiresAt = NULL WHERE UserId = @userId;');
  response.json({ message: 'Contraseña actualizada correctamente.' });
});

app.get('/api/health', async (_request, response) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT DB_NAME() AS databaseName, SYSUTCDATETIME() AS serverTime');
    response.json({ connected: true, ...result.recordset[0] });
  } catch (error) {
    console.error('Database health check failed:', error.message);
    response.status(503).json({ connected: false, message: 'No fue posible conectar con la base de datos.' });
  }
});

app.get('/api/companies', requirePermission('Empresas', 'Ver empresas'), async (request, response) => {
  try {
    const page = Math.max(Number(request.query.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(request.query.pageSize) || 20, 1), 100);
    const search = String(request.query.search || '');
    const pool = await getPool();
    const result = await pool.request()
      .input('search', sql.NVarChar(150), `%${search}%`)
      .input('offset', sql.Int, (page - 1) * pageSize)
      .input('pageSize', sql.Int, pageSize)
      .input('companyId', sql.Int, request.user.companyId || null)
      .input('isGlobal', sql.Bit, isGlobalAdmin(request))
      .query(`
        SELECT Id, Name, Rnc, IsActive, CreatedAt,
               UserCount, BranchCount, ActiveUserCount, InactiveUserCount
        FROM dbo.vw_CompaniesList
        WHERE (@isGlobal = 1 OR Id = @companyId)
          AND (Name LIKE @search OR Rnc LIKE @search)
        ORDER BY Name
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;

        SELECT COUNT_BIG(*) AS total
        FROM dbo.Companies
        WHERE (@isGlobal = 1 OR Id = @companyId)
          AND (Name LIKE @search OR Rnc LIKE @search);
      `);
    response.json({
      data: result.recordsets[0],
      total: Number(result.recordsets[1][0].total),
      page,
      pageSize
    });
  } catch (error) {
    console.error('Companies query failed:', error.message);
    response.status(500).json({ message: 'No fue posible cargar las empresas.' });
  }
});

// B-15/S-05: Validar RNC dominicano (9 u 11 dígitos, solo numericos — DGII / Ley 253-12)
function validateRnc(rnc) {
  if (!rnc) return false;
  const digits = rnc.replace(/[^0-9]/g, '');
  return digits.length === 9 || digits.length === 11;
}

app.post('/api/companies', requireGlobalAdmin, async (request, response) => {
  const { name, rnc, email, phone, address, status } = request.body;
  if (!name?.trim() || !rnc?.trim() || !email?.trim()) {
    return response.status(400).json({ message: 'Nombre, RNC y email son obligatorios.' });
  }
  if (!validateRnc(rnc)) {
    return response.status(400).json({ message: 'El RNC debe tener 9 u 11 dígitos numéricos (formato DGII).' });
  }
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('name', sql.NVarChar(150), name.trim())
      .input('rnc', sql.VarChar(20), rnc.replace(/[^0-9]/g, ''))
      .input('email', sql.NVarChar(254), email.trim())
      .input('phone', sql.NVarChar(30), phone?.trim() || null)
      .input('address', sql.NVarChar(300), address?.trim() || null)
      .input('isActive', sql.Bit, status !== 'Inactiva')
      .query(`
        INSERT INTO dbo.Companies (Name, Rnc, ContactEmail, Phone, Address, IsActive)
        OUTPUT INSERTED.Id AS id, INSERTED.Name AS name, INSERTED.Rnc AS rnc,
               INSERTED.IsActive AS isActive, INSERTED.CreatedAt AS createdAt
        VALUES (@name, @rnc, @email, @phone, @address, @isActive);
      `);
    await writeAudit(request, 'CREATE', 'Empresas', 'Company', result.recordset[0].id);
    response.status(201).json(result.recordset[0]);
  } catch (error) {
    console.error('Company creation failed:', error.message);
    response.status(error.number === 2627 ? 409 : 500).json({ message: error.number === 2627 ? 'El RNC ya está registrado.' : 'No fue posible guardar la empresa.' });
  }
});

app.post('/api/inventory/products', requirePermission('Productos', 'Crear productos'), async (request, response) => {
  const { sku, name, category, unit = 'und.', minimum = 0, price = 0, companyId } = request.body;
  const targetCompanyId = isGlobalAdmin(request) ? Number(companyId || request.user.companyId) : request.user.companyId;
  if (!Number.isInteger(Number(targetCompanyId)) || !sku?.trim() || !name?.trim() || Number(minimum) < 0 || Number(price) < 0) {
    return response.status(400).json({ message: 'Empresa, SKU, nombre y valores válidos son obligatorios.' });
  }
  try {
    const result = await (await getPool()).request()
      .input('companyId', sql.Int, targetCompanyId).input('sku', sql.NVarChar(50), sku.trim())
      .input('name', sql.NVarChar(180), name.trim()).input('category', sql.NVarChar(100), category?.trim() || null)
      .input('unit', sql.NVarChar(30), unit.trim()).input('minimum', sql.Decimal(18, 3), Number(minimum))
      .input('price', sql.Decimal(18, 4), Number(price))
      .query(`INSERT INTO dbo.Products (CompanyId, Sku, Name, Category, UnitName, MinimumStock, UnitCost)
              OUTPUT INSERTED.Id AS id, INSERTED.Sku AS sku, INSERTED.Name AS name
              VALUES (@companyId, @sku, @name, @category, @unit, @minimum, @price);`);
    await writeAudit(request, 'CREATE', 'Productos', 'Product', result.recordset[0].id, targetCompanyId);
    response.status(201).json(result.recordset[0]);
  } catch (error) {
    console.error('Product creation failed:', error.message);
    response.status(error.number === 2627 ? 409 : 500).json({ message: error.number === 2627 ? 'Ese SKU ya existe en la empresa.' : 'No fue posible crear el producto.' });
  }
});

app.put('/api/inventory/products/:id', requirePermission('Productos', 'Editar productos'), async (request, response) => {
  const { sku, name, category, unit = 'und.', minimum = 0, price = 0 } = request.body;
  if (!sku?.trim() || !name?.trim() || Number(minimum) < 0 || Number(price) < 0) {
    return response.status(400).json({ message: 'SKU, nombre y valores válidos son obligatorios.' });
  }
  try {
    const result = await (await getPool()).request()
      .input('id', sql.Int, Number(request.params.id)).input('companyId', sql.Int, request.user.companyId || null)
      .input('isGlobal', sql.Bit, isGlobalAdmin(request)).input('sku', sql.NVarChar(50), sku.trim())
      .input('name', sql.NVarChar(180), name.trim()).input('category', sql.NVarChar(100), category?.trim() || null)
      .input('unit', sql.NVarChar(30), unit.trim()).input('minimum', sql.Decimal(18, 3), Number(minimum))
      .input('price', sql.Decimal(18, 4), Number(price))
      .query(`UPDATE dbo.Products SET Sku = @sku, Name = @name, Category = @category, UnitName = @unit,
              MinimumStock = @minimum, UnitCost = @price, UpdatedAt = SYSUTCDATETIME()
              OUTPUT INSERTED.Id AS id, INSERTED.Sku AS sku, INSERTED.Name AS name
              WHERE Id = @id AND (@isGlobal = 1 OR CompanyId = @companyId);`);
    if (!result.recordset[0]) return response.status(404).json({ message: 'Producto no encontrado.' });
    await writeAudit(request, 'UPDATE', 'Productos', 'Product', request.params.id);
    response.json(result.recordset[0]);
  } catch (error) {
    console.error('Product update failed:', error.message);
    response.status(error.number === 2627 ? 409 : 500).json({ message: error.number === 2627 ? 'Ese SKU ya existe en la empresa.' : 'No fue posible actualizar el producto.' });
  }
});

app.patch('/api/inventory/products/:id/status', requirePermission('Productos', 'Editar productos'), async (request, response) => {
  if (typeof request.body?.isActive !== 'boolean') return response.status(400).json({ message: 'isActive debe ser booleano.' });
  try {
    const result = await (await getPool()).request()
      .input('id', sql.Int, Number(request.params.id)).input('isActive', sql.Bit, request.body.isActive)
      .input('companyId', sql.Int, request.user.companyId || null).input('isGlobal', sql.Bit, isGlobalAdmin(request))
      .query(`UPDATE dbo.Products SET IsActive = @isActive, UpdatedAt = SYSUTCDATETIME()
              OUTPUT INSERTED.Id AS id, INSERTED.IsActive AS isActive
              WHERE Id = @id AND (@isGlobal = 1 OR CompanyId = @companyId);`);
    if (!result.recordset[0]) return response.status(404).json({ message: 'Producto no encontrado.' });
    await writeAudit(request, request.body.isActive ? 'ACTIVATE' : 'DEACTIVATE', 'Productos', 'Product', request.params.id);
    response.json(result.recordset[0]);
  } catch (error) {
    console.error('Product status update failed:', error.message);
    response.status(500).json({ message: 'No fue posible actualizar el producto.' });
  }
});

app.get('/api/inventory/products', requirePermission('Productos', 'Ver productos'), async (request, response) => {
  try {
    const result = await (await getPool()).request()
      .input('companyId', sql.Int, request.user.companyId)
      .input('isGlobal', sql.Bit, isGlobalAdmin(request))
      .query(`
         SELECT p.Id AS id, p.Sku AS sku, p.Name AS name, p.Category AS category, p.UnitName AS unit,
           p.MinimumStock AS minimum, p.UnitCost AS price, p.IsActive AS isActive, COALESCE(SUM(s.Quantity), 0) AS stock
        FROM dbo.Products AS p
        LEFT JOIN dbo.InventoryStock AS s ON s.ProductId = p.Id
        WHERE p.IsActive = 1 AND (@isGlobal = 1 OR p.CompanyId = @companyId)
        GROUP BY p.Id, p.Sku, p.Name, p.Category, p.UnitName, p.MinimumStock, p.UnitCost, p.IsActive
        ORDER BY p.Name;
      `);
    response.json(result.recordset);
  } catch (error) {
    console.error('Products query failed:', error.message);
    response.status(500).json({ message: 'No fue posible cargar los productos.' });
  }
});

app.get('/api/inventory/stock', requirePermission('Existencias', 'Ver existencias'), async (request, response) => {
  try {
    const result = await (await getPool()).request()
      .input('companyId', sql.Int, request.user.companyId)
      .input('isGlobal', sql.Bit, isGlobalAdmin(request))
      .query(`
        SELECT s.Id AS id, s.ProductId AS productId, p.Sku AS sku, p.Name AS product,
               p.UnitName AS unit, p.MinimumStock AS minimum, s.Quantity AS quantity,
               b.Id AS branchId, b.Name AS branch
        FROM dbo.InventoryStock AS s
        INNER JOIN dbo.Products AS p ON p.Id = s.ProductId
        INNER JOIN dbo.Branches AS b ON b.Id = s.BranchId
        WHERE (@isGlobal = 1 OR s.CompanyId = @companyId)
        ORDER BY p.Name, b.Name;
      `);
    response.json(result.recordset);
  } catch (error) {
    console.error('Stock query failed:', error.message);
    response.status(500).json({ message: 'No fue posible cargar las existencias.' });
  }
});

app.get('/api/inventory/movements', requirePermission('Movimientos', 'Ver movimientos'), async (request, response) => {
  try {
    const result = await (await getPool()).request()
      .input('companyId', sql.Int, request.user.companyId)
      .input('isGlobal', sql.Bit, isGlobalAdmin(request))
      .query(`
        SELECT TOP 100 m.Id AS id, m.CreatedAt AS createdAt, m.MovementType AS type,
               p.Sku AS sku, p.Name AS product, m.Quantity AS quantity, b.Name AS branch,
               COALESCE(CONCAT(u.FirstName, N' ', u.LastName), N'Sistema') AS userName
        FROM dbo.InventoryMovements AS m
        INNER JOIN dbo.Products AS p ON p.Id = m.ProductId
        INNER JOIN dbo.Branches AS b ON b.Id = m.BranchId
        LEFT JOIN dbo.UserOrganizations AS u ON u.UserId = m.CreatedBy
        WHERE (@isGlobal = 1 OR m.CompanyId = @companyId)
        ORDER BY m.CreatedAt DESC;
      `);
    response.json(result.recordset);
  } catch (error) {
    console.error('Movements query failed:', error.message);
    response.status(500).json({ message: 'No fue posible cargar los movimientos.' });
  }
});

app.post('/api/inventory/movements', requirePermission('Movimientos', 'Registrar movimientos'), async (request, response) => {
  const { productId, branchId, type, quantity, notes } = request.body;
  if (!Number.isInteger(Number(productId)) || !Number.isInteger(Number(branchId)) || !Number(quantity) || !['Entrada', 'Salida'].includes(type)) {
    return response.status(400).json({ message: 'Producto, sucursal, tipo y cantidad válida son obligatorios.' });
  }
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const requestScope = new sql.Request(transaction)
      .input('productId', sql.Int, Number(productId)).input('branchId', sql.Int, Number(branchId))
      .input('companyId', sql.Int, request.user.companyId || null).input('isGlobal', sql.Bit, isGlobalAdmin(request));
    const productResult = await requestScope.query(`
      SELECT p.Id, p.CompanyId, p.UnitCost FROM dbo.Products AS p
      INNER JOIN dbo.Branches AS b ON b.Id = @branchId AND b.CompanyId = p.CompanyId
      WHERE p.Id = @productId AND p.IsActive = 1 AND (@isGlobal = 1 OR p.CompanyId = @companyId);
    `);
    const product = productResult.recordset[0];
    if (!product) throw Object.assign(new Error('Producto o sucursal fuera de tu organización.'), { status: 403 });
    const stockRequest = new sql.Request(transaction).input('productId', sql.Int, Number(productId)).input('branchId', sql.Int, Number(branchId));
    const stockResult = await stockRequest.query('SELECT Quantity FROM dbo.InventoryStock WITH (UPDLOCK) WHERE ProductId = @productId AND BranchId = @branchId;');
    const currentStock = Number(stockResult.recordset[0]?.Quantity || 0);
    const amount = Number(quantity);
    if (type === 'Salida' && currentStock < amount) throw Object.assign(new Error('La existencia disponible no alcanza para esta salida.'), { status: 409 });
    const nextStock = currentStock + (type === 'Entrada' ? amount : -amount);
    const updateStock = new sql.Request(transaction).input('companyId', sql.Int, product.CompanyId)
      .input('productId', sql.Int, Number(productId)).input('branchId', sql.Int, Number(branchId)).input('quantity', sql.Decimal(18, 3), nextStock);
    await updateStock.query(`
      IF EXISTS (SELECT 1 FROM dbo.InventoryStock WHERE ProductId = @productId AND BranchId = @branchId)
        UPDATE dbo.InventoryStock SET Quantity = @quantity, UpdatedAt = SYSUTCDATETIME() WHERE ProductId = @productId AND BranchId = @branchId;
      ELSE
        INSERT INTO dbo.InventoryStock (CompanyId, ProductId, BranchId, Quantity) VALUES (@companyId, @productId, @branchId, @quantity);
    `);
    const movement = await new sql.Request(transaction).input('companyId', sql.Int, product.CompanyId)
      .input('productId', sql.Int, Number(productId)).input('branchId', sql.Int, Number(branchId))
      .input('type', sql.NVarChar(10), type).input('quantity', sql.Decimal(18, 3), amount)
      .input('unitCost', sql.Decimal(18, 4), product.UnitCost).input('notes', sql.NVarChar(300), notes?.trim() || null)
      .input('createdBy', sql.NVarChar(450), request.user.userId)
      .query(`INSERT INTO dbo.InventoryMovements (CompanyId, ProductId, BranchId, MovementType, Quantity, UnitCost, Notes, CreatedBy)
              OUTPUT INSERTED.Id AS id, INSERTED.CreatedAt AS createdAt
              VALUES (@companyId, @productId, @branchId, @type, @quantity, @unitCost, @notes, @createdBy);`);
    await transaction.commit();
    response.status(201).json(movement.recordset[0]);
  } catch (error) {
    await transaction.rollback().catch(() => {});
    console.error('Movement creation failed:', error.message);
    response.status(error.status || 500).json({ message: error.status ? error.message : 'No fue posible registrar el movimiento.' });
  }
});

app.get('/api/finance/summary', requirePermission('Finanzas', 'Ver finanzas'), async (request, response) => {
  try {
    const result = await (await getPool()).request()
      .input('companyId', sql.Int, request.user.companyId).input('isGlobal', sql.Bit, isGlobalAdmin(request))
      .query(`
        SELECT TransactionType AS type, COALESCE(SUM(Amount), 0) AS total
        FROM dbo.FinanceTransactions
        WHERE TransactionDate >= DATEFROMPARTS(YEAR(GETUTCDATE()), MONTH(GETUTCDATE()), 1)
          AND (@isGlobal = 1 OR CompanyId = @companyId)
        GROUP BY TransactionType;
      `);
    response.json({ transactions: result.recordset });
  } catch (error) {
    console.error('Finance summary failed:', error.message);
    response.status(500).json({ message: 'No fue posible cargar el resumen financiero.' });
  }
});

app.post('/api/finance/transactions', requirePermission('Finanzas', 'Registrar transacciones'), async (request, response) => {
  const { type = 'Gasto', category, description, amount, taxRate = 0, dueDate, companyId } = request.body;
  const targetCompanyId = isGlobalAdmin(request) ? Number(companyId || request.user.companyId) : request.user.companyId;
  if (!Number.isInteger(Number(targetCompanyId)) || !category?.trim() || !Number(amount) || !['Ingreso', 'Gasto'].includes(type)) {
    return response.status(400).json({ message: 'Tipo, categoría y monto válido son obligatorios.' });
  }
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('companyId', sql.Int, targetCompanyId).input('type', sql.NVarChar(20), type)
            .input('category', sql.NVarChar(100), category.trim()).input('description', sql.NVarChar(300), description?.trim() || null)
            .input('amount', sql.Decimal(18, 2), Number(amount)).input('taxRate', sql.Decimal(9, 4), Number(taxRate))
            .input('taxAmount', sql.Decimal(18, 2), Number(amount) * Number(taxRate) / 100).input('dueDate', sql.Date, dueDate || null)
            .input('createdBy', sql.NVarChar(450), request.user.userId)
            .query(`INSERT INTO dbo.FinanceTransactions (CompanyId, TransactionType, Category, Description, Amount, TaxRate, TaxAmount, DueDate, Status, CreatedBy)
              OUTPUT INSERTED.Id AS id, INSERTED.Amount AS amount, INSERTED.TransactionType AS type
              VALUES (@companyId, @type, @category, @description, @amount, @taxRate, @taxAmount, @dueDate, N'Pendiente', @createdBy);`);
    await writeAudit(request, 'CREATE', 'Finance', 'FinanceTransaction', result.recordset[0].id, targetCompanyId);
    response.status(201).json(result.recordset[0]);
  } catch (error) {
    console.error('Finance transaction creation failed:', error.message);
    response.status(500).json({ message: 'No fue posible registrar la transacción.' });
  }
});

app.get('/api/finance/transactions', requirePermission('Finanzas', 'Ver finanzas'), async (request, response) => {
  try {
    const result = await (await getPool()).request().input('companyId', sql.Int, request.user.companyId).input('isGlobal', sql.Bit, isGlobalAdmin(request)).query(`
      SELECT TOP 100 t.Id AS id, t.TransactionType AS type, t.Category AS category, t.Description AS description,
             t.Amount AS amount, t.TaxAmount AS taxAmount, t.DueDate AS dueDate, t.Status AS status, t.CreatedAt AS createdAt
      FROM dbo.FinanceTransactions AS t WHERE (@isGlobal = 1 OR t.CompanyId = @companyId) ORDER BY t.CreatedAt DESC;
    `);
    response.json(result.recordset);
  } catch (error) {
    console.error('Finance transactions query failed:', error.message);
    response.status(500).json({ message: 'No fue posible cargar las transacciones.' });
  }
});

app.patch('/api/finance/transactions/:id/status', requirePermission('Finanzas', 'Registrar transacciones'), async (request, response) => {
  const { status } = request.body;
  if (!['Aprobada', 'Pagada', 'Rechazada', 'Revertida'].includes(status)) return response.status(400).json({ message: 'Estado financiero no válido.' });
  const result = await (await getPool()).request().input('id', sql.BigInt, Number(request.params.id))
    .input('status', sql.NVarChar(20), status).input('userId', sql.NVarChar(450), request.user.userId)
    .input('companyId', sql.Int, request.user.companyId).input('isGlobal', sql.Bit, isGlobalAdmin(request))
    .query(`UPDATE dbo.FinanceTransactions SET Status = @status, ApprovedBy = CASE WHEN @status = N'Aprobada' THEN @userId ELSE ApprovedBy END,
            ApprovedAt = CASE WHEN @status = N'Aprobada' THEN SYSUTCDATETIME() ELSE ApprovedAt END,
            ReversedAt = CASE WHEN @status = N'Revertida' THEN SYSUTCDATETIME() ELSE ReversedAt END
            OUTPUT INSERTED.Id AS id, INSERTED.Status AS status
            WHERE Id = @id AND (@isGlobal = 1 OR CompanyId = @companyId);`);
  if (!result.recordset[0]) return response.status(404).json({ message: 'Transacción no encontrada.' });
  await writeAudit(request, status === 'Revertida' ? 'UPDATE' : 'UPDATE', 'Finance', 'FinanceTransaction', request.params.id);
  response.json(result.recordset[0]);
});

app.get('/api/finance/contacts', requirePermission('Finanzas', 'Ver finanzas'), async (request, response) => {
  try {
    const result = await (await getPool()).request().input('companyId', sql.Int, request.user.companyId).input('isGlobal', sql.Bit, isGlobalAdmin(request)).query(`
      SELECT Id AS id, ContactType AS type, Name AS name, TaxId AS taxId, Email AS email, Phone AS phone, IsActive AS isActive
      FROM dbo.FinanceContacts WHERE IsActive = 1 AND (@isGlobal = 1 OR CompanyId = @companyId) ORDER BY Name;
    `);
    response.json(result.recordset);
  } catch (error) {
    console.error('Finance contacts query failed:', error.message);
    response.status(500).json({ message: 'No fue posible cargar los contactos.' });
  }
});

app.post('/api/finance/contacts', requirePermission('Finanzas', 'Registrar transacciones'), async (request, response) => {
  const { type, name, taxId, email, phone } = request.body;
  if (!['Cliente', 'Proveedor'].includes(type) || !name?.trim()) return response.status(400).json({ message: 'Tipo y nombre del contacto son obligatorios.' });
  const result = await (await getPool()).request().input('companyId', sql.Int, request.user.companyId).input('type', sql.NVarChar(20), type)
    .input('name', sql.NVarChar(180), name.trim()).input('taxId', sql.NVarChar(40), taxId?.trim() || null)
    .input('email', sql.NVarChar(254), email?.trim() || null).input('phone', sql.NVarChar(40), phone?.trim() || null)
    .query(`INSERT INTO dbo.FinanceContacts (CompanyId, ContactType, Name, TaxId, Email, Phone)
            OUTPUT INSERTED.Id AS id, INSERTED.ContactType AS type, INSERTED.Name AS name
            VALUES (@companyId, @type, @name, @taxId, @email, @phone);`);
  response.status(201).json(result.recordset[0]);
});

app.get('/api/finance/invoices', requirePermission('Finanzas', 'Ver finanzas'), async (request, response) => {
  try {
    const result = await (await getPool()).request().input('companyId', sql.Int, request.user.companyId).input('isGlobal', sql.Bit, isGlobalAdmin(request)).query(`
      SELECT TOP 100 i.Id AS id, i.InvoiceNumber AS number, i.Ncf AS ncf, i.InvoiceType AS type, i.IssueDate AS issueDate, i.DueDate AS dueDate,
             i.Subtotal AS subtotal, i.TaxAmount AS taxAmount, i.Total AS total, i.Status AS status, c.Name AS contact
      FROM dbo.FinanceInvoices AS i LEFT JOIN dbo.FinanceContacts AS c ON c.Id = i.ContactId
      WHERE (@isGlobal = 1 OR i.CompanyId = @companyId) ORDER BY i.CreatedAt DESC;
    `);
    response.json(result.recordset);
  } catch (error) {
    console.error('Finance invoices query failed:', error.message);
    response.status(500).json({ message: 'No fue posible cargar las facturas.' });
  }
});

app.post('/api/finance/invoices', requirePermission('Finanzas', 'Registrar transacciones'), async (request, response) => {
  const { number, ncf, type, contactId, subtotal, taxRate = 0, dueDate } = request.body;
  if (!number?.trim() || !['Venta', 'Compra'].includes(type) || Number(subtotal) <= 0) return response.status(400).json({ message: 'Número, tipo y subtotal válido son obligatorios.' });
  if (ncf && ncf.trim().length > 19) return response.status(400).json({ message: 'El NCF no puede exceder 19 caracteres.' });
  const taxAmount = Number(subtotal) * Number(taxRate) / 100;
  const result = await (await getPool()).request().input('companyId', sql.Int, request.user.companyId).input('number', sql.NVarChar(50), number.trim())
    .input('ncf', sql.NVarChar(19), ncf?.trim() || null)
    .input('type', sql.NVarChar(20), type).input('contactId', sql.Int, contactId ? Number(contactId) : null).input('subtotal', sql.Decimal(18, 2), Number(subtotal))
    .input('taxRate', sql.Decimal(9, 4), Number(taxRate)).input('taxAmount', sql.Decimal(18, 2), taxAmount).input('total', sql.Decimal(18, 2), Number(subtotal) + taxAmount)
    .input('dueDate', sql.Date, dueDate || null).input('createdBy', sql.NVarChar(450), request.user.userId)
    .query(`INSERT INTO dbo.FinanceInvoices (CompanyId, ContactId, InvoiceNumber, Ncf, InvoiceType, Subtotal, TaxRate, TaxAmount, Total, DueDate, CreatedBy)
            OUTPUT INSERTED.Id AS id, INSERTED.InvoiceNumber AS number, INSERTED.Ncf AS ncf, INSERTED.Total AS total
            VALUES (@companyId, @contactId, @number, @ncf, @type, @subtotal, @taxRate, @taxAmount, @total, @dueDate, @createdBy);`);
  response.status(201).json(result.recordset[0]);
});

app.post('/api/finance/payments', requirePermission('Finanzas', 'Registrar transacciones'), async (request, response) => {
  const { invoiceId, amount, method, reference } = request.body;
  if (!Number(amount) || !method?.trim()) return response.status(400).json({ message: 'Monto y método de pago son obligatorios.' });
  const result = await (await getPool()).request().input('companyId', sql.Int, request.user.companyId).input('invoiceId', sql.BigInt, invoiceId ? Number(invoiceId) : null)
    .input('amount', sql.Decimal(18, 2), Number(amount)).input('method', sql.NVarChar(40), method.trim()).input('reference', sql.NVarChar(100), reference?.trim() || null).input('createdBy', sql.NVarChar(450), request.user.userId)
    .query(`INSERT INTO dbo.FinancePayments (CompanyId, InvoiceId, Amount, Method, Reference, CreatedBy)
            OUTPUT INSERTED.Id AS id, INSERTED.Amount AS amount
            VALUES (@companyId, @invoiceId, @amount, @method, @reference, @createdBy);`);
  response.status(201).json(result.recordset[0]);
});

app.post('/api/finance/bank-transactions/:id/reconcile', requirePermission('Finanzas', 'Registrar transacciones'), async (request, response) => {
  const result = await (await getPool()).request().input('id', sql.BigInt, Number(request.params.id)).input('companyId', sql.Int, request.user.companyId).input('isGlobal', sql.Bit, isGlobalAdmin(request)).input('userId', sql.NVarChar(450), request.user.userId)
    .query(`UPDATE dbo.FinanceBankTransactions SET Status = N'Conciliada', ReconciledAt = SYSUTCDATETIME(), ReconciledBy = @userId
            OUTPUT INSERTED.Id AS id, INSERTED.Status AS status WHERE Id = @id AND (@isGlobal = 1 OR CompanyId = @companyId);`);
  if (!result.recordset[0]) return response.status(404).json({ message: 'Movimiento bancario no encontrado.' });
  response.json(result.recordset[0]);
});

app.get('/api/finance/bank-transactions', requirePermission('Finanzas', 'Ver finanzas'), async (request, response) => {
  try {
    const result = await (await getPool()).request().input('companyId', sql.Int, request.user.companyId).input('isGlobal', sql.Bit, isGlobalAdmin(request)).query(`
      SELECT TOP 100 Id AS id, TransactionDate AS transactionDate, Description AS description, Amount AS amount,
             Reference AS reference, Status AS status FROM dbo.FinanceBankTransactions
      WHERE (@isGlobal = 1 OR CompanyId = @companyId) ORDER BY TransactionDate DESC, Id DESC;
    `);
    response.json(result.recordset);
  } catch (error) {
    console.error('Finance bank transactions query failed:', error.message);
    response.status(500).json({ message: 'No fue posible cargar los movimientos bancarios.' });
  }
});

app.post('/api/finance/bank-transactions', requirePermission('Finanzas', 'Registrar transacciones'), async (request, response) => {
  const { transactionDate, description, amount, reference } = request.body;
  if (!description?.trim() || !Number(amount)) return response.status(400).json({ message: 'Descripción y monto válido son obligatorios.' });
  const result = await (await getPool()).request().input('companyId', sql.Int, request.user.companyId)
    .input('transactionDate', sql.Date, transactionDate || null).input('description', sql.NVarChar(300), description.trim())
    .input('amount', sql.Decimal(18, 2), Number(amount)).input('reference', sql.NVarChar(100), reference?.trim() || null)
    .query(`INSERT INTO dbo.FinanceBankTransactions (CompanyId, TransactionDate, Description, Amount, Reference)
            OUTPUT INSERTED.Id AS id, INSERTED.Status AS status
            VALUES (@companyId, COALESCE(@transactionDate, CONVERT(date, SYSUTCDATETIME())), @description, @amount, @reference);`);
  response.status(201).json(result.recordset[0]);
});

app.get('/api/users', requirePermission('Usuarios', 'Ver usuarios'), async (request, response) => {
  try {
    const pool = await getPool();
    // B-08: paginación real de usuarios
    const page = Math.max(Number(request.query.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(request.query.pageSize) || 20, 1), 100);
    const statusFilter = String(request.query.status || '').trim();
    const result = await pool.request()
      .input('companyId', sql.Int, request.user.companyId || null)
      .input('isGlobal', sql.Bit, isGlobalAdmin(request))
      .input('offset', sql.Int, (page - 1) * pageSize)
      .input('pageSize', sql.Int, pageSize)
      .input('statusFilter', sql.NVarChar(10), statusFilter || null)
      .query(`
      SELECT u.UserId AS id,
             CONCAT(u.FirstName, N' ', u.LastName) AS name,
             u.Email AS email,
             u.CompanyId AS companyId,
             c.Name AS company,
             u.BranchId AS branchId,
             b.Name AS branch,
             u.IsActive,
             u.LastLoginAt,
             u.CreatedAt,
             COALESCE(r.Name, N'Sin rol') AS role
      FROM dbo.UserOrganizations AS u
      INNER JOIN dbo.Companies AS c ON c.Id = u.CompanyId
      LEFT JOIN dbo.Branches AS b ON b.Id = u.BranchId
      OUTER APPLY (
        SELECT TOP 1 r.Name
        FROM dbo.UserRoles AS ur
        INNER JOIN dbo.Roles AS r ON r.Id = ur.RoleId
        WHERE ur.UserId = u.UserId
        ORDER BY r.Name
      ) AS r
        WHERE (@isGlobal = 1 OR u.CompanyId = @companyId)
          AND (@isGlobal = 1 OR COALESCE(r.Name, N'') <> N'Super Admin')
          AND (@statusFilter IS NULL OR (CASE WHEN u.IsActive = 1 THEN N'Activa' ELSE N'Inactiva' END) = @statusFilter)
      ORDER BY u.LastName, u.FirstName
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;

      SELECT COUNT_BIG(*) AS total
      FROM dbo.UserOrganizations AS u
      INNER JOIN dbo.Companies AS c ON c.Id = u.CompanyId
      OUTER APPLY (
        SELECT TOP 1 r.Name FROM dbo.UserRoles AS ur
        INNER JOIN dbo.Roles AS r ON r.Id = ur.RoleId
        WHERE ur.UserId = u.UserId ORDER BY r.Name
      ) AS r
      WHERE (@isGlobal = 1 OR u.CompanyId = @companyId)
        AND (@isGlobal = 1 OR COALESCE(r.Name, N'') <> N'Super Admin')
        AND (@statusFilter IS NULL OR (CASE WHEN u.IsActive = 1 THEN N'Activa' ELSE N'Inactiva' END) = @statusFilter);
    `);
    response.json({
      data: result.recordsets[0],
      total: Number(result.recordsets[1][0].total),
      page,
      pageSize
    });
  } catch (error) {
    console.error('Users query failed:', error.message);
    response.status(500).json({ message: 'No fue posible cargar los usuarios.' });
  }
});

app.post('/api/users', requirePermission('Usuarios', 'Crear usuarios'), async (request, response) => {
  const { firstName, lastName, email, phone, company, branch, role, password } = request.body;
  if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !company?.trim() || !password) {
    return response.status(400).json({ message: 'Nombre, apellido, email, empresa y contraseña son obligatorios.' });
  }
  try {
    const pool = await getPool();
    const salt = crypto.randomBytes(16);
    const hash = crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha512');
    const passwordHash = ['pbkdf2', 'sha512', '310000', salt.toString('base64'), hash.toString('base64')].join('$');
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const lookup = new sql.Request(transaction)
        .input('companyName', sql.NVarChar(150), company.trim())
        .input('branchName', sql.NVarChar(150), branch?.trim() || null)
        .input('roleName', sql.NVarChar(100), role?.trim() || 'Employee');
      const lookupResult = await lookup.query(`
        SELECT TOP 1 c.Id AS companyId,
          (SELECT TOP 1 b.Id FROM dbo.Branches b WHERE b.CompanyId = c.Id AND b.Name = @branchName) AS branchId,
          (SELECT TOP 1 r.Id FROM dbo.Roles r WHERE (r.Name = @roleName OR (r.Name = N'Employee' AND @roleName IN (N'Empleado', N'Employee')) OR (r.Name = N'Company Admin' AND @roleName IN (N'Administrador', N'Administrador de Empresa', N'Company Admin'))) AND r.IsActive = 1) AS roleId
        FROM dbo.Companies c WHERE c.Name = @companyName;
      `);
      const organization = lookupResult.recordset[0];
      if (!organization?.companyId || !organization?.roleId) throw Object.assign(new Error('Empresa o rol no encontrado.'), { status: 400 });
      if (!isGlobalAdmin(request) && organization.companyId !== request.user.companyId) {
        throw Object.assign(new Error('No puedes crear usuarios fuera de tu empresa.'), { status: 403 });
      }
      const userId = crypto.randomUUID();
      const insertUser = new sql.Request(transaction)
        .input('userId', sql.NVarChar(450), userId)
        .input('companyId', sql.Int, organization.companyId)
        .input('branchId', sql.Int, organization.branchId)
        .input('firstName', sql.NVarChar(100), firstName.trim())
        .input('lastName', sql.NVarChar(100), lastName.trim())
        .input('email', sql.NVarChar(254), email.trim())
        .input('passwordHash', sql.NVarChar(500), passwordHash)
        .input('phone', sql.NVarChar(30), phone?.trim() || null)
        .input('roleId', sql.Int, organization.roleId);
      const inserted = await insertUser.query(`
        INSERT INTO dbo.UserOrganizations (UserId, CompanyId, BranchId, FirstName, LastName, Email, PasswordHash, Phone, IsActive)
        OUTPUT INSERTED.UserId AS id, INSERTED.FirstName AS firstName, INSERTED.LastName AS lastName, INSERTED.Email AS email
        VALUES (@userId, @companyId, @branchId, @firstName, @lastName, @email, @passwordHash, @phone, 1);
        INSERT INTO dbo.UserRoles (UserId, RoleId) VALUES (@userId, @roleId);
      `);
      await transaction.commit();
      await writeAudit(request, 'CREATE', 'Usuarios', 'User', userId, organization.companyId);
      response.status(201).json(inserted.recordset[0]);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('User creation failed:', error.message);
    response.status(error.status || (error.number === 2627 ? 409 : 500)).json({ message: error.status ? error.message : error.number === 2627 ? 'Ese email ya está registrado.' : 'No fue posible guardar el usuario.' });
  }
});

app.get('/api/profile', async (request, response) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('userId', sql.NVarChar(450), request.user.userId)
      .query(`
        SELECT u.UserId AS id, u.FirstName AS firstName, u.LastName AS lastName,
               u.Email AS email, u.Phone AS phone, c.Name AS company,
               b.Name AS branch, COALESCE(r.Name, N'Sin rol') AS role
        FROM dbo.UserOrganizations AS u
        INNER JOIN dbo.Companies AS c ON c.Id = u.CompanyId
        LEFT JOIN dbo.Branches AS b ON b.Id = u.BranchId
        OUTER APPLY (
          SELECT TOP 1 r.Name
          FROM dbo.UserRoles AS ur
          INNER JOIN dbo.Roles AS r ON r.Id = ur.RoleId
          WHERE ur.UserId = u.UserId
          ORDER BY r.Name
        ) AS r
        WHERE u.UserId = @userId;
      `);
    if (!result.recordset[0]) return response.status(404).json({ message: 'Perfil no encontrado.' });
    const profile = result.recordset[0];
    const isSuperAdmin = profile.role === 'Super Admin';
    const isCompanyAdmin = profile.role === 'Company Admin';
    let permissions = [];
    if (isSuperAdmin) {
      const allPerms = await pool.request().query('SELECT ModuleName, PermissionName FROM dbo.Permissions;');
      permissions = allPerms.recordset.map(p => `${p.ModuleName}|${p.PermissionName}`);
    } else {
      const permResult = await pool.request()
        .input('userId', sql.NVarChar(450), request.user.userId)
        .query(`
          SELECT DISTINCT p.ModuleName, p.PermissionName
          FROM dbo.UserRoles ur
          INNER JOIN dbo.RolePermissions rp ON rp.RoleId = ur.RoleId
          INNER JOIN dbo.Permissions p ON p.Id = rp.PermissionId
          WHERE ur.UserId = @userId;
        `);
      permissions = permResult.recordset.map(p => `${p.ModuleName}|${p.PermissionName}`);
    }
    response.json({
      ...profile,
      isSuperAdmin,
      isCompanyAdmin,
      permissions
    });
  } catch (error) {
    console.error('Profile query failed:', error.message);
    response.status(500).json({ message: 'No fue posible cargar el perfil.' });
  }
});

app.put('/api/profile', async (request, response) => {
  const { firstName, lastName, email, phone } = request.body;
  if (!firstName?.trim() || !lastName?.trim() || !email?.trim()) {
    return response.status(400).json({ message: 'Nombre, apellido y email son obligatorios.' });
  }
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('userId', sql.NVarChar(450), request.user.userId)
      .input('firstName', sql.NVarChar(100), firstName.trim())
      .input('lastName', sql.NVarChar(100), lastName.trim())
      .input('email', sql.NVarChar(254), email.trim())
      .input('phone', sql.NVarChar(30), phone?.trim() || null)
      .query(`
        UPDATE dbo.UserOrganizations
        SET FirstName = @firstName, LastName = @lastName,
            Email = @email, Phone = @phone, UpdatedAt = SYSUTCDATETIME()
        OUTPUT INSERTED.UserId AS id, INSERTED.FirstName AS firstName,
               INSERTED.LastName AS lastName, INSERTED.Email AS email,
               INSERTED.Phone AS phone
        WHERE UserId = @userId;
      `);
    if (!result.recordset[0]) return response.status(404).json({ message: 'Perfil no encontrado.' });
    response.json(result.recordset[0]);
  } catch (error) {
    console.error('Profile update failed:', error.message);
    response.status(error.number === 2627 ? 409 : 500).json({ message: error.number === 2627 ? 'Ese email ya está registrado.' : 'No fue posible guardar el perfil.' });
  }
});

app.get('/api/branches', requirePermission('Sucursales', 'Ver sucursales'), async (request, response) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('companyId', sql.Int, request.user.companyId || null)
      .input('isGlobal', sql.Bit, isGlobalAdmin(request))
      .query(`
      SELECT b.Id AS id, b.Name AS name, b.Code AS code, c.Name AS company,
             b.ManagerUserId AS managerUserId, b.IsActive,
             COUNT(u.UserId) AS userCount
      FROM dbo.Branches AS b
      INNER JOIN dbo.Companies AS c ON c.Id = b.CompanyId
      LEFT JOIN dbo.UserOrganizations AS u ON u.BranchId = b.Id
      WHERE (@isGlobal = 1 OR b.CompanyId = @companyId)
      GROUP BY b.Id, b.Name, b.Code, c.Name, b.ManagerUserId, b.IsActive
      ORDER BY c.Name, b.Name;
    `);
    response.json(result.recordset);
  } catch (error) {
    console.error('Branches query failed:', error.message);
    response.status(500).json({ message: 'No fue posible cargar las sucursales.' });
  }
});

app.get('/api/roles', requireRoleAdministration, async (request, response) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('isGlobal', sql.Bit, isGlobalAdmin(request))
      .input('companyId', sql.Int, request.user.companyId || null)
      .query(`
      SELECT r.Id AS id, r.Name AS name, r.Description AS description,
             r.RoleType AS type,
             CASE WHEN r.RoleType = N'Sistema' THEN 1 ELSE 0 END AS isSystem,
             COUNT(ur.UserId) AS userCount
      FROM dbo.Roles AS r
      LEFT JOIN dbo.UserRoles AS ur ON ur.RoleId = r.Id
      WHERE r.IsActive = 1
        AND (@isGlobal = 1 OR r.Name <> N'Super Admin')
      GROUP BY r.Id, r.Name, r.Description, r.RoleType
      ORDER BY r.Name;
    `);
    response.json(result.recordset);
  } catch (error) {
    console.error('Roles query failed:', error.message);
    response.status(500).json({ message: 'No fue posible cargar los roles.' });
  }
});

app.get('/api/permissions', requireRoleAdministration, async (_request, response) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT Id AS id, ModuleName AS module, PermissionName AS name FROM dbo.Permissions ORDER BY ModuleName, PermissionName;');
    response.json(result.recordset);
  } catch (error) {
    console.error('Permissions query failed:', error.message);
    response.status(500).json({ message: 'No fue posible cargar los permisos.' });
  }
});

app.get('/api/roles/:id/permissions', requireRoleAdministration, async (request, response) => {
  try {
    const pool = await getPool();
    const result = await pool.request().input('roleId', sql.Int, Number(request.params.id))
      .input('isGlobal', sql.Bit, isGlobalAdmin(request))
      .query(`SELECT PermissionId AS id FROM dbo.RolePermissions AS rp
              INNER JOIN dbo.Roles AS r ON r.Id = rp.RoleId
              WHERE rp.RoleId = @roleId AND (@isGlobal = 1 OR r.Name <> N'Super Admin')
              ORDER BY PermissionId;`);
    response.json(result.recordset.map(permission => permission.id));
  } catch (error) {
    console.error('Role permissions query failed:', error.message);
    response.status(500).json({ message: 'No fue posible cargar los permisos del rol.' });
  }
});

app.put('/api/roles/:id/permissions', requireRoleAdministration, async (request, response) => {
  const permissionIds = Array.isArray(request.body?.permissionIds) ? [...new Set(request.body.permissionIds.map(Number).filter(Number.isInteger))] : null;
  if (!permissionIds) return response.status(400).json({ message: 'permissionIds debe ser un arreglo.' });
  const transaction = new sql.Transaction(await getPool());
  try {
    await transaction.begin();
    const roleCheck = await new sql.Request(transaction).input('roleId', sql.Int, Number(request.params.id))
      .input('isGlobal', sql.Bit, isGlobalAdmin(request))
      .query('SELECT Id FROM dbo.Roles WHERE Id = @roleId AND (@isGlobal = 1 OR Name <> N\'Super Admin\');');
    if (!roleCheck.recordset[0]) {
      await transaction.rollback();
      return response.status(403).json({ message: 'No puedes administrar el rol Super Admin.' });
    }
    const clear = new sql.Request(transaction).input('roleId', sql.Int, Number(request.params.id));
    await clear.query('DELETE FROM dbo.RolePermissions WHERE RoleId = @roleId;');
    for (const permissionId of permissionIds) {
      await new sql.Request(transaction).input('roleId', sql.Int, Number(request.params.id)).input('permissionId', sql.Int, permissionId)
        .query('INSERT INTO dbo.RolePermissions (RoleId, PermissionId) VALUES (@roleId, @permissionId);');
    }
    await transaction.commit();
    await writeAudit(request, 'UPDATE', 'Roles', 'RolePermissions', request.params.id);
    response.status(204).end();
  } catch (error) {
    await transaction.rollback();
    console.error('Role permissions update failed:', error.message);
    response.status(500).json({ message: 'No fue posible guardar los permisos del rol.' });
  }
});

app.get('/api/audit', requirePermission('Auditoría', 'Ver auditoría'), async (request, response) => {
  try {
    const pool = await getPool();
    const query = String(request.query.search || '').trim();
    const moduleName = String(request.query.module || '').trim();
    const actionName = String(request.query.action || '').trim();
    const auditRequest = pool.request().input('search', sql.NVarChar(200), `%${query}%`)
      .input('module', sql.NVarChar(80), moduleName || null).input('action', sql.NVarChar(40), actionName || null)
      .input('companyId', sql.Int, request.user.companyId || null)
      .input('isGlobal', sql.Bit, isGlobalAdmin(request));
    const result = await auditRequest.query(`
      SELECT a.Id AS id, a.CreatedAt, a.ActionName AS action,
             a.ModuleName AS module, a.EntityName AS entity,
             a.EntityId AS record, a.IpAddress AS ip,
             COALESCE(CONCAT(u.FirstName, N' ', u.LastName), N'Sistema') AS userName
      FROM dbo.AuditLogs AS a
      LEFT JOIN dbo.UserOrganizations AS u ON u.UserId = a.UserId
      WHERE (@isGlobal = 1 OR a.CompanyId = @companyId)
        AND (@search = '%%' OR CONCAT(COALESCE(u.FirstName, N''), N' ', COALESCE(u.LastName, N''), N' ', COALESCE(a.EntityId, N'')) LIKE @search)
        AND (@module IS NULL OR a.ModuleName = @module)
        AND (@action IS NULL OR a.ActionName = @action)
      ORDER BY a.CreatedAt DESC;
    `);
    response.json(result.recordset);
  } catch (error) {
    console.error('Audit query failed:', error.message);
    response.status(500).json({ message: 'No fue posible cargar la auditoría.' });
  }
});

// M-07: Exportación de auditoría a CSV
app.get('/api/audit/export', requirePermission('Auditoría', 'Ver auditoría'), async (request, response) => {
  try {
    const pool = await getPool();
    const query = String(request.query.search || '').trim();
    const moduleName = String(request.query.module || '').trim();
    const actionName = String(request.query.action || '').trim();
    const auditRequest = pool.request()
      .input('search', sql.NVarChar(200), `%${query}%`)
      .input('module', sql.NVarChar(80), moduleName || null)
      .input('action', sql.NVarChar(40), actionName || null)
      .input('companyId', sql.Int, request.user.companyId || null)
      .input('isGlobal', sql.Bit, isGlobalAdmin(request));
    const result = await auditRequest.query(`
      SELECT a.Id AS id, a.CreatedAt, a.ActionName AS action,
             a.ModuleName AS module, a.EntityName AS entity,
             a.EntityId AS record, a.IpAddress AS ip,
             COALESCE(CONCAT(u.FirstName, N' ', u.LastName), N'Sistema') AS userName
      FROM dbo.AuditLogs AS a
      LEFT JOIN dbo.UserOrganizations AS u ON u.UserId = a.UserId
      WHERE (@isGlobal = 1 OR a.CompanyId = @companyId)
        AND (@search = '%%' OR CONCAT(COALESCE(u.FirstName, N''), N' ', COALESCE(u.LastName, N''), N' ', COALESCE(a.EntityId, N'')) LIKE @search)
        AND (@module IS NULL OR a.ModuleName = @module)
        AND (@action IS NULL OR a.ActionName = @action)
      ORDER BY a.CreatedAt DESC;
    `);
    const rows = result.recordset;
    const header = 'ID,Fecha,Usuario,Acción,Módulo,Entidad,Registro,IP\n';
    const csvEscape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = header + rows.map(r =>
      [r.id, r.CreatedAt?.toISOString() ?? '', r.userName, r.action, r.module, r.entity, r.record, r.ip]
        .map(csvEscape).join(',')
    ).join('\n');
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="auditoria-${new Date().toISOString().slice(0, 10)}.csv"`);
    response.send('\uFEFF' + csv); // BOM para Excel
  } catch (error) {
    console.error('Audit export failed:', error.message);
    response.status(500).json({ message: 'No fue posible exportar la auditoría.' });
  }
});

app.patch('/api/companies/:id/status', requireGlobalAdmin, async (request, response) => {
  const isActive = request.body?.isActive;
  if (typeof isActive !== 'boolean') return response.status(400).json({ message: 'isActive debe ser booleano.' });
  try {
    const pool = await getPool();
    const result = await pool.request().input('id', sql.Int, Number(request.params.id)).input('isActive', sql.Bit, isActive)
      .query(`UPDATE dbo.Companies SET IsActive = @isActive, UpdatedAt = SYSUTCDATETIME() OUTPUT INSERTED.Id AS id, INSERTED.IsActive AS isActive WHERE Id = @id;`);
    if (!result.recordset[0]) return response.status(404).json({ message: 'Empresa no encontrada.' });
    await writeAudit(request, isActive ? 'ACTIVATE' : 'DEACTIVATE', 'Empresas', 'Company', request.params.id);
    response.json(result.recordset[0]);
  } catch (error) {
    console.error('Company status update failed:', error.message);
    response.status(500).json({ message: 'No fue posible actualizar la empresa.' });
  }
});

app.put('/api/companies/:id', requireGlobalAdmin, async (request, response) => {
  const { name, rnc, email, phone, address } = request.body;
  if (!name?.trim() || !rnc?.trim() || !email?.trim()) return response.status(400).json({ message: 'Nombre, RNC y email son obligatorios.' });
  if (!validateRnc(rnc)) return response.status(400).json({ message: 'El RNC debe tener 9 u 11 dígitos numéricos (formato DGII).' });
  try {
    const pool = await getPool();
    const result = await pool.request().input('id', sql.Int, Number(request.params.id))
      .input('name', sql.NVarChar(150), name.trim()).input('rnc', sql.VarChar(20), rnc.trim())
      .input('email', sql.NVarChar(254), email.trim()).input('phone', sql.NVarChar(30), phone?.trim() || null)
      .input('address', sql.NVarChar(300), address?.trim() || null)
      .query(`UPDATE dbo.Companies SET Name = @name, Rnc = @rnc, ContactEmail = @email, Phone = @phone, Address = @address, UpdatedAt = SYSUTCDATETIME()
              OUTPUT INSERTED.Id AS id, INSERTED.Name AS name, INSERTED.Rnc AS rnc, INSERTED.ContactEmail AS email
              WHERE Id = @id;`);
    if (!result.recordset[0]) return response.status(404).json({ message: 'Empresa no encontrada.' });
    await writeAudit(request, 'UPDATE', 'Empresas', 'Company', request.params.id);
    response.json(result.recordset[0]);
  } catch (error) {
    console.error('Company update failed:', error.message);
    response.status(error.number === 2627 ? 409 : 500).json({ message: error.number === 2627 ? 'El RNC ya está registrado.' : 'No fue posible actualizar la empresa.' });
  }
});

app.patch('/api/users/:id/status', requirePermission('Usuarios', 'Desactivar usuarios'), async (request, response) => {
  const isActive = request.body?.isActive;
  if (typeof isActive !== 'boolean') return response.status(400).json({ message: 'isActive debe ser booleano.' });
  try {
    const pool = await getPool();
    const result = await pool.request().input('id', sql.NVarChar(450), request.params.id).input('isActive', sql.Bit, isActive)
      .input('companyId', sql.Int, request.user.companyId || null).input('isGlobal', sql.Bit, isGlobalAdmin(request))
      .query(`UPDATE dbo.UserOrganizations SET IsActive = @isActive, UpdatedAt = SYSUTCDATETIME()
              OUTPUT INSERTED.UserId AS id, INSERTED.IsActive AS isActive, INSERTED.CompanyId AS companyId
              WHERE UserId = @id AND (@isGlobal = 1 OR CompanyId = @companyId);`);
    const user = result.recordset[0];
    if (!user) return response.status(404).json({ message: 'Usuario no encontrado.' });
    await writeAudit(request, isActive ? 'ACTIVATE' : 'DEACTIVATE', 'Usuarios', 'User', request.params.id, user.companyId);
    response.json(user);
  } catch (error) {
    console.error('User status update failed:', error.message);
    response.status(500).json({ message: 'No fue posible actualizar el usuario.' });
  }
});

app.put('/api/users/:id', requirePermission('Usuarios', 'Editar usuarios'), async (request, response) => {
  const { firstName, lastName, email, phone } = request.body;
  if (!firstName?.trim() || !lastName?.trim() || !email?.trim()) return response.status(400).json({ message: 'Nombre, apellido y email son obligatorios.' });
  try {
    const pool = await getPool();
    const result = await pool.request().input('id', sql.NVarChar(450), request.params.id)
      .input('firstName', sql.NVarChar(100), firstName.trim()).input('lastName', sql.NVarChar(100), lastName.trim())
      .input('email', sql.NVarChar(254), email.trim()).input('phone', sql.NVarChar(30), phone?.trim() || null)
      .input('companyId', sql.Int, request.user.companyId || null).input('isGlobal', sql.Bit, isGlobalAdmin(request))
      .query(`UPDATE dbo.UserOrganizations SET FirstName = @firstName, LastName = @lastName, Email = @email, Phone = @phone, UpdatedAt = SYSUTCDATETIME()
              OUTPUT INSERTED.UserId AS id, INSERTED.FirstName AS firstName, INSERTED.LastName AS lastName, INSERTED.Email AS email
              WHERE UserId = @id AND (@isGlobal = 1 OR CompanyId = @companyId);`);
    if (!result.recordset[0]) return response.status(404).json({ message: 'Usuario no encontrado.' });
    await writeAudit(request, 'UPDATE', 'Usuarios', 'User', request.params.id);
    response.json(result.recordset[0]);
  } catch (error) {
    console.error('User update failed:', error.message);
    response.status(error.number === 2627 ? 409 : 500).json({ message: error.number === 2627 ? 'Ese email ya está registrado.' : 'No fue posible actualizar el usuario.' });
  }
});

app.put('/api/users/:id/password', requirePermission('Usuarios', 'Editar usuarios'), async (request, response) => {
  const { newPassword } = request.body;
  const targetUserId = request.params.id;
  if (!newPassword || newPassword.length < 6) {
    return response.status(400).json({ message: 'La nueva contraseña debe tener al menos 6 caracteres.' });
  }
  try {
    const pool = await getPool();
    if (!isGlobalAdmin(request)) {
      const targetUser = await pool.request().input('uid', sql.NVarChar(450), targetUserId)
        .query('SELECT CompanyId FROM dbo.UserOrganizations WHERE UserId = @uid');
      if (targetUser.recordset[0]?.CompanyId !== request.user.companyId) {
        return response.status(403).json({ message: 'No puedes modificar usuarios de otra empresa.' });
      }
    }
    const salt = crypto.randomBytes(16);
    const hash = crypto.pbkdf2Sync(newPassword, salt, 310000, 32, 'sha512');
    const passwordHash = ['pbkdf2', 'sha512', '310000', salt.toString('base64'), hash.toString('base64')].join('$');
    await pool.request()
      .input('userId', sql.NVarChar(450), targetUserId)
      .input('passwordHash', sql.NVarChar(500), passwordHash)
      .query('UPDATE dbo.UserOrganizations SET PasswordHash = @passwordHash, UpdatedAt = SYSUTCDATETIME() WHERE UserId = @userId');
    await writeAudit(request, 'PASSWORD_RESET', 'Usuarios', 'User', targetUserId, request.user.companyId);
    response.json({ message: 'Contraseña actualizada correctamente.' });
  } catch (error) {
    console.error('Admin password update failed:', error.message);
    response.status(500).json({ message: 'No fue posible actualizar la contraseña del usuario.' });
  }
});

app.post('/api/branches', requirePermission('Sucursales', 'Crear sucursales'), async (request, response) => {
  const { companyId, name, code, address, phone, email, managerUserId } = request.body;
  if (!Number.isInteger(Number(companyId)) || !name?.trim() || !code?.trim()) {
    return response.status(400).json({ message: 'Empresa, nombre y código son obligatorios.' });
  }
  try {
    const pool = await getPool();
    const scope = await pool.request().input('companyId', sql.Int, Number(companyId))
      .input('sessionCompanyId', sql.Int, request.user.companyId || null).input('isGlobal', sql.Bit, isGlobalAdmin(request))
      .query('SELECT Id FROM dbo.Companies WHERE Id = @companyId AND (@isGlobal = 1 OR Id = @sessionCompanyId);');
    if (!scope.recordset[0]) return response.status(403).json({ message: 'No puedes crear sucursales fuera de tu empresa.' });
    const result = await pool.request()
      .input('companyId', sql.Int, Number(companyId)).input('name', sql.NVarChar(150), name.trim())
      .input('code', sql.NVarChar(30), code.trim()).input('address', sql.NVarChar(300), address?.trim() || null)
      .input('phone', sql.NVarChar(30), phone?.trim() || null).input('email', sql.NVarChar(254), email?.trim() || null)
      .input('managerUserId', sql.NVarChar(450), managerUserId?.trim() || null)
      .query(`INSERT INTO dbo.Branches (CompanyId, Name, Code, Address, Phone, Email, ManagerUserId)
              OUTPUT INSERTED.Id AS id, INSERTED.Name AS name, INSERTED.Code AS code, INSERTED.CompanyId AS companyId
              VALUES (@companyId, @name, @code, @address, @phone, @email, @managerUserId);`);
    await writeAudit(request, 'CREATE', 'Sucursales', 'Branch', result.recordset[0].id, Number(companyId));
    response.status(201).json(result.recordset[0]);
  } catch (error) {
    console.error('Branch creation failed:', error.message);
    response.status(error.number === 2627 ? 409 : 500).json({ message: error.number === 2627 ? 'Ese código ya existe para la empresa.' : 'No fue posible guardar la sucursal.' });
  }
});

// M-01: Edición de sucursal
app.put('/api/branches/:id', requirePermission('Sucursales', 'Editar sucursales'), async (request, response) => {
  const { name, code, address, phone, email, managerUserId } = request.body;
  if (!name?.trim() || !code?.trim()) {
    return response.status(400).json({ message: 'Nombre y código son obligatorios.' });
  }
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, Number(request.params.id))
      .input('companyId', sql.Int, request.user.companyId || null)
      .input('isGlobal', sql.Bit, isGlobalAdmin(request))
      .input('name', sql.NVarChar(150), name.trim())
      .input('code', sql.NVarChar(30), code.trim())
      .input('address', sql.NVarChar(300), address?.trim() || null)
      .input('phone', sql.NVarChar(30), phone?.trim() || null)
      .input('email', sql.NVarChar(254), email?.trim() || null)
      .input('managerUserId', sql.NVarChar(450), managerUserId?.trim() || null)
      .query(`UPDATE dbo.Branches
              SET Name = @name, Code = @code, Address = @address, Phone = @phone,
                  Email = @email, ManagerUserId = @managerUserId, UpdatedAt = SYSUTCDATETIME()
              OUTPUT INSERTED.Id AS id, INSERTED.Name AS name, INSERTED.Code AS code
              WHERE Id = @id AND (@isGlobal = 1 OR CompanyId = @companyId);`);
    if (!result.recordset[0]) return response.status(404).json({ message: 'Sucursal no encontrada.' });
    await writeAudit(request, 'UPDATE', 'Sucursales', 'Branch', request.params.id);
    response.json(result.recordset[0]);
  } catch (error) {
    console.error('Branch update failed:', error.message);
    response.status(error.number === 2627 ? 409 : 500).json({ message: error.number === 2627 ? 'Ese código ya existe para la empresa.' : 'No fue posible actualizar la sucursal.' });
  }
});

// M-01: Activar / desactivar sucursal (eliminación lógica)
app.patch('/api/branches/:id/status', requirePermission('Sucursales', 'Editar sucursales'), async (request, response) => {
  const isActive = request.body?.isActive;
  if (typeof isActive !== 'boolean') return response.status(400).json({ message: 'isActive debe ser booleano.' });
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, Number(request.params.id))
      .input('isActive', sql.Bit, isActive)
      .input('companyId', sql.Int, request.user.companyId || null)
      .input('isGlobal', sql.Bit, isGlobalAdmin(request))
      .query(`UPDATE dbo.Branches SET IsActive = @isActive, UpdatedAt = SYSUTCDATETIME()
              OUTPUT INSERTED.Id AS id, INSERTED.IsActive AS isActive
              WHERE Id = @id AND (@isGlobal = 1 OR CompanyId = @companyId);`);
    if (!result.recordset[0]) return response.status(404).json({ message: 'Sucursal no encontrada.' });
    await writeAudit(request, isActive ? 'ACTIVATE' : 'DEACTIVATE', 'Sucursales', 'Branch', request.params.id);
    response.json(result.recordset[0]);
  } catch (error) {
    console.error('Branch status update failed:', error.message);
    response.status(500).json({ message: 'No fue posible actualizar la sucursal.' });
  }
});

app.post('/api/roles', requireRoleAdministration, async (request, response) => {
  const { name, description, roleType = 'Personalizado', permissionIds } = request.body || {};
  if (!name?.trim()) return response.status(400).json({ message: 'El nombre del rol es obligatorio.' });
  if (name.trim().toLowerCase() === 'super admin') {
    return response.status(403).json({ message: 'El rol Super Admin es reservado del sistema.' });
  }
  
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  let transactionStarted = false;
  try {
    await transaction.begin();
    transactionStarted = true;

    const exists = await new sql.Request(transaction)
      .input('name', sql.NVarChar(100), name.trim())
      .query('SELECT Id FROM dbo.Roles WHERE LOWER(Name) = LOWER(@name) AND IsActive = 1;');
    if (exists.recordset[0]) {
      await transaction.rollback();
      transactionStarted = false;
      return response.status(409).json({ message: 'Ya existe un rol con ese nombre.' });
    }

    const effectiveRoleType = (roleType === 'Sistema' && isGlobalAdmin(request)) ? 'Sistema' : 'Personalizado';

    const insertResult = await new sql.Request(transaction)
      .input('name', sql.NVarChar(100), name.trim())
      .input('description', sql.NVarChar(300), description?.trim() || null)
      .input('roleType', sql.NVarChar(30), effectiveRoleType)
      .query(`INSERT INTO dbo.Roles (Name, Description, RoleType, IsActive)
              OUTPUT INSERTED.Id AS id, INSERTED.Name AS name, INSERTED.Description AS description,
                     INSERTED.RoleType AS type,
                     CASE WHEN INSERTED.RoleType = N'Sistema' THEN 1 ELSE 0 END AS isSystem
              VALUES (@name, @description, @roleType, 1);`);
    
    const roleId = insertResult.recordset[0].id;

    if (Array.isArray(permissionIds) && permissionIds.length > 0) {
      const uniquePermIds = [...new Set(permissionIds.map(Number).filter(Number.isInteger))];
      for (const pId of uniquePermIds) {
        await new sql.Request(transaction)
          .input('roleId', sql.Int, roleId)
          .input('permissionId', sql.Int, pId)
          .query('INSERT INTO dbo.RolePermissions (RoleId, PermissionId) VALUES (@roleId, @permissionId);');
      }
    }

    await transaction.commit();
    transactionStarted = false;
    await writeAudit(request, 'CREATE', 'Roles', 'Role', roleId);
    response.status(201).json({ ...insertResult.recordset[0], userCount: 0 });
  } catch (error) {
    if (transactionStarted) {
      try { await transaction.rollback(); } catch (_) {}
    }
    console.error('Role creation failed:', error.message);
    response.status(error.number === 2627 ? 409 : 500).json({ message: error.number === 2627 ? 'Ese rol ya existe.' : 'No fue posible guardar el rol.' });
  }
});

app.put('/api/roles/:id', requireRoleAdministration, async (request, response) => {
  const roleId = Number(request.params.id);
  if (!Number.isInteger(roleId) || roleId <= 0) return response.status(400).json({ message: 'ID de rol inválido.' });

  const { name, description, permissionIds } = request.body || {};
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  let transactionStarted = false;

  try {
    await transaction.begin();
    transactionStarted = true;

    const roleCheck = await new sql.Request(transaction)
      .input('roleId', sql.Int, roleId)
      .query('SELECT Id, Name, Description, RoleType FROM dbo.Roles WHERE Id = @roleId AND IsActive = 1;');
    
    const currentRole = roleCheck.recordset[0];
    if (!currentRole) {
      await transaction.rollback();
      transactionStarted = false;
      return response.status(404).json({ message: 'El rol no existe.' });
    }

    if (currentRole.Name === 'Super Admin' && !isGlobalAdmin(request)) {
      await transaction.rollback();
      transactionStarted = false;
      return response.status(403).json({ message: 'No puedes administrar el rol Super Admin.' });
    }

    const isSystemRole = currentRole.RoleType === 'Sistema';
    let targetName = currentRole.Name;

    if (name && name.trim()) {
      if (isSystemRole && name.trim() !== currentRole.Name) {
        await transaction.rollback();
        transactionStarted = false;
        return response.status(400).json({ message: 'No se puede cambiar el nombre de un rol esencial del sistema.' });
      }
      if (!isSystemRole) {
        targetName = name.trim();
        const conflict = await new sql.Request(transaction)
          .input('name', sql.NVarChar(100), targetName)
          .input('roleId', sql.Int, roleId)
          .query('SELECT Id FROM dbo.Roles WHERE LOWER(Name) = LOWER(@name) AND Id <> @roleId AND IsActive = 1;');
        if (conflict.recordset[0]) {
          await transaction.rollback();
          transactionStarted = false;
          return response.status(409).json({ message: 'Ya existe otro rol con ese nombre.' });
        }
      }
    }

    const targetDesc = description !== undefined ? (description?.trim() || null) : currentRole.Description;

    await new sql.Request(transaction)
      .input('roleId', sql.Int, roleId)
      .input('name', sql.NVarChar(100), targetName)
      .input('description', sql.NVarChar(300), targetDesc)
      .query('UPDATE dbo.Roles SET Name = @name, Description = @description WHERE Id = @roleId;');

    if (Array.isArray(permissionIds)) {
      const uniquePermIds = [...new Set(permissionIds.map(Number).filter(Number.isInteger))];
      await new sql.Request(transaction)
        .input('roleId', sql.Int, roleId)
        .query('DELETE FROM dbo.RolePermissions WHERE RoleId = @roleId;');

      for (const pId of uniquePermIds) {
        await new sql.Request(transaction)
          .input('roleId', sql.Int, roleId)
          .input('permissionId', sql.Int, pId)
          .query('INSERT INTO dbo.RolePermissions (RoleId, PermissionId) VALUES (@roleId, @permissionId);');
      }
    }

    await transaction.commit();
    transactionStarted = false;
    await writeAudit(request, 'UPDATE', 'Roles', 'Role', roleId);

    response.json({
      id: roleId,
      name: targetName,
      description: targetDesc,
      type: currentRole.RoleType,
      isSystem: isSystemRole ? 1 : 0
    });
  } catch (error) {
    if (transactionStarted) {
      try { await transaction.rollback(); } catch (_) {}
    }
    console.error('Role update failed:', error.message);
    response.status(500).json({ message: 'No fue posible actualizar el rol.' });
  }
});

app.delete('/api/roles/:id', requireRoleAdministration, async (request, response) => {
  const roleId = Number(request.params.id);
  if (!Number.isInteger(roleId) || roleId <= 0) return response.status(400).json({ message: 'ID de rol inválido.' });

  const pool = await getPool();
  try {
    const roleCheck = await pool.request()
      .input('roleId', sql.Int, roleId)
      .query('SELECT Id, Name, Description, RoleType FROM dbo.Roles WHERE Id = @roleId;');
    
    const role = roleCheck.recordset[0];
    if (!role) return response.status(404).json({ message: 'El rol no existe.' });

    // Protección de roles esenciales del sistema
    if (role.RoleType === 'Sistema' || role.Name === 'Super Admin') {
      return response.status(403).json({
        message: `El rol "${role.Name}" es esencial para el funcionamiento del sistema y no puede ser eliminado.`
      });
    }

    // Verificar usuarios asignados
    const userCountCheck = await pool.request()
      .input('roleId', sql.Int, roleId)
      .query('SELECT COUNT(*) AS userCount FROM dbo.UserRoles WHERE RoleId = @roleId;');
    
    const count = userCountCheck.recordset[0]?.userCount || 0;
    if (count > 0) {
      return response.status(400).json({
        message: `No se puede eliminar el rol "${role.Name}" porque tiene ${count} usuario(s) asignado(s). Desasigne los usuarios antes de eliminarlo.`
      });
    }

    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;
    try {
      await transaction.begin();
      transactionStarted = true;

      // Eliminar permisos asociados
      await new sql.Request(transaction)
        .input('roleId', sql.Int, roleId)
        .query('DELETE FROM dbo.RolePermissions WHERE RoleId = @roleId;');

      // Eliminar rol
      await new sql.Request(transaction)
        .input('roleId', sql.Int, roleId)
        .query('DELETE FROM dbo.Roles WHERE Id = @roleId;');

      await transaction.commit();
      transactionStarted = false;
      await writeAudit(request, 'DELETE', 'Roles', 'Role', roleId);

      response.json({ message: `Rol "${role.Name}" eliminado exitosamente.` });
    } catch (innerError) {
      if (transactionStarted) {
        try { await transaction.rollback(); } catch (_) {}
      }
      throw innerError;
    }
  } catch (error) {
    console.error('Role deletion failed:', error.message);
    response.status(500).json({ message: 'No fue posible eliminar el rol.' });
  }
});

let activePool = null;
const poolProxy = new Proxy({}, {
  get(_target, prop) {
    if (!activePool) throw new Error('Database pool not ready yet');
    const val = activePool[prop];
    return typeof val === 'function' ? val.bind(activePool) : val;
  }
});

registerHrModule(app, {
  pool: poolProxy,
  sql,
  requirePermission,
  writeAudit,
  isGlobalAdmin
});

app.use((_request, response) => {
  if (_request.path.startsWith('/api/')) return response.status(404).json({ message: 'Ruta API no encontrada.' });
  if (path.extname(_request.path)) return response.status(404).send('Not found');
  response.sendFile(path.join(__dirname, 'public', 'index.html'));
});

ensureOperationsSchema().then(async () => {
  activePool = await getPool();
  await runMigrations(activePool);
  app.listen(port, () => {
    console.log(`Kinetix Core disponible en http://localhost:${port}`);
    console.log(`Base configurada: ${dbConfig.server}/${dbConfig.database}`);
  });
}).catch(error => {
  console.error('Operations schema initialization failed:', error.message);
  process.exitCode = 1;
});

