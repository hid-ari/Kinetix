import 'dotenv/config';
import crypto from 'node:crypto';
import sql from 'mssql/msnodesqlv8.js';

const password = process.env.NEW_USER_PASSWORD;
if (!password) throw new Error('Define NEW_USER_PASSWORD antes de ejecutar este script.');

const server = process.env.DB_SERVER;
const database = process.env.DB_DATABASE;
const config = {
  server,
  database,
  connectionString: `Driver={ODBC Driver 18 for SQL Server};Server=${server};Database=${database};Trusted_Connection=Yes;Encrypt=No;TrustServerCertificate=Yes;`,
  driver: 'msnodesqlv8',
  options: { trustedConnection: true }
};

const salt = crypto.randomBytes(16);
const hash = crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha512');
const passwordHash = ['pbkdf2', 'sha512', '310000', salt.toString('base64'), hash.toString('base64')].join('$');
const pool = await sql.connect(config);
const transaction = new sql.Transaction(pool);

try {
  await transaction.begin();
  await new sql.Request(transaction).query(`
    IF COL_LENGTH('dbo.UserOrganizations', 'Email') IS NULL
      ALTER TABLE dbo.UserOrganizations ADD Email NVARCHAR(254) NULL;
    IF COL_LENGTH('dbo.UserOrganizations', 'PasswordHash') IS NULL
      ALTER TABLE dbo.UserOrganizations ADD PasswordHash NVARCHAR(500) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_UserOrganizations_Email')
      ALTER TABLE dbo.UserOrganizations ADD CONSTRAINT UQ_UserOrganizations_Email UNIQUE (Email);
  `);

  const companyRequest = new sql.Request(transaction)
    .input('name', sql.NVarChar(150), 'Kinetrix')
    .input('rnc', sql.VarChar(20), '40215230497');
  const companyResult = await companyRequest.query(`
    IF NOT EXISTS (SELECT 1 FROM dbo.Companies WHERE Rnc = @rnc)
      INSERT INTO dbo.Companies (Name, Rnc, ContactEmail, IsActive)
      VALUES (@name, @rnc, 'ariyamahideki1@gmail.com', 1);
    SELECT TOP 1 Id FROM dbo.Companies WHERE Rnc = @rnc;
  `);

  const companyId = companyResult.recordset[0].Id;
  const userRequest = new sql.Request(transaction)
    .input('userId', sql.NVarChar(450), 'hideki-ariyama')
    .input('companyId', sql.Int, companyId)
    .input('firstName', sql.NVarChar(100), 'Hideki')
    .input('lastName', sql.NVarChar(100), 'Ariyama')
    .input('email', sql.NVarChar(254), 'ariyamahideki1@gmail.com')
    .input('passwordHash', sql.NVarChar(500), passwordHash);
  await userRequest.query(`
    IF NOT EXISTS (SELECT 1 FROM dbo.UserOrganizations WHERE Email = @email)
      INSERT INTO dbo.UserOrganizations
        (UserId, CompanyId, BranchId, FirstName, LastName, Email, PasswordHash, IsActive)
      VALUES
        (@userId, @companyId, NULL, @firstName, @lastName, @email, @passwordHash, 1);
    ELSE
      UPDATE dbo.UserOrganizations
      SET PasswordHash = @passwordHash, IsActive = 1, UpdatedAt = SYSUTCDATETIME()
      WHERE Email = @email;
  `);

  const roleRequest = new sql.Request(transaction)
    .input('userId', sql.NVarChar(450), 'hideki-ariyama')
    .input('roleName', sql.NVarChar(100), 'Company Admin');
  await roleRequest.query(`
    INSERT INTO dbo.UserRoles (UserId, RoleId)
    SELECT @userId, Id
    FROM dbo.Roles
    WHERE Name = @roleName
      AND NOT EXISTS (
        SELECT 1 FROM dbo.UserRoles ur
        INNER JOIN dbo.Roles r ON r.Id = ur.RoleId
        WHERE ur.UserId = @userId AND r.Name = @roleName
      );
  `);

  await transaction.commit();
  console.log('Usuario creado o actualizado correctamente.');
} catch (error) {
  await transaction.rollback();
  throw error;
} finally {
  await pool.close();
}
