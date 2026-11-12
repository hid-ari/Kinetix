import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Core
import { db, dbConfig } from './server/core/db.js';
import { runMigrations } from './server/core/migrate.js';
import { securityHeadersMiddleware, sameOriginMiddleware } from './server/core/security.js';
import { requireAuth, requirePermission, writeAudit, isGlobalAdmin, purgeExpiredSessions } from './server/core/auth.js';

// Módulos del Sistema
import { registerAuthModule } from './server/modules/auth/index.js';
import { registerAdminModule } from './server/modules/admin/index.js';
import { registerInventoryModule } from './server/modules/inventory/index.js';
import { registerFinanceModule } from './server/modules/finance/index.js';
import { registerHrModule } from './server/modules/hr/index.js';

// Logger estructurado JSON
const originalLog = console.log;
const originalError = console.error;
console.log = (...args) => originalLog(JSON.stringify({ level: 'INFO', timestamp: new Date().toISOString(), message: args.join(' ') }));
console.error = (...args) => originalError(JSON.stringify({ level: 'ERROR', timestamp: new Date().toISOString(), message: args.join(' ') }));

// Captura de errores no controlados a nivel de proceso
process.on('uncaughtException', error => {
  console.error('[Fatal] Uncaught Exception:', error.message, error.stack);
  process.exit(1);
});

process.on('unhandledRejection', reason => {
  console.error('[Fatal] Unhandled Rejection:', reason instanceof Error ? reason.message : String(reason));
});

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

// Protección CSRF complementaria: valida Origin en métodos mutantes de la API
app.use('/api', sameOriginMiddleware);

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
  pool: db,
  requirePermission,
  writeAudit,
  isGlobalAdmin
});

// Manejador 404 y Fallback SPA
app.use((request, response) => {
  if (request.path.startsWith('/api/')) return response.status(404).json({ message: 'Ruta API no encontrada.' });
  if (path.extname(request.path)) return response.status(404).send('Not found');
  response.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Manejador centralizado de errores para Express
app.use((error, request, response, _next) => {
  const status = error.status || error.statusCode || 500;
  console.error(`[Error ${status}] ${request.method} ${request.originalUrl || request.url}:`, error.message);
  response.status(status).json({
    message: status === 500 && process.env.NODE_ENV === 'production'
      ? 'Error interno del servidor.'
      : error.message || 'Error inesperado.'
  });
});

let serverInstance = null;

// Cierre ordenado (Graceful Shutdown)
let isShuttingDown = false;
async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[Server] Recibida señal ${signal}. Cerrando servidor y conexiones de base de datos...`);

  const forceExit = setTimeout(() => {
    console.error('[Server] Cierre forzado por exceder tiempo límite.');
    process.exit(1);
  }, 10000);
  forceExit.unref();

  if (serverInstance) {
    serverInstance.close(async () => {
      try {
        await db.close();
        console.log('[Server] Servidor y conexiones cerradas correctamente.');
        process.exit(0);
      } catch (err) {
        console.error('[Server] Error al cerrar pool de base de datos:', err.message);
        process.exit(1);
      }
    });
  } else {
    await db.close().catch(() => {});
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Inicialización de Esquemas, Migraciones y Servidor
runMigrations().then(() => {
  serverInstance = app.listen(port, () => {
    console.log(`Kinetix Core disponible en http://localhost:${port}`);
    console.log(`Base configurada: ${dbConfig.host || 'DATABASE_URL'}/${dbConfig.database || ''}`);
  });

  // Limpieza periódica de sesiones expiradas (al iniciar y cada hora)
  const purge = () => purgeExpiredSessions()
    .then(count => { if (count) console.log(`Sesiones expiradas eliminadas: ${count}`); })
    .catch(error => console.error('Session purge failed:', error.message));
  purge();
  setInterval(purge, 60 * 60 * 1000).unref();
}).catch(error => {
  console.error('Database initialization failed:', error.message);
  process.exitCode = 1;
});
