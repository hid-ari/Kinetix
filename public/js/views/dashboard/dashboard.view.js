import { state } from '../../core/state.js';
import { escapeHtml, badge } from '../../components/utils.js';
import { breadcrumb, pageHeader, currentOptions } from '../../components/ui.js';

export function dashboard() {
  const company = state.currentUser?.company || 'tu organización';
  const activeCompanies = state.companies.filter(c => c.status === 'Activa').length;
  return `${breadcrumb([['dashboard', 'Espacio de trabajo'], ['dashboard', company]])}
  ${pageHeader(company, 'Panel ejecutivo de control operativo y administración.')}
  <div class="stats">
    <div class="stat">
      <span class="stat-label">Empresas activas</span>
      <div class="stat-value">${activeCompanies}</div>
      <span class="stat-meta">↑ Alcance de la organización</span>
    </div>
    <div class="stat">
      <span class="stat-label">Usuarios registrados</span>
      <div class="stat-value">${state.users.length}</div>
      <span class="stat-meta">● En la organización</span>
    </div>
    <div class="stat">
      <span class="stat-label">Sucursales</span>
      <div class="stat-value">${state.branches.length}</div>
      <span class="stat-meta">● Sedes operativas</span>
    </div>
    <div class="stat">
      <span class="stat-label">Eventos registrados</span>
      <div class="stat-value">${state.audit.length}</div>
      <span class="stat-meta">Auditoría reciente</span>
    </div>
  </div>
  ${currentOptions()}
  <div class="grid-2">
    <div class="panel">
      <div class="panel-head">
        <div>
          <h2>Actividad reciente</h2>
          <p class="panel-note">Eventos de seguridad y operaciones</p>
        </div>
        <button class="row-action" data-nav="audit">Ver auditoría →</button>
      </div>
      <div class="panel-body activity">
        ${state.audit.slice(0, 4).map(item => `<div class="activity-item"><span class="activity-bullet"></span><div><p><strong>${escapeHtml(item.user)}</strong> realizó ${escapeHtml(item.action.toLowerCase())} en <strong>${escapeHtml(item.module)}</strong></p><small>${item.date} · ${escapeHtml(item.record)}</small></div></div>`).join('') || '<div class="empty">No hay actividad reciente.</div>'}
      </div>
    </div>
    <div class="panel">
      <div class="panel-head">
        <div>
          <h2>Estado de la organización</h2>
          <p class="panel-note">Empresas registradas</p>
        </div>
        <button class="row-action" data-nav="companies">Ver detalle →</button>
      </div>
      <div class="panel-body">
        ${state.companies.map(company => `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #f1f5f9;font-size:13px"><strong>${escapeHtml(company.name)}</strong>${badge(company.status)}</div>`).join('') || '<div class="empty">Sin empresas registradas.</div>'}
      </div>
    </div>
  </div>`;
}
