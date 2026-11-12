import { createSummaryRouter } from './routes/summary.routes.js';
import { createTransactionsRouter } from './routes/transactions.routes.js';
import { createInvoicesRouter } from './routes/invoices.routes.js';
import { createContactsRouter } from './routes/contacts.routes.js';
import { createBankingRouter } from './routes/banking.routes.js';

/**
 * Registra las rutas modulares del subsistema de Finanzas en Express.
 * Estructurado por documentos y entidades (Summary, Transactions, Invoices, Contacts, Banking).
 */
export function registerFinanceModule(app) {
  const routers = [
    createSummaryRouter(),
    createTransactionsRouter(),
    createInvoicesRouter(),
    createContactsRouter(),
    createBankingRouter()
  ];

  for (const router of routers) {
    app.use('/api/finance', router);
  }

  console.log('[Finance Module] Finance routes registered successfully under /api/finance (summary, transactions, invoices, contacts, banking)');
}
