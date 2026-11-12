/**
 * Capa de acceso a datos de Kinetix (PostgreSQL vía `pg`).
 *
 * API unificada:
 *   await db.query('SELECT * FROM Users WHERE Id = @id', { id: 1 })
 *   await db.request().input('id', 1).query('SELECT ...')
 *   await db.withTransaction(async tx => { ... })
 *   await db.findById / findOne / find / count / insert / update / delete
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool, Client, types } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, '../../database/migrations');

// ── Tipos PostgreSQL -> tipos nativos JS ───────────────────────────────────────────
types.setTypeParser(20, value => Number(value));       // BIGINT  -> number
types.setTypeParser(1700, value => Number(value));     // NUMERIC -> number
types.setTypeParser(1082, value => new Date(`${value}T00:00:00Z`)); // DATE -> Date (UTC)

export const dbConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT || 5432),
      database: process.env.PGDATABASE || 'kinetix',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || undefined
    };

const pool = new Pool({
  ...dbConfig,
  max: 15,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});
pool.on('error', error => console.error('Database pool error:', error.message));

/** Detecta violación de restricción UNIQUE en PostgreSQL (SQLSTATE 23505). */
export function isUniqueViolation(error) {
  return error?.code === '23505';
}

/**
 * Garantiza que la base de datos objetivo exista en el servidor PostgreSQL.
 * Si fue eliminada o es una instalación limpia, se conecta a la base `postgres` y la crea.
 */
export async function ensureDatabaseExists() {
  let targetDb = dbConfig.database;
  let adminConfig;

  if (dbConfig.connectionString) {
    const url = new URL(dbConfig.connectionString);
    targetDb = decodeURIComponent(url.pathname.replace(/^\//, '')) || 'kinetix';
    url.pathname = '/postgres';
    adminConfig = { connectionString: url.toString() };
  } else {
    targetDb = dbConfig.database || 'kinetix';
    adminConfig = { ...dbConfig, database: 'postgres' };
  }

  if (!/^[A-Za-z0-9_-]+$/.test(targetDb)) {
    throw new Error(`Nombre de base de datos inválido: ${targetDb}`);
  }

  const client = new Client(adminConfig);
  await client.connect();
  try {
    const check = await client.query('SELECT 1 FROM pg_database WHERE datname = $1;', [targetDb]);
    if (check.rowCount === 0) {
      console.log(`[Database] Creando base de datos PostgreSQL "${targetDb}"...`);
      await client.query(`CREATE DATABASE "${targetDb}" ENCODING 'UTF8';`);
      console.log(`[Database] Base de datos "${targetDb}" creada exitosamente.`);
    }
  } finally {
    await client.end().catch(() => {});
  }
}

// ── Restauración de mayúsculas (PascalCase) en los nombres de columna ─────────────
const schemaCase = new Map();
let schemaCaseLoaded = false;

function stripSqlComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/@[A-Za-z0-9_]+/g, ' ');
}

function registerIdentifiers(text, target, onlyIfMissing = true) {
  for (const [token] of stripSqlComments(text).matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) {
    if (!/[a-z]/.test(token) || !/[A-Z]/.test(token)) continue;
    const key = token.toLowerCase();
    if (!onlyIfMissing || !target.has(key)) target.set(key, token);
  }
}

function loadSchemaCase() {
  if (schemaCaseLoaded) return;
  schemaCaseLoaded = true;
  try {
    for (const file of fs.readdirSync(migrationsDir).filter(name => name.endsWith('.sql')).sort()) {
      registerIdentifiers(fs.readFileSync(path.join(migrationsDir, file), 'utf8'), schemaCase);
    }
  } catch { /* sin carpeta de migraciones: se usará el texto de cada consulta */ }
}

const queryCaseCache = new Map();
function caseMapFor(text) {
  let map = queryCaseCache.get(text);
  if (map) return map;
  loadSchemaCase();
  map = new Map(schemaCase);
  registerIdentifiers(text, map, true);
  for (const [, alias] of stripSqlComments(text).matchAll(/\bAS\s+"?([A-Za-z_][A-Za-z0-9_]*)"?/gi)) {
    map.set(alias.toLowerCase(), alias);
  }
  if (queryCaseCache.size > 500) queryCaseCache.clear();
  queryCaseCache.set(text, map);
  return map;
}

// ── Traducción de parámetros nombrados @nombre -> $n ────────────────────────────────
function compile(text, params) {
  if (Array.isArray(params)) return { text, values: params };
  const names = [];
  const values = [];
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "'" || ch === '"') {
      let j = i + 1;
      while (j < text.length) {
        if (text[j] === ch) { if (text[j + 1] === ch) { j += 2; continue; } break; }
        j++;
      }
      out += text.slice(i, j + 1);
      i = j + 1;
    } else if (ch === '@' && /[A-Za-z_]/.test(text[i + 1] || '')) {
      let j = i + 1;
      while (j < text.length && /\w/.test(text[j])) j++;
      const name = text.slice(i + 1, j);
      if (!params || !(name in params)) throw new Error(`Falta el parámetro @${name} en la consulta.`);
      let index = names.indexOf(name);
      if (index === -1) {
        names.push(name);
        values.push(normalizeValue(params[name]));
        index = names.length - 1;
      }
      out += `$${index + 1}`;
      i = j;
    } else {
      out += ch;
      i++;
    }
  }
  return { text: out, values };
}

function normalizeValue(value) {
  if (value === undefined) return null;
  if (value && typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value) && !Array.isArray(value)) {
    return JSON.stringify(value);
  }
  return value;
}

async function execute(client, text, params) {
  const compiled = compile(text, params);
  let result;
  try {
    result = await client.query(compiled.text, compiled.values);
  } catch (error) {
    error.sqlText = compiled.text;
    throw error;
  }
  const caseMap = caseMapFor(text);
  const keys = result.fields?.map(field => caseMap.get(field.name) || field.name) || [];
  const rows = result.fields?.length
    ? result.rows.map(row => {
        const mapped = {};
        result.fields.forEach((field, index) => { mapped[keys[index]] = row[field.name]; });
        return mapped;
      })
    : [];
  const rowCount = result.rowCount ?? rows.length;
  return { rows, recordset: rows, recordsets: [rows], rowCount, rowsAffected: [rowCount] };
}

class Request {
  constructor(runner) {
    this.runner = runner;
    this.params = {};
  }
  input(name, value) {
    this.params[name] = value;
    return this;
  }
  query(text) {
    return this.runner(text, this.params);
  }
}

function createCrud(runner) {
  return {
    async findById(table, id, { select = '*', columns } = {}) {
      if (id == null) return null;
      const cols = Array.isArray(columns) && columns.length ? columns.join(', ') : select;
      const res = await runner(`SELECT ${cols} FROM ${table} WHERE Id = $1 LIMIT 1;`, [id]);
      return res.recordset[0] || null;
    },
    async findOne(table, where = {}, { select = '*' } = {}) {
      const keys = Object.keys(where).filter(k => where[k] !== undefined);
      if (!keys.length) {
        const res = await runner(`SELECT ${select} FROM ${table} LIMIT 1;`, []);
        return res.recordset[0] || null;
      }
      const clauses = keys.map((k, i) => `${k} = $${i + 1}`);
      const values = keys.map(k => where[k]);
      const res = await runner(`SELECT ${select} FROM ${table} WHERE ${clauses.join(' AND ')} LIMIT 1;`, values);
      return res.recordset[0] || null;
    },
    async find(table, where = {}, { select = '*', orderBy, limit, offset } = {}) {
      const keys = Object.keys(where).filter(k => where[k] !== undefined);
      const values = keys.map(k => where[k]);
      let sql = `SELECT ${select} FROM ${table}`;
      if (keys.length) {
        sql += ` WHERE ` + keys.map((k, i) => `${k} = $${i + 1}`).join(' AND ');
      }
      if (orderBy) sql += ` ORDER BY ${orderBy}`;
      if (limit != null) {
        values.push(limit);
        sql += ` LIMIT $${values.length}`;
      }
      if (offset != null) {
        values.push(offset);
        sql += ` OFFSET $${values.length}`;
      }
      sql += ';';
      const res = await runner(sql, values);
      return res.recordset;
    },
    async count(table, where = {}) {
      const keys = Object.keys(where).filter(k => where[k] !== undefined);
      const values = keys.map(k => where[k]);
      let sql = `SELECT COUNT(*)::int AS count FROM ${table}`;
      if (keys.length) {
        sql += ` WHERE ` + keys.map((k, i) => `${k} = $${i + 1}`).join(' AND ');
      }
      sql += ';';
      const res = await runner(sql, values);
      return res.recordset[0]?.count ?? 0;
    },
    async insert(table, data, { returning = '*' } = {}) {
      const keys = Object.keys(data).filter(k => data[k] !== undefined);
      if (!keys.length) throw new Error(`No hay campos para insertar en ${table}`);
      const values = keys.map(k => normalizeValue(data[k]));
      const placeholders = keys.map((_, i) => `$${i + 1}`);
      const returningClause = returning ? ` RETURNING ${returning}` : '';
      const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders.join(', ')})${returningClause};`;
      const res = await runner(sql, values);
      return returning ? res.recordset[0] : res.rowCount;
    },
    async update(table, idOrWhere, data, { returning = '*' } = {}) {
      const dataKeys = Object.keys(data).filter(k => data[k] !== undefined);
      if (!dataKeys.length) throw new Error(`No hay campos para actualizar en ${table}`);
      const values = [];
      const setClauses = dataKeys.map(k => {
        values.push(normalizeValue(data[k]));
        return `${k} = $${values.length}`;
      });

      const where = (typeof idOrWhere === 'object' && idOrWhere !== null) ? idOrWhere : { Id: idOrWhere };
      const whereKeys = Object.keys(where).filter(k => where[k] !== undefined);
      if (!whereKeys.length) throw new Error(`No se especificó condición WHERE para actualizar ${table}`);
      const whereClauses = whereKeys.map(k => {
        values.push(normalizeValue(where[k]));
        return `${k} = $${values.length}`;
      });

      const returningClause = returning ? ` RETURNING ${returning}` : '';
      const sql = `UPDATE ${table} SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}${returningClause};`;
      const res = await runner(sql, values);
      return typeof idOrWhere === 'object' ? res.recordset : (res.recordset[0] || null);
    },
    async delete(table, idOrWhere) {
      const where = (typeof idOrWhere === 'object' && idOrWhere !== null) ? idOrWhere : { Id: idOrWhere };
      const whereKeys = Object.keys(where).filter(k => where[k] !== undefined);
      if (!whereKeys.length) throw new Error(`No se especificó condición WHERE para eliminar en ${table}`);
      const values = whereKeys.map(k => normalizeValue(where[k]));
      const whereClauses = whereKeys.map((k, i) => `${k} = $${i + 1}`);
      const sql = `DELETE FROM ${table} WHERE ${whereClauses.join(' AND ')};`;
      const res = await runner(sql, values);
      return res.rowCount;
    }
  };
}

class Transaction {
  constructor() {
    this.client = null;
    this.crud = null;
  }
  async begin() {
    this.client = await pool.connect();
    await this.client.query('BEGIN');
    this.crud = createCrud((text, params) => execute(this.client, text, params));
    return this;
  }
  request() {
    if (!this.client) throw new Error('La transacción no ha sido iniciada.');
    return new Request((text, params) => execute(this.client, text, params));
  }
  query(text, params) { return execute(this.client, text, params); }
  findById(...args) { return this.crud.findById(...args); }
  findOne(...args) { return this.crud.findOne(...args); }
  find(...args) { return this.crud.find(...args); }
  count(...args) { return this.crud.count(...args); }
  insert(...args) { return this.crud.insert(...args); }
  update(...args) { return this.crud.update(...args); }
  delete(...args) { return this.crud.delete(...args); }
  async commit() { await this.#finish('COMMIT'); }
  async rollback() { await this.#finish('ROLLBACK'); }
  async #finish(command) {
    if (!this.client) return;
    const client = this.client;
    this.client = null;
    try { await client.query(command); } finally { client.release(); }
  }
}

const defaultCrud = createCrud((text, params) => execute(pool, text, params));

export const db = {
  query: (text, params) => execute(pool, text, params),
  request: () => new Request((text, params) => execute(pool, text, params)),
  transaction: () => new Transaction(),
  ...defaultCrud,
  async withTransaction(work) {
    const tx = new Transaction();
    await tx.begin();
    try {
      const result = await work(tx);
      await tx.commit();
      return result;
    } catch (error) {
      await tx.rollback().catch(() => {});
      throw error;
    }
  },
  exec: (script, client = pool) => client.query(script),
  close: () => pool.end()
};
