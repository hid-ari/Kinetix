import { state } from '../../core/state.js';
import { escapeHtml } from '../../components/utils.js';

export function login() {
  return `<div class="login-page">
    <div class="login-aside">
      <div class="brand">
        <div class="brand-mark"><img src="/logo.png" alt="Kinetix Logo"></div>
        <div><strong>Kinetix</strong><small>Administración Kinetix</small></div>
      </div>
      <div class="login-message">
        <span class="eyebrow">OPERACIONES SIN FRICCIÓN</span>
        <h1>El pulso de tu empresa, en un solo lugar.</h1>
        <p>Gestiona personas, permisos y sucursales con la claridad que exige el trabajo diario.</p>
      </div>
      <small class="login-legal">Kinetix Core · Plataforma de administración empresarial</small>
    </div>
    <div class="login-form">
      <div class="login-box">
        <span class="eyebrow">BIENVENIDO DE VUELTA</span>
        <h2>Iniciar sesión</h2>
        <p>Accede a tu espacio de trabajo seguro.</p>
        <form id="login-form">
          <div class="field">
            <label>Email</label>
            <input name="email" type="email" required value="" placeholder="tu@email.com">
          </div>
          <div class="field">
            <label>Contraseña</label>
            <input name="password" type="password" required value="" placeholder="Tu contraseña">
          </div>
          <div class="login-options">
            <label class="check"><input type="checkbox" checked> Recordarme</label>
            <button type="button" class="row-action" data-action="forgot-password">¿Olvidaste tu contraseña?</button>
          </div>
          <button class="primary login-submit">Iniciar sesión <span>→</span></button>
        </form>
      </div>
    </div>
  </div>`;
}

export function resetPasswordView() {
  return `<div class="login-page">
    <div class="login-form" style="width: 100%">
      <div class="login-box">
        <span class="eyebrow">RECUPERACIÓN</span>
        <h2>Restablecer contraseña</h2>
        <p>Ingresa tu nueva contraseña para ${escapeHtml(state.resetEmail)}.</p>
        <form id="reset-password-form">
          <div class="field">
            <label>Nueva contraseña</label>
            <input name="password" type="password" required minlength="10" placeholder="Mínimo 10 caracteres">
          </div>
          <button class="primary login-submit">Actualizar contraseña</button>
        </form>
      </div>
    </div>
  </div>`;
}
