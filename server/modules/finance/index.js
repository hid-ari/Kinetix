import { createFinanceRouter } from './routes/finance.routes.js';

export function registerFinanceModule(app) {
  app.use('/api/finance', createFinanceRouter());
  console.log('[Finance Module] Finance routes registered under /api/finance');
}
