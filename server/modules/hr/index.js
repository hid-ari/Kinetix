import { createCatalogsRouter } from './routes/catalogs.routes.js';
import { createDepartmentsRouter } from './routes/departments.routes.js';
import { createPositionsRouter } from './routes/positions.routes.js';
import { createDocumentsRouter } from './routes/documents.routes.js';
import { createEmployeesRouter } from './routes/employees.routes.js';
import { createDashboardRouter } from './routes/dashboard.routes.js';
import { createNotificationsRouter } from './routes/notifications.routes.js';
import { createApprovalsRouter } from './routes/approvals.routes.js';
import { createAttendanceRouter } from './routes/attendance.routes.js';
import { createVacationsRouter } from './routes/vacations.routes.js';
import { createLeavesRouter } from './routes/leaves.routes.js';

/**
 * Registers all HR module routes, controllers, and services into the Express app.
 */
export function registerHrModule(app, ctx) {
  const router = [
    createCatalogsRouter(ctx),
    createDepartmentsRouter(ctx),
    createPositionsRouter(ctx),
    createDocumentsRouter(ctx),
    createEmployeesRouter(ctx),
    createDashboardRouter(ctx),
    createNotificationsRouter(ctx),
    createApprovalsRouter(ctx),
    createAttendanceRouter(ctx),
    createVacationsRouter(ctx),
    createLeavesRouter(ctx)
  ];

  for (const r of router) {
    app.use('/api/hr', r);
  }

  console.log('[HR Module] Human Resources module routes registered successfully under /api/hr');
}
