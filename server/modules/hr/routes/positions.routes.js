import express from 'express';
import {
  listPositions,
  getPositionById,
  createPosition,
  updatePosition,
  togglePositionStatus
} from '../repositories/positions.repo.js';
import { resolveTargetCompanyId, assertCompanyAccess } from '../access.js';
import { validateSalaryRange } from '../validators.js';

export function createPositionsRouter(ctx) {
  const router = express.Router();
  const { pool, requirePermission, writeAudit } = ctx;

  router.get('/positions', requirePermission('RRHH Estructura', 'Ver estructura'), async (req, res) => {
    try {
      const companyId = resolveTargetCompanyId(req);
      if (!companyId) return res.status(400).json({ message: 'Se requiere especificar la empresa.' });
      await assertCompanyAccess(pool, req, companyId);

      const filters = {
        departmentId: req.query.departmentId,
        isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
        search: req.query.search
      };

      const positions = await listPositions(pool, companyId, filters);
      res.json(positions);
    } catch (err) {
      console.error('Error listing positions:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al listar cargos.' });
    }
  });

  router.get('/positions/:id', requirePermission('RRHH Estructura', 'Ver estructura'), async (req, res) => {
    try {
      const pos = await getPositionById(pool, req.params.id);
      if (!pos) return res.status(404).json({ message: 'Cargo no encontrado.' });
      await assertCompanyAccess(pool, req, pos.CompanyId);
      res.json(pos);
    } catch (err) {
      console.error('Error getting position:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al obtener cargo.' });
    }
  });

  router.post('/positions', requirePermission('RRHH Estructura', 'Administrar departamentos y cargos'), async (req, res) => {
    try {
      const companyId = resolveTargetCompanyId(req);
      if (!companyId) return res.status(400).json({ message: 'Se requiere especificar la empresa.' });
      await assertCompanyAccess(pool, req, companyId);

      const { code, title, departmentId, description, responsibilities, hierarchyLevel, salaryMin, salaryMax } = req.body;
      if (!code?.trim() || !title?.trim() || !departmentId) {
        return res.status(400).json({ message: 'Código, título y departamento son obligatorios.' });
      }

      const salaryCheck = validateSalaryRange(salaryMin, salaryMax);
      if (!salaryCheck.valid) {
        return res.status(400).json({ message: salaryCheck.message });
      }

      const created = await createPosition(pool, {
        companyId,
        departmentId,
        code,
        title,
        description,
        responsibilities,
        hierarchyLevel,
        salaryMin,
        salaryMax
      }, req.user.userId);

      await writeAudit(req, 'CREATE', 'RRHH Estructura', 'HrPosition', String(created.Id), companyId, {
        newValues: req.body
      });

      res.status(201).json(created);
    } catch (err) {
      console.error('Error creating position:', err);
      res.status(err.number === 2627 ? 409 : (err.status || 500)).json({
        message: err.number === 2627 ? 'Ya existe un cargo con ese código en esta empresa.' : (err.message || 'Error al crear cargo.')
      });
    }
  });

  router.put('/positions/:id', requirePermission('RRHH Estructura', 'Administrar departamentos y cargos'), async (req, res) => {
    try {
      const pos = await getPositionById(pool, req.params.id);
      if (!pos) return res.status(404).json({ message: 'Cargo no encontrado.' });
      await assertCompanyAccess(pool, req, pos.CompanyId);

      const { code, title, departmentId, description, responsibilities, hierarchyLevel, salaryMin, salaryMax } = req.body;
      if (!code?.trim() || !title?.trim() || !departmentId) {
        return res.status(400).json({ message: 'Código, título y departamento son obligatorios.' });
      }

      const salaryCheck = validateSalaryRange(salaryMin, salaryMax);
      if (!salaryCheck.valid) {
        return res.status(400).json({ message: salaryCheck.message });
      }

      const updated = await updatePosition(pool, pos.Id, {
        departmentId,
        code,
        title,
        description,
        responsibilities,
        hierarchyLevel,
        salaryMin,
        salaryMax
      }, req.user.userId);

      await writeAudit(req, 'UPDATE', 'RRHH Estructura', 'HrPosition', String(pos.Id), pos.CompanyId, {
        oldValues: pos,
        newValues: req.body
      });

      res.json(updated);
    } catch (err) {
      console.error('Error updating position:', err);
      res.status(err.number === 2627 ? 409 : (err.status || 500)).json({
        message: err.number === 2627 ? 'Ya existe un cargo con ese código en esta empresa.' : (err.message || 'Error al actualizar cargo.')
      });
    }
  });

  router.patch('/positions/:id/status', requirePermission('RRHH Estructura', 'Administrar departamentos y cargos'), async (req, res) => {
    try {
      const pos = await getPositionById(pool, req.params.id);
      if (!pos) return res.status(404).json({ message: 'Cargo no encontrado.' });
      await assertCompanyAccess(pool, req, pos.CompanyId);

      const isActive = req.body?.isActive;
      if (typeof isActive !== 'boolean') return res.status(400).json({ message: 'isActive debe ser booleano.' });

      const updated = await togglePositionStatus(pool, pos.Id, isActive, req.user.userId);

      await writeAudit(req, isActive ? 'ACTIVATE' : 'DEACTIVATE', 'RRHH Estructura', 'HrPosition', String(pos.Id), pos.CompanyId);

      res.json(updated);
    } catch (err) {
      console.error('Error toggling position status:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al cambiar estado del cargo.' });
    }
  });

  return router;
}
