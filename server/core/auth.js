import crypto from 'node:crypto';
import { db } from './db.js';

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
  await db.insert('UserSessions', {
    TokenHash: hashSessionToken(token),
    UserId: userId,
    ExpiresAt: new Date(Date.now() + sessionTtlMs)
  }, { returning: false });
}

const lastSeenThrottleMs = 60 * 1000;

export async function findPersistentSession(token) {
  if (!token) return null;
  const session = await db.findOne('UserSessions', { TokenHash: hashSessionToken(token) }, {
    select: 'UserId AS userId, ExpiresAt AS expiresAt, LastSeenAt AS lastSeenAt'
  });

  if (session && new Date(session.expiresAt).getTime() < Date.now()) {
    await deletePersistentSession(token);
    return null;
  }
  // Evita una escritura por request: solo refresca LastSeenAt cada minuto.
  if (session && (!session.lastSeenAt || Date.now() - new Date(session.lastSeenAt).getTime() > lastSeenThrottleMs)) {
    await db.update('UserSessions', { TokenHash: hashSessionToken(token) }, {
      LastSeenAt: new Date()
    }, { returning: false });
  }
  return session;
}

/** Elimina sesiones expiradas que nadie volvió a usar. */
export async function purgeExpiredSessions() {
  const result = await db.request()
    .input('now', new Date())
    .query('DELETE FROM UserSessions WHERE ExpiresAt < @now;');
  return result.rowsAffected[0] || 0;
}

export async function deletePersistentSession(token) {
  if (!token) return;
  await db.delete('UserSessions', { TokenHash: hashSessionToken(token) });
}

export async function findUserById(userId) {
  const result = await db.request()
    .input('userId', userId)
    .query(`
      SELECT u.UserId AS userId, u.FirstName AS firstName, u.LastName AS lastName,
             u.Email AS email, u.PasswordHash AS passwordHash, u.IsActive AS isActive,
             u.CompanyId AS companyId,
             u.BranchId AS branchId,
             COALESCE(r.Name, 'Employee') AS role
      FROM UserOrganizations AS u
      LEFT JOIN LATERAL (
        SELECT r.Name FROM UserRoles AS ur
        INNER JOIN Roles AS r ON r.Id = ur.RoleId
        WHERE ur.UserId = u.UserId ORDER BY r.Name
        LIMIT 1
      ) AS r ON TRUE
      WHERE u.UserId = @userId LIMIT 1;
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

    // Solo exponer campos necesarios — no incluir passwordHash
    request.user = {
      userId: user.userId,
      firstName: user.firstName,
      lastName: user.lastName,
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
      const result = await db.request()
        .input('userId', request.user.userId)
        .input('moduleName', moduleName)
        .input('permissionName', permissionName)
        .query(`
          SELECT 1 AS allowed
          FROM UserRoles AS ur
          INNER JOIN RolePermissions AS rp ON rp.RoleId = ur.RoleId
          INNER JOIN Permissions AS p ON p.Id = rp.PermissionId
          WHERE ur.UserId = @userId AND p.ModuleName = @moduleName AND p.PermissionName = @permissionName LIMIT 1;
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
  await db.insert('AuditLogs', {
    UserId: request.user?.userId || null,
    CompanyId: companyId || null,
    BranchId: options.branchId || null,
    ActionName: action,
    ModuleName: moduleName,
    EntityName: entityName || null,
    EntityId: entityId == null ? null : String(entityId),
    OldValues: options.oldValues ? (typeof options.oldValues === 'string' ? options.oldValues : JSON.stringify(options.oldValues)) : null,
    NewValues: options.newValues ? (typeof options.newValues === 'string' ? options.newValues : JSON.stringify(options.newValues)) : null,
    Context: options.context || null,
    IpAddress: request.ip,
    UserAgent: request.get('user-agent') || null
  }, { returning: false });
}
