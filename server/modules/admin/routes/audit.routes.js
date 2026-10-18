import { Router } from 'express';
import { getPool, sql } from '../../../core/db.js';
import { requirePermission, isGlobalAdmin } from '../../../core/auth.js';

export function createAuditRouter() {
  const router = Router();

  router.get('/', requirePermission('Auditoría', 'Ver auditoría'), async (request, response) => {
    try {
      const pool = await getPool();
      const query = String(request.query.search || '').trim();
      const moduleName = String(request.query.module || '').trim();
      const actionName = String(request.query.action || '').trim();
      const auditRequest = pool.request().input('search', sql.NVarChar(200), `%${query}%`)
        .input('module', sql.NVarChar(80), moduleName || null).input('action', sql.NVarChar(40), actionName || null)
        .input('companyId', sql.Int, request.user.companyId || null)
        .input('isGlobal', sql.Bit, isGlobalAdmin(request));
      const result = await auditRequest.query(`
        SELECT a.Id AS id, a.CreatedAt, a.ActionName AS action,
               a.ModuleName AS module, a.EntityName AS entity,
               a.EntityId AS record, a.IpAddress AS ip,
               COALESCE(CONCAT(u.FirstName, N' ', u.LastName), N'Sistema') AS userName
        FROM dbo.AuditLogs AS a
        LEFT JOIN dbo.UserOrganizations AS u ON u.UserId = a.UserId
        WHERE (@isGlobal = 1 OR a.CompanyId = @companyId)
          AND (@search = '%%' OR CONCAT(COALESCE(u.FirstName, N''), N' ', COALESCE(u.LastName, N''), N' ', COALESCE(a.EntityId, N'')) LIKE @search)
          AND (@module IS NULL OR a.ModuleName = @module)
          AND (@action IS NULL OR a.ActionName = @action)
        ORDER BY a.CreatedAt DESC;
      `);
      response.json(result.recordset);
    } catch (error) {
      console.error('Audit query failed:', error.message);
      response.status(500).json({ message: 'No fue posible cargar la auditoría.' });
    }
  });

  // M-07: Exportación de auditoría a CSV
  router.get('/export', requirePermission('Auditoría', 'Ver auditoría'), async (request, response) => {
    try {
      const pool = await getPool();
      const query = String(request.query.search || '').trim();
      const moduleName = String(request.query.module || '').trim();
      const actionName = String(request.query.action || '').trim();
      const auditRequest = pool.request()
        .input('search', sql.NVarChar(200), `%${query}%`)
        .input('module', sql.NVarChar(80), moduleName || null)
        .input('action', sql.NVarChar(40), actionName || null)
        .input('companyId', sql.Int, request.user.companyId || null)
        .input('isGlobal', sql.Bit, isGlobalAdmin(request));
      const result = await auditRequest.query(`
        SELECT a.Id AS id, a.CreatedAt, a.ActionName AS action,
               a.ModuleName AS module, a.EntityName AS entity,
               a.EntityId AS record, a.IpAddress AS ip,
               COALESCE(CONCAT(u.FirstName, N' ', u.LastName), N'Sistema') AS userName
        FROM dbo.AuditLogs AS a
        LEFT JOIN dbo.UserOrganizations AS u ON u.UserId = a.UserId
        WHERE (@isGlobal = 1 OR a.CompanyId = @companyId)
          AND (@search = '%%' OR CONCAT(COALESCE(u.FirstName, N''), N' ', COALESCE(u.LastName, N''), N' ', COALESCE(a.EntityId, N'')) LIKE @search)
          AND (@module IS NULL OR a.ModuleName = @module)
          AND (@action IS NULL OR a.ActionName = @action)
        ORDER BY a.CreatedAt DESC;
      `);
      const rows = result.recordset;
      const header = 'ID,Fecha,Usuario,Acción,Módulo,Entidad,Registro,IP\n';
      const csvEscape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = header + rows.map(r =>
        [r.id, r.CreatedAt?.toISOString() ?? '', r.userName, r.action, r.module, r.entity, r.record, r.ip]
          .map(csvEscape).join(',')
      ).join('\n');
      response.setHeader('Content-Type', 'text/csv; charset=utf-8');
      response.setHeader('Content-Disposition', `attachment; filename="auditoria-${new Date().toISOString().slice(0, 10)}.csv"`);
      response.send('\uFEFF' + csv); // BOM para Excel
    } catch (error) {
      console.error('Audit export failed:', error.message);
      response.status(500).json({ message: 'No fue posible exportar la auditoría.' });
    }
  });

  return router;
}
