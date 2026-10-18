import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Core
import { getPool, setActivePool, poolProxy, sql, dbConfig } from './server/core/db.js';
import { ensureOperationsSchema } from './server/core/schema.js';
import { securityHeadersMiddleware } from './server/core/security.js';
import { requireAuth, requirePermission, writeAudit, isGlobalAdmin } from './server/core/auth.js';

// Módulos del Sistema
import { registerAuthModule } from './server/modules/auth/index.js';
import { registerAdminModule } from './server/modules/admin/index.js';
import { registerInventoryModule } from './server/modules/inventory/index.js';
import { registerFinanceModule } from './server/modules/finance/index.js';
import { registerHrModule } from './server/modules/hr/index.js';
import { runMigrations } from './server/modules/hr/migrate.js';

// M-09: Logger estructurado JSON
const originalLog = console.log;
const originalError = console.error;
console.log = (...args) => originalLog(JSON.stringify({ level: 'INFO', timestamp: new Date().toISOString(), message: args.join(' ') }));
console.error = (...args) => originalError(JSON.stringify({ level: 'ERROR', timestamp: new Date().toISOString(), message: args.join(' ') }));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);

// Middlewares globales de transporte y seguridad
app.use(express.json({ limit: '256kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(securityHeadersMiddleware);

// Rutas estáticas del Frontend SPA
app.get('/', (_request, response) => response.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/index.html', (_request, response) => response.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/app.js', (_request, response) => response.sendFile(path.join(__dirname, 'public', 'js', 'app.js')));
app.get('/styles.css', (_request, response) => response.sendFile(path.join(__dirname, 'public', 'styles.css')));

// Protección centralizada de endpoints de API (excepto /health y /auth/*)
app.use('/api', (request, response, next) => {
  if (request.path === '/health' || request.path.startsWith('/auth/')) return next();
  return requireAuth(request, response, next);
});

// Registro de Módulos Operativos
registerAuthModule(app);
registerAdminModule(app);
registerInventoryModule(app);
registerFinanceModule(app);
registerHrModule(app, {
  pool: poolProxy,
  sql,
  requirePermission,
  writeAudit,
  isGlobalAdmin
});

// Manejador 404 y Fallback SPA
app.use((_request, response) => {
  if (_request.path.startsWith('/api/')) return response.status(404).json({ message: 'Ruta API no encontrada.' });
  if (path.extname(_request.path)) return response.status(404).send('Not found');
  response.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Inicialización de Esquemas, Migraciones y Servidor
ensureOperationsSchema(poolProxy).then(async () => {
  const pool = await getPool();
  setActivePool(pool);
  await runMigrations(pool);
  app.listen(port, () => {
    console.log(`Kinetix Core disponible en http://localhost:${port}`);
    console.log(`Base configurada: ${dbConfig.server}/${dbConfig.database}`);
  });
}).catch(error => {
  console.error('Operations schema initialization failed:', error.message);
  process.exitCode = 1;
});
