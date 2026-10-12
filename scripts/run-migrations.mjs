import 'dotenv/config';
import sql from 'mssql/msnodesqlv8.js';
import { runMigrations } from '../server/modules/hr/migrate.js';

const server = process.env.DB_SERVER || '(localdb)\\MSSQLLocalDB';
const database = process.env.DB_DATABASE || 'KinetixCore';

const pool = await sql.connect({
  server,
  database,
  driver: 'msnodesqlv8',
  connectionString: `Driver={ODBC Driver 18 for SQL Server};Server=${server};Database=${database};Trusted_Connection=Yes;Encrypt=No;TrustServerCertificate=Yes;`,
  options: {
    trustedConnection: true,
    trustServerCertificate: true
  }
});

try {
  await runMigrations(pool);
  console.log('Migrations completed successfully.');
} catch (error) {
  console.error('Migration failed:', error);
  process.exitCode = 1;
} finally {
  await pool.close();
}
