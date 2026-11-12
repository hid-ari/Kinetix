import { state, hasPermission } from '../../core/state.js';
import { escapeHtml, badge, initials as getInitials } from '../../components/utils.js';
import { breadcrumb, pageHeader } from '../../components/ui.js';

/** Aplica búsqueda de texto y estado sobre la lista de sucursales. */
function filteredBranches() {
  const query = state.query.trim().toLowerCase();
  return state.branches.filter(b => {
    if (query && !`${b.name} ${b.code} ${b.manager}`.toLowerCase().includes(query)) return false;
    if (state.branchStatusFilter && b.status !== state.branchStatusFilter) return false;
    return true;
  });
}

export function branches() {
  const rows = filteredBranches();
  const active = state.branches.filter(b => b.status === 'Activa').length;
  const canCreate = hasPermission('Sucursales', 'Crear sucursales');

  return `
    ${breadcrumb([['branches', 'Sucursales']])}
    ${pageHeader('Sucursales', 'Consulta y organiza las sedes operativas de la empresa.', canCreate ? '<button class="primary" data-action="new-branch">＋ Nueva sucursal</button>' : '')}
    <div class="panel">
      <div class="table-toolbar">
        <div class="filter-row">
          <input id="page-search" placeholder="Buscar por nombre, código o encargado..." value="${escapeHtml(state.query)}" style="min-width:260px;">
          <select data-branch-filter="status" aria-label="Filtrar por estado">
            <option value="" ${!state.branchStatusFilter ? 'selected' : ''}>Todos los estados</option>
            <option value="Activa" ${state.branchStatusFilter === 'Activa' ? 'selected' : ''}>Activas</option>
            <option value="Inactiva" ${state.branchStatusFilter === 'Inactiva' ? 'selected' : ''}>Inactivas</option>
          </select>
        </div>
        <span class="panel-note">${rows.length} de ${state.branches.length} sucursales · ${active} activas</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Código</th>
              <th>Encargado</th>
              <th>Usuarios</th>
              <th>Estado</th>
              <th style="text-align:right;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(b => `
                <tr>
                  <td><strong>${escapeHtml(b.name)}</strong></td>
                  <td><span class="folio-tag">#${escapeHtml(b.code)}</span></td>
                  <td>
                    ${b.managerUserId ? `<div class="emp-cell-flex">
                      <div class="emp-avatar-sm" style="width:26px;height:26px;font-size:10px;">${escapeHtml(getInitials(b.manager))}</div>
                      <div class="emp-cell-info"><strong style="font-size:12.5px;">${escapeHtml(b.manager)}</strong></div>
                    </div>` : '<span class="panel-note">Sin encargado</span>'}
                  </td>
                  <td><strong style="font-variant-numeric:tabular-nums;">${b.users}</strong></td>
                  <td>${badge(b.status)}</td>
                  <td style="text-align:right;">
                    <button class="row-action" data-detail="branch" data-id="${b.id}">Ver detalle →</button>
                  </td>
                </tr>`).join('') || `<tr><td colspan="6" class="empty">${state.branches.length ? 'Ninguna sucursal coincide con los filtros.' : 'Aún no hay sucursales registradas.'}</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
