import 'dotenv/config';
import crypto from 'node:crypto';
import sql from 'mssql/msnodesqlv8.js';

const server = process.env.DB_SERVER || '(localdb)\\MSSQLLocalDB';
const database = process.env.DB_DATABASE || 'KinetixCore';
const config = {
  server, database, driver: 'msnodesqlv8',
  connectionString: `Driver={ODBC Driver 18 for SQL Server};Server=${server};Database=${database};Trusted_Connection=Yes;Encrypt=No;TrustServerCertificate=Yes;`,
  options: { trustedConnection: true, trustServerCertificate: true }
};

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha512');
  return ['pbkdf2', 'sha512', '310000', salt.toString('base64'), hash.toString('base64')].join('$');
}

const defaultPassword = 'Admin12345!';
const passwordHash = hashPassword(defaultPassword);

async function syncUsers() {
  const pool = await sql.connect(config);
  const usersToEnsure = [
    { id: 'admin-principal', email: 'admin@kinetix.local', first: 'Admin', last: 'Sistema', role: 'Super Admin' },
    { id: 'kinetix-super-admin', email: 'superadmin@kinetix.local', first: 'Kinetix', last: 'Super Admin', role: 'Super Admin' },
    { id: 'hideki-ariyama', email: 'ariyamahideki1@gmail.com', first: 'Hideki', last: 'Ariyama', role: 'Company Admin' },
    { id: 'ana-martinez', email: 'ana.martinez@kinetix.com', first: 'Ana', last: 'Martínez', role: 'Company Admin' },
    { id: 'director-rrhh', email: 'director.rrhh@kinetix.local', first: 'Sofía', last: 'Valdez (Directora)', role: 'Director de RRHH' },
    { id: 'carlos-gomez', email: 'carlos.gomez@kinetix.com', first: 'Carlos', last: 'Gómez', role: 'Employee' },
    { id: 'carlos-mendoza', email: 'carlos.mendoza@kinetix.local', first: 'Carlos', last: 'Mendoza', role: 'Employee' }
  ];

  for (const u of usersToEnsure) {
    const rRes = await pool.request().input('rName', sql.NVarChar(100), u.role)
      .query('SELECT TOP 1 Id FROM dbo.Roles WHERE Name = @rName');
    const roleId = rRes.recordset[0]?.Id;
    if (!roleId) { console.error('Rol no encontrado:', u.role); continue; }

    const uRes = await pool.request().input('email', sql.NVarChar(254), u.email)
      .query('SELECT TOP 1 UserId FROM dbo.UserOrganizations WHERE Email = @email');
    
    let userId = uRes.recordset[0]?.UserId;
    if (userId) {
      await pool.request()
        .input('userId', sql.NVarChar(450), userId)
        .input('first', sql.NVarChar(100), u.first)
        .input('last', sql.NVarChar(100), u.last)
        .input('passwordHash', sql.NVarChar(500), passwordHash)
        .query('UPDATE dbo.UserOrganizations SET FirstName = @first, LastName = @last, PasswordHash = @passwordHash, IsActive = 1, UpdatedAt = SYSUTCDATETIME() WHERE UserId = @userId');
    } else {
      userId = u.id;
      await pool.request()
        .input('userId', sql.NVarChar(450), userId)
        .input('companyId', sql.Int, 1)
        .input('first', sql.NVarChar(100), u.first)
        .input('last', sql.NVarChar(100), u.last)
        .input('email', sql.NVarChar(254), u.email)
        .input('passwordHash', sql.NVarChar(500), passwordHash)
        .query('INSERT INTO dbo.UserOrganizations (UserId, CompanyId, FirstName, LastName, Email, PasswordHash, IsActive) VALUES (@userId, @companyId, @first, @last, @email, @passwordHash, 1)');
    }

    await pool.request().input('userId', sql.NVarChar(450), userId).query('DELETE FROM dbo.UserRoles WHERE UserId = @userId');
    await pool.request().input('userId', sql.NVarChar(450), userId).input('roleId', sql.Int, roleId)
      .query('INSERT INTO dbo.UserRoles (UserId, RoleId) VALUES (@userId, @roleId)');

    console.log(`✓ Sincronizado: ${u.email} | Rol: ${u.role} | Clave: ${defaultPassword}`);
  }
  await pool.close();
  console.log('Sincronización completada exitosamente.');
}

syncUsers().catch(console.error);
