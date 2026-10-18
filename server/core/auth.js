import crypto from 'node:crypto';
import { getPool, sql } from './db.js';

export const sessionTtlMs = 8 * 60 * 60 * 1000;

export function parseCookies(request) {
  return Object.fromEntries((request.headers.cookie || '').split(';').filter(Boolean).map(cookie => {
    const separator = cookie.indexOf('=');
    return [cookie.slice(0, separator).trim(), decodeURIComponent(cookie.slice(separator + 1).trim())];
  }));
}

export function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createPersistentSession(userId, token) {
  const pool = await getPool();
  await pool.request()
    .input('tokenHash', sql.Char(64), hashSessionToken(token))
    .input('userId', sql.NVarChar(450), userId)
    .input('expiresAt', sql.DateTime2, new Date(Date.now() + sessionTtlMs))
    .query('INSERT INTO dbo.UserSessions (TokenHash, UserId, ExpiresAt) VALUES (@tokenHash, @userId, @expiresAt);');
}

export async function findPersistentSession(token) {
  if (!token) return null;
  const pool = await getPool();
  const result = await pool.request()
    .input('tokenHash', sql.Char(64), hashSessionToken(token))
    .query('SELECT TOP 1 UserId AS userId, ExpiresAt AS expiresAt FROM dbo.UserSessions WHERE TokenHash = @tokenHash;');
  
  const session = result.recordset[0];
  if (session && new Date(session.expiresAt).getTime() < Date.now()) {
    await deletePersistentSession(token);
    return null;
  }
  if (session) {
    await pool.request()
      .input('tokenHash', sql.Char(64), hashSessionToken(token))
      .query('UPDATE dbo.UserSessions SET LastSeenAt = SYSUTCDATETIME() WHERE TokenHash = @tokenHash;');
  }
  return session;
}

export async function deletePersistentSession(token) {
  if (!token) return;
  const pool = await getPool();
  await pool.request()
    .input('tokenHash', sql.Char(64), hashSessionToken(token))
    .query('DELETE FROM dbo.UserSessions WHERE TokenHash = @tokenHash;');
}

export async function findUserById(userId) {
  const pool = await getPool();
  const result = await pool.request()
    .input('userId', sql.NVarChar(450), userId)
    .query(`
      SELECT TOP 1 u.UserId AS userId, u.Email AS email, u.PasswordHash AS passwordHash, u.IsActive AS isActive,
             COALESCE(r.Name, N'Employee') AS role, u.CompanyId AS companyId,
             u.BranchId AS branchId
      FROM dbo.UserOrganizations AS u
      OUTER APPLY (
        SELECT TOP 1 r.Name FROM dbo.UserRoles AS ur
        INNER JOIN dbo.Roles AS r ON r.Id = ur.RoleId
        WHERE ur.UserId = u.UserId ORDER BY r.Name
      ) AS r
      WHERE u.UserId = @userId;
    `);
  return result.recordset[0];
}

export function verifyPassword(password, encodedHash) {
  const [algorithm, digest, iterations, saltValue, hashValue] = String(encodedHash || '').split('$');
  if (algorithm !== 'pbkdf2' || digest !== 'sha512' || !iterations || !saltValue || !hashValue) return false;
  const salt = Buffer.from(saltValue, 'base64');
  const expected = Buffer.from(hashValue, 'base64');
  const actual = crypto.pbkdf2Sync(password, salt, Number(iterations), expected.length, digest);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function createPasswordHash(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha512');
  return ['pbkdf2', 'sha512', '310000', salt.toString('base64'), hash.toString('base64')].join('$');
}

export async function requireAuth(request, response, next) {
  try {
    const token = parseCookies(request).kinetix_session;
    const session = await findPersistentSession(token);
    if (!session) {
      return response.status(401).json({ message: 'La sesión no es válida o ha expirado.' });
    }
    const user = await findUserById(session.userId);
    if (!user?.isActive) return response.status(403).json({ message: 'El usuario está inactivo.' });
    
    // Solo exponer campos necesarios — no incluir passwordHash (S-09)
    request.user = {
      userId: user.userId,
      email: user.email,
      isActive: user.isActive,
      role: user.role,
      companyId: user.companyId,
      branchId: user.branchId
    };
    next();
  } catch (error) {
    console.error('Authentication failed:', error.message);
    response.status(503).json({ message: 'No fue posible validar la sesión.' });
  }
}

export function isGlobalAdmin(request) {
  return request.user?.role === 'Super Admin';
}

export function requireGlobalAdmin(request, response, next) {
  if (!isGlobalAdmin(request)) return response.status(403).json({ message: 'Solo un Super Admin puede administrar organizaciones.' });
  next();
}

export function requireRoleAdministration(request, response, next) {
  if (!['Super Admin', 'Company Admin'].includes(request.user?.role)) {
    return response.status(403).json({ message: 'No tienes acceso a roles y permisos.' });
  }
  next();
}

export function requirePermission(moduleName, permissionName) {
  return async (request, response, next) => {
    if (isGlobalAdmin(request)) return next();
    try {
      const pool = await getPool();
      const result = await pool.request()
        .input('userId', sql.NVarChar(450), request.user.userId)
        .input('moduleName', sql.NVarChar(80), moduleName)
        .input('permissionName', sql.NVarChar(120), permissionName)
        .query(`
          SELECT TOP 1 1 AS allowed
          FROM dbo.UserRoles AS ur
          INNER JOIN dbo.RolePermissions AS rp ON rp.RoleId = ur.RoleId
          INNER JOIN dbo.Permissions AS p ON p.Id = rp.PermissionId
          WHERE ur.UserId = @userId AND p.ModuleName = @moduleName AND p.PermissionName = @permissionName;
        `);
      if (!result.recordset[0]) return response.status(403).json({ message: 'No tienes permiso para realizar esta operación.' });
      next();
    } catch (error) {
      console.error('Permission check failed:', error.message);
      response.status(503).json({ message: 'No fue posible validar los permisos.' });
    }
  };
}

export async function writeAudit(request, action, moduleName, entityName, entityId, companyId = request.user?.companyId, options = {}) {
  const pool = await getPool();
  await pool.request()
    .input('userId', sql.NVarChar(450), request.user?.userId || null)
    .input('companyId', sql.Int, companyId || null)
    .input('branchId', sql.Int, options.branchId || null)
    .input('action', sql.NVarChar(40), action)
    .input('module', sql.NVarChar(80), moduleName)
    .input('entity', sql.NVarChar(80), entityName || null)
    .input('entityId', sql.NVarChar(100), entityId == null ? null : String(entityId))
    .input('oldValues', sql.NVarChar(sql.MAX), options.oldValues ? (typeof options.oldValues === 'string' ? options.oldValues : JSON.stringify(options.oldValues)) : null)
    .input('newValues', sql.NVarChar(sql.MAX), options.newValues ? (typeof options.newValues === 'string' ? options.newValues : JSON.stringify(options.newValues)) : null)
    .input('context', sql.NVarChar(1000), options.context || null)
    .input('ip', sql.VarChar(45), request.ip)
    .input('userAgent', sql.NVarChar(500), request.get('user-agent') || null)
    .query(`
      INSERT INTO dbo.AuditLogs (UserId, CompanyId, BranchId, ActionName, ModuleName, EntityName, EntityId, OldValues, NewValues, Context, IpAddress, UserAgent)
      VALUES (@userId, @companyId, @branchId, @action, @module, @entity, @entityId, @oldValues, @newValues, @context, @ip, @userAgent);
    `);
}
