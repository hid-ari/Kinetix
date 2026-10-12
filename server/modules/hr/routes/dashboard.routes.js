import express from 'express';
import { getHrDashboardSummary, getOrgChartData } from '../repositories/dashboard.repo.js';
import { resolveTargetCompanyId, assertCompanyAccess, hasPermission, isGlobalAdmin, isCompanyAdmin } from '../access.js';

export function createDashboardRouter(ctx) {
  const router = express.Router();
  const { pool, requirePermission } = ctx;

  router.get('/dashboard', requirePermission('RRHH Empleados', 'Ver empleados'), async (req, res) => {
    try {
      const companyId = resolveTargetCompanyId(req);
      if (!companyId) return res.status(400).json({ message: 'Se requiere especificar la empresa.' });
      await assertCompanyAccess(pool, req, companyId);

      const canViewSalary = isGlobalAdmin(req) || isCompanyAdmin(req) || await hasPermission(pool, req.user.userId, 'RRHH Empleados', 'Ver información salarial', req);

      const summary = await getHrDashboardSummary(pool, companyId, { canViewSalary });
      res.json(summary);
    } catch (err) {
      console.error('Error fetching HR dashboard:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al obtener panel de RRHH.' });
    }
  });

  router.get('/org-chart', requirePermission('RRHH Estructura', 'Ver estructura'), async (req, res) => {
    try {
      const companyId = resolveTargetCompanyId(req);
      if (!companyId) return res.status(400).json({ message: 'Se requiere especificar la empresa.' });
      await assertCompanyAccess(pool, req, companyId);

      const chartData = await getOrgChartData(pool, companyId);
      res.json(chartData);
    } catch (err) {
      console.error('Error fetching org chart data:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al obtener estructura organizacional.' });
    }
  });

  return router;
}
