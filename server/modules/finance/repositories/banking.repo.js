/**
 * Data Access Layer para Movimientos Bancarios y Conciliación.
 */

export async function getBankTransactions(pool, { companyId, isGlobal }) {
  const result = await pool.request()
    .input('companyId', companyId)
    .input('isGlobal', isGlobal)
    .query(`
      SELECT Id AS id, TransactionDate AS transactionDate, Description AS description, Amount AS amount,
             Reference AS reference, Status AS status
      FROM FinanceBankTransactions
      WHERE (@isGlobal = TRUE OR CompanyId = @companyId)
      ORDER BY TransactionDate DESC, Id DESC
      LIMIT 100;
    `);
  return result.recordset;
}

export async function createBankTransaction(pool, { companyId, transactionDate, description, amount, reference }) {
  const txn = await pool.insert('FinanceBankTransactions', {
    CompanyId: companyId,
    TransactionDate: transactionDate || new Date().toISOString().split('T')[0],
    Description: description.trim(),
    Amount: Number(amount),
    Reference: reference?.trim() || null
  });
  return { id: txn.Id, status: txn.Status };
}

export async function reconcileBankTransaction(pool, { id, userId, companyId, isGlobal }) {
  const where = { Id: Number(id) };
  if (!isGlobal) {
    where.CompanyId = companyId;
  }
  const updated = await pool.update('FinanceBankTransactions', where, {
    Status: 'Conciliada',
    ReconciledAt: new Date(),
    ReconciledBy: userId
  });
  if (!updated) return null;
  return { id: updated.Id, status: updated.Status };
}
