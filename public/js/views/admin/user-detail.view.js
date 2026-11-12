import { state, hasPermission } from '../../core/state.js';
import { badge, escapeHtml, initials } from '../../components/utils.js';
import { breadcrumb } from '../../components/ui.js';

export function userDetail(id) {
  const u = state.users.find(x => String(x.id) === String(id));
  if (!u) {
    return `
      ${breadcrumb([['dashboard', 'Administración'], ['users', 'Usuarios'], ['users', 'No encontrado']])}
      <div class="panel empty">Usuario no encontrado o sin permisos suficientes.</div>
    `;
  }

  const uInitials = initials(u.name || 'Usuario');
  const userAudit = state.audit.filter(a => a.user === u.name);

  return `
    ${breadcrumb([['dashboard', 'Administración'], ['users', 'Usuarios'], ['user-detail', u.name]])}

    <!-- Executive Hero Card (Kinetix Precision) -->
    <div class="company-hero-card" style="margin-bottom: 20px;">
      <div class="company-hero-main">
        <div class="company-hero-avatar" style="width: 60px; height: 60px; font-size: 20px; border-radius: 14px; background: #eff6ff; color: var(--royal); border: 2px solid #bfdbfe; font-weight: 800;">
          ${escapeHtml(uInitials)}
        </div>
        <div class="company-hero-details">
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: var(--navy);">${escapeHtml(u.name)}</h1>
            ${badge(u.status)}
            <span style="font-family: monospace; background: #e2e8f0; color: var(--navy); padding: 2px 8px; border-radius: 5px; font-weight: 700; font-size: 11.5px;">
              ${escapeHtml(u.role)}
            </span>
          </div>
          <p style="margin-top: 6px; font-size: 13px; color: var(--muted); display: flex; align-items: center; gap: 8px;">
            <span>${escapeHtml(u.email)}</span>
            <span>·</span>
            <span><strong>${escapeHtml(u.company)}</strong></span>
            <span>·</span>
            <span>${escapeHtml(u.branch || 'Sin sucursal')}</span>
          </p>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="inline-actions" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
        ${hasPermission('Usuarios', 'Editar usuarios') ? `
          <button class="primary" data-action="edit-user" data-id="${u.id}" title="Editar usuario">
            <svg viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
            <span>Editar usuario</span>
          </button>
          <button class="secondary" data-action="admin-reset-user-password" data-id="${u.id}" data-name="${escapeHtml(u.name)}" title="Establecer nueva contraseña">
            <svg viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;"><path fill-rule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clip-rule="evenodd"/></svg>
            <span>Asignar contraseña</span>
          </button>
        ` : ''}

        ${hasPermission('Usuarios', 'Desactivar usuarios') ? `
          <button class="secondary" data-action="toggle-user" title="${u.status === 'Activa' ? 'Desactivar acceso' : 'Activar acceso'}">
            ${u.status === 'Activa' ? 'Desactivar acceso' : 'Activar acceso'}
          </button>
        ` : ''}

        ${hasPermission('Usuarios', 'Desactivar usuarios') && u.id !== state.currentUser?.userId && u.role !== 'Super Admin' ? `
          <button class="danger" data-action="delete-user" data-id="${u.id}" data-name="${escapeHtml(u.name)}" style="background: #dc2626; color: #ffffff; border: none;" title="Eliminar usuario del sistema">
            Eliminar usuario
          </button>
        ` : ''}
      </div>
    </div>

    <!-- Metric Cards -->
    <div class="grid-4" style="margin-bottom: 20px;">
      <div class="company-metric-card">
        <div class="company-metric-icon" style="background:#eff6ff; color:var(--royal);">
          <svg viewBox="0 0 20 20" fill="currentColor" style="width:18px;height:18px;"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1a1 1 0 000 2h1a1 1 0 100-2H7zm0 4a1 1 0 000 2h1a1 1 0 100-2H7zm0 4a1 1 0 000 2h1a1 1 0 100-2H7zm4-8a1 1 0 000 2h1a1 1 0 100-2h-1zm0 4a1 1 0 000 2h1a1 1 0 100-2h-1zm0 4a1 1 0 000 2h1a1 1 0 100-2h-1z" clip-rule="evenodd"/></svg>
        </div>
        <div>
          <span class="panel-note" style="display:block; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Empresa</span>
          <strong style="font-size:15px; color:var(--ink);">${escapeHtml(u.company)}</strong>
        </div>
      </div>

      <div class="company-metric-card">
        <div class="company-metric-icon" style="background:#f0fdf4; color:#059669;">
          <svg viewBox="0 0 20 20" fill="currentColor" style="width:18px;height:18px;"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/></svg>
        </div>
        <div>
          <span class="panel-note" style="display:block; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Sucursal</span>
          <strong style="font-size:15px; color:var(--ink);">${escapeHtml(u.branch || 'Todas')}</strong>
        </div>
      </div>

      <div class="company-metric-card">
        <div class="company-metric-icon" style="background:#faf5ff; color:#7c3aed;">
          <svg viewBox="0 0 20 20" fill="currentColor" style="width:18px;height:18px;"><path fill-rule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z" clip-rule="evenodd"/></svg>
        </div>
        <div>
          <span class="panel-note" style="display:block; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Rol de Sistema</span>
          <strong style="font-size:15px; color:var(--ink);">${escapeHtml(u.role)}</strong>
        </div>
      </div>

      <div class="company-metric-card">
        <div class="company-metric-icon" style="background:#fffbeb; color:#d97706;">
          <svg viewBox="0 0 20 20" fill="currentColor" style="width:18px;height:18px;"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>
        </div>
        <div>
          <span class="panel-note" style="display:block; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Último Acceso</span>
          <strong style="font-size:14px; color:var(--ink); font-variant-numeric: tabular-nums;">${escapeHtml(u.last || 'Sin registro')}</strong>
        </div>
      </div>
    </div>

    <!-- Detail Panels -->
    <div class="grid-2">
      <div class="panel">
        <div class="panel-head">
          <h2>Datos de la cuenta</h2>
          <span class="panel-note">Credenciales y entidad</span>
        </div>
        <div class="panel-body">
          <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap: 14px;">
            <div class="detail-field-box">
              <span class="detail-label">Nombre completo</span>
              <span class="detail-val">${escapeHtml(u.name)}</span>
            </div>
            <div class="detail-field-box">
              <span class="detail-label">Correo electrónico</span>
              <span class="detail-val">${escapeHtml(u.email)}</span>
            </div>
            <div class="detail-field-box">
              <span class="detail-label">Empresa asignada</span>
              <span class="detail-val">${escapeHtml(u.company)}</span>
            </div>
            <div class="detail-field-box">
              <span class="detail-label">Sucursal asignada</span>
              <span class="detail-val">${escapeHtml(u.branch || 'Sin sucursal asignada')}</span>
            </div>
            <div class="detail-field-box">
              <span class="detail-label">Rol de permisos</span>
              <div style="margin-top:4px;"><span class="tag-neutral">${escapeHtml(u.role)}</span></div>
            </div>
            <div class="detail-field-box">
              <span class="detail-label">Estado de cuenta</span>
              <div style="margin-top:4px;">${badge(u.status)}</div>
            </div>
            <div class="detail-field-box">
              <span class="detail-label">Teléfono de contacto</span>
              <span class="detail-val">${escapeHtml(u.phone || 'Sin registrar')}</span>
            </div>
            <div class="detail-field-box">
              <span class="detail-label">Expediente de Empleado (RRHH)</span>
              <div style="margin-top:4px; display:flex; flex-wrap:wrap; align-items:center; gap:8px;">
                ${u.employeeId ? `
                  <span class="badge-pill success"><span class="badge-pill-dot"></span>Vinculado${u.employeeCode ? ` · ${escapeHtml(u.employeeCode)}` : ''}</span>
                  <button type="button" class="row-action" data-hr-detail="employee" data-id="${u.employeeId}" style="padding:2px 8px; font-size:12px;">Ver expediente →</button>
                ` : `
                  <span class="badge-pill warning"><span class="badge-pill-dot"></span>Sin expediente</span>
                  <button type="button" class="row-action" data-action="link-existing-employee-to-user" data-user-id="${u.id}" style="padding:2px 8px; font-size:12px;">Vincular existente</button>
                  <button type="button" class="row-action" data-action="create-employee-for-user" data-user-id="${u.id}" style="padding:2px 8px; font-size:12px; color:var(--primary,#0070f2);">Crear nuevo →</button>
                `}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <h2>Actividad y auditoría reciente</h2>
          <span class="panel-note">${userAudit.length} registros</span>
        </div>
        <div class="panel-body activity" style="max-height: 380px; overflow-y: auto;">
          ${userAudit.length > 0 ? userAudit.map(a => `
            <div class="activity-item">
              <span class="activity-bullet"></span>
              <div>
                <p><strong>${escapeHtml(a.action)}</strong> en ${escapeHtml(a.module)}</p>
                <small style="color:var(--muted);">${escapeHtml(a.date)} · IP: ${escapeHtml(a.ip || 'Local')}</small>
              </div>
            </div>
          `).join('') : '<p class="panel-note" style="padding:16px 0;">Sin eventos de auditoría registrados para este usuario.</p>'}
        </div>
      </div>
    </div>
  `;
}
