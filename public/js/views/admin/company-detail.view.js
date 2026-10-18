import { state } from '../../core/state.js';
import { escapeHtml, badge } from '../../components/utils.js';
import { breadcrumb } from '../../components/ui.js';

export function companyDetail(id) {
  const c = state.companies.find(x => String(x.id) === String(id));
  if (!c) return '<div class="empty">Empresa no encontrada.</div>';
  return `
    ${breadcrumb([['dashboard', 'Administración'], ['companies', 'Empresas'], ['companies', escapeHtml(c.name)]])}
    <div class="detail-head">
      <div>
        <h1>${escapeHtml(c.name)}</h1>
        <p class="subtitle">RNC ${escapeHtml(c.rnc)} · ${badge(c.status)}</p>
      </div>
      <div class="inline-actions">
        <button class="secondary" data-action="edit-company">Editar</button>
        <button class="${c.status === 'Activa' ? 'danger' : 'primary'}" data-action="toggle-company">
          ${c.status === 'Activa' ? 'Desactivar' : 'Activar'}
        </button>
      </div>
    </div>
    <div class="detail-summary">
      <div><strong>${c.users}</strong><span>Usuarios totales</span></div>
      <div><strong>${c.branches}</strong><span>Sucursales</span></div>
      <div><strong>${c.activeUsers ?? 0}</strong><span>Usuarios activos</span></div>
      <div><strong>${c.inactiveUsers ?? 0}</strong><span>Usuarios inactivos</span></div>
    </div>
    <div class="detail-tabs">
      ${['Información', 'Usuarios', 'Sucursales', 'Auditoría'].map(t => `
        <button class="${state.tab === t ? 'active' : ''}" data-tab="${t}">${t}</button>
      `).join('')}
    </div>
    <div class="panel">
      <div class="panel-body">
        ${state.tab === 'Información' ? `
          <h2>Información general</h2>
          <div class="form-grid" style="margin-top:18px">
            <div><span class="panel-note">Email de contacto</span><p><strong>${escapeHtml(c.email)}</strong></p></div>
            <div><span class="panel-note">Fecha de creación</span><p><strong>${c.date}</strong></p></div>
            <div><span class="panel-note">Estado de cuenta</span><div style="margin-top:4px;">${badge(c.status)}</div></div>
          </div>
        ` : `
          <h2>${escapeHtml(state.tab)}</h2>
          <p class="subtitle" style="margin-top:10px">Contenido cargado bajo demanda para ${escapeHtml(c.name)}.</p>
        `}
      </div>
    </div>
  `;
}
