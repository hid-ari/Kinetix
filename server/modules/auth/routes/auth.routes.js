import { Router } from 'express';
import crypto from 'node:crypto';
import { db } from '../../../core/db.js';
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
      const account = await db.findOne('UserOrganizations', { Email: email.trim() }, {
        select: 'UserId, PasswordHash, IsActive'
      });
      if (!account?.IsActive || !verifyPassword(password, account.PasswordHash)) {
        try {
          await db.insert('AuditLogs', {
            UserId: account?.UserId || null,
            ActionName: 'LOGIN_FAILED',
            ModuleName: 'Acceso',
            EntityName: 'User',
            EntityId: email.trim(),
            IpAddress: request.ip,
            UserAgent: request.get('user-agent') || null
          }, { returning: false });
        } catch (_auditError) { /* no bloquear el flujo por error de auditoría */ }
        return response.status(401).json({ message: 'Email o contraseña incorrectos.' });
      }
      const token = crypto.randomBytes(32).toString('hex');
      await createPersistentSession(account.UserId, token);
      await db.update('UserOrganizations', { UserId: account.UserId }, {
        LastLoginAt: new Date()
      }, { returning: false });
      await db.insert('AuditLogs', {
        UserId: account.UserId,
        ActionName: 'LOGIN',
        ModuleName: 'Acceso',
        IpAddress: request.ip,
        UserAgent: request.get('user-agent') || null
      }, { returning: false });
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
      await db.update('UserOrganizations', { UserId: request.user.userId }, {
        PasswordHash: createPasswordHash(newPassword),
        UpdatedAt: new Date()
      }, { returning: false });
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

  router.post('/forgot-password', async (request, response) => {
    const { email } = request.body;
    if (!email) return response.status(400).json({ message: 'Email es obligatorio.' });
    const user = await db.findOne('UserOrganizations', { Email: email.trim(), IsActive: true }, {
      select: 'UserId, FirstName'
    });
    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expires = new Date(Date.now() + 15 * 60 * 1000);
      await db.update('UserOrganizations', { UserId: user.UserId }, {
        ResetToken: tokenHash,
        ResetTokenExpiresAt: expires
      }, { returning: false });
      console.log(`[EMAIL] To: ${email} | Subject: Recuperación de contraseña | Link: /reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`);
    }
    response.json({ message: 'Si el correo existe, recibirás un enlace de recuperación.' });
  });

  router.post('/reset-password', async (request, response) => {
    const { email, token, newPassword } = request.body;
    if (!email || !token || !newPassword || newPassword.length < 10) {
      return response.status(400).json({ message: 'Datos incompletos o contraseña muy corta.' });
    }
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await db.findOne('UserOrganizations', { Email: email.trim(), ResetToken: tokenHash, IsActive: true }, {
      select: 'UserId, ResetTokenExpiresAt'
    });
    if (!user || new Date(user.ResetTokenExpiresAt) < new Date()) {
      return response.status(400).json({ message: 'Token inválido o expirado.' });
    }
    await db.update('UserOrganizations', { UserId: user.UserId }, {
      PasswordHash: createPasswordHash(newPassword),
      ResetToken: null,
      ResetTokenExpiresAt: null,
      UpdatedAt: new Date()
    }, { returning: false });
    response.json({ message: 'Contraseña actualizada correctamente.' });
  });

  return router;
}

export function createHealthRouter() {
  const router = Router();
  router.get('/health', async (_request, response) => {
    try {
      const result = await db.request().query('SELECT current_database() AS databaseName, now() AS serverTime');
      response.json({ connected: true, ...result.recordset[0] });
    } catch (error) {
      console.error('Database health check failed:', error.message);
      response.status(503).json({ connected: false, message: 'No fue posible conectar con la base de datos.' });
    }
  });
  return router;
}
