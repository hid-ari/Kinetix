import 'dotenv/config';
import { runMigrations } from '../server/core/migrate.js';
import { db } from '../server/core/db.js';

try {
  const applied = await runMigrations();
  console.log(applied.length ? `Migraciones aplicadas: ${applied.join(', ')}` : 'La base de datos ya está al día.');
} catch (error) {
  console.error('Migration failed:', error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
