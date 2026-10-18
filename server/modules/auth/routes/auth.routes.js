import { Router } from 'express';
import crypto from 'node:crypto';
import { getPool, sql } from '../../../core/db.js';
import {
  sessionTtlMs,
  parseCookies,
  createPersistentSession,
  deletePersistentSession,
  findUserById,
  verifyPassword,
  createPasswordHash,
  writeAudit
} from '../../../core/auth.js';
import { loginLimiter } from '../../../core/security.js';

export function createAuthRouter() {
  const router = Router();

  router.post('/login', loginLimiter, async (request, response) => {
    const { email, password } = request.body;
    if (!email?.trim() || !password) {
      return response.status(400).json({ message: 'Email y contraseña son obligatorios.' });
    }
    try {
      const pool = await getPool();
      const result = await pool.request()
        .input('email', sql.NVarChar(254), email.trim())
        .query('SELECT TOP 1 UserId, PasswordHash, IsActive FROM dbo.UserOrganizations WHERE Email = @email;');
      const account = result.recordset[0];
      if (!account?.IsActive || !verifyPassword(password, account.PasswordHash)) {
        // M-04: Auditar login fallido
        try {
          const failedRequest = pool.request()
            .input('userId', sql.NVarChar(450), account?.UserId || null)
            .input('action', sql.NVarChar(40), 'LOGIN_FAILED')
            .input('module', sql.NVarChar(80), 'Acceso')
            .input('entity', sql.NVarChar(80), 'User')
            .input('entityId', sql.NVarChar(100), email.trim())
            .input('ip', sql.VarChar(45), request.ip)
            .input('userAgent', sql.NVarChar(500), request.get('user-agent') || null);
          await failedRequest.query(`INSERT INTO dbo.AuditLogs (UserId, ActionName, ModuleName, EntityName, EntityId, IpAddress, UserAgent)
                  VALUES (@userId, @action, @module, @entity, @entityId, @ip, @userAgent);`);
        } catch (_auditError) { /* no bloquear el flujo por error de auditoría */ }
        return response.status(401).json({ message: 'Email o contraseña incorrectos.' });
      }
      const token = crypto.randomBytes(32).toString('hex');
      await createPersistentSession(account.UserId, token);
      await pool.request().input('userId', sql.NVarChar(450), account.UserId)
        .query('UPDATE dbo.UserOrganizations SET LastLoginAt = SYSUTCDATETIME() WHERE UserId = @userId;');
      await pool.request().input('userId', sql.NVarChar(450), account.UserId)
        .input('action', sql.NVarChar(40), 'LOGIN').input('module', sql.NVarChar(80), 'Acceso')
        .input('ip', sql.VarChar(45), request.ip).input('userAgent', sql.NVarChar(500), request.get('user-agent') || null)
        .query(`INSERT INTO dbo.AuditLogs (UserId, ActionName, ModuleName, IpAddress, UserAgent)
                VALUES (@userId, @action, @module, @ip, @userAgent);`);
      const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
      response.setHeader('Set-Cookie', `kinetix_session=${encodeURIComponent(token)}; Max-Age=${sessionTtlMs / 1000}; Path=/; HttpOnly; SameSite=Lax${secureFlag}`);
      response.json({ authenticated: true });
    } catch (error) {
      console.error('Login failed:', error.message);
      response.status(500).json({ message: 'No fue posible iniciar sesión.' });
    }
  });

  router.post('/change-password', async (request, response) => {
    const { currentPassword, newPassword } = request.body;
    if (!currentPassword || !newPassword || newPassword.length < 10) {
      return response.status(400).json({ message: 'La nueva contraseña debe tener al menos 10 caracteres.' });
    }
    try {
      const user = await findUserById(request.user.userId);
      if (!verifyPassword(currentPassword, user?.passwordHash || request.user.passwordHash)) {
        return response.status(401).json({ message: 'La contraseña actual es incorrecta.' });
      }
      const pool = await getPool();
      await pool.request().input('userId', sql.NVarChar(450), request.user.userId)
        .input('passwordHash', sql.NVarChar(500), createPasswordHash(newPassword))
        .query('UPDATE dbo.UserOrganizations SET PasswordHash = @passwordHash, UpdatedAt = SYSUTCDATETIME() WHERE UserId = @userId;');
      await writeAudit(request, 'PASSWORD_CHANGE', 'Acceso', 'User', request.user.userId);
      response.status(204).end();
    } catch (error) {
      console.error('Password change failed:', error.message);
      response.status(500).json({ message: 'No fue posible cambiar la contraseña.' });
    }
  });

  router.post('/logout', async (request, response) => {
    await deletePersistentSession(parseCookies(request).kinetix_session);
    response.clearCookie('kinetix_session');
    response.status(204).end();
  });

  // M-03: Recuperación de contraseña
  router.post('/forgot-password', async (request, response) => {
    const { email } = request.body;
    if (!email) return response.status(400).json({ message: 'Email es obligatorio.' });
    const pool = await getPool();
    const result = await pool.request().input('email', sql.NVarChar(254), email.trim()).query('SELECT UserId, FirstName FROM dbo.UserOrganizations WHERE Email = @email AND IsActive = 1;');
    const user = result.recordset[0];
    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
      await pool.request().input('userId', sql.NVarChar(450), user.UserId).input('token', sql.Char(64), tokenHash).input('expires', sql.DateTime2, expires)
        .query('UPDATE dbo.UserOrganizations SET ResetToken = @token, ResetTokenExpiresAt = @expires WHERE UserId = @userId;');
      // Simular envío de correo escribiendo en el logger
      console.log(`[EMAIL] To: ${email} | Subject: Recuperación de contraseña | Link: /reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`);
    }
    // Respondemos 200 siempre para no enumerar usuarios
    response.json({ message: 'Si el correo existe, recibirás un enlace de recuperación.' });
  });

  router.post('/reset-password', async (request, response) => {
    const { email, token, newPassword } = request.body;
    if (!email || !token || !newPassword || newPassword.length < 10) return response.status(400).json({ message: 'Datos incompletos o contraseña muy corta.' });
    const pool = await getPool();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const result = await pool.request().input('email', sql.NVarChar(254), email).input('token', sql.Char(64), tokenHash)
      .query('SELECT UserId, ResetTokenExpiresAt FROM dbo.UserOrganizations WHERE Email = @email AND ResetToken = @token AND IsActive = 1;');
    const user = result.recordset[0];
    if (!user || new Date(user.ResetTokenExpiresAt) < new Date()) {
      return response.status(400).json({ message: 'Token inválido o expirado.' });
    }
    const passwordHash = await crypto.promises.pbkdf2(newPassword, crypto.randomBytes(16), 100000, 64, 'sha512').then(h => h.toString('hex'));
    await pool.request().input('userId', sql.NVarChar(450), user.UserId).input('hash', sql.VarChar(255), passwordHash)
      .query('UPDATE dbo.UserOrganizations SET PasswordHash = @hash, ResetToken = NULL, ResetTokenExpiresAt = NULL WHERE UserId = @userId;');
    response.json({ message: 'Contraseña actualizada correctamente.' });
  });

  return router;
}

export function createHealthRouter() {
  const router = Router();
  router.get('/health', async (_request, response) => {
    try {
      const pool = await getPool();
      const result = await pool.request().query('SELECT DB_NAME() AS databaseName, SYSUTCDATETIME() AS serverTime');
      response.json({ connected: true, ...result.recordset[0] });
    } catch (error) {
      console.error('Database health check failed:', error.message);
      response.status(503).json({ connected: false, message: 'No fue posible conectar con la base de datos.' });
    }
  });
  return router;
}
