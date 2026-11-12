import { Router } from 'express';
import { db } from '../../../core/db.js';
import { requirePermission, isGlobalAdmin, writeAudit } from '../../../core/auth.js';
import {
  getTransactions,
  createTransaction,
  updateTransactionStatus
} from '../repositories/transactions.repo.js';

export function createTransactionsRouter() {
  const router = Router();

  router.get('/transactions', requirePermission('Finanzas', 'Ver finanzas'), async (request, response) => {
    try {
      const transactions = await getTransactions(db, {
        companyId: request.user.companyId,
        isGlobal: isGlobalAdmin(request)
      });
      response.json(transactions);
    } catch (error) {
      console.error('Finance transactions query failed:', error.message);
      response.status(500).json({ message: 'No fue posible cargar las transacciones.' });
    }
  });

  router.post('/transactions', requirePermission('Finanzas', 'Registrar transacciones'), async (request, response) => {
    const { type = 'Gasto', category, description, amount, taxRate = 0, dueDate, companyId } = request.body;
    const targetCompanyId = isGlobalAdmin(request) ? Number(companyId || request.user.companyId) : request.user.companyId;

    if (!Number.isInteger(Number(targetCompanyId)) || !category?.trim() || !Number(amount) || !['Ingreso', 'Gasto'].includes(type)) {
      return response.status(400).json({ message: 'Tipo, categoría y monto válido son obligatorios.' });
    }

    try {
      const created = await createTransaction(db, {
        companyId: targetCompanyId,
        type,
        category,
        description,
        amount,
        taxRate,
        dueDate,
        userId: request.user.userId
      });

      await writeAudit(request, 'CREATE', 'Finance', 'FinanceTransaction', created.id, targetCompanyId);
      response.status(201).json(created);
    } catch (error) {
      console.error('Finance transaction creation failed:', error.message);
      response.status(500).json({ message: 'No fue posible registrar la transacción.' });
    }
  });

  router.patch('/transactions/:id/status', requirePermission('Finanzas', 'Registrar transacciones'), async (request, response) => {
    const { status } = request.body;
    if (!['Aprobada', 'Pagada', 'Rechazada', 'Revertida'].includes(status)) {
      return response.status(400).json({ message: 'Estado financiero no válido.' });
    }

    try {
      const updated = await updateTransactionStatus(db, {
        id: request.params.id,
        status,
        userId: request.user.userId,
        companyId: request.user.companyId,
        isGlobal: isGlobalAdmin(request)
      });

      if (!updated) {
        return response.status(404).json({ message: 'Transacción no encontrada.' });
      }

      await writeAudit(request, 'UPDATE', 'Finance', 'FinanceTransaction', request.params.id);
      response.json(updated);
    } catch (error) {
      console.error('Finance transaction status update failed:', error.message);
      response.status(500).json({ message: 'No fue posible actualizar el estado de la transacción.' });
    }
  });

  return router;
}
