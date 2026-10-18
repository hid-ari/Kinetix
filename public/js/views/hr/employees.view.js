import { state, hasPermission } from '../../core/state.js';
import { escapeHtml, initials } from '../../components/utils.js';
import { breadcrumb, pageHeader } from '../../components/ui.js';

export function hrBadge(status) {
  const s = String(status || '').toLowerCase().trim();
  if (s === 'activo') return `<span class="badge-pill success"><span class="badge-pill-dot"></span>Activo</span>`;
  if (s === 'suspendido') return `<span class="badge-pill warning"><span class="badge-pill-dot"></span>Suspendido</span>`;
  if (s === 'licencia') return `<span class="badge-pill purple"><span class="badge-pill-dot"></span>Licencia</span>`;
  if (s === 'desvinculado') return `<span class="badge-pill danger"><span class="badge-pill-dot"></span>Desvinculado</span>`;
  return `<span class="badge-pill neutral"><span class="badge-pill-dot"></span>${escapeHtml(status || 'N/A')}</span>`;
}

export function employeesView() {
  const employees = state.hr.employees || [];
  const total = state.hr.employeesTotal || 0;
  const page = state.hr.employeesPage || 1;
  const pageSize = state.hr.employeesPageSize || 20;

  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  const start = total ? ((page - 1) * pageSize) + 1 : 0;
  const end = total ? Math.min(start + employees.length - 1, total) : 0;

  const depts = state.hr.departments || [];
  const branches = state.branches || [];

  const deptOptions = depts.map(d => `
    <option value="${d.Id}" ${String(state.hr.employeesDeptFilter) === String(d.Id) ? 'selected' : ''}>
      ${escapeHtml(d.Name)}
    </option>
  `).join('');

  const branchOptions = branches.map(b => `
    <option value="${b.id}" ${String(state.hr.employeesBranchFilter) === String(b.id) ? 'selected' : ''}>
      ${escapeHtml(b.name)}
    </option>
  `).join('');

  const actionsHtml = `
    <div class="inline-actions">
      ${hasPermission('RRHH Empleados', 'Exportar empleados') ? `
        <button class="secondary" data-action="export-hr-employees" title="Exportar listado a CSV">
          <svg viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
          <span>Exportar CSV</span>
        </button>
      ` : ''}
      ${hasPermission('RRHH Empleados', 'Crear empleados') ? `<button class="primary" data-nav="hr-employee-form">＋ Nuevo empleado</button>` : ''}
    </div>
  `;

  return `
    ${breadcrumb([['dashboard', 'Inicio'], ['hr-dashboard', 'Recursos Humanos'], ['hr-employees', 'Empleados']])}
    ${pageHeader('Gestión de Empleados', 'Administración centralizada de la plantilla laboral, expedientes y ciclo de vida.', actionsHtml)}

    <div class="panel">
      <!-- Filter Toolbar -->
      <div class="table-toolbar">
        <div class="filter-row">
          <input id="hr-search" placeholder="Buscar por nombre, código o documento..." value="${escapeHtml(state.hr.employeesSearch || '')}" style="min-width:260px;">
          <select data-hr-filter="status">
            <option value="">Todos los estados</option>
            <option value="Activo" ${state.hr.employeesStatusFilter === 'Activo' ? 'selected' : ''}>Activo</option>
            <option value="Suspendido" ${state.hr.employeesStatusFilter === 'Suspendido' ? 'selected' : ''}>Suspendido</option>
            <option value="Licencia" ${state.hr.employeesStatusFilter === 'Licencia' ? 'selected' : ''}>Licencia</option>
            <option value="Desvinculado" ${state.hr.employeesStatusFilter === 'Desvinculado' ? 'selected' : ''}>Desvinculado</option>
          </select>
          <select data-hr-filter="department">
            <option value="">Todos los departamentos</option>
            ${deptOptions}
          </select>
          <select data-hr-filter="branch">
            <option value="">Todas las sucursales</option>
            ${branchOptions}
          </select>
          <button class="secondary" data-action="clear-hr-filters" style="padding:6px 12px; font-size:12px;">Limpiar</button>
        </div>
        <span class="panel-note">${total} colaboradores</span>
      </div>

      <!-- Employees Table -->
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Empleado</th>
              <th>Código</th>
              <th>Cargo / Departamento</th>
              <th>Sucursal</th>
              <th>Tipo de Contrato</th>
              <th>Estado</th>
              <th style="text-align:right;">Expediente</th>
            </tr>
          </thead>
          <tbody>
            ${employees.length ? employees.map(emp => {
              const fullName = `${emp.FirstName} ${emp.LastName}`;
              const userInitials = initials(fullName);
              const photoUrl = emp.PhotoFileId ? `/api/hr/employees/${emp.Id}/photo` : null;

              return `
                <tr>
                  <td>
                    <div class="emp-cell-flex">
                      <div class="emp-avatar-sm" style="overflow:hidden;">
                        ${photoUrl ? `<img src="${photoUrl}" alt="${escapeHtml(fullName)}" style="width:100%;height:100%;object-fit:cover;">` : escapeHtml(userInitials)}
                      </div>
                      <div class="emp-cell-info">
                        <strong>${escapeHtml(fullName)}</strong>
                        <small>${escapeHtml(emp.Email || emp.DocumentNumber || 'Sin correo registrado')}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span class="folio-tag">#${escapeHtml(emp.EmployeeCode)}</span>
                  </td>
                  <td>
                    <strong>${escapeHtml(emp.PositionTitle || 'Sin cargo asignado')}</strong>
                    <small style="display:block; color:var(--muted);">${escapeHtml(emp.DepartmentName || 'General')}</small>
                  </td>
                  <td><span class="tag-neutral">${escapeHtml(emp.BranchName || 'General')}</span></td>
                  <td>
                    <small style="font-weight:600; color:var(--muted);">${escapeHtml(emp.ContractTypeName || 'Indefinido')}</small>
                  </td>
                  <td>${hrBadge(emp.Status)}</td>
                  <td style="text-align:right;">
                    <button class="row-action" data-hr-detail="employee" data-id="${emp.Id}">
                      Ver expediente →
                    </button>
                  </td>
                </tr>
              `;
            }).join('') : `
              <tr>
                <td colspan="7" class="empty">No encontramos empleados con los filtros aplicados.</td>
              </tr>
            `}
          </tbody>
        </table>
      </div>

      <!-- Pagination Footer -->
      <div class="pagination">
        <span>Mostrando ${start}-${end} de ${total} registros</span>
        <div class="pages">
          ${Array.from({ length: pageCount }, (_, i) => `
            <button class="${i + 1 === page ? 'active' : ''}" data-hr-page="${i + 1}">${i + 1}</button>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}
