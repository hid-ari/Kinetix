import { Router } from 'express';
import { asyncHandler } from '../../../core/http.js';
import { parseProfileBody, SUPER_ADMIN_ROLE } from '../validators.js';
import { getProfile, getEffectivePermissions, updateProfile } from '../repositories/profile.repo.js';

export function createProfileRouter() {
  const router = Router();

  router.get('/', asyncHandler(async (request, response) => {
    const profile = await getProfile(request.user.userId);
    const isSuperAdmin = request.user.role === SUPER_ADMIN_ROLE || profile.role === SUPER_ADMIN_ROLE;
    const isCompanyAdmin = isSuperAdmin || profile.role === 'Company Admin';
    const permissions = await getEffectivePermissions(request.user.userId, isSuperAdmin ? SUPER_ADMIN_ROLE : profile.role);

    response.json({
      ...profile,
      isSuperAdmin,
      isCompanyAdmin,
      permissions
    });
  }, { fallbackMessage: 'No fue posible cargar el perfil.' }));

  router.put('/', asyncHandler(async (request, response) => {
    const values = parseProfileBody(request.body);
    const updated = await updateProfile(request.user.userId, values);
    response.json(updated);
  }, {
    fallbackMessage: 'No fue posible guardar el perfil.',
    duplicateMessage: 'Ese email ya está registrado.'
  }));

  return router;
}
