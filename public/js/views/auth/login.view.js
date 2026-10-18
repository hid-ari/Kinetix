import { state } from '../../core/state.js';
import { escapeHtml } from '../../components/utils.js';

export function login() {
  return `<div class="login-page">
    <div class="login-aside">
      <div class="login-aside-glow"></div>
      <div class="brand">
        <div class="brand-mark"><img src="/logo.png" alt="Kinetix Logo"></div>
        <div>
          <strong>Kinetix</strong>
          <small>Core Administration & ERP</small>
        </div>
      </div>
      <div class="login-message">
        <div class="login-badge-pill">
          <span class="login-badge-dot"></span>
          <span>SISTEMA DE GESTIÓN EMPRESARIAL 2.0</span>
        </div>
        <h1>El pulso integral de tu organización en una sola plataforma.</h1>
        <p>Recursos Humanos, control de asistencias, aprobaciones, inventario multisede y finanzas operativas con total precisión y trazabilidad.</p>
        
        <div class="login-features-list">
          <div class="login-feature-item">
            <span class="login-feature-icon">✓</span>
            <div>
              <strong>Gestión de RRHH & Código de Trabajo</strong>
              <small>Vacaciones escala Art. 177, licencias, asistencias y flujos multietapa</small>
            </div>
          </div>
          <div class="login-feature-item">
            <span class="login-feature-icon">✓</span>
            <div>
              <strong>Seguridad & Auditoría Inmutable</strong>
              <small>Control RBAC granular, permisos jerárquicos y registro blindado</small>
            </div>
          </div>
          <div class="login-feature-item">
            <span class="login-feature-icon">✓</span>
            <div>
              <strong>Operaciones & Finanzas en Tiempo Real</strong>
              <small>Control de existencias, kardex de movimientos y balance corporativo</small>
            </div>
          </div>
        </div>
      </div>
      <div class="login-aside-footer">
        <div class="login-security-tag">
          <svg viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;"><path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
          <span>Seguridad Empresarial · TLS 1.3 · Sesiones Encriptadas</span>
        </div>
        <small class="login-legal">© 2026 Kinetix Core · Todos los derechos reservados.</small>
      </div>
    </div>
    <div class="login-form">
      <div class="login-box">
        <div class="login-header-group">
          <span class="eyebrow">PORTAL DE ACCESO SEGURO</span>
          <h2>Iniciar sesión</h2>
          <p>Ingresa tus credenciales corporativas para acceder a tu panel.</p>
        </div>

        <form id="login-form">
          <div class="field">
            <label>Correo Electrónico Corporativo</label>
            <input name="email" id="login-email-input" type="email" required placeholder="usuario@empresa.com" autocomplete="username">
          </div>
          <div class="field">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <label style="margin:0;">Contraseña</label>
              <button type="button" class="row-action link-style-action" data-action="forgot-password" style="font-size:11.5px;padding:0;border:none;background:none;">¿Olvidaste tu contraseña?</button>
            </div>
            <input name="password" id="login-password-input" type="password" required placeholder="Tu contraseña" autocomplete="current-password">
          </div>
          <div class="login-options">
            <label class="check"><input type="checkbox" checked> Mantener sesión activa</label>
          </div>
          <button class="primary login-submit" type="submit">
            <span>Ingresar al Sistema</span>
            <svg viewBox="0 0 20 20" fill="currentColor" style="width:16px;height:16px;"><path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
          </button>
        </form>
      </div>
    </div>
  </div>`;
}

export function resetPasswordView() {
  return `<div class="login-page">
    <div class="login-form" style="width: 100%">
      <div class="login-box">
        <span class="eyebrow">RECUPERACIÓN SEGURA</span>
        <h2>Restablecer contraseña</h2>
        <p>Ingresa tu nueva contraseña para <strong>${escapeHtml(state.resetEmail)}</strong>.</p>
        <form id="reset-password-form">
          <div class="field">
            <label>Nueva contraseña</label>
            <input name="password" type="password" required minlength="10" placeholder="Mínimo 10 caracteres alfanuméricos">
            <span class="helper">Usa una combinación de mayúsculas, minúsculas, números y símbolos.</span>
          </div>
          <div style="display:flex;gap:10px;margin-top:12px;">
            <button type="button" class="secondary" data-action="back-to-login" style="flex:1;">Volver al login</button>
            <button class="primary login-submit" type="submit" style="flex:1;">Actualizar contraseña</button>
          </div>
        </form>
      </div>
    </div>
  </div>`;
}

