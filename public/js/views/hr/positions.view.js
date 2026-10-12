import { state } from '../../core/state.js';
import { escapeHtml, badge } from '../../components/utils.js';
import { breadcrumb, pageHeader } from '../../components/ui.js';

export function positionsView() {
  const positions = state.hr.positions || [];

  return `
    ${breadcrumb([['dashboard', 'Inicio'], ['hr-dashboard', 'Recursos Humanos'], ['hr-positions', 'Cargos']])}
    ${pageHeader('Cargos y Puestos de Trabajo', 'Estructura ocupacional, responsabilidades y bandas salariales referenciales.', `
      <button class="primary" data-action="open-position-modal">＋ Nuevo cargo</button>
    `)}

    <div class="panel">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Título del Cargo</th>
              <th>Departamento</th>
              <th>Nivel Jerárquico</th>
              <th>Banda Salarial (DOP)</th>
              <th>Colaboradores</th>
              <th>Estado</th>
              <th style="text-align:right;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${positions.length ? positions.map(p => {
              const salaryBand = (p.SalaryMin != null && p.SalaryMax != null)
                ? `RD$ ${Number(p.SalaryMin).toLocaleString()} – ${Number(p.SalaryMax).toLocaleString()}`
                : (p.SalaryMin != null ? `Desde RD$ ${Number(p.SalaryMin).toLocaleString()}` : 'No definida');

              return `
                <tr>
                  <td><span class="folio-tag">#${escapeHtml(p.Code)}</span></td>
                  <td>
                    <strong>${escapeHtml(p.Title)}</strong>
                    ${p.Description ? `<small style="display:block; color:var(--muted)">${escapeHtml(p.Description)}</small>` : ''}
                  </td>
                  <td><span class="tag-neutral">${escapeHtml(p.DepartmentName || 'General')}</span></td>
                  <td>
                    <span class="badge-pill info">
                      <span class="badge-pill-dot"></span>Nivel ${p.HierarchyLevel}
                    </span>
                  </td>
                  <td>
                    <strong style="font-size:12.5px; color:var(--navy); font-variant-numeric:tabular-nums;">
                      ${salaryBand}
                    </strong>
                  </td>
                  <td><strong style="font-variant-numeric:tabular-nums;">${p.ActiveEmployeesCount ?? 0}</strong> <small style="color:var(--muted)">activos</small></td>
                  <td>
                    ${badge(p.IsActive ? 'Activo' : 'Inactivo')}
                  </td>
                  <td style="text-align:right;">
                    <button class="row-action" data-action="edit-position" data-id="${p.Id}">Editar</button>
                  </td>
                </tr>
              `;
            }).join('') : `
              <tr>
                <td colspan="8" class="empty">No hay cargos registrados. Haz clic en "Nuevo cargo".</td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

