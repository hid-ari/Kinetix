import express from 'express';
import { getCatalogs, getHrSettings, updateHrSettings } from '../repositories/catalogs.repo.js';
import { resolveTargetCompanyId, assertCompanyAccess } from '../access.js';

export function createCatalogsRouter(ctx) {
  const router = express.Router();
  const { pool, requirePermission, writeAudit } = ctx;

  router.get('/catalogs', async (req, res) => {
    try {
      const companyId = resolveTargetCompanyId(req);
      if (companyId) await assertCompanyAccess(pool, req, companyId);
      const catalogs = await getCatalogs(pool, companyId);
      res.json(catalogs);
    } catch (err) {
      console.error('Error fetching HR catalogs:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al obtener catálogos.' });
    }
  });

  router.get('/settings', requirePermission('RRHH Configuración', 'Configurar políticas de RRHH'), async (req, res) => {
    try {
      const companyId = resolveTargetCompanyId(req);
      if (!companyId) return res.status(400).json({ message: 'Se requiere especificar la empresa.' });
      await assertCompanyAccess(pool, req, companyId);
      const settings = await getHrSettings(pool, companyId);
      res.json(settings);
    } catch (err) {
      console.error('Error fetching HR settings:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al obtener configuración de RRHH.' });
    }
  });

  router.put('/settings', requirePermission('RRHH Configuración', 'Configurar políticas de RRHH'), async (req, res) => {
    try {
      const companyId = resolveTargetCompanyId(req);
      if (!companyId) return res.status(400).json({ message: 'Se requiere especificar la empresa.' });
      await assertCompanyAccess(pool, req, companyId);

      const oldSettings = await getHrSettings(pool, companyId);
      await updateHrSettings(pool, companyId, req.body, req.user.userId);

      await writeAudit(req, 'UPDATE', 'RRHH Configuración', 'HrSettings', String(companyId), companyId, {
        oldValues: oldSettings,
        newValues: req.body
      });

      res.json({ message: 'Configuración actualizada correctamente.' });
    } catch (err) {
      console.error('Error updating HR settings:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al guardar configuración.' });
    }
  });

  return router;
}
