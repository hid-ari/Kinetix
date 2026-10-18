/**
 * Auditoría de integridad entre el código y la base de datos.
 *  1. Objetos dbo.* referenciados en el código que no existen en la BD.
 *  2. Claves foráneas deshabilitadas o no confiables.
 *  3. Registros huérfanos por cada clave foránea (columna simple).
 *  4. Columnas FK sin índice (afecta rendimiento de joins).
 * Uso: node scripts/audit-db.mjs
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import sql from 'mssql/msnodesqlv8.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const server = process.env.DB_SERVER || '(localdb)\\MSSQLLocalDB';
const database = process.env.DB_DATABASE || 'KinetixCore';
const pool = await sql.connect({
  server, database, driver: 'msnodesqlv8',
  connectionString: `Driver={ODBC Driver 18 for SQL Server};Server=${server};Database=${database};Trusted_Connection=Yes;Encrypt=No;TrustServerCertificate=Yes;`,
  options: { trustedConnection: true, trustServerCertificate: true }
});

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'public', 'storage', 'database'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(m?js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

// 1. Objetos referenciados
const refs = new Map();
for (const file of walk(root)) {
  if (file.endsWith('audit-db.mjs')) continue;
  const text = fs.readFileSync(file, 'utf8');
  for (const m of text.matchAll(/dbo\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
    const name = m[1];
    if (!refs.has(name)) refs.set(name, new Set());
    refs.get(name).add(path.relative(root, file));
  }
}
const objs = await pool.request().query(`SELECT name, type_desc FROM sys.objects WHERE schema_id = SCHEMA_ID('dbo')`);
const existing = new Map(objs.recordset.map(o => [o.name.toLowerCase(), o.type_desc]));
const missing = [...refs.entries()].filter(([n]) => !existing.has(n.toLowerCase()));
console.log('\n=== 1. Objetos referenciados en código pero inexistentes en BD ===');
if (!missing.length) console.log('OK: los', refs.size, 'objetos referenciados existen.');
for (const [n, files] of missing) console.log(`FALTA dbo.${n}  <-  ${[...files].join(', ')}`);

const tables = objs.recordset.filter(o => o.type_desc === 'USER_TABLE').map(o => o.name);
const unused = tables.filter(t => ![...refs.keys()].some(r => r.toLowerCase() === t.toLowerCase()));
console.log('\nTablas sin referencia directa en el código:', unused.length ? unused.join(', ') : 'ninguna');

// 2. FKs deshabilitadas / no confiables
const badFk = await pool.request().query(`
  SELECT fk.name, OBJECT_NAME(fk.parent_object_id) AS tbl, fk.is_disabled, fk.is_not_trusted
  FROM sys.foreign_keys fk WHERE fk.is_disabled = 1 OR fk.is_not_trusted = 1`);
console.log('\n=== 2. Claves foráneas deshabilitadas o no confiables ===');
if (!badFk.recordset.length) console.log('OK');
for (const f of badFk.recordset) console.log(`${f.tbl}.${f.name} disabled=${f.is_disabled} notTrusted=${f.is_not_trusted}`);

// 3. Huérfanos
const fks = await pool.request().query(`
  SELECT fk.name, OBJECT_NAME(fkc.parent_object_id) AS childTbl, pc.name AS childCol,
         OBJECT_NAME(fkc.referenced_object_id) AS parentTbl, rc.name AS parentCol
  FROM sys.foreign_keys fk
  JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
  JOIN sys.columns pc ON pc.object_id = fkc.parent_object_id AND pc.column_id = fkc.parent_column_id
  JOIN sys.columns rc ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id
  WHERE fk.object_id IN (SELECT constraint_object_id FROM sys.foreign_key_columns GROUP BY constraint_object_id HAVING COUNT(*) = 1)`);
console.log('\n=== 3. Registros huérfanos por FK ===');
let orphanCount = 0;
for (const f of fks.recordset) {
  const r = await pool.request().query(`
    SELECT COUNT(*) AS n FROM dbo.[${f.childTbl}] c
    WHERE c.[${f.childCol}] IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM dbo.[${f.parentTbl}] p WHERE p.[${f.parentCol}] = c.[${f.childCol}])`);
  if (r.recordset[0].n > 0) { orphanCount++; console.log(`${f.childTbl}.${f.childCol} -> ${f.parentTbl}.${f.parentCol}: ${r.recordset[0].n} huérfanos (${f.name})`); }
}
if (!orphanCount) console.log('OK: ninguna de las', fks.recordset.length, 'FKs tiene huérfanos.');

// 4. FKs sin índice
const noIdx = await pool.request().query(`
  SELECT OBJECT_NAME(fkc.parent_object_id) AS tbl, c.name AS col
  FROM sys.foreign_key_columns fkc
  JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
  WHERE NOT EXISTS (
    SELECT 1 FROM sys.index_columns ic
    WHERE ic.object_id = fkc.parent_object_id AND ic.column_id = fkc.parent_column_id AND ic.key_ordinal = 1)
  ORDER BY tbl, col`);
console.log('\n=== 4. Columnas FK sin índice líder ===');
console.log(noIdx.recordset.length ? noIdx.recordset.map(r => `${r.tbl}.${r.col}`).join('\n') : 'OK');

await pool.close();
