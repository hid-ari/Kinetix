import { db } from '../../../core/db.js';
import { notFound } from '../../../core/http.js';
import { SUPER_ADMIN_ROLE } from '../validators.js';

export async function getProfile(userId) {
  const res = await db.query(`
    SELECT u.UserId AS id, u.FirstName AS "firstName", u.LastName AS "lastName",
           u.Email AS email, u.Phone AS phone,
           c.Id AS "companyId", c.Name AS company,
           b.Name AS branch,
           COALESCE(r.Name, 'Empleado') AS role
    FROM UserOrganizations AS u
    INNER JOIN Companies AS c ON c.Id = u.CompanyId
    LEFT JOIN Branches AS b ON b.Id = u.BranchId
    LEFT JOIN LATERAL (
      SELECT r.Name FROM UserRoles AS ur
      INNER JOIN Roles AS r ON r.Id = ur.RoleId
      WHERE ur.UserId = u.UserId ORDER BY r.Name LIMIT 1
    ) AS r ON TRUE
    WHERE u.UserId = @userId;`, { userId });
  const profile = res.recordset[0];
  if (!profile) throw notFound('Perfil no encontrado.');
  return profile;
}

/** Permisos efectivos como claves "Módulo|Permiso". El Super Admin recibe todos. */
export async function getEffectivePermissions(userId, role) {
  const res = role === SUPER_ADMIN_ROLE
    ? await db.query('SELECT ModuleName, PermissionName FROM Permissions;')
    : await db.query(`
        SELECT DISTINCT p.ModuleName, p.PermissionName
        FROM UserRoles AS ur
        INNER JOIN RolePermissions AS rp ON rp.RoleId = ur.RoleId
        INNER JOIN Permissions AS p ON p.Id = rp.PermissionId
        WHERE ur.UserId = @userId;`, { userId });
  return res.recordset.map(p => `${p.ModuleName}|${p.PermissionName}`);
}

export async function updateProfile(userId, { firstName, lastName, email, phone }) {
  const [profile] = await db.update('UserOrganizations', { UserId: userId }, {
    FirstName: firstName, LastName: lastName, Email: email, Phone: phone, UpdatedAt: new Date()
  }, { returning: 'UserId AS id, FirstName AS "firstName", LastName AS "lastName", Email AS email, Phone AS phone' });
  if (!profile) throw notFound('Perfil no encontrado.');
  return profile;
}

