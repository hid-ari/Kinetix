import { Router } from 'express';
import { getPool, sql } from '../../../core/db.js';
import { requirePermission, isGlobalAdmin, writeAudit } from '../../../core/auth.js';

export function createBranchesRouter() {
  const router = Router();

  router.get('/', requirePermission('Sucursales', 'Ver sucursales'), async (request, response) => {
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

  router.post('/', requirePermission('Sucursales', 'Crear sucursales'), async (request, response) => {
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
  router.put('/:id', requirePermission('Sucursales', 'Editar sucursales'), async (request, response) => {
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
  router.patch('/:id/status', requirePermission('Sucursales', 'Editar sucursales'), async (request, response) => {
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

  return router;
}
