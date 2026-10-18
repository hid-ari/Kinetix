import { createCompaniesRouter } from './routes/companies.routes.js';
import { createUsersRouter } from './routes/users.routes.js';
import { createProfileRouter } from './routes/profile.routes.js';
import { createBranchesRouter } from './routes/branches.routes.js';
import { createRolesRouter } from './routes/roles.routes.js';
import { createAuditRouter } from './routes/audit.routes.js';

export function registerAdminModule(app) {
  app.use('/api/companies', createCompaniesRouter());
  app.use('/api/users', createUsersRouter());
  app.use('/api/profile', createProfileRouter());
  app.use('/api/branches', createBranchesRouter());
  app.use('/api', createRolesRouter()); // provides /api/roles, /api/permissions, etc.
  app.use('/api/audit', createAuditRouter());

  console.log('[Admin Module] Admin routes registered successfully (companies, users, profile, branches, roles, audit)');
}
