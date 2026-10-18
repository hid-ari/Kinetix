import { Router } from 'express';
import crypto from 'node:crypto';
import { getPool, sql } from '../../../core/db.js';
import { requirePermission, isGlobalAdmin, writeAudit } from '../../../core/auth.js';

export function createUsersRouter() {
  const router = Router();

  router.get('/', requirePermission('Usuarios', 'Ver usuarios'), async (request, response) => {
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

  router.post('/', requirePermission('Usuarios', 'Crear usuarios'), async (request, response) => {
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

  router.patch('/:id/status', requirePermission('Usuarios', 'Desactivar usuarios'), async (request, response) => {
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

  router.put('/:id', requirePermission('Usuarios', 'Editar usuarios'), async (request, response) => {
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

  router.put('/:id/password', requirePermission('Usuarios', 'Editar usuarios'), async (request, response) => {
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

  return router;
}
