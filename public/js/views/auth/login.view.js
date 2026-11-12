import { state } from '../../core/state.js';
import { escapeHtml } from '../../components/utils.js';

export function login() {
  return `
    <div class="fiori-app-shell login-shell">
      <!-- 1. SHELL BAR SUPERIOR (SAP Fiori Horizon) -->
      <header class="fiori-shell-bar login-shell-bar">
        <div class="fiori-shell-left">
          <div class="fiori-brand-btn" style="cursor:default;">
            <div class="fiori-brand-mark"><img src="/logo.png" alt="Kinetix Logo"></div>
            <span class="fiori-brand-name">Kinetix</span>
          </div>
          <span class="fiori-app-bar-sep"></span>
          <span class="fiori-space-selector" style="cursor:default;">Portal Corporativo</span>
        </div>

        <div class="fiori-shell-right">
          <span class="login-shell-status">
            <span class="login-status-dot"></span>
            <span>Acceso Seguro</span>
          </span>
        </div>
      </header>

      <!-- 2. CONTENIDO PRINCIPAL DE ACCESO -->
      <main class="fiori-main-viewport login-viewport">
        <div class="login-card-split">
          
          <!-- Columna Izquierda: Identidad Corporativa Sobria y Compacta -->
          <aside class="login-brand-pane">
            <div class="login-brand-identity">
              <div class="login-brand-logo">
                <img src="/logo.png" alt="Kinetix Logo">
              </div>
              <h1>Kinetix</h1>
              <p>Sistema de Gestión Empresarial</p>
            </div>

            <div class="login-brand-footer">
              <small>© 2026 Kinetix Core · Todos los derechos reservados.</small>
            </div>
          </aside>

          <!-- Columna Derecha: Formulario de Autenticación -->
          <section class="login-form-pane">
            <div class="login-box">
              <div class="login-header-group">
                <span class="eyebrow">PORTAL DE ACCESO</span>
                <h2>Iniciar sesión</h2>
                <p>Ingresa tus credenciales corporativas para continuar.</p>
              </div>

              <form id="login-form">
                <div class="field">
                  <label for="login-email-input">Correo Electrónico Corporativo</label>
                  <input name="email" id="login-email-input" type="email" required placeholder="usuario@empresa.com" autocomplete="username">
                </div>
                <div class="field">
                  <div class="login-password-label-row">
                    <label for="login-password-input">Contraseña</label>
                    <button type="button" class="link-btn" data-action="forgot-password">¿Olvidaste tu contraseña?</button>
                  </div>
                  <input name="password" id="login-password-input" type="password" required placeholder="Tu contraseña" autocomplete="current-password">
                </div>
                <div class="login-options">
                  <label class="check"><input type="checkbox" checked> Mantener sesión activa</label>
                </div>
                <button class="primary login-submit" type="submit">
                  <span>Ingresar al Sistema</span>
                  <svg viewBox="0 0 20 20" fill="currentColor" style="width:16px;height:16px;">
                    <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd"/>
                  </svg>
                </button>
              </form>
            </div>
          </section>

        </div>
      </main>
    </div>
  `;
}

export function resetPasswordView() {
  return `
    <div class="fiori-app-shell login-shell">
      <header class="fiori-shell-bar login-shell-bar">
        <div class="fiori-shell-left">
          <div class="fiori-brand-btn" style="cursor:default;">
            <div class="fiori-brand-mark"><img src="/logo.png" alt="Kinetix Logo"></div>
            <span class="fiori-brand-name">Kinetix</span>
          </div>
          <span class="fiori-app-bar-sep"></span>
          <span class="fiori-space-selector" style="cursor:default;">Recuperación de Acceso</span>
        </div>
      </header>

      <main class="fiori-main-viewport login-viewport">
        <div class="login-card-split">
          <aside class="login-brand-pane">
            <div class="login-brand-identity">
              <div class="login-brand-logo">
                <img src="/logo.png" alt="Kinetix Logo">
              </div>
              <h1>Kinetix</h1>
              <p>Sistema de Gestión Empresarial</p>
            </div>

            <div class="login-brand-footer">
              <small>© 2026 Kinetix Core · Todos los derechos reservados.</small>
            </div>
          </aside>

          <section class="login-form-pane">
            <div class="login-box">
              <div class="login-header-group">
                <span class="eyebrow">RECUPERACIÓN SEGURA</span>
                <h2>Restablecer contraseña</h2>
                <p>Ingresa tu nueva contraseña para <strong>${escapeHtml(state.resetEmail)}</strong>.</p>
              </div>
              <form id="reset-password-form">
                <div class="field">
                  <label>Nueva contraseña</label>
                  <input name="password" type="password" required minlength="10" placeholder="Mínimo 10 caracteres alfanuméricos">
                  <span class="helper">Usa una combinación de mayúsculas, minúsculas, números y símbolos.</span>
                </div>
                <div style="display:flex;gap:10px;margin-top:6px;">
                  <button type="button" class="secondary" data-action="back-to-login" style="flex:1;">Volver al login</button>
                  <button class="primary login-submit" type="submit" style="flex:1;margin-top:0;">Actualizar contraseña</button>
                </div>
              </form>
            </div>
          </section>
        </div>
      </main>
    </div>
  `;
}
