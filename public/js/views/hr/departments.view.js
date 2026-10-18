import { state, hasPermission } from '../../core/state.js';
import { escapeHtml, badge, initials } from '../../components/utils.js';
import { breadcrumb, pageHeader } from '../../components/ui.js';

export function departmentsView() {
  const departments = state.hr.departments || [];

  return `
    ${breadcrumb([['dashboard', 'Inicio'], ['hr-dashboard', 'Recursos Humanos'], ['hr-departments', 'Departamentos']])}
    ${pageHeader('Departamentos', 'Define y administra la estructura organizativa, jerarquías y responsables de área.', 
      hasPermission('RRHH Estructura', 'Administrar departamentos y cargos') ? '<button class="primary" data-action="open-department-modal">＋ Nuevo departamento</button>' : ''
    )}

    <div class="panel">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Departamento</th>
              <th>Sucursal</th>
              <th>Dependencia Jerárquica</th>
              <th>Responsable / Manager</th>
              <th>Colaboradores</th>
              <th>Estado</th>
              <th style="text-align:right;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${departments.length ? departments.map(d => {
              const manager = d.ManagerName?.trim();
              const mInitials = manager ? initials(manager) : null;
              return `
                <tr>
                  <td><span class="folio-tag">#${escapeHtml(d.Code)}</span></td>
                  <td>
                    <strong>${escapeHtml(d.Name)}</strong>
                    ${d.Description ? `<small style="display:block; color:var(--muted)">${escapeHtml(d.Description)}</small>` : ''}
                  </td>
                  <td><span class="tag-neutral">${escapeHtml(d.BranchName || 'General')}</span></td>
                  <td>
                    <span style="color: ${d.ParentDepartmentName ? 'var(--navy)' : 'var(--muted)'}; font-size:12.5px;">
                      ${escapeHtml(d.ParentDepartmentName || 'Nivel Superior (Raíz)')}
                    </span>
                  </td>
                  <td>
                    ${manager ? `
                      <div class="emp-cell-flex">
                        <div class="emp-avatar-sm" style="width:26px;height:26px;font-size:10px;">${escapeHtml(mInitials)}</div>
                        <div class="emp-cell-info">
                          <strong style="font-size:12.5px;">${escapeHtml(manager)}</strong>
                        </div>
                      </div>
                    ` : `<span style="color:var(--muted); font-size:12px;">Sin responsable asignado</span>`}
                  </td>
                  <td><strong style="font-variant-numeric:tabular-nums;">${d.ActiveEmployeesCount ?? 0}</strong> <small style="color:var(--muted)">activos</small></td>
                  <td>
                    ${badge(d.IsActive ? 'Activo' : 'Inactivo')}
                  </td>
                  <td style="text-align:right;">
                    <div style="display:inline-flex; gap:6px; justify-content:flex-end;">
                      <button class="row-action" data-action="edit-department" data-id="${d.Id}">Editar</button>
                      ${hasPermission('RRHH Estructura', 'Administrar departamentos y cargos') ? `
                        <button class="row-action" style="color:var(--danger,#ef4444);" data-action="delete-department" data-id="${d.Id}" data-name="${escapeHtml(d.Name)}">Eliminar</button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `;
            }).join('') : `
              <tr>
                <td colspan="8" class="empty">No hay departamentos registrados. Haz clic en "Nuevo departamento".</td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

