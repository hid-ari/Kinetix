import { state, hasPermission } from '../../core/state.js';
import { escapeHtml, badge, initials as getInitials } from '../../components/utils.js';
import { breadcrumb, pageHeader } from '../../components/ui.js';

export function branches() {
  const companyOptions = state.companies.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('');
  return `
    ${breadcrumb([['dashboard', 'Administración'], ['branches', 'Sucursales']])}
    ${pageHeader('Sucursales', 'Consulta y organiza las sedes operativas de tus empresas.', hasPermission('Sucursales', 'Crear sucursales') ? '<button class="primary" data-action="new-branch">＋ Nueva sucursal</button>' : '')}
    <div class="panel">
      <div class="table-toolbar">
        <div class="filter-row">
          <input id="page-search" placeholder="Buscar sucursal o código..." value="${escapeHtml(state.query)}" style="min-width:260px;">
          <select>
            <option value="">Todas las empresas</option>
            ${companyOptions}
          </select>
        </div>
        <span class="panel-note">${state.branches.length} sucursales</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Código</th>
              <th>Empresa</th>
              <th>Encargado</th>
              <th>Usuarios</th>
              <th>Estado</th>
              <th style="text-align:right;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${state.branches.filter(b => `${b.name} ${b.code}`.toLowerCase().includes(state.query.toLowerCase())).map(b => {
              const mInitials = getInitials(b.manager || 'Encargado');
              return `
                <tr>
                  <td><strong>${escapeHtml(b.name)}</strong></td>
                  <td><span class="folio-tag">#${escapeHtml(b.code)}</span></td>
                  <td>${escapeHtml(b.company)}</td>
                  <td>
                    <div class="emp-cell-flex">
                      <div class="emp-avatar-sm" style="width:26px;height:26px;font-size:10px;">${escapeHtml(mInitials)}</div>
                      <div class="emp-cell-info">
                        <strong style="font-size:12.5px;">${escapeHtml(b.manager)}</strong>
                      </div>
                    </div>
                  </td>
                  <td><strong style="font-variant-numeric:tabular-nums;">${b.users}</strong></td>
                  <td>${badge(b.status)}</td>
                  <td style="text-align:right;">
                    <button class="row-action" data-detail="branch" data-id="${b.id}">Ver detalle →</button>
                  </td>
                </tr>
              `;
            }).join('') || '<tr><td colspan="7" class="empty">No encontramos sucursales.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
