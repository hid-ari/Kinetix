import { Router } from 'express';
import { requirePermission, isGlobalAdmin, writeAudit } from '../../../core/auth.js';
import { asyncHandler, forbidden, parsePositiveInt } from '../../../core/http.js';
import { parseBranchBody, parseBoolean } from '../validators.js';
import {
  listBranches,
  listManagerCandidates,
  listBranchUsers,
  createBranch,
  updateBranch,
  setBranchStatus
} from '../repositories/branches.repo.js';

const getScope = request => ({
  companyId: request.user.companyId || null,
  isGlobal: isGlobalAdmin(request)
});

export function createBranchesRouter() {
  const router = Router();

  router.get('/', requirePermission('Sucursales', 'Ver sucursales'), asyncHandler(async (request, response) => {
    const branches = await listBranches(getScope(request));
    response.json(branches);
  }, { fallbackMessage: 'No fue posible cargar las sucursales.' }));

  router.get('/managers', requirePermission('Sucursales', 'Ver sucursales'), asyncHandler(async (request, response) => {
    const companyId = parsePositiveInt(request.query.companyId || request.user.companyId || 1, 'Empresa');
    if (!isGlobalAdmin(request) && companyId !== Number(request.user.companyId)) {
      throw forbidden('No tienes acceso a esa empresa.');
    }
    const managers = await listManagerCandidates(companyId);
    response.json(managers);
  }, { fallbackMessage: 'No fue posible cargar los posibles encargados.' }));

  router.get('/:id/users', requirePermission('Sucursales', 'Ver sucursales'), asyncHandler(async (request, response) => {
    const branchId = parsePositiveInt(request.params.id, 'Sucursal');
    const users = await listBranchUsers(branchId, getScope(request));
    response.json(users);
  }, { fallbackMessage: 'No fue posible cargar los usuarios de la sucursal.' }));

  router.post('/', requirePermission('Sucursales', 'Crear sucursales'), asyncHandler(async (request, response) => {
    const companyId = parsePositiveInt(request.body?.companyId || request.user?.companyId || 1, 'Empresa');
    const values = parseBranchBody(request.body);
    const created = await createBranch(companyId, values, getScope(request));
    await writeAudit(request, 'CREATE', 'Sucursales', 'Branch', created.id, companyId);
    response.status(201).json(created);
  }, {
    fallbackMessage: 'No fue posible guardar la sucursal.',
    duplicateMessage: 'Ese código ya existe para la empresa.'
  }));

  router.put('/:id', requirePermission('Sucursales', 'Editar sucursales'), asyncHandler(async (request, response) => {
    const branchId = parsePositiveInt(request.params.id, 'Sucursal');
    const values = parseBranchBody(request.body);
    const updated = await updateBranch(branchId, values, getScope(request));
    await writeAudit(request, 'UPDATE', 'Sucursales', 'Branch', branchId, updated.companyId);
    response.json(updated);
  }, {
    fallbackMessage: 'No fue posible actualizar la sucursal.',
    duplicateMessage: 'Ese código ya existe para la empresa.'
  }));

  router.patch('/:id/status', requirePermission('Sucursales', 'Editar sucursales'), asyncHandler(async (request, response) => {
    const branchId = parsePositiveInt(request.params.id, 'Sucursal');
    const isActive = parseBoolean(request.body?.isActive, 'isActive');
    const updated = await setBranchStatus(branchId, isActive, getScope(request));
    await writeAudit(request, isActive ? 'ACTIVATE' : 'DEACTIVATE', 'Sucursales', 'Branch', branchId, updated.companyId);
    response.json(updated);
  }, { fallbackMessage: 'No fue posible actualizar la sucursal.' }));

  return router;
}
