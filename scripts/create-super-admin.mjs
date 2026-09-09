import 'dotenv/config';
import crypto from 'node:crypto';
import sql from 'mssql/msnodesqlv8.js';

const password = process.env.NEW_SUPER_ADMIN_PASSWORD;
if (!password || password.length < 10) throw new Error('Define NEW_SUPER_ADMIN_PASSWORD con al menos 10 caracteres.');

const userId = process.env.SUPER_ADMIN_ID || 'kinetix-super-admin';
const email = process.env.SUPER_ADMIN_EMAIL || 'superadmin@kinetix.local';
const firstName = process.env.SUPER_ADMIN_FIRST_NAME || 'Kinetix';
const lastName = process.env.SUPER_ADMIN_LAST_NAME || 'Super Admin';
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
  const company = await new sql.Request(transaction).query('SELECT TOP 1 Id FROM dbo.Companies WHERE IsActive = 1 ORDER BY Id;');
  if (!company.recordset[0]) throw new Error('No existe una empresa activa para asociar el Super Admin.');
  const companyId = company.recordset[0].Id;
  const request = new sql.Request(transaction)
    .input('userId', sql.NVarChar(450), userId)
    .input('companyId', sql.Int, companyId)
    .input('firstName', sql.NVarChar(100), firstName)
    .input('lastName', sql.NVarChar(100), lastName)
    .input('email', sql.NVarChar(254), email)
    .input('passwordHash', sql.NVarChar(500), passwordHash);
  await request.query(`
    IF EXISTS (SELECT 1 FROM dbo.UserOrganizations WHERE UserId = @userId)
      UPDATE dbo.UserOrganizations SET CompanyId = @companyId, FirstName = @firstName, LastName = @lastName,
        Email = @email, PasswordHash = @passwordHash, IsActive = 1, UpdatedAt = SYSUTCDATETIME() WHERE UserId = @userId;
    ELSE
      INSERT INTO dbo.UserOrganizations (UserId, CompanyId, FirstName, LastName, Email, PasswordHash, IsActive)
      VALUES (@userId, @companyId, @firstName, @lastName, @email, @passwordHash, 1);
  `);
  await new sql.Request(transaction).input('userId', sql.NVarChar(450), userId).query(`
    DELETE ur FROM dbo.UserRoles AS ur INNER JOIN dbo.Roles AS r ON r.Id = ur.RoleId WHERE ur.UserId = @userId AND r.Name <> N'Super Admin';
    INSERT INTO dbo.UserRoles (UserId, RoleId)
    SELECT @userId, r.Id FROM dbo.Roles AS r WHERE r.Name = N'Super Admin'
      AND NOT EXISTS (SELECT 1 FROM dbo.UserRoles WHERE UserId = @userId AND RoleId = r.Id);
  `);
  await transaction.commit();
  console.log(`Super Admin creado o actualizado: ${email}`);
} catch (error) {
  await transaction.rollback();
  throw error;
} finally {
  await pool.close();
}
