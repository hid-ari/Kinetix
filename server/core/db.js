import sql from 'mssql/msnodesqlv8.js';

export const dbConfig = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_DATABASE || 'KinetixCore',
  ...(process.env.DB_AUTH === 'windows' ? {
    driver: 'msnodesqlv8',
    connectionString: `Driver={ODBC Driver 18 for SQL Server};Server=${process.env.DB_SERVER || '(localdb)\\MSSQLLocalDB'};Database=${process.env.DB_DATABASE || 'KinetixCore'};Trusted_Connection=Yes;Encrypt=No;TrustServerCertificate=Yes;`,
    options: {
      trustedConnection: true,
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false'
    }
  } : {
    port: Number(process.env.DB_PORT || 1433),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false'
    }
  }),
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let poolPromise;
export function getPool() {
  if (process.env.DB_AUTH !== 'windows' && (!dbConfig.user || !dbConfig.password)) {
    throw new Error('Faltan DB_USER o DB_PASSWORD en el archivo .env');
  }
  if (!poolPromise) {
    poolPromise = sql.connect(dbConfig).catch(error => {
      poolPromise = undefined;
      throw error;
    });
  }
  return poolPromise;
}

let activePool = null;
export function setActivePool(pool) {
  activePool = pool;
}
export function getActivePool() {
  return activePool;
}

export const poolProxy = new Proxy({}, {
  get(_target, prop) {
    const pool = activePool || poolPromise;
    if (!pool) throw new Error('Database pool not ready yet');
    // If activePool is resolved, return its property/method
    if (activePool) {
      const val = activePool[prop];
      return typeof val === 'function' ? val.bind(activePool) : val;
    }
    // Fallback if pool is still a promise
    return (...args) => pool.then(resolvedPool => {
      const val = resolvedPool[prop];
      return typeof val === 'function' ? val.apply(resolvedPool, args) : val;
    });
  }
});

export { sql };
