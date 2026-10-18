import express from 'express';
import {
  listDepartments,
  getDepartmentById,
  checkDepartmentCycle,
  createDepartment,
  updateDepartment,
  toggleDepartmentStatus,
  deleteDepartment
} from '../repositories/departments.repo.js';
import { resolveTargetCompanyId, assertCompanyAccess } from '../access.js';

export function createDepartmentsRouter(ctx) {
  const router = express.Router();
  const { pool, requirePermission, writeAudit } = ctx;

  router.get('/departments', requirePermission('RRHH Estructura', 'Ver estructura'), async (req, res) => {
    try {
      const companyId = resolveTargetCompanyId(req);
      if (!companyId) return res.status(400).json({ message: 'Se requiere especificar la empresa.' });
      await assertCompanyAccess(pool, req, companyId);

      const filters = {
        branchId: req.query.branchId,
        isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
        search: req.query.search
      };

      const depts = await listDepartments(pool, companyId, filters);
      res.json(depts);
    } catch (err) {
      console.error('Error listing departments:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al listar departamentos.' });
    }
  });

  router.get('/departments/:id', requirePermission('RRHH Estructura', 'Ver estructura'), async (req, res) => {
    try {
      const dept = await getDepartmentById(pool, req.params.id);
      if (!dept) return res.status(404).json({ message: 'Departamento no encontrado.' });
      await assertCompanyAccess(pool, req, dept.CompanyId);
      res.json(dept);
    } catch (err) {
      console.error('Error getting department:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al obtener departamento.' });
    }
  });

  router.post('/departments', requirePermission('RRHH Estructura', 'Administrar departamentos y cargos'), async (req, res) => {
    try {
      const companyId = resolveTargetCompanyId(req);
      if (!companyId) return res.status(400).json({ message: 'Se requiere especificar la empresa.' });
      await assertCompanyAccess(pool, req, companyId);

      const { code, name, branchId, parentDepartmentId, description, managerEmployeeId } = req.body;
      if (!code?.trim() || !name?.trim()) {
        return res.status(400).json({ message: 'El código y el nombre del departamento son obligatorios.' });
      }

      const created = await createDepartment(pool, {
        companyId,
        branchId,
        parentDepartmentId,
        code,
        name,
        description,
        managerEmployeeId
      }, req.user.userId);

      await writeAudit(req, 'CREATE', 'RRHH Estructura', 'HrDepartment', String(created.Id), companyId, {
        newValues: req.body
      });

      res.status(201).json(created);
    } catch (err) {
      console.error('Error creating department:', err);
      res.status(err.number === 2627 ? 409 : (err.status || 500)).json({
        message: err.number === 2627 ? 'Ya existe un departamento con ese código en esta empresa.' : (err.message || 'Error al crear departamento.')
      });
    }
  });

  router.put('/departments/:id', requirePermission('RRHH Estructura', 'Administrar departamentos y cargos'), async (req, res) => {
    try {
      const dept = await getDepartmentById(pool, req.params.id);
      if (!dept) return res.status(404).json({ message: 'Departamento no encontrado.' });
      await assertCompanyAccess(pool, req, dept.CompanyId);

      const { code, name, branchId, parentDepartmentId, description, managerEmployeeId } = req.body;
      if (!code?.trim() || !name?.trim()) {
        return res.status(400).json({ message: 'El código y el nombre del departamento son obligatorios.' });
      }

      // Check cycle
      if (parentDepartmentId) {
        const isCycle = await checkDepartmentCycle(pool, dept.Id, Number(parentDepartmentId));
        if (isCycle) {
          return res.status(400).json({ message: 'No se puede asignar como padre a sí mismo o a uno de sus subdepartamentos (ciclo jerárquico).' });
        }
      }

      const updated = await updateDepartment(pool, dept.Id, {
        branchId,
        parentDepartmentId,
        code,
        name,
        description,
        managerEmployeeId
      }, req.user.userId);

      await writeAudit(req, 'UPDATE', 'RRHH Estructura', 'HrDepartment', String(dept.Id), dept.CompanyId, {
        oldValues: dept,
        newValues: req.body
      });

      res.json(updated);
    } catch (err) {
      console.error('Error updating department:', err);
      res.status(err.number === 2627 ? 409 : (err.status || 500)).json({
        message: err.number === 2627 ? 'Ya existe un departamento con ese código en esta empresa.' : (err.message || 'Error al actualizar departamento.')
      });
    }
  });

  router.patch('/departments/:id/status', requirePermission('RRHH Estructura', 'Administrar departamentos y cargos'), async (req, res) => {
    try {
      const dept = await getDepartmentById(pool, req.params.id);
      if (!dept) return res.status(404).json({ message: 'Departamento no encontrado.' });
      await assertCompanyAccess(pool, req, dept.CompanyId);

      const isActive = req.body?.isActive;
      if (typeof isActive !== 'boolean') return res.status(400).json({ message: 'isActive debe ser booleano.' });

      const updated = await toggleDepartmentStatus(pool, dept.Id, isActive, req.user.userId);

      await writeAudit(req, isActive ? 'ACTIVATE' : 'DEACTIVATE', 'RRHH Estructura', 'HrDepartment', String(dept.Id), dept.CompanyId);

      res.json(updated);
    } catch (err) {
      console.error('Error toggling department status:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al cambiar estado del departamento.' });
    }
  });

  router.delete('/departments/:id', requirePermission('RRHH Estructura', 'Administrar departamentos y cargos'), async (req, res) => {
    try {
      const dept = await getDepartmentById(pool, req.params.id);
      if (!dept) return res.status(404).json({ message: 'Departamento no encontrado.' });
      await assertCompanyAccess(pool, req, dept.CompanyId);

      const deleted = await deleteDepartment(pool, dept.Id, dept.CompanyId);

      await writeAudit(req, 'DELETE', 'RRHH Estructura', 'HrDepartment', String(dept.Id), dept.CompanyId, {
        oldValues: dept
      });

      res.json({ message: `Departamento "${dept.Name}" eliminado exitosamente.`, deleted });
    } catch (err) {
      console.error('Error deleting department:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al eliminar departamento.' });
    }
  });

  return router;
}
