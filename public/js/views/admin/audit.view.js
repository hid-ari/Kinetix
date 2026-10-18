import { state } from '../../core/state.js';
import { escapeHtml, badge, initials as getInitials } from '../../components/utils.js';
import { breadcrumb, pageHeader } from '../../components/ui.js';

export function audit() {
  return `
    ${breadcrumb([['dashboard', 'Administración'], ['audit', 'Auditoría']])}
    ${pageHeader('Auditoría', 'Registro inmutable de trazabilidad de acciones operativas y de seguridad.', '<button class="secondary" data-action="export-audit">⇓ Exportar CSV</button>')}
    <div class="panel">
      <div class="table-toolbar">
        <div class="filter-row">
          <input id="page-search" placeholder="Buscar usuario o registro..." value="${escapeHtml(state.auditSearch)}" style="min-width:240px;">
          <select data-audit-filter="module">
            <option value="">Todos los módulos</option>
            <option value="Usuarios">Usuarios</option>
            <option value="Empresas">Empresas</option>
            <option value="Sucursales">Sucursales</option>
            <option value="Acceso">Acceso</option>
            <option value="Inventario">Inventario</option>
            <option value="Finanzas">Finanzas</option>
            <option value="Roles">Roles</option>
          </select>
          <select data-audit-filter="action">
            <option value="">Todas las acciones</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="LOGIN">LOGIN</option>
            <option value="LOGIN_FAILED">LOGIN_FAILED</option>
            <option value="ACTIVATE">ACTIVATE</option>
            <option value="DEACTIVATE">DEACTIVATE</option>
            <option value="PASSWORD_CHANGE">PASSWORD_CHANGE</option>
          </select>
          <button class="primary" data-action="refresh-audit" style="padding:0 16px;">Buscar</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha y Hora</th>
              <th>Usuario</th>
              <th>Acción</th>
              <th>Módulo</th>
              <th>Registro Afectado</th>
              <th>Dirección IP</th>
              <th style="text-align:right;">Detalle</th>
            </tr>
          </thead>
          <tbody>
            ${state.audit.map(a => {
              const aInitials = getInitials(a.user || 'Admin');
              return `
                <tr>
                  <td><span style="font-variant-numeric:tabular-nums; color:var(--muted); font-size:12px;">${a.date}</span></td>
                  <td>
                    <div class="emp-cell-flex">
                      <div class="emp-avatar-sm" style="width:28px;height:28px;font-size:10px;">${escapeHtml(aInitials)}</div>
                      <div class="emp-cell-info">
                        <strong style="font-size:12.5px;">${escapeHtml(a.user)}</strong>
                      </div>
                    </div>
                  </td>
                  <td>${badge(a.action)}</td>
                  <td><span class="tag-neutral">${escapeHtml(a.module)}</span></td>
                  <td><strong>${escapeHtml(a.record)}</strong></td>
                  <td><span class="folio-tag" style="font-size:11px;">${escapeHtml(a.ip)}</span></td>
                  <td style="text-align:right;">
                    <button class="row-action" data-action="audit-detail" data-audit-id="${a.id}">Ver →</button>
                  </td>
                </tr>
              `;
            }).join('') || '<tr><td colspan="7" class="empty">No hay eventos de auditoría registrados.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
