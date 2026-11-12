import { Router } from 'express';
import { requirePermission, requireGlobalAdmin, writeAudit } from '../../../core/auth.js';
import { asyncHandler, parsePositiveInt } from '../../../core/http.js';
import { parseCompanyBody, validateRnc } from '../validators.js';
import { getCompanySummary, updateCompany } from '../repositories/companies.repo.js';

export { validateRnc };

export function createCompaniesRouter() {
  const router = Router();

  router.get('/', requirePermission('Empresas', 'Ver empresas'), asyncHandler(async (request, response) => {
    const companyId = request.user.companyId || 1;
    const data = await getCompanySummary(companyId);
    response.json({
      data,
      total: data.length,
      page: 1,
      pageSize: 1
    });
  }, { fallbackMessage: 'No fue posible cargar la información de la empresa.' }));

  router.put('/:id', requireGlobalAdmin, asyncHandler(async (request, response) => {
    const companyId = parsePositiveInt(request.params.id, 'Empresa');
    const values = parseCompanyBody(request.body);
    const updated = await updateCompany(companyId, values);
    await writeAudit(request, 'UPDATE', 'Empresas', 'Company', companyId, companyId);
    response.json(updated);
  }, {
    fallbackMessage: 'No fue posible actualizar la empresa.',
    duplicateMessage: 'El RNC ya está registrado.'
  }));

  return router;
}
