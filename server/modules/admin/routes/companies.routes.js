import { Router } from 'express';
import { getPool, sql } from '../../../core/db.js';
import { requirePermission, requireGlobalAdmin, isGlobalAdmin, writeAudit } from '../../../core/auth.js';

// B-15/S-05: Validar RNC dominicano (9 u 11 dígitos, solo numéricos — DGII / Ley 253-12)
export function validateRnc(rnc) {
  if (!rnc) return false;
  const digits = rnc.replace(/[^0-9]/g, '');
  return digits.length === 9 || digits.length === 11;
}

export function createCompaniesRouter() {
  const router = Router();

  router.get('/', requirePermission('Empresas', 'Ver empresas'), async (request, response) => {
    try {
      const page = Math.max(Number(request.query.page) || 1, 1);
      const pageSize = Math.min(Math.max(Number(request.query.pageSize) || 20, 1), 100);
      const search = String(request.query.search || '');
      const pool = await getPool();
      const result = await pool.request()
        .input('search', sql.NVarChar(150), `%${search}%`)
        .input('offset', sql.Int, (page - 1) * pageSize)
        .input('pageSize', sql.Int, pageSize)
        .input('companyId', sql.Int, request.user.companyId || null)
        .input('isGlobal', sql.Bit, isGlobalAdmin(request))
        .query(`
          SELECT Id, Name, Rnc, IsActive, CreatedAt,
                 UserCount, BranchCount, ActiveUserCount, InactiveUserCount
          FROM dbo.vw_CompaniesList
          WHERE (@isGlobal = 1 OR Id = @companyId)
            AND (Name LIKE @search OR Rnc LIKE @search)
          ORDER BY Name
          OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;

          SELECT COUNT_BIG(*) AS total
          FROM dbo.Companies
          WHERE (@isGlobal = 1 OR Id = @companyId)
            AND (Name LIKE @search OR Rnc LIKE @search);
        `);
      response.json({
        data: result.recordsets[0],
        total: Number(result.recordsets[1][0].total),
        page,
        pageSize
      });
    } catch (error) {
      console.error('Companies query failed:', error.message);
      response.status(500).json({ message: 'No fue posible cargar las empresas.' });
    }
  });

  router.post('/', requireGlobalAdmin, async (request, response) => {
    const { name, rnc, email, phone, address, status } = request.body;
    if (!name?.trim() || !rnc?.trim() || !email?.trim()) {
      return response.status(400).json({ message: 'Nombre, RNC y email son obligatorios.' });
    }
    if (!validateRnc(rnc)) {
      return response.status(400).json({ message: 'El RNC debe tener 9 u 11 dígitos numéricos (formato DGII).' });
    }
    try {
      const pool = await getPool();
      const result = await pool.request()
        .input('name', sql.NVarChar(150), name.trim())
        .input('rnc', sql.VarChar(20), rnc.replace(/[^0-9]/g, ''))
        .input('email', sql.NVarChar(254), email.trim())
        .input('phone', sql.NVarChar(30), phone?.trim() || null)
        .input('address', sql.NVarChar(300), address?.trim() || null)
        .input('isActive', sql.Bit, status !== 'Inactiva')
        .query(`
          INSERT INTO dbo.Companies (Name, Rnc, ContactEmail, Phone, Address, IsActive)
          OUTPUT INSERTED.Id AS id, INSERTED.Name AS name, INSERTED.Rnc AS rnc,
                 INSERTED.IsActive AS isActive, INSERTED.CreatedAt AS createdAt
          VALUES (@name, @rnc, @email, @phone, @address, @isActive);
        `);
      await writeAudit(request, 'CREATE', 'Empresas', 'Company', result.recordset[0].id);
      response.status(201).json(result.recordset[0]);
    } catch (error) {
      console.error('Company creation failed:', error.message);
      response.status(error.number === 2627 ? 409 : 500).json({ message: error.number === 2627 ? 'El RNC ya está registrado.' : 'No fue posible guardar la empresa.' });
    }
  });

  router.patch('/:id/status', requireGlobalAdmin, async (request, response) => {
    const isActive = request.body?.isActive;
    if (typeof isActive !== 'boolean') return response.status(400).json({ message: 'isActive debe ser booleano.' });
    try {
      const pool = await getPool();
      const result = await pool.request().input('id', sql.Int, Number(request.params.id)).input('isActive', sql.Bit, isActive)
        .query(`UPDATE dbo.Companies SET IsActive = @isActive, UpdatedAt = SYSUTCDATETIME() OUTPUT INSERTED.Id AS id, INSERTED.IsActive AS isActive WHERE Id = @id;`);
      if (!result.recordset[0]) return response.status(404).json({ message: 'Empresa no encontrada.' });
      await writeAudit(request, isActive ? 'ACTIVATE' : 'DEACTIVATE', 'Empresas', 'Company', request.params.id);
      response.json(result.recordset[0]);
    } catch (error) {
      console.error('Company status update failed:', error.message);
      response.status(500).json({ message: 'No fue posible actualizar la empresa.' });
    }
  });

  router.put('/:id', requireGlobalAdmin, async (request, response) => {
    const { name, rnc, email, phone, address } = request.body;
    if (!name?.trim() || !rnc?.trim() || !email?.trim()) return response.status(400).json({ message: 'Nombre, RNC y email son obligatorios.' });
    if (!validateRnc(rnc)) return response.status(400).json({ message: 'El RNC debe tener 9 u 11 dígitos numéricos (formato DGII).' });
    try {
      const pool = await getPool();
      const result = await pool.request().input('id', sql.Int, Number(request.params.id))
        .input('name', sql.NVarChar(150), name.trim()).input('rnc', sql.VarChar(20), rnc.trim())
        .input('email', sql.NVarChar(254), email.trim()).input('phone', sql.NVarChar(30), phone?.trim() || null)
        .input('address', sql.NVarChar(300), address?.trim() || null)
        .query(`UPDATE dbo.Companies SET Name = @name, Rnc = @rnc, ContactEmail = @email, Phone = @phone, Address = @address, UpdatedAt = SYSUTCDATETIME()
                OUTPUT INSERTED.Id AS id, INSERTED.Name AS name, INSERTED.Rnc AS rnc, INSERTED.ContactEmail AS email
                WHERE Id = @id;`);
      if (!result.recordset[0]) return response.status(404).json({ message: 'Empresa no encontrada.' });
      await writeAudit(request, 'UPDATE', 'Empresas', 'Company', request.params.id);
      response.json(result.recordset[0]);
    } catch (error) {
      console.error('Company update failed:', error.message);
      response.status(error.number === 2627 ? 409 : 500).json({ message: error.number === 2627 ? 'El RNC ya está registrado.' : 'No fue posible actualizar la empresa.' });
    }
  });

  return router;
}
