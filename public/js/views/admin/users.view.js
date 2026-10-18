import { state, hasPermission } from '../../core/state.js';
import { escapeHtml, badge, initials as getInitials } from '../../components/utils.js';
import { breadcrumb, pageHeader } from '../../components/ui.js';

export function users() {
  const items = state.users.filter(u => `${u.name} ${u.email} ${u.company}`.toLowerCase().includes(state.query.toLowerCase()) && (!state.usersStatusFilter || u.status === state.usersStatusFilter));
  const pageCount = Math.max(Math.ceil(state.usersTotal / state.usersPageSize), 1);
  const start = state.usersTotal ? ((state.usersPage - 1) * state.usersPageSize) + 1 : 0;
  const end = start ? Math.min(start + items.length - 1, state.usersTotal) : 0;
  return `
    ${breadcrumb([['dashboard', 'Administración'], ['users', 'Usuarios']])}
    ${pageHeader('Usuarios', 'Controla identidades, perfiles y acceso multi-inquilino por empresa.', hasPermission('Usuarios', 'Crear usuarios') ? '<button class="primary" data-action="new-user">＋ Nuevo usuario</button>' : '')}
    <div class="panel">
      <div class="table-toolbar">
        <div class="filter-row">
          <input id="page-search" placeholder="Buscar nombre o email..." value="${escapeHtml(state.query)}" style="min-width:260px;">
          <select data-users-status-filter>
            <option value="">Todos los estados</option>
            <option value="Activa" ${state.usersStatusFilter === 'Activa' ? 'selected' : ''}>Activa</option>
            <option value="Inactiva" ${state.usersStatusFilter === 'Inactiva' ? 'selected' : ''}>Inactiva</option>
          </select>
        </div>
        <span class="panel-note">${state.usersTotal} usuarios</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Empresa</th>
              <th>Sucursal</th>
              <th>Rol de Acceso</th>
              <th>Estado</th>
              <th>Último Acceso</th>
              <th style="text-align:right;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(u => {
              const uInitials = getInitials(u.name || 'Usuario');
              return `
                <tr>
                  <td>
                    <div class="emp-cell-flex">
                      <div class="emp-avatar-sm" style="width:34px;height:34px;font-size:11.5px;">
                        ${escapeHtml(uInitials)}
                      </div>
                      <div class="emp-cell-info">
                        <strong>${escapeHtml(u.name)}</strong>
                        <small>${escapeHtml(u.email)}</small>
                      </div>
                    </div>
                  </td>
                  <td><strong>${escapeHtml(u.company)}</strong></td>
                  <td>${escapeHtml(u.branch || 'Todas')}</td>
                  <td><span class="tag-neutral">${escapeHtml(u.role)}</span></td>
                  <td>${badge(u.status)}</td>
                  <td><span style="font-variant-numeric:tabular-nums; color:var(--muted); font-size:12px;">${u.last}</span></td>
                  <td style="text-align:right;">
                    <button class="row-action" data-detail="user" data-id="${u.id}">Ver detalle →</button>
                  </td>
                </tr>
              `;
            }).join('') || '<tr><td colspan="7" class="empty">No encontramos usuarios con ese criterio.</td></tr>'}
          </tbody>
        </table>
      </div>
      <div class="pagination">
        <span>Mostrando ${start}-${end} de ${state.usersTotal} registros</span>
        <div class="pages">
          ${Array.from({ length: pageCount }, (_, i) => `
            <button class="${i + 1 === state.usersPage ? 'active' : ''}" data-users-page="${i + 1}">${i + 1}</button>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}
