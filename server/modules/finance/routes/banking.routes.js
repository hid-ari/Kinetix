import { Router } from 'express';
import { db } from '../../../core/db.js';
import { requirePermission, isGlobalAdmin } from '../../../core/auth.js';
import {
  getBankTransactions,
  createBankTransaction,
  reconcileBankTransaction
} from '../repositories/banking.repo.js';

export function createBankingRouter() {
  const router = Router();

  router.get('/bank-transactions', requirePermission('Finanzas', 'Ver finanzas'), async (request, response) => {
    try {
      const transactions = await getBankTransactions(db, {
        companyId: request.user.companyId,
        isGlobal: isGlobalAdmin(request)
      });
      response.json(transactions);
    } catch (error) {
      console.error('Finance bank transactions query failed:', error.message);
      response.status(500).json({ message: 'No fue posible cargar los movimientos bancarios.' });
    }
  });

  router.post('/bank-transactions', requirePermission('Finanzas', 'Registrar transacciones'), async (request, response) => {
    const { transactionDate, description, amount, reference } = request.body;
    if (!description?.trim() || !Number(amount)) {
      return response.status(400).json({ message: 'Descripción y monto válido son obligatorios.' });
    }

    try {
      const txn = await createBankTransaction(db, {
        companyId: request.user.companyId,
        transactionDate,
        description,
        amount,
        reference
      });
      response.status(201).json(txn);
    } catch (error) {
      console.error('Finance bank transaction creation failed:', error.message);
      response.status(500).json({ message: 'No fue posible registrar el movimiento bancario.' });
    }
  });

  router.post('/bank-transactions/:id/reconcile', requirePermission('Finanzas', 'Registrar transacciones'), async (request, response) => {
    try {
      const reconciled = await reconcileBankTransaction(db, {
        id: request.params.id,
        userId: request.user.userId,
        companyId: request.user.companyId,
        isGlobal: isGlobalAdmin(request)
      });

      if (!reconciled) {
        return response.status(404).json({ message: 'Movimiento bancario no encontrado.' });
      }

      response.json(reconciled);
    } catch (error) {
      console.error('Finance bank reconciliation failed:', error.message);
      response.status(500).json({ message: 'No fue posible conciliar el movimiento bancario.' });
    }
  });

  return router;
}
