import { Router } from 'express';
import { getPool, sql } from '../../../core/db.js';
import { requireRoleAdministration, isGlobalAdmin, writeAudit } from '../../../core/auth.js';

export function createRolesRouter() {
  const router = Router();

  // Roles CRUD
  router.get('/roles', requireRoleAdministration, async (request, response) => {
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

  router.post('/roles', requireRoleAdministration, async (request, response) => {
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

  router.put('/roles/:id', requireRoleAdministration, async (request, response) => {
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

  router.delete('/roles/:id', requireRoleAdministration, async (request, response) => {
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

  // Permisos
  router.get('/permissions', requireRoleAdministration, async (_request, response) => {
    try {
      const pool = await getPool();
      const result = await pool.request().query('SELECT Id AS id, ModuleName AS module, PermissionName AS name FROM dbo.Permissions ORDER BY ModuleName, PermissionName;');
      response.json(result.recordset);
    } catch (error) {
      console.error('Permissions query failed:', error.message);
      response.status(500).json({ message: 'No fue posible cargar los permisos.' });
    }
  });

  router.get('/roles/:id/permissions', requireRoleAdministration, async (request, response) => {
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

  router.put('/roles/:id/permissions', requireRoleAdministration, async (request, response) => {
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

  return router;
}
