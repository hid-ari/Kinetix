import { Router } from 'express';
import { getPool, sql } from '../../../core/db.js';
import { requirePermission, isGlobalAdmin, writeAudit } from '../../../core/auth.js';

export function createFinanceRouter() {
  const router = Router();

  // Resumen Financiero
  router.get('/summary', requirePermission('Finanzas', 'Ver finanzas'), async (request, response) => {
    try {
      const result = await (await getPool()).request()
        .input('companyId', sql.Int, request.user.companyId).input('isGlobal', sql.Bit, isGlobalAdmin(request))
        .query(`
          SELECT TransactionType AS type, COALESCE(SUM(Amount), 0) AS total
          FROM dbo.FinanceTransactions
          WHERE TransactionDate >= DATEFROMPARTS(YEAR(GETUTCDATE()), MONTH(GETUTCDATE()), 1)
            AND (@isGlobal = 1 OR CompanyId = @companyId)
          GROUP BY TransactionType;
        `);
      response.json({ transactions: result.recordset });
    } catch (error) {
      console.error('Finance summary failed:', error.message);
      response.status(500).json({ message: 'No fue posible cargar el resumen financiero.' });
    }
  });

  // Transacciones
  router.get('/transactions', requirePermission('Finanzas', 'Ver finanzas'), async (request, response) => {
    try {
      const result = await (await getPool()).request().input('companyId', sql.Int, request.user.companyId).input('isGlobal', sql.Bit, isGlobalAdmin(request)).query(`
        SELECT TOP 100 t.Id AS id, t.TransactionType AS type, t.Category AS category, t.Description AS description,
               t.Amount AS amount, t.TaxAmount AS taxAmount, t.DueDate AS dueDate, t.Status AS status, t.CreatedAt AS createdAt
        FROM dbo.FinanceTransactions AS t WHERE (@isGlobal = 1 OR t.CompanyId = @companyId) ORDER BY t.CreatedAt DESC;
      `);
      response.json(result.recordset);
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
      const pool = await getPool();
      const result = await pool.request()
        .input('companyId', sql.Int, targetCompanyId).input('type', sql.NVarChar(20), type)
        .input('category', sql.NVarChar(100), category.trim()).input('description', sql.NVarChar(300), description?.trim() || null)
        .input('amount', sql.Decimal(18, 2), Number(amount)).input('taxRate', sql.Decimal(9, 4), Number(taxRate))
        .input('taxAmount', sql.Decimal(18, 2), Number(amount) * Number(taxRate) / 100).input('dueDate', sql.Date, dueDate || null)
        .input('createdBy', sql.NVarChar(450), request.user.userId)
        .query(`INSERT INTO dbo.FinanceTransactions (CompanyId, TransactionType, Category, Description, Amount, TaxRate, TaxAmount, DueDate, Status, CreatedBy)
                OUTPUT INSERTED.Id AS id, INSERTED.Amount AS amount, INSERTED.TransactionType AS type
                VALUES (@companyId, @type, @category, @description, @amount, @taxRate, @taxAmount, @dueDate, N'Pendiente', @createdBy);`);
      await writeAudit(request, 'CREATE', 'Finance', 'FinanceTransaction', result.recordset[0].id, targetCompanyId);
      response.status(201).json(result.recordset[0]);
    } catch (error) {
      console.error('Finance transaction creation failed:', error.message);
      response.status(500).json({ message: 'No fue posible registrar la transacción.' });
    }
  });

  router.patch('/transactions/:id/status', requirePermission('Finanzas', 'Registrar transacciones'), async (request, response) => {
    const { status } = request.body;
    if (!['Aprobada', 'Pagada', 'Rechazada', 'Revertida'].includes(status)) return response.status(400).json({ message: 'Estado financiero no válido.' });
    const result = await (await getPool()).request().input('id', sql.BigInt, Number(request.params.id))
      .input('status', sql.NVarChar(20), status).input('userId', sql.NVarChar(450), request.user.userId)
      .input('companyId', sql.Int, request.user.companyId).input('isGlobal', sql.Bit, isGlobalAdmin(request))
      .query(`UPDATE dbo.FinanceTransactions SET Status = @status, ApprovedBy = CASE WHEN @status = N'Aprobada' THEN @userId ELSE ApprovedBy END,
              ApprovedAt = CASE WHEN @status = N'Aprobada' THEN SYSUTCDATETIME() ELSE ApprovedAt END,
              ReversedAt = CASE WHEN @status = N'Revertida' THEN SYSUTCDATETIME() ELSE ReversedAt END
              OUTPUT INSERTED.Id AS id, INSERTED.Status AS status
              WHERE Id = @id AND (@isGlobal = 1 OR CompanyId = @companyId);`);
    if (!result.recordset[0]) return response.status(404).json({ message: 'Transacción no encontrada.' });
    await writeAudit(request, status === 'Revertida' ? 'UPDATE' : 'UPDATE', 'Finance', 'FinanceTransaction', request.params.id);
    response.json(result.recordset[0]);
  });

  // Contactos
  router.get('/contacts', requirePermission('Finanzas', 'Ver finanzas'), async (request, response) => {
    try {
      const result = await (await getPool()).request().input('companyId', sql.Int, request.user.companyId).input('isGlobal', sql.Bit, isGlobalAdmin(request)).query(`
        SELECT Id AS id, ContactType AS type, Name AS name, TaxId AS taxId, Email AS email, Phone AS phone, IsActive AS isActive
        FROM dbo.FinanceContacts WHERE IsActive = 1 AND (@isGlobal = 1 OR CompanyId = @companyId) ORDER BY Name;
      `);
      response.json(result.recordset);
    } catch (error) {
      console.error('Finance contacts query failed:', error.message);
      response.status(500).json({ message: 'No fue posible cargar los contactos.' });
    }
  });

  router.post('/contacts', requirePermission('Finanzas', 'Registrar transacciones'), async (request, response) => {
    const { type, name, taxId, email, phone } = request.body;
    if (!['Cliente', 'Proveedor'].includes(type) || !name?.trim()) return response.status(400).json({ message: 'Tipo y nombre del contacto son obligatorios.' });
    const result = await (await getPool()).request().input('companyId', sql.Int, request.user.companyId).input('type', sql.NVarChar(20), type)
      .input('name', sql.NVarChar(180), name.trim()).input('taxId', sql.NVarChar(40), taxId?.trim() || null)
      .input('email', sql.NVarChar(254), email?.trim() || null).input('phone', sql.NVarChar(40), phone?.trim() || null)
      .query(`INSERT INTO dbo.FinanceContacts (CompanyId, ContactType, Name, TaxId, Email, Phone)
              OUTPUT INSERTED.Id AS id, INSERTED.ContactType AS type, INSERTED.Name AS name
              VALUES (@companyId, @type, @name, @taxId, @email, @phone);`);
    response.status(201).json(result.recordset[0]);
  });

  // Facturas
  router.get('/invoices', requirePermission('Finanzas', 'Ver finanzas'), async (request, response) => {
    try {
      const result = await (await getPool()).request().input('companyId', sql.Int, request.user.companyId).input('isGlobal', sql.Bit, isGlobalAdmin(request)).query(`
        SELECT TOP 100 i.Id AS id, i.InvoiceNumber AS number, i.Ncf AS ncf, i.InvoiceType AS type, i.IssueDate AS issueDate, i.DueDate AS dueDate,
               i.Subtotal AS subtotal, i.TaxAmount AS taxAmount, i.Total AS total, i.Status AS status, c.Name AS contact
        FROM dbo.FinanceInvoices AS i LEFT JOIN dbo.FinanceContacts AS c ON c.Id = i.ContactId
        WHERE (@isGlobal = 1 OR i.CompanyId = @companyId) ORDER BY i.CreatedAt DESC;
      `);
      response.json(result.recordset);
    } catch (error) {
      console.error('Finance invoices query failed:', error.message);
      response.status(500).json({ message: 'No fue posible cargar las facturas.' });
    }
  });

  router.post('/invoices', requirePermission('Finanzas', 'Registrar transacciones'), async (request, response) => {
    const { number, ncf, type, contactId, subtotal, taxRate = 0, dueDate } = request.body;
    if (!number?.trim() || !['Venta', 'Compra'].includes(type) || Number(subtotal) <= 0) return response.status(400).json({ message: 'Número, tipo y subtotal válido son obligatorios.' });
    if (ncf && ncf.trim().length > 19) return response.status(400).json({ message: 'El NCF no puede exceder 19 caracteres.' });
    const taxAmount = Number(subtotal) * Number(taxRate) / 100;
    const result = await (await getPool()).request().input('companyId', sql.Int, request.user.companyId).input('number', sql.NVarChar(50), number.trim())
      .input('ncf', sql.NVarChar(19), ncf?.trim() || null)
      .input('type', sql.NVarChar(20), type).input('contactId', sql.Int, contactId ? Number(contactId) : null).input('subtotal', sql.Decimal(18, 2), Number(subtotal))
      .input('taxRate', sql.Decimal(9, 4), Number(taxRate)).input('taxAmount', sql.Decimal(18, 2), taxAmount).input('total', sql.Decimal(18, 2), Number(subtotal) + taxAmount)
      .input('dueDate', sql.Date, dueDate || null).input('createdBy', sql.NVarChar(450), request.user.userId)
      .query(`INSERT INTO dbo.FinanceInvoices (CompanyId, ContactId, InvoiceNumber, Ncf, InvoiceType, Subtotal, TaxRate, TaxAmount, Total, DueDate, CreatedBy)
              OUTPUT INSERTED.Id AS id, INSERTED.InvoiceNumber AS number, INSERTED.Ncf AS ncf, INSERTED.Total AS total
              VALUES (@companyId, @contactId, @number, @ncf, @type, @subtotal, @taxRate, @taxAmount, @total, @dueDate, @createdBy);`);
    response.status(201).json(result.recordset[0]);
  });

  // Pagos
  router.post('/payments', requirePermission('Finanzas', 'Registrar transacciones'), async (request, response) => {
    const { invoiceId, amount, method, reference } = request.body;
    if (!Number(amount) || !method?.trim()) return response.status(400).json({ message: 'Monto y método de pago son obligatorios.' });
    const result = await (await getPool()).request().input('companyId', sql.Int, request.user.companyId).input('invoiceId', sql.BigInt, invoiceId ? Number(invoiceId) : null)
      .input('amount', sql.Decimal(18, 2), Number(amount)).input('method', sql.NVarChar(40), method.trim()).input('reference', sql.NVarChar(100), reference?.trim() || null).input('createdBy', sql.NVarChar(450), request.user.userId)
      .query(`INSERT INTO dbo.FinancePayments (CompanyId, InvoiceId, Amount, Method, Reference, CreatedBy)
              OUTPUT INSERTED.Id AS id, INSERTED.Amount AS amount
              VALUES (@companyId, @invoiceId, @amount, @method, @reference, @createdBy);`);
    response.status(201).json(result.recordset[0]);
  });

  // Bancos y Conciliación
  router.get('/bank-transactions', requirePermission('Finanzas', 'Ver finanzas'), async (request, response) => {
    try {
      const result = await (await getPool()).request().input('companyId', sql.Int, request.user.companyId).input('isGlobal', sql.Bit, isGlobalAdmin(request)).query(`
        SELECT TOP 100 Id AS id, TransactionDate AS transactionDate, Description AS description, Amount AS amount,
               Reference AS reference, Status AS status FROM dbo.FinanceBankTransactions
        WHERE (@isGlobal = 1 OR CompanyId = @companyId) ORDER BY TransactionDate DESC, Id DESC;
      `);
      response.json(result.recordset);
    } catch (error) {
      console.error('Finance bank transactions query failed:', error.message);
      response.status(500).json({ message: 'No fue posible cargar los movimientos bancarios.' });
    }
  });

  router.post('/bank-transactions', requirePermission('Finanzas', 'Registrar transacciones'), async (request, response) => {
    const { transactionDate, description, amount, reference } = request.body;
    if (!description?.trim() || !Number(amount)) return response.status(400).json({ message: 'Descripción y monto válido son obligatorios.' });
    const result = await (await getPool()).request().input('companyId', sql.Int, request.user.companyId)
      .input('transactionDate', sql.Date, transactionDate || null).input('description', sql.NVarChar(300), description.trim())
      .input('amount', sql.Decimal(18, 2), Number(amount)).input('reference', sql.NVarChar(100), reference?.trim() || null)
      .query(`INSERT INTO dbo.FinanceBankTransactions (CompanyId, TransactionDate, Description, Amount, Reference)
              OUTPUT INSERTED.Id AS id, INSERTED.Status AS status
              VALUES (@companyId, COALESCE(@transactionDate, CONVERT(date, SYSUTCDATETIME())), @description, @amount, @reference);`);
    response.status(201).json(result.recordset[0]);
  });

  router.post('/bank-transactions/:id/reconcile', requirePermission('Finanzas', 'Registrar transacciones'), async (request, response) => {
    const result = await (await getPool()).request().input('id', sql.BigInt, Number(request.params.id)).input('companyId', sql.Int, request.user.companyId).input('isGlobal', sql.Bit, isGlobalAdmin(request)).input('userId', sql.NVarChar(450), request.user.userId)
      .query(`UPDATE dbo.FinanceBankTransactions SET Status = N'Conciliada', ReconciledAt = SYSUTCDATETIME(), ReconciledBy = @userId
              OUTPUT INSERTED.Id AS id, INSERTED.Status AS status WHERE Id = @id AND (@isGlobal = 1 OR CompanyId = @companyId);`);
    if (!result.recordset[0]) return response.status(404).json({ message: 'Movimiento bancario no encontrado.' });
    response.json(result.recordset[0]);
  });

  return router;
}
