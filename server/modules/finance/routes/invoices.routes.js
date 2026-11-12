import { Router } from 'express';
import { db, isUniqueViolation } from '../../../core/db.js';
import { requirePermission, isGlobalAdmin } from '../../../core/auth.js';
import { getInvoices, createInvoice, createPayment } from '../repositories/invoices.repo.js';

export function createInvoicesRouter() {
  const router = Router();

  router.get('/invoices', requirePermission('Finanzas', 'Ver finanzas'), async (request, response) => {
    try {
      const invoices = await getInvoices(db, {
        companyId: request.user.companyId,
        isGlobal: isGlobalAdmin(request)
      });
      response.json(invoices);
    } catch (error) {
      console.error('Finance invoices query failed:', error.message);
      response.status(500).json({ message: 'No fue posible cargar las facturas.' });
    }
  });

  router.post('/invoices', requirePermission('Finanzas', 'Registrar transacciones'), async (request, response) => {
    const { number, ncf, type, contactId, subtotal, taxRate = 0, dueDate } = request.body;
    if (!number?.trim() || !['Venta', 'Compra'].includes(type) || Number(subtotal) <= 0) {
      return response.status(400).json({ message: 'Número, tipo y subtotal válido son obligatorios.' });
    }
    if (ncf && ncf.trim().length > 19) {
      return response.status(400).json({ message: 'El NCF no puede exceder 19 caracteres.' });
    }

    try {
      const invoice = await createInvoice(db, {
        companyId: request.user.companyId,
        contactId,
        number,
        ncf,
        type,
        subtotal,
        taxRate,
        dueDate,
        userId: request.user.userId
      });
      response.status(201).json(invoice);
    } catch (error) {
      console.error('Finance invoice creation failed:', error.message);
      const isDuplicate = isUniqueViolation(error);
      response.status(isDuplicate ? 409 : 500).json({
        message: isDuplicate ? 'Ya existe una factura con ese número.' : 'No fue posible registrar la factura.'
      });
    }
  });

  router.post('/payments', requirePermission('Finanzas', 'Registrar transacciones'), async (request, response) => {
    const { invoiceId, amount, method, reference } = request.body;
    if (!Number(amount) || !method?.trim()) {
      return response.status(400).json({ message: 'Monto y método de pago son obligatorios.' });
    }

    try {
      const payment = await createPayment(db, {
        companyId: request.user.companyId,
        invoiceId,
        amount,
        method,
        reference,
        userId: request.user.userId
      });
      response.status(201).json(payment);
    } catch (error) {
      console.error('Finance payment creation failed:', error.message);
      response.status(500).json({ message: 'No fue posible registrar el pago.' });
    }
  });

  return router;
}
