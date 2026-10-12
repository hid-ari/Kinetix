import 'dotenv/config';
import sql from 'mssql/msnodesqlv8.js';

const server = process.env.DB_SERVER || '(localdb)\\MSSQLLocalDB';
const database = process.env.DB_DATABASE || 'KinetixCore';
const pool = await sql.connect({
  server, database, driver: 'msnodesqlv8',
  connectionString: `Driver={ODBC Driver 18 for SQL Server};Server=${server};Database=${database};Trusted_Connection=Yes;Encrypt=No;TrustServerCertificate=Yes;`,
  options: { trustedConnection: true, trustServerCertificate: true }
});
const query = process.argv[2];
const result = await pool.request().query(query);
for (const set of result.recordsets) console.table(set);
await pool.close();
