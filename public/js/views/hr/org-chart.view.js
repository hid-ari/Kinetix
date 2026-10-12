import { state } from '../../core/state.js';
import { escapeHtml, initials } from '../../components/utils.js';
import { breadcrumb, pageHeader } from '../../components/ui.js';

export function orgChartView() {
  const chartData = state.hr.orgChart || { departments: [], employees: [] };
  const depts = chartData.departments || [];
  const employees = chartData.employees || [];

  // Group departments hierarchically
  const roots = depts.filter(d => !d.ParentDepartmentId);
  const childrenMap = {};
  for (const d of depts) {
    if (d.ParentDepartmentId) {
      (childrenMap[d.ParentDepartmentId] ||= []).push(d);
    }
  }

  // Group employees by department
  const empMap = {};
  for (const e of employees) {
    if (e.DepartmentId) {
      (empMap[e.DepartmentId] ||= []).push(e);
    }
  }

  function renderDeptNode(dept) {
    const deptEmployees = empMap[dept.Id] || [];
    const subDepts = childrenMap[dept.Id] || [];

    return `
      <div class="org-node-card" style="background:#ffffff; border:1px solid var(--line); border-radius:10px; margin-bottom:14px; box-shadow:var(--shadow-sm); overflow:hidden;">
        <div style="padding:14px 18px; background:#f8fafc; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; align-items:center;">
          <div>
            <span style="font-family:monospace; font-size:11px; font-weight:700; color:var(--royal);">${escapeHtml(dept.Code)}</span>
            <strong style="display:block; font-size:15px; color:var(--navy); margin-top:2px;">${escapeHtml(dept.Name)}</strong>
          </div>
          <span class="badge active" style="font-size:11px;">${deptEmployees.length} colaboradores</span>
        </div>

        <div style="padding:16px 18px;">
          ${dept.ManagerName ? `
            <div style="margin-bottom:14px; padding:10px 14px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; display:flex; align-items:center; gap:10px;">
              <svg viewBox="0 0 20 20" fill="currentColor" style="width:18px;height:18px;color:#2563eb;flex-shrink:0;"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/></svg>
              <div>
                <small style="display:block; color:var(--muted); font-size:10.5px; font-weight:600; text-transform:uppercase;">Responsable de Unidad</small>
                <strong>${escapeHtml(dept.ManagerName)}</strong>
                ${dept.ManagerPositionTitle ? `<span style="font-size:11.5px; color:var(--royal)"> · ${escapeHtml(dept.ManagerPositionTitle)}</span>` : ''}
              </div>
            </div>
          ` : ''}

          <!-- Employees list -->
          ${deptEmployees.length ? `
            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:10px;">
              ${deptEmployees.map(emp => {
                const photoUrl = emp.PhotoFileId ? `/api/hr/employees/${emp.Id}/photo` : null;
                const userInitials = initials(emp.FullName);

                return `
                  <div style="display:flex; align-items:center; gap:10px; padding:8px 10px; background:#f8fafc; border:1px solid var(--line); border-radius:6px; cursor:pointer;" data-hr-detail="employee" data-id="${emp.Id}">
                    <div class="profile-avatar" style="width:30px; height:30px; font-size:11px; flex:0 0 30px; overflow:hidden;">
                      ${photoUrl ? `<img src="${photoUrl}" alt="${escapeHtml(emp.FullName)}" style="width:100%;height:100%;object-fit:cover;">` : escapeHtml(userInitials)}
                    </div>
                    <div style="min-width:0; flex:1;">
                      <strong style="display:block; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(emp.FullName)}</strong>
                      <small style="display:block; font-size:11px; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(emp.PositionTitle || 'Personal')}</small>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : '<p class="panel-note" style="margin:0;">Sin colaboradores asignados en este departamento.</p>'}
        </div>

        ${subDepts.length ? `
          <div style="padding:14px 18px 10px; background:#f1f5f9; border-top:1px solid var(--line);">
            <small style="display:block; color:var(--muted); font-weight:700; text-transform:uppercase; font-size:10.5px; margin-bottom:10px;">Subdepartamentos adscritos:</small>
            <div style="padding-left:14px; border-left:2px dashed #cbd5e1;">
              ${subDepts.map(sd => renderDeptNode(sd)).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  return `
    ${breadcrumb([['dashboard', 'Inicio'], ['hr-dashboard', 'Recursos Humanos'], ['hr-orgchart', 'Organigrama']])}
    ${pageHeader('Estructura Organizacional', 'Visualización de unidades, responsables y personal por área de la empresa.', `
      <button class="secondary" data-nav="hr-departments">Administrar departamentos</button>
    `)}

    <div class="panel" style="padding:22px;">
      ${roots.length ? `
        <div style="display:grid; gap:20px;">
          ${roots.map(rootDept => renderDeptNode(rootDept)).join('')}
        </div>
      ` : `
        <div class="empty">
          <p>No se encontraron departamentos registrados para mostrar en el organigrama.</p>
          <button class="primary" data-action="open-department-modal" style="margin-top:10px;">Crear primer departamento</button>
        </div>
      `}
    </div>
  `;
}
