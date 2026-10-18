import { state, hasPermission } from '../../core/state.js';
import { badge, escapeHtml } from '../../components/utils.js';
import { breadcrumb } from '../../components/ui.js';

export function userDetail(id) {
  const u = state.users.find(x => String(x.id) === String(id));
  if (!u) return '<div class="empty">Usuario no encontrado.</div>';
  return `
    ${breadcrumb([['dashboard', 'Administración'], ['users', 'Usuarios'], ['users', u.name]])}
    <div class="detail-head">
      <div>
        <h1>${escapeHtml(u.name)}</h1>
        <p class="subtitle">${escapeHtml(u.email)} · ${badge(u.status)}</p>
      </div>
      <div class="inline-actions">
        ${hasPermission('Usuarios', 'Editar usuarios') ? `<button class="secondary" data-action="admin-reset-user-password" data-id="${u.id}" data-name="${escapeHtml(u.name)}">Asignar contraseña</button>` : ''}
        ${hasPermission('Usuarios', 'Desactivar usuarios') ? `
          <button class="${u.status === 'Activa' ? 'danger' : 'primary'}" data-action="toggle-user">
            ${u.status === 'Activa' ? 'Desactivar' : 'Activar'}
          </button>
        ` : ''}
      </div>
    </div>
    <div class="grid-2">
      <div class="panel">
        <div class="panel-head"><h2>Datos de acceso</h2></div>
        <div class="panel-body">
          <div class="form-grid">
            <div><span class="panel-note">Empresa</span><p><strong>${escapeHtml(u.company)}</strong></p></div>
            <div><span class="panel-note">Sucursal</span><p><strong>${escapeHtml(u.branch)}</strong></p></div>
            <div><span class="panel-note">Rol</span><p><span class="tag-neutral">${escapeHtml(u.role)}</span></p></div>
            <div><span class="panel-note">Último acceso</span><p><strong>${escapeHtml(u.last)}</strong></p></div>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Actividad reciente</h2></div>
        <div class="panel-body activity">
          ${state.audit.filter(a => a.user === u.name).map(a => `
            <div class="activity-item">
              <span class="activity-bullet"></span>
              <div>
                <p><strong>${escapeHtml(a.action)}</strong> en ${escapeHtml(a.module)}</p>
                <small>${escapeHtml(a.date)}</small>
              </div>
            </div>
          `).join('') || '<p class="panel-note">Sin actividad reciente registrada.</p>'}
        </div>
      </div>
    </div>
  `;
}
