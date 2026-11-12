import { state, canManageRoles } from '../../core/state.js';
import { escapeHtml } from '../../components/utils.js';
import { breadcrumb, pageHeader } from '../../components/ui.js';

export function roles() {
  const canManage = canManageRoles();
  return `
    ${breadcrumb([['dashboard', 'Administración'], ['roles', 'Roles y permisos']])}
    ${pageHeader('Roles y Permisos', 'Define el alcance, privilegios y accesos de cada perfil dentro de Kinetix.', canManage ? '<button class="primary" data-action="new-role">＋ Nuevo rol</button>' : '')}
    <div class="panel">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nombre del Rol</th>
              <th>Descripción</th>
              <th>Usuarios Asignados</th>
              <th>Tipo</th>
              <th style="text-align:right;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${state.roles.map(r => `
              <tr>
                <td><strong>${escapeHtml(r.name)}</strong></td>
                <td><small style="color:var(--muted);">${escapeHtml(r.description || 'Sin descripción')}</small></td>
                <td><strong style="font-variant-numeric:tabular-nums;">${r.userCount ?? 0}</strong> activos</td>
                <td>
                  ${(r.isSystem || r.type === 'Sistema')
                    ? `<span class="tag-neutral" style="background:rgba(59,130,246,0.12);color:#3b82f6;border:1px solid rgba(59,130,246,0.3);font-weight:600;">Sistema</span>`
                    : `<span class="tag-neutral">${escapeHtml(r.type || 'Personalizado')}</span>`
                  }
                </td>
                <td style="text-align:right;">
                  ${canManage ? `
                    <button class="row-action" data-action="edit-role" data-role="${escapeHtml(r.name)}" data-role-id="${r.id}">
                      Editar
                    </button>
                    ${!(r.isSystem || r.type === 'Sistema') ? `
                      <button class="row-action" data-action="delete-role" data-role="${escapeHtml(r.name)}" data-role-id="${r.id}" style="color:var(--danger,#ef4444);margin-left:6px;">
                        Eliminar
                      </button>
                    ` : `
                      <span style="color:var(--muted);font-size:11px;margin-left:8px;opacity:0.7;" title="Rol esencial protegido contra eliminación">Fijo</span>
                    `}
                  ` : '<span class="panel-note">Solo lectura</span>'}
                </td>
              </tr>
            `).join('') || '<tr><td colspan="5" class="empty">No hay roles registrados.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
