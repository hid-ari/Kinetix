import { state, hasPermission } from '../../core/state.js';
import { escapeHtml, badge, initials } from '../../components/utils.js';
import { breadcrumb } from '../../components/ui.js';

export function branchDetail(id) {
  const branch = state.branches.find(item => item.id === id);
  if (!branch) {
    return `
      ${breadcrumb([['dashboard', 'Administración'], ['branches', 'Sucursales']])}
      <div class="panel empty">Sucursal no encontrada o sin permisos suficientes.</div>
    `;
  }

  const isActive = branch.status === 'Activa';
  const canEdit = hasPermission('Sucursales', 'Editar sucursales');
  const bInitials = initials(branch.name || 'Sucursal');

  const usersRows = state.branchUsers.map(user => `
    <tr>
      <td>
        <div style="display:flex; align-items:center; gap:8px;">
          <strong>${escapeHtml(user.name)}</strong>
          ${user.id === branch.managerUserId ? '<span class="folio-tag" style="background:#e0f2fe;color:#0284c7;font-weight:700;">Encargado</span>' : ''}
        </div>
      </td>
      <td>${escapeHtml(user.email)}</td>
      <td>${badge(user.isActive ?? user.IsActive ? 'Activa' : 'Inactiva')}</td>
    </tr>
  `).join('');

  return `
    ${breadcrumb([['dashboard', 'Administración'], ['branches', 'Sucursales'], ['branch-detail', branch.name]])}

    <!-- Executive Hero Card -->
    <div class="company-hero-card" style="margin-bottom: 20px;">
      <div class="company-hero-main">
        <div class="company-hero-avatar" style="width: 60px; height: 60px; font-size: 20px; border-radius: 14px; background: #eff6ff; color: var(--royal); border: 2px solid #bfdbfe; font-weight: 800;">
          ${escapeHtml(bInitials)}
        </div>
        <div class="company-hero-details">
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: var(--navy);">${escapeHtml(branch.name)}</h1>
            ${badge(branch.status)}
            <span style="font-family: monospace; background: #e2e8f0; color: var(--navy); padding: 2px 8px; border-radius: 5px; font-weight: 700; font-size: 11.5px;">
              ${escapeHtml(branch.code)}
            </span>
          </div>
          <p style="margin-top: 6px; font-size: 13px; color: var(--muted); display: flex; align-items: center; gap: 8px;">
            <span>Empresa: <strong>${escapeHtml(branch.company)}</strong></span>
            <span>·</span>
            <span>Encargado: ${branch.managerUserId ? `<strong>${escapeHtml(branch.manager)}</strong>` : 'Sin asignar'}</span>
          </p>
        </div>
      </div>

      <!-- Action Buttons -->
      ${canEdit ? `
        <div class="inline-actions" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <button class="secondary" data-action="edit-branch" title="Editar sucursal">
            <svg viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
            <span>Editar sucursal</span>
          </button>
          <button class="secondary" data-action="toggle-branch" title="${isActive ? 'Desactivar sucursal' : 'Activar sucursal'}">
            ${isActive ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      ` : ''}
    </div>

    <!-- Executive Metrics Grid -->
    <div class="grid-4" style="margin-bottom: 24px;">
      <div class="company-metric-card">
        <div class="company-metric-icon" style="background:#eff6ff; color:var(--royal);">
          <svg viewBox="0 0 20 20" fill="currentColor" style="width:18px;height:18px;"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1a1 1 0 000 2h1a1 1 0 100-2H7zm0 4a1 1 0 000 2h1a1 1 0 100-2H7zm0 4a1 1 0 000 2h1a1 1 0 100-2H7zm4-8a1 1 0 000 2h1a1 1 0 100-2h-1zm0 4a1 1 0 000 2h1a1 1 0 100-2h-1zm0 4a1 1 0 000 2h1a1 1 0 100-2h-1z" clip-rule="evenodd"/></svg>
        </div>
        <div>
          <span class="panel-note" style="display:block; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Empresa</span>
          <strong style="font-size:15px; color:var(--ink);">${escapeHtml(branch.company)}</strong>
        </div>
      </div>

      <div class="company-metric-card">
        <div class="company-metric-icon" style="background:#f0fdf4; color:#059669;">
          <svg viewBox="0 0 20 20" fill="currentColor" style="width:18px;height:18px;"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/></svg>
        </div>
        <div>
          <span class="panel-note" style="display:block; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Encargado</span>
          <strong style="font-size:15px; color:var(--ink);">${branch.managerUserId ? escapeHtml(branch.manager) : 'Sin asignar'}</strong>
        </div>
      </div>

      <div class="company-metric-card">
        <div class="company-metric-icon" style="background:#faf5ff; color:#7c3aed;">
          <svg viewBox="0 0 20 20" fill="currentColor" style="width:18px;height:18px;"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
        </div>
        <div>
          <span class="panel-note" style="display:block; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Usuarios Asignados</span>
          <strong style="font-size:16px; color:var(--ink);">${branch.users} usuarios</strong>
        </div>
      </div>

      <div class="company-metric-card">
        <div class="company-metric-icon" style="background:#fffbeb; color:#d97706;">
          <svg viewBox="0 0 20 20" fill="currentColor" style="width:18px;height:18px;"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/></svg>
        </div>
        <div>
          <span class="panel-note" style="display:block; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Código Operativo</span>
          <strong style="font-size:15px; font-family:monospace; color:var(--ink);">${escapeHtml(branch.code)}</strong>
        </div>
      </div>
    </div>

    <!-- Details Grid -->
    <div class="grid-2">
      <div class="panel">
        <div class="panel-head"><h2>Datos operativos</h2></div>
        <div class="panel-body">
          <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap: 14px;">
            <div class="detail-field-box">
              <span class="detail-label">Nombre de la sucursal</span>
              <span class="detail-val">${escapeHtml(branch.name)}</span>
            </div>
            <div class="detail-field-box">
              <span class="detail-label">Código interno</span>
              <span class="detail-val" style="font-family:monospace;">${escapeHtml(branch.code)}</span>
            </div>
            <div class="detail-field-box">
              <span class="detail-label">Empresa matriz</span>
              <span class="detail-val">${escapeHtml(branch.company)}</span>
            </div>
            <div class="detail-field-box">
              <span class="detail-label">Encargado responsable</span>
              <span class="detail-val">${branch.managerUserId ? escapeHtml(branch.manager) : 'Sin encargado asignado'}</span>
            </div>
            <div class="detail-field-box" style="grid-column: span 2;">
              <span class="detail-label">Estado</span>
              <div style="margin-top:4px;">${badge(branch.status)}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h2>Información de contacto</h2></div>
        <div class="panel-body">
          <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap: 14px;">
            <div class="detail-field-box">
              <span class="detail-label">Correo electrónico</span>
              <span class="detail-val">${escapeHtml(branch.email || 'No registrado')}</span>
            </div>
            <div class="detail-field-box">
              <span class="detail-label">Teléfono</span>
              <span class="detail-val">${escapeHtml(branch.phone || 'No registrado')}</span>
            </div>
            <div class="detail-field-box" style="grid-column: span 2;">
              <span class="detail-label">Dirección física</span>
              <span class="detail-val">${escapeHtml(branch.address || 'No registrada')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Assigned Users Table -->
    <div class="panel" style="margin-top: 20px;">
      <div class="panel-head">
        <h2>Usuarios asignados a esta sucursal</h2>
        <span class="panel-note">${state.branchUsers.length} usuarios</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Correo electrónico</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${usersRows || '<tr><td colspan="3" class="empty">Esta sucursal aún no tiene usuarios asignados.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
