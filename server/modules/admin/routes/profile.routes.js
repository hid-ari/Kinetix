import { Router } from 'express';
import { getPool, sql } from '../../../core/db.js';

export function createProfileRouter() {
  const router = Router();

  router.get('/', async (request, response) => {
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

  router.put('/', async (request, response) => {
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

  return router;
}
