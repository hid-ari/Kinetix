/**
 * Gestión de usuarios desde la terminal (reemplaza create-super-admin, create-user,
 * sync-users y clean-database).
 *
 *   node scripts/users.mjs create <email> <rol> "<Nombre Apellido>"   (NEW_USER_PASSWORD obligatorio)
 *   node scripts/users.mjs seed-dev      usuarios de demostración, clave Admin12345! (solo desarrollo)
 *
 * Si no existe ninguna empresa se crea una por defecto para poder asociar al usuario.
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { db } from '../server/core/db.js';
import { createPasswordHash } from '../server/core/auth.js';

async function ensureCompany(tx) {
  const existing = await tx.query('SELECT Id FROM Companies WHERE IsActive ORDER BY Id LIMIT 1;');
  if (existing.recordset[0]) return existing.recordset[0].Id;
  const created = await tx.query(
    `INSERT INTO Companies (Name, Rnc) VALUES ('Kinetix', '000-00000-0') RETURNING Id;`);
  console.log('Empresa por defecto creada: Kinetix');
  return created.recordset[0].Id;
}

async function upsertUser({ email, role, firstName, lastName, password, userId }) {
  await db.withTransaction(async tx => {
    const roleRow = (await tx.query('SELECT Id FROM Roles WHERE Name = @role;', { role })).recordset[0];
    if (!roleRow) throw new Error(`Rol no encontrado: ${role}`);
    const companyId = await ensureCompany(tx);
    const existing = (await tx.query('SELECT UserId FROM UserOrganizations WHERE Email = @email;', { email })).recordset[0];
    const id = existing?.UserId || userId || crypto.randomUUID();
    const passwordHash = createPasswordHash(password);
    if (existing) {
      await tx.query(`UPDATE UserOrganizations SET FirstName = @firstName, LastName = @lastName,
        PasswordHash = @passwordHash, IsActive = TRUE, UpdatedAt = now() WHERE UserId = @id;`,
      { id, firstName, lastName, passwordHash });
    } else {
      await tx.query(`INSERT INTO UserOrganizations (UserId, CompanyId, FirstName, LastName, Email, PasswordHash)
        VALUES (@id, @companyId, @firstName, @lastName, @email, @passwordHash);`,
      { id, companyId, firstName, lastName, email, passwordHash });
    }
    await tx.query('DELETE FROM UserRoles WHERE UserId = @id;', { id });
    await tx.query('INSERT INTO UserRoles (UserId, RoleId) VALUES (@id, @roleId);', { id, roleId: roleRow.Id });
  });
  console.log(`✓ ${email} | ${role}`);
}

const [command, ...args] = process.argv.slice(2);
try {
  if (command === 'create') {
    const [email, role, fullName = ''] = args;
    const password = process.env.NEW_USER_PASSWORD;
    if (!email || !role || !password || password.length < 10) {
      throw new Error('Uso: NEW_USER_PASSWORD=<10+ caracteres> node scripts/users.mjs create <email> <rol> "<Nombre Apellido>"');
    }
    const [firstName, ...rest] = fullName.split(' ');
    await upsertUser({ email, role, firstName: firstName || email, lastName: rest.join(' ') || '-', password });
  } else if (command === 'seed-dev') {
    const password = 'Admin12345!';
    for (const [email, role, firstName, lastName, userId] of [
      ['admin@kinetix.local', 'Super Admin', 'Admin', 'Sistema', 'admin-principal'],
      ['superadmin@kinetix.local', 'Super Admin', 'Kinetix', 'Super Admin', 'kinetix-super-admin'],
      ['ana.martinez@kinetix.com', 'Company Admin', 'Ana', 'Martínez', 'ana-martinez'],
      ['director.rrhh@kinetix.local', 'Director de RRHH', 'Sofía', 'Valdez (Directora)', 'director-rrhh'],
      ['carlos.gomez@kinetix.com', 'Employee', 'Carlos', 'Gómez', 'carlos-gomez'],
      ['carlos.mendoza@kinetix.local', 'Employee', 'Carlos', 'Mendoza', 'carlos-mendoza']
    ]) await upsertUser({ email, role, firstName, lastName, password, userId });
    console.log(`Usuarios de desarrollo listos. Clave: ${password}`);
  } else {
    throw new Error('Comandos: create | seed-dev');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
