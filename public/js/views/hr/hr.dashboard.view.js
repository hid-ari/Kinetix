import { state } from '../../core/state.js';
import { escapeHtml } from '../../components/utils.js';
import { breadcrumb, pageHeader } from '../../components/ui.js';

export function hrDashboard() {
  const d = state.hr.dashboard || {};
  const total = d.totalEmployees || 0;
  const active = d.activeEmployees || 0;
  const suspended = d.suspendedEmployees || 0;
  const leave = d.leaveEmployees || 0;
  const terminated = d.terminatedEmployees || 0;
  const recentHires = d.recentHires || 0;
  const recentTerminations = d.recentTerminations || 0;

  const byDept = d.byDepartment || [];
  const byBranch = d.byBranch || [];
  const byContract = d.byContractType || [];
  const birthdays = d.upcomingBirthdays || [];

  let payrollCardHtml = '';
  if (d.payroll && d.payroll.length > 0) {
    const p = d.payroll[0];
    const formatted = new Intl.NumberFormat('es-DO', { style: 'currency', currency: p.SalaryCurrency || 'DOP' }).format(p.TotalBaseSalary || 0);
    payrollCardHtml = `
      <div class="stat-card">
        <div class="stat-icon-wrapper blue">
          <svg viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clip-rule="evenodd"/></svg>
        </div>
        <div class="stat-content">
          <span class="stat-label">Costo Nómina Base</span>
          <strong class="stat-value" style="font-size:22px">${formatted}</strong>
          <span class="stat-sub">Mensual consolidado</span>
        </div>
      </div>
    `;
  }

  return `
    ${breadcrumb([['dashboard', 'Inicio'], ['hr-dashboard', 'Recursos Humanos']])}
    ${pageHeader('Recursos Humanos', 'Gestión integral del ciclo de vida del personal, estructura organizativa y expedientes.', `
      <div class="inline-actions">
        <button class="secondary" data-nav="hr-orgchart">
          <svg viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/></svg>
          <span>Organigrama</span>
        </button>
        <button class="primary" data-nav="hr-employee-form">＋ Nuevo empleado</button>
      </div>
    `)}

    <!-- KPI Stats Cards -->
    <div class="hr-stats-grid" style="margin-bottom: 24px;">
      <div class="stat-card">
        <div class="stat-icon-wrapper blue">
          <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
        </div>
        <div class="stat-content">
          <span class="stat-label">Total Colaboradores</span>
          <strong class="stat-value">${total}</strong>
          <span class="stat-sub">${active} en operaciones activas</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper green">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
        </div>
        <div class="stat-content">
          <span class="stat-label">Personal Activo</span>
          <strong class="stat-value" style="color:#059669;">${active}</strong>
          <span class="stat-sub">${total ? Math.round((active / total) * 100) : 0}% de la plantilla</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper amber">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>
        </div>
        <div class="stat-content">
          <span class="stat-label">Permisos / Suspensión</span>
          <strong class="stat-value" style="color:#d97706;">${leave + suspended}</strong>
          <span class="stat-sub">${leave} licencias · ${suspended} suspendidos</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper purple">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/></svg>
        </div>
        <div class="stat-content">
          <span class="stat-label">Nuevos Ingresos (30d)</span>
          <strong class="stat-value" style="color:#7c3aed;">${recentHires}</strong>
          <span class="stat-sub">${recentTerminations} desvinculaciones registradas</span>
        </div>
      </div>
      ${payrollCardHtml}
    </div>

    <!-- Quick Access Strip -->
    <div class="workspace-options" style="margin-bottom: 24px;">
      <div class="workspace-options-head">
        <h3>Módulos de Gestión de Personal</h3>
        <span class="panel-note">Accesos directos a estructura y expedientes</span>
      </div>
      <div class="option-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
        <button class="option-card" data-nav="hr-employees">
          <span class="option-icon">
            <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
          </span>
          <span><strong>Gestión de Empleados</strong><small>Expedientes, búsquedas y altas</small></span>
          <b>→</b>
        </button>
        <button class="option-card" data-nav="hr-departments">
          <span class="option-icon">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4zm3 1h6v4H7V5zm6 6H7v2h6v-2z" clip-rule="evenodd"/></svg>
          </span>
          <span><strong>Departamentos</strong><small>Estructura y responsables</small></span>
          <b>→</b>
        </button>
        <button class="option-card" data-nav="hr-positions">
          <span class="option-icon">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>
          </span>
          <span><strong>Cargos y Puestos</strong><small>Perfiles y bandas salariales</small></span>
          <b>→</b>
        </button>
        <button class="option-card" data-nav="hr-orgchart">
          <span class="option-icon">
            <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/></svg>
          </span>
          <span><strong>Organigrama General</strong><small>Relaciones jerárquicas</small></span>
          <b>→</b>
        </button>
      </div>
    </div>

    <!-- Grid: Distribution and Activity -->
    <div class="grid-2">
      <!-- Left Column: Department & Contract Distribution -->
      <div style="display:grid; gap:20px;">
        <div class="panel">
          <div class="panel-head">
            <h2>Personal por Departamento</h2>
            <span class="panel-note">${byDept.length} departamentos activos</span>
          </div>
          <div class="panel-body">
            ${byDept.length ? `
              <div style="display:grid; gap:14px;">
                ${byDept.map(dept => {
                  const pct = total ? Math.round((dept.Count / total) * 100) : 0;
                  return `
                    <div>
                      <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px;">
                        <strong>${escapeHtml(dept.DepartmentName)}</strong>
                        <span style="color:var(--muted)">${dept.Count} colaboradores (${pct}%)</span>
                      </div>
                      <div style="height:7px; background:#e2e8f0; border-radius:4px; overflow:hidden;">
                        <div style="height:100%; width:${pct}%; background:linear-gradient(90deg, #2563eb 0%, #3b82f6 100%); border-radius:4px;"></div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : '<p class="panel-note">No hay departamentos configurados con colaboradores activos.</p>'}
          </div>
        </div>

        <div class="panel">
          <div class="panel-head">
            <h2>Distribución por Modalidad de Contrato</h2>
            <span class="panel-note">Tipos de vinculación</span>
          </div>
          <div class="panel-body">
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:12px;">
              ${byContract.map(c => `
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:14px 16px;">
                  <span style="display:block; font-size:11px; color:var(--muted); font-weight:700; text-transform:uppercase; letter-spacing:0.04em;">${escapeHtml(c.ContractTypeName)}</span>
                  <strong style="font-size:22px; font-weight:800; color:var(--navy); margin-top:4px; display:block;">${c.Count}</strong>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Sede, Cumpleaños y Alertas -->
      <div style="display:grid; gap:20px; align-content:start;">
        <div class="panel">
          <div class="panel-head">
            <h2>Distribución por Sucursal</h2>
            <span class="panel-note">Sedes operativas</span>
          </div>
          <div class="panel-body">
            ${byBranch.length ? `
              <div style="display:grid; gap:10px;">
                ${byBranch.map(b => `
                  <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px;">
                    <div>
                      <strong>${escapeHtml(b.BranchName)}</strong>
                    </div>
                    <span class="badge active">${b.Count} colaboradores</span>
                  </div>
                `).join('')}
              </div>
            ` : '<p class="panel-note">No hay sucursales registradas.</p>'}
          </div>
        </div>

        ${birthdays.length ? `
          <div class="panel">
            <div class="panel-head">
              <div style="display:flex; align-items:center; gap:8px;">
                <svg viewBox="0 0 20 20" fill="currentColor" style="width:18px;height:18px;color:#2563eb;"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>
                <h2>Cumpleaños del Mes</h2>
              </div>
              <span class="panel-note">${birthdays.length} colaboradores</span>
            </div>
            <div class="panel-body" style="display:grid; gap:10px;">
              ${birthdays.map(b => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; font-size:13px;">
                  <div>
                    <strong>${escapeHtml(b.FirstName)} ${escapeHtml(b.LastName)}</strong>
                    <small style="display:block; color:var(--muted)">${escapeHtml(b.DepartmentName || 'Personal')}</small>
                  </div>
                  <span style="font-weight:700; color:var(--royal); font-size:12px; background:white; padding:3px 8px; border-radius:6px; border:1px solid #bfdbfe;">Día ${b.BirthDay}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}
