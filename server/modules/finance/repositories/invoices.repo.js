/**
 * Data Access Layer para Facturas y Pagos.
 */

export async function getInvoices(pool, { companyId, isGlobal }) {
  const result = await pool.request()
    .input('companyId', companyId)
    .input('isGlobal', isGlobal)
    .query(`
      SELECT i.Id AS id, i.InvoiceNumber AS number, i.Ncf AS ncf, i.InvoiceType AS type, i.IssueDate AS issueDate, i.DueDate AS dueDate,
             i.Subtotal AS subtotal, i.TaxAmount AS taxAmount, i.Total AS total, i.Status AS status, c.Name AS contact
      FROM FinanceInvoices AS i
      LEFT JOIN FinanceContacts AS c ON c.Id = i.ContactId
      WHERE (@isGlobal = TRUE OR i.CompanyId = @companyId)
      ORDER BY i.CreatedAt DESC
      LIMIT 100;
    `);
  return result.recordset;
}

export async function createInvoice(pool, { companyId, contactId, number, ncf, type, subtotal, taxRate, dueDate, userId }) {
  const taxAmount = Number(subtotal) * Number(taxRate || 0) / 100;
  const invoice = await pool.insert('FinanceInvoices', {
    CompanyId: companyId,
    ContactId: contactId ? Number(contactId) : null,
    InvoiceNumber: number.trim(),
    Ncf: ncf?.trim() || null,
    InvoiceType: type,
    Subtotal: Number(subtotal),
    TaxRate: Number(taxRate || 0),
    TaxAmount: taxAmount,
    Total: Number(subtotal) + taxAmount,
    DueDate: dueDate || null,
    CreatedBy: userId
  });
  return { id: invoice.Id, number: invoice.InvoiceNumber, ncf: invoice.Ncf, total: invoice.Total };
}

export async function createPayment(pool, { companyId, invoiceId, amount, method, reference, userId }) {
  const payment = await pool.insert('FinancePayments', {
    CompanyId: companyId,
    InvoiceId: invoiceId ? Number(invoiceId) : null,
    Amount: Number(amount),
    Method: method.trim(),
    Reference: reference?.trim() || null,
    CreatedBy: userId
  });
  return { id: payment.Id, amount: payment.Amount };
}
