import { state } from '../../core/state.js';
import { escapeHtml } from '../../components/utils.js';
import { breadcrumb, pageHeader } from '../../components/ui.js';

export function profile() {
  const user = state.currentUser || {};
  return `
    ${breadcrumb([['dashboard', 'Administración'], ['profile', 'Mi perfil']])}
    ${pageHeader('Mi perfil', 'Gestiona tus datos personales y credenciales.')}
    <form id="profile-form" class="panel form-layout">
      <div class="form-section">
        <h3>Información personal</h3>
        <div class="form-grid">
          <div class="field">
            <label>Nombre</label>
            <input name="firstName" required value="${escapeHtml(user.firstName)}">
          </div>
          <div class="field">
            <label>Apellido</label>
            <input name="lastName" required value="${escapeHtml(user.lastName)}">
          </div>
          <div class="field">
            <label>Email</label>
            <input name="email" required value="${escapeHtml(user.email)}" type="email">
          </div>
          <div class="field">
            <label>Teléfono</label>
            <input name="phone" value="${escapeHtml(user.phone)}">
          </div>
        </div>
      </div>
      <div class="form-section">
        <h3>Acceso y organización</h3>
        <div class="form-grid">
          <div class="field">
            <label>Empresa</label>
            <input value="${escapeHtml(user.company)}" disabled>
          </div>
          <div class="field">
            <label>Rol</label>
            <input value="${escapeHtml(user.role)}" disabled>
          </div>
          <div class="field">
            <label>Sucursal</label>
            <input value="${escapeHtml(user.branch || 'Sin sucursal')}" disabled>
          </div>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="secondary" data-action="change-password">Cambiar contraseña</button>
        <button type="button" class="danger" data-action="logout">Cerrar sesión</button>
        <button type="submit" class="primary">Guardar cambios</button>
      </div>
    </form>
  `;
}
