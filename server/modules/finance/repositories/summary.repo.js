/**
 * Data Access Layer para el Resumen Financiero.
 */

export async function getFinanceSummary(pool, { companyId, isGlobal }) {
  const result = await pool.request()
    .input('companyId', companyId)
    .input('isGlobal', isGlobal)
    .query(`
      SELECT TransactionType AS type, COALESCE(SUM(Amount), 0) AS total
      FROM FinanceTransactions
      WHERE TransactionDate >= date_trunc('month', now())::date
        AND (@isGlobal = TRUE OR CompanyId = @companyId)
      GROUP BY TransactionType;
    `);
  return { transactions: result.recordset };
}
