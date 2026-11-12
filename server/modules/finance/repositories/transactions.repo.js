/**
 * Data Access Layer para Transacciones Financieras.
 */

export async function getTransactions(pool, { companyId, isGlobal }) {
  const result = await pool.request()
    .input('companyId', companyId)
    .input('isGlobal', isGlobal)
    .query(`
      SELECT t.Id AS id, t.TransactionType AS type, t.Category AS category, t.Description AS description,
             t.Amount AS amount, t.TaxAmount AS taxAmount, t.DueDate AS dueDate, t.Status AS status, t.CreatedAt AS createdAt
      FROM FinanceTransactions AS t
      WHERE (@isGlobal = TRUE OR t.CompanyId = @companyId)
      ORDER BY t.CreatedAt DESC
      LIMIT 100;
    `);
  return result.recordset;
}

export async function createTransaction(pool, { companyId, type, category, description, amount, taxRate, dueDate, userId }) {
  const taxAmount = Number(amount) * Number(taxRate || 0) / 100;
  return pool.insert('FinanceTransactions', {
    CompanyId: companyId,
    TransactionType: type,
    Category: category.trim(),
    Description: description?.trim() || null,
    Amount: Number(amount),
    TaxRate: Number(taxRate || 0),
    TaxAmount: taxAmount,
    DueDate: dueDate || null,
    Status: 'Pendiente',
    CreatedBy: userId
  }, { returning: 'Id AS id, Amount AS amount, TransactionType AS type' });
}

export async function updateTransactionStatus(pool, { id, status, userId, companyId, isGlobal }) {
  const result = await pool.request()
    .input('id', Number(id))
    .input('status', status)
    .input('userId', userId)
    .input('companyId', companyId)
    .input('isGlobal', isGlobal)
    .query(`
      UPDATE FinanceTransactions
      SET Status = @status,
          ApprovedBy = CASE WHEN @status = 'Aprobada' THEN @userId ELSE ApprovedBy END,
          ApprovedAt = CASE WHEN @status = 'Aprobada' THEN now() ELSE ApprovedAt END,
          ReversedAt = CASE WHEN @status = 'Revertida' THEN now() ELSE ReversedAt END
      WHERE Id = @id AND (@isGlobal = TRUE OR CompanyId = @companyId)
      RETURNING Id AS id, Status AS status;
    `);
  return result.recordset[0] || null;
}
