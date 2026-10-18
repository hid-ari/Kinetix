import 'dotenv/config';
import crypto from 'node:crypto';
import sql from 'mssql/msnodesqlv8.js';

const server = process.env.DB_SERVER || '(localdb)\\MSSQLLocalDB';
const database = process.env.DB_DATABASE || 'KinetixCore';

const config = {
  server,
  database,
  connectionString: `Driver={ODBC Driver 18 for SQL Server};Server=${server};Database=${database};Trusted_Connection=Yes;Encrypt=No;TrustServerCertificate=Yes;`,
  driver: 'msnodesqlv8',
  options: { trustedConnection: true, trustServerCertificate: true }
};

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha512');
  return ['pbkdf2', 'sha512', '310000', salt.toString('base64'), hash.toString('base64')].join('$');
}

async function runQuery(pool, queryString, inputs = {}) {
  const req = pool.request();
  for (const [key, val] of Object.entries(inputs)) {
    req.input(key, val.type, val.value);
  }
  return await req.query(queryString);
}

export async function cleanDatabase() {
  console.log('--- Iniciando limpieza y configuración de la base de datos ---');
  const pool = await sql.connect(config);

  try {
    // 1. Limpieza de tablas operativas (respetando dependencias FK)
    console.log('1. Limpiando sesiones y registros operativos de prueba...');
    const cleanupQueries = [
      'DELETE FROM dbo.UserSessions',
      'DELETE FROM dbo.HrNotifications',
      'DELETE FROM dbo.HrLeaveRequests',
      'DELETE FROM dbo.HrVacationRequests',
      'DELETE FROM dbo.HrAttendanceCorrections',
      'DELETE FROM dbo.HrApprovalHistory',
      'DELETE FROM dbo.HrApprovalRequests',
      'DELETE FROM dbo.HrAttendance',
      'DELETE FROM dbo.HrEmployeeDocuments',
      'DELETE FROM dbo.HrEmergencyContacts',
      'DELETE FROM dbo.HrEmployeeShifts',
      'DELETE FROM dbo.HrAccessScopes'
    ];

    for (const q of cleanupQueries) {
      await runQuery(pool, q);
    }

    // 2. Limpieza de movimientos de empleados con trigger inmutable
    console.log('2. Limpiando movimientos inmutables...');
    await runQuery(pool, 'DISABLE TRIGGER TR_HrEmployeeMovements_Immutable ON dbo.HrEmployeeMovements');
    await runQuery(pool, 'DELETE FROM dbo.HrEmployeeMovements');
    await runQuery(pool, 'ENABLE TRIGGER TR_HrEmployeeMovements_Immutable ON dbo.HrEmployeeMovements');

    // 3. Limpieza de saldos de vacaciones y empleados
    console.log('3. Limpiando empleados y saldos de vacaciones...');
    await runQuery(pool, 'DELETE FROM dbo.HrVacationBalances');
    await runQuery(pool, 'UPDATE dbo.HrDepartments SET ManagerEmployeeId = NULL');
    await runQuery(pool, 'DELETE FROM dbo.HrEmployees');

    // 4. Limpieza de archivos temporales
    console.log('4. Limpiando archivos temporales...');
    await runQuery(pool, `
      DELETE FROM dbo.HrFiles WHERE Id NOT IN (SELECT PhotoFileId FROM dbo.HrEmployees WHERE PhotoFileId IS NOT NULL)
    `);

    // 5. Limpieza de cargos y departamentos de prueba
    console.log('5. Limpiando departamentos y cargos de prueba...');
    await runQuery(pool, "DELETE FROM dbo.HrPositions WHERE Code LIKE 'POS-%'");
    await runQuery(pool, "DELETE FROM dbo.HrDepartments WHERE Code LIKE 'DEP-TEST-%' OR Code LIKE 'SUB-%'");

    // 6. Limpieza de logs de auditoría de prueba
    console.log('6. Limpiando logs de auditoría de prueba...');
    await runQuery(pool, 'DISABLE TRIGGER TR_AuditLogs_Immutable ON dbo.AuditLogs');
    await runQuery(pool, "DELETE FROM dbo.AuditLogs WHERE EntityId LIKE '%test%' OR UserId LIKE '%test%'");
    await runQuery(pool, 'ENABLE TRIGGER TR_AuditLogs_Immutable ON dbo.AuditLogs');

    // 7. Configuración de Roles Esenciales del Sistema (Inmutables/Protegidos)
    console.log('7. Configurando roles esenciales del sistema...');
    
    const systemRoles = [
      { name: 'Super Admin', description: 'Acceso total y global a todas las empresas, configuraciones y módulos de la plataforma.' },
      { name: 'Company Admin', description: 'Administrador principal de la empresa, sucursales y gestión de usuarios.' },
      { name: 'Director de RRHH', description: 'Dirección de gestión de recursos humanos, expedientes, salarios y políticas.' },
      { name: 'Analista de RRHH', description: 'Operación diaria de expedientes, asistencia y movimientos sin acceso salarial.' },
      { name: 'Encargado de Nómina', description: 'Gestión y consulta de empleados, contratos y salarios para procesamiento de nómina.' },
      { name: 'Supervisor', description: 'Supervisión de equipos, turnos, aprobación de permisos y asistencia de su personal.' },
      { name: 'Manager', description: 'Gestión operativa de sucursal, inventario y transacciones financieras.' },
      { name: 'Employee', description: 'Autoservicio del empleado: marcaje de asistencia, solicitudes y perfil personal.' }
    ];

    for (const role of systemRoles) {
      await runQuery(pool, `
        IF EXISTS (SELECT 1 FROM dbo.Roles WHERE Name = @name)
        BEGIN
          UPDATE dbo.Roles 
          SET RoleType = 'Sistema', Description = @description, IsActive = 1
          WHERE Name = @name;
        END
        ELSE
        BEGIN
          INSERT INTO dbo.Roles (Name, Description, RoleType, IsActive)
          VALUES (@name, @description, 'Sistema', 1);
        END
      `, {
        name: { type: sql.NVarChar(100), value: role.name },
        description: { type: sql.NVarChar(300), value: role.description }
      });
    }

    // 8. Asignación de permisos a roles esenciales
    console.log('8. Asignando permisos a roles esenciales...');
    // Permisos completos para Super Admin y Company Admin
    await runQuery(pool, `
      INSERT INTO dbo.RolePermissions (RoleId, PermissionId)
      SELECT r.Id, p.Id
      FROM dbo.Roles r
      CROSS JOIN dbo.Permissions p
      WHERE r.Name IN ('Super Admin', 'Company Admin')
        AND NOT EXISTS (
          SELECT 1 FROM dbo.RolePermissions rp
          WHERE rp.RoleId = r.Id AND rp.PermissionId = p.Id
        )
    `);

    // 9. Configuración del único usuario: Super Admin (superadmin@kinetix.local)
    console.log('9. Configurando usuario único: Super Admin (superadmin@kinetix.local)...');
    const defaultPassword = 'Admin12345!';
    const passwordHash = hashPassword(defaultPassword);
    const superAdminUserId = 'kinetix-super-admin';
    const superAdminEmail = 'superadmin@kinetix.local';

    // Asegurar que el usuario superadmin exista en UserOrganizations
    await runQuery(pool, `
      IF EXISTS (SELECT 1 FROM dbo.UserOrganizations WHERE UserId = @userId OR Email = @email)
      BEGIN
        UPDATE dbo.UserOrganizations
        SET UserId = @userId, CompanyId = @companyId, FirstName = @firstName, LastName = @lastName,
            Email = @email, PasswordHash = @passwordHash, IsActive = 1, UpdatedAt = SYSUTCDATETIME()
        WHERE UserId = @userId OR Email = @email;
      END
      ELSE
      BEGIN
        INSERT INTO dbo.UserOrganizations (UserId, CompanyId, FirstName, LastName, Email, PasswordHash, IsActive)
        VALUES (@userId, @companyId, @firstName, @lastName, @email, @passwordHash, 1);
      END
    `, {
      userId: { type: sql.NVarChar(450), value: superAdminUserId },
      companyId: { type: sql.Int, value: 1 },
      firstName: { type: sql.NVarChar(100), value: 'Kinetix' },
      lastName: { type: sql.NVarChar(100), value: 'Super Admin' },
      email: { type: sql.NVarChar(254), value: superAdminEmail },
      passwordHash: { type: sql.NVarChar(500), value: passwordHash }
    });

    // Reasignar referencias FK a usuarios antes de eliminar los demás
    await runQuery(pool, `UPDATE dbo.HrFiles SET UploadedBy = @userId WHERE UploadedBy <> @userId;`, {
      userId: { type: sql.NVarChar(450), value: superAdminUserId }
    });
    await runQuery(pool, `UPDATE dbo.InventoryMovements SET CreatedBy = @userId WHERE CreatedBy <> @userId;`, {
      userId: { type: sql.NVarChar(450), value: superAdminUserId }
    });
    await runQuery(pool, `UPDATE dbo.FinanceTransactions SET CreatedBy = @userId WHERE CreatedBy <> @userId;`, {
      userId: { type: sql.NVarChar(450), value: superAdminUserId }
    });
    await runQuery(pool, `UPDATE dbo.FinanceInvoices SET CreatedBy = @userId WHERE CreatedBy <> @userId;`, {
      userId: { type: sql.NVarChar(450), value: superAdminUserId }
    });
    await runQuery(pool, `UPDATE dbo.FinancePayments SET CreatedBy = @userId WHERE CreatedBy <> @userId;`, {
      userId: { type: sql.NVarChar(450), value: superAdminUserId }
    });
    await runQuery(pool, `UPDATE dbo.FinanceBankTransactions SET ReconciledBy = NULL;`);
    await runQuery(pool, `UPDATE dbo.HrApprovalSteps SET ApproverUserId = NULL;`);

    await runQuery(pool, 'DISABLE TRIGGER TR_HrEmployeeMovements_Immutable ON dbo.HrEmployeeMovements');
    await runQuery(pool, `UPDATE dbo.HrEmployeeMovements SET CreatedBy = @userId WHERE CreatedBy <> @userId;`, {
      userId: { type: sql.NVarChar(450), value: superAdminUserId }
    });
    await runQuery(pool, 'ENABLE TRIGGER TR_HrEmployeeMovements_Immutable ON dbo.HrEmployeeMovements');

    await runQuery(pool, 'DISABLE TRIGGER TR_AuditLogs_Immutable ON dbo.AuditLogs');
    await runQuery(pool, `UPDATE dbo.AuditLogs SET UserId = @userId WHERE UserId <> @userId;`, {
      userId: { type: sql.NVarChar(450), value: superAdminUserId }
    });
    await runQuery(pool, 'ENABLE TRIGGER TR_AuditLogs_Immutable ON dbo.AuditLogs');

    // 10. Eliminar todos los demás usuarios de UserRoles y UserOrganizations
    console.log('10. Eliminando todos los demás usuarios...');
    await runQuery(pool, `DELETE FROM dbo.UserRoles WHERE UserId <> @userId;`, {
      userId: { type: sql.NVarChar(450), value: superAdminUserId }
    });
    await runQuery(pool, `DELETE FROM dbo.UserOrganizations WHERE UserId <> @userId;`, {
      userId: { type: sql.NVarChar(450), value: superAdminUserId }
    });

    // 11. Asegurar rol Super Admin (RoleId = 1) asignado al único usuario
    const superAdminRoleRes = await runQuery(pool, "SELECT Id FROM dbo.Roles WHERE Name = 'Super Admin'");
    const superAdminRoleId = superAdminRoleRes.recordset[0]?.Id || 1;

    await runQuery(pool, `
      DELETE FROM dbo.UserRoles WHERE UserId = @userId;
      INSERT INTO dbo.UserRoles (UserId, RoleId) VALUES (@userId, @roleId);
    `, {
      userId: { type: sql.NVarChar(450), value: superAdminUserId },
      roleId: { type: sql.Int, value: superAdminRoleId }
    });

    console.log('--- Limpieza y configuración completada con éxito ---');
    console.log('Único usuario en la base de datos:');
    console.log(`  Super Admin: ${superAdminEmail} / ${defaultPassword}`);
    console.log('Roles del Sistema (Inmutables): Super Admin, Company Admin, Director de RRHH, Analista de RRHH, Encargado de Nómina, Supervisor, Manager, Employee');

  } catch (error) {
    console.error('Error durante la limpieza de base de datos:', error);
    throw error;
  } finally {
    await pool.close();
  }
}

cleanDatabase();
