import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, '../../../database/migrations');

/**
 * Splits SQL script containing 'GO' batch separators into executable batches.
 */
function splitSqlBatches(content) {
  return content
    .split(/^\s*GO\s*$/gim)
    .map(batch => batch.trim())
    .filter(batch => batch.length > 0);
}

/**
 * Runs pending migrations tracking them in dbo.SchemaMigrations table.
 */
export async function runMigrations(pool) {
  // Ensure migrations tracking table exists
  await pool.request().query(`
    IF OBJECT_ID(N'dbo.SchemaMigrations', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.SchemaMigrations (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        MigrationName NVARCHAR(255) NOT NULL UNIQUE,
        AppliedAt DATETIME2(0) NOT NULL DEFAULT (SYSUTCDATETIME())
      );
    END;
  `);

  const files = (await fs.readdir(migrationsDir))
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const check = await pool.request()
      .input('migrationName', file)
      .query('SELECT 1 FROM dbo.SchemaMigrations WHERE MigrationName = @migrationName;');

    if (check.recordset.length > 0) {
      continue;
    }

    console.log(`[Migrations] Applying ${file}...`);
    const fullPath = path.join(migrationsDir, file);
    const content = await fs.readFile(fullPath, 'utf8');
    const batches = splitSqlBatches(content);

    for (const batch of batches) {
      try {
        await pool.request().query(batch);
      } catch (err) {
        console.error(`[Migrations] Error executing batch in ${file}:`, err.message);
        console.error(`[Migrations] Batch preview: ${batch.slice(0, 200)}...`);
        throw err;
      }
    }

    await pool.request()
      .input('migrationName', file)
      .query('INSERT INTO dbo.SchemaMigrations (MigrationName) VALUES (@migrationName);');

    console.log(`[Migrations] Successfully applied ${file}`);
  }
}
