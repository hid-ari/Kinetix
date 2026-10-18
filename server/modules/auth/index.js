import { createAuthRouter, createHealthRouter } from './routes/auth.routes.js';

export function registerAuthModule(app) {
  app.use('/api/auth', createAuthRouter());
  app.use('/api', createHealthRouter());
  console.log('[Auth Module] Auth routes registered under /api/auth and /api/health');
}
