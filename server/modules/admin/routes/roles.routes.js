import { Router } from 'express';
import { requireRoleAdministration, isGlobalAdmin, writeAudit } from '../../../core/auth.js';
import { asyncHandler, badRequest, parsePositiveInt } from '../../../core/http.js';
import { parsePermissionIds } from '../validators.js';
import {
  listRoles,
  listPermissions,
  getRolePermissionIds,
  createRole,
  updateRole,
  setRolePermissions,
  deleteRole
} from '../repositories/roles.repo.js';

export function createRolesRouter() {
  const router = Router();

  router.get('/roles', requireRoleAdministration, asyncHandler(async (request, response) => {
    const roles = await listRoles({ isGlobal: isGlobalAdmin(request) });
    response.json(roles);
  }, { fallbackMessage: 'No fue posible cargar los roles.' }));

  router.post('/roles', requireRoleAdministration, asyncHandler(async (request, response) => {
    const { name, description, roleType = 'Personalizado', permissionIds } = request.body || {};
    if (!name?.trim()) throw badRequest('El nombre del rol es obligatorio.');

    const created = await createRole({
      name: name.trim(),
      description: description?.trim() || null,
      roleType,
      permissionIds: parsePermissionIds(permissionIds)
    }, isGlobalAdmin(request));

    await writeAudit(request, 'CREATE', 'Roles', 'Role', created.id);
    response.status(201).json(created);
  }, {
    fallbackMessage: 'No fue posible guardar el rol.',
    duplicateMessage: 'Ya existe un rol con ese nombre.'
  }));

  router.put('/roles/:id', requireRoleAdministration, asyncHandler(async (request, response) => {
    const roleId = parsePositiveInt(request.params.id, 'ID de rol');
    const { name, description, permissionIds } = request.body || {};

    const updated = await updateRole(roleId, {
      name: name?.trim() || undefined,
      description: description !== undefined ? (description?.trim() || null) : undefined,
      permissionIds: parsePermissionIds(permissionIds)
    }, isGlobalAdmin(request));

    await writeAudit(request, 'UPDATE', 'Roles', 'Role', roleId);
    response.json(updated);
  }, {
    fallbackMessage: 'No fue posible actualizar el rol.',
    duplicateMessage: 'Ya existe otro rol con ese nombre.'
  }));

  router.delete('/roles/:id', requireRoleAdministration, asyncHandler(async (request, response) => {
    const roleId = parsePositiveInt(request.params.id, 'ID de rol');
    const deleted = await deleteRole(roleId, isGlobalAdmin(request));
    await writeAudit(request, 'DELETE', 'Roles', 'Role', roleId);
    response.json({ message: `Rol "${deleted.Name}" eliminado exitosamente.` });
  }, { fallbackMessage: 'No fue posible eliminar el rol.' }));

  router.get('/permissions', requireRoleAdministration, asyncHandler(async (_request, response) => {
    const permissions = await listPermissions();
    response.json(permissions);
  }, { fallbackMessage: 'No fue posible cargar los permisos.' }));

  router.get('/roles/:id/permissions', requireRoleAdministration, asyncHandler(async (request, response) => {
    const roleId = parsePositiveInt(request.params.id, 'ID de rol');
    const permissionIds = await getRolePermissionIds(roleId, isGlobalAdmin(request));
    response.json(permissionIds);
  }, { fallbackMessage: 'No fue posible cargar los permisos del rol.' }));

  router.put('/roles/:id/permissions', requireRoleAdministration, asyncHandler(async (request, response) => {
    const roleId = parsePositiveInt(request.params.id, 'ID de rol');
    const permissionIds = parsePermissionIds(request.body?.permissionIds);
    if (!permissionIds) throw badRequest('permissionIds debe ser un arreglo.');

    await setRolePermissions(roleId, permissionIds, isGlobalAdmin(request));
    await writeAudit(request, 'UPDATE', 'Roles', 'RolePermissions', roleId);
    response.status(204).end();
  }, { fallbackMessage: 'No fue posible guardar los permisos del rol.' }));

  return router;
}
