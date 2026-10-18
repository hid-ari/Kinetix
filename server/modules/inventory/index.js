import { createInventoryRouter } from './routes/inventory.routes.js';

export function registerInventoryModule(app) {
  app.use('/api/inventory', createInventoryRouter());
  console.log('[Inventory Module] Inventory routes registered under /api/inventory');
}
