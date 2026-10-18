import { state } from '../../core/state.js';
import { escapeHtml, badge } from '../../components/utils.js';
import { breadcrumb, currentOptions } from '../../components/ui.js';

export function dashboard() {
  const user = state.currentUser || {};
  const userName = `${user.firstName || 'Usuario'}`.trim();
  const company = user.company || 'Kinetix Group';
  const activeCompanies = state.companies.filter(c => c.status === 'Activa').length;
  const todayFormatted = new Intl.DateTimeFormat('es-DO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date());
  
  return `
    ${breadcrumb([['dashboard', 'Espacio de trabajo'], ['dashboard', company]])}
    
    <!-- Hero Greeting Banner -->
    <div class="dashboard-hero-banner">
      <div class="dashboard-hero-content">
        <div class="dashboard-hero-badge">
          <span class="pulse-dot"></span>
          <span>PANEL EJECUTIVO EN TIEMPO REAL</span>
        </div>
        <h1>Hola, ${escapeHtml(userName)} 👋</h1>
        <p>Bienvenido al centro de mando de <strong>${escapeHtml(company)}</strong>. Supervisa recursos humanos, operaciones de inventario y finanzas corporativas.</p>
      </div>
      <div class="dashboard-hero-aside">
        <div class="hero-date-chip">
          <svg viewBox="0 0 20 20" fill="currentColor" style="width:16px;height:16px;"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>
          <span>${todayFormatted}</span>
        </div>
      </div>
    </div>
    
    <!-- KPI Metrics -->
    <div class="hr-stats-grid">
      <div class="stat-card">
        <div class="stat-icon-wrapper blue">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4zm3 1h6v4H7V5zm6 6H7v2h6v-2z" clip-rule="evenodd"/></svg>
        </div>
        <div class="stat-content">
          <span class="stat-label">Empresas Activas</span>
          <strong class="stat-value">${activeCompanies}</strong>
          <span class="stat-sub">Alcance organizacional</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper green">
          <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
        </div>
        <div class="stat-content">
          <span class="stat-label">Usuarios Registrados</span>
          <strong class="stat-value">${state.users.length}</strong>
          <span class="stat-sub">Cuentas activas del sistema</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper amber">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/></svg>
        </div>
        <div class="stat-content">
          <span class="stat-label">Sucursales</span>
          <strong class="stat-value">${state.branches.length}</strong>
          <span class="stat-sub">Sedes y puntos operativos</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper purple">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
        </div>
        <div class="stat-content">
          <span class="stat-label">Eventos Auditados</span>
          <strong class="stat-value">${state.audit.length}</strong>
          <span class="stat-sub">Trazabilidad inmutable</span>
        </div>
      </div>
    </div>

    <!-- Quick Access Modules -->
    ${currentOptions()}

    <!-- Dual Activity & Status Grid -->
    <div class="grid-2">
      <div class="panel">
        <div class="panel-head">
          <div>
            <h2>Actividad Reciente</h2>
            <p class="panel-note">Eventos de seguridad y operaciones de usuarios</p>
          </div>
          <button class="row-action" data-nav="audit">Ver auditoría →</button>
        </div>
        <div class="panel-body activity">
          ${state.audit.slice(0, 4).map(item => `
            <div class="activity-item">
              <span class="activity-bullet"></span>
              <div>
                <p><strong>${escapeHtml(item.user)}</strong> realizó <strong>${escapeHtml(item.action.toLowerCase())}</strong> en <strong>${escapeHtml(item.module)}</strong></p>
                <small>${item.date} · ${escapeHtml(item.record)}</small>
              </div>
            </div>
          `).join('') || '<div class="empty">No hay actividad reciente registrada.</div>'}
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <div>
            <h2>Estado de la Organización</h2>
            <p class="panel-note">Empresas registradas en el grupo</p>
          </div>
          <button class="row-action" data-nav="companies">Ver detalle →</button>
        </div>
        <div class="panel-body">
          ${state.companies.map(company => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #f1f5f9;font-size:13px">
              <strong>${escapeHtml(company.name)}</strong>
              ${badge(company.status)}
            </div>
          `).join('') || '<div class="empty">Sin empresas registradas.</div>'}
        </div>
      </div>
    </div>
  `;
}
