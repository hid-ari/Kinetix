import { Router } from 'express';
import { requirePermission, isGlobalAdmin, writeAudit } from '../../../core/auth.js';
import { asyncHandler, badRequest } from '../../../core/http.js';
import { parseUserBody, parseBoolean, assertPassword } from '../validators.js';
import {
  DUPLICATE_EMAIL_MESSAGE,
  listUsers,
  createUser,
  updateUser,
  setUserStatus,
  resetUserPassword,
  deleteUser
} from '../repositories/users.repo.js';

const getScope = request => ({
  companyId: request.user.companyId || null,
  isGlobal: isGlobalAdmin(request)
});

export function createUsersRouter() {
  const router = Router();

  router.get('/', requirePermission('Usuarios', 'Ver usuarios'), asyncHandler(async (request, response) => {
    const page = Math.max(Number(request.query.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(request.query.pageSize) || 20, 1), 100);
    const statusFilter = String(request.query.status || '').trim();
    const { data, total } = await listUsers({ ...getScope(request), page, pageSize, statusFilter });
    response.json({ data, total, page, pageSize });
  }, { fallbackMessage: 'No fue posible cargar los usuarios.' }));

  router.post('/', requirePermission('Usuarios', 'Crear usuarios'), asyncHandler(async (request, response) => {
    const input = parseUserBody(request.body, { isCreate: true });
    const companyId = request.user.companyId || 1;
    const created = await createUser(input, { companyId, isGlobal: isGlobalAdmin(request) });
    await writeAudit(request, 'CREATE', 'Usuarios', 'User', created.id, companyId);
    response.status(201).json(created);
  }, {
    fallbackMessage: 'No fue posible guardar el usuario.',
    duplicateMessage: DUPLICATE_EMAIL_MESSAGE
  }));

  router.patch('/:id/status', requirePermission('Usuarios', 'Desactivar usuarios'), asyncHandler(async (request, response) => {
    const isActive = parseBoolean(request.body?.isActive, 'isActive');
    const updated = await setUserStatus(request.params.id, isActive, getScope(request));
    await writeAudit(request, isActive ? 'ACTIVATE' : 'DEACTIVATE', 'Usuarios', 'User', request.params.id, updated.companyId);
    response.json(updated);
  }, { fallbackMessage: 'No fue posible actualizar el usuario.' }));

  router.put('/:id', requirePermission('Usuarios', 'Editar usuarios'), asyncHandler(async (request, response) => {
    const input = parseUserBody(request.body, { isCreate: false });
    const updated = await updateUser(request.params.id, input, getScope(request));
    await writeAudit(request, 'UPDATE', 'Usuarios', 'User', request.params.id, updated.companyId);
    response.json({
      id: updated.id,
      firstName: updated.firstName,
      lastName: updated.lastName,
      email: updated.email
    });
  }, {
    fallbackMessage: 'No fue posible actualizar el usuario.',
    duplicateMessage: DUPLICATE_EMAIL_MESSAGE
  }));

  router.put('/:id/password', requirePermission('Usuarios', 'Editar usuarios'), asyncHandler(async (request, response) => {
    const newPassword = assertPassword(request.body?.newPassword, { required: true });
    const targetUser = await resetUserPassword(request.params.id, newPassword, getScope(request));
    await writeAudit(request, 'PASSWORD_RESET', 'Usuarios', 'User', request.params.id, targetUser.CompanyId);
    response.json({ message: 'Contraseña actualizada correctamente.' });
  }, { fallbackMessage: 'No fue posible actualizar la contraseña del usuario.' }));

  router.delete('/:id', requirePermission('Usuarios', 'Desactivar usuarios'), asyncHandler(async (request, response) => {
    const targetUserId = String(request.params.id || '').trim();
    if (!targetUserId) throw badRequest('Identificador de usuario inválido.');
    if (request.user.userId === targetUserId) {
      throw badRequest('No puedes eliminar tu propia cuenta de usuario en sesión.');
    }

    const { user, softDeleted } = await deleteUser(targetUserId, getScope(request));
    await writeAudit(request, softDeleted ? 'DEACTIVATE' : 'DELETE', 'Usuarios', 'User', targetUserId, user.CompanyId);

    const fullName = `${user.FirstName} ${user.LastName}`;
    response.json({
      message: softDeleted
        ? `El usuario "${fullName}" cuenta con historial operativo y de auditoría. Se desactivó permanentemente y se revocaron todos sus accesos.`
        : `El usuario "${fullName}" ha sido eliminado exitosamente.`,
      deleted: true,
      softDeleted
    });
  }, { fallbackMessage: 'No fue posible eliminar el usuario.' }));

  return router;
}
