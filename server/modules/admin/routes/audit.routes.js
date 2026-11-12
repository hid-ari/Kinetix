import { Router } from 'express';
import { requirePermission, isGlobalAdmin } from '../../../core/auth.js';
import { asyncHandler } from '../../../core/http.js';
import { parseAuditFilters } from '../validators.js';
import { AUDIT_LIST_LIMIT, AUDIT_EXPORT_LIMIT, listAuditLogs, toAuditCsv } from '../repositories/audit.repo.js';

const getScope = request => ({
  companyId: request.user.companyId || null,
  isGlobal: isGlobalAdmin(request)
});

export function createAuditRouter() {
  const router = Router();

  router.get('/', requirePermission('Auditoría', 'Ver auditoría'), asyncHandler(async (request, response) => {
    const filters = parseAuditFilters(request.query);
    const rows = await listAuditLogs(filters, getScope(request), AUDIT_LIST_LIMIT);
    response.json(rows);
  }, { fallbackMessage: 'No fue posible cargar la auditoría.' }));

  router.get('/export', requirePermission('Auditoría', 'Ver auditoría'), asyncHandler(async (request, response) => {
    const filters = parseAuditFilters(request.query);
    const rows = await listAuditLogs(filters, getScope(request), AUDIT_EXPORT_LIMIT);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="auditoria-${new Date().toISOString().slice(0, 10)}.csv"`);
    response.send(toAuditCsv(rows));
  }, { fallbackMessage: 'No fue posible exportar la auditoría.' }));

  return router;
}
