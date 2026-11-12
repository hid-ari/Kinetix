import { Router } from 'express';
import { db } from '../../../core/db.js';
import { requirePermission, isGlobalAdmin } from '../../../core/auth.js';
import { getFinanceSummary } from '../repositories/summary.repo.js';

export function createSummaryRouter() {
  const router = Router();

  router.get('/summary', requirePermission('Finanzas', 'Ver finanzas'), async (request, response) => {
    try {
      const summary = await getFinanceSummary(db, {
        companyId: request.user.companyId,
        isGlobal: isGlobalAdmin(request)
      });
      response.json(summary);
    } catch (error) {
      console.error('Finance summary failed:', error.message);
      response.status(500).json({ message: 'No fue posible cargar el resumen financiero.' });
    }
  });

  return router;
}
