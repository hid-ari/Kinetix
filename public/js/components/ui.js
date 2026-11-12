import { state, canAccessView } from '../core/state.js';
import { escapeHtml, toast } from './utils.js';
import { loadData } from '../core/api.js';

export function pageHeader(title, description, action = '', badgeText = '') {
  const badgeHtml = badgeText ? `<span class="page-heading-chip">${escapeHtml(badgeText)}</span>` : '';
  return `<div class="page-heading">
    <div>
      ${badgeHtml}
      <h1>${title}</h1>
      <p class="subtitle">${description}</p>
    </div>
    ${action ? `<div class="inline-actions">${action}</div>` : ''}
  </div>`;
}

// Jerarquía de navegación única (alineada 1:1 con server/modules).
const CRUMBS = {
  // Módulo: Administración (server/modules/admin/routes)
  'admin':              { label: 'Administración' },
  'companies':          { label: 'Administración' },
  'users':              { parent: 'admin', label: 'Usuarios' },
  'user-detail':        { parent: 'users', label: 'Usuario' },
  'user-form':          { parent: 'users', label: 'Usuario' },
  'branches':           { parent: 'admin', label: 'Sucursales' },
  'branch-detail':      { parent: 'branches', label: 'Sucursal' },
  'branch-form':        { parent: 'branches', label: 'Sucursal' },
  'roles':              { parent: 'admin', label: 'Roles y permisos' },
  'audit':              { parent: 'admin', label: 'Auditoría' },

  // Módulo: Recursos Humanos (server/modules/hr/routes)
  'hr-dashboard':       { label: 'Recursos Humanos' },
  'hr-employees':       { parent: 'hr-dashboard', label: 'Empleados' },
  'hr-employee-form':   { parent: 'hr-employees', label: 'Empleado' },
  'hr-employee-detail': { parent: 'hr-employees', label: 'Expediente' },
  'hr-departments':     { parent: 'hr-dashboard', label: 'Departamentos' },
  'hr-positions':       { parent: 'hr-dashboard', label: 'Cargos y Puestos' },
  'hr-orgchart':        { parent: 'hr-dashboard', label: 'Organigrama' },
  'hr-attendance':      { parent: 'hr-dashboard', label: 'Asistencia & Turnos' },
  'hr-vacations':       { parent: 'hr-dashboard', label: 'Vacaciones & Permisos' },
  'hr-approvals':       { parent: 'hr-dashboard', label: 'Aprobaciones' },

  // Módulo: Inventario & Stock (server/modules/inventory/routes)
  'inventory':          { label: 'Inventario & Stock' },
  'products':           { parent: 'inventory', label: 'Productos' },
  'stock':              { parent: 'inventory', label: 'Existencias' },
  'movements':          { parent: 'inventory', label: 'Entradas / salidas' },
  'alerts':             { parent: 'inventory', label: 'Alertas' },

  // Módulo: Finanzas (server/modules/finance/routes)
  'finance':              { label: 'Finanzas' },
  'finance-transactions': { parent: 'finance', label: 'Transacciones' },
  'finance-invoices':     { parent: 'finance', label: 'Facturas' },
  'finance-contacts':     { parent: 'finance', label: 'Clientes y Proveedores' },
  'finance-banking':      { parent: 'finance', label: 'Conciliación Bancaria' },

  'profile':            { label: 'Mi perfil' }
};

function adminHome() {
  return ['companies', 'users', 'branches', 'roles', 'audit'].find(v => canAccessView(v)) || 'companies';
}

/**
 * Construye el camino de navegación a partir de la vista actual.
 */
export function breadcrumb(items) {
  const leafLabel = items?.length ? items[items.length - 1][1] : '';
  const node = CRUMBS[state.view];
  let trail;

  if (!node) {
    trail = items || [];
  } else {
    trail = [];
    let key = state.view;
    while (key) {
      if (key === 'admin') {
        trail.unshift([adminHome(), 'Administración']);
        break;
      }
      const n = CRUMBS[key];
      if (!n) break;
      trail.unshift([key, n.label]);
      key = n.parent;
    }
    // Solo las vistas dinámicas (nombre real, "Nuevo...", etc.) aportan su etiqueta final
    const dynamic = /-(detail|form)$/.test(state.view);
    if (dynamic && leafLabel) trail[trail.length - 1][1] = leafLabel;
  }

  return `<nav class="breadcrumb" aria-label="Ruta de navegación">${trail.map((item, i) => i < trail.length - 1
    ? `<button data-nav="${item[0]}">${item[1]}</button><span>/</span>`
    : `<strong>${item[1]}</strong>`).join('')}</nav>`;
}

export function showModal(title, body, confirmText, callback = null, options = {}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const sizeOption = typeof options === 'string' ? options : (options?.size || '');
  const sizeClass = sizeOption ? `modal-${sizeOption}` : '';
  const confirmBtnHtml = confirmText ? `<button type="button" class="primary modal-confirm">${confirmText}</button>` : '';
  backdrop.innerHTML = `
    <div class="modal ${sizeClass}">
      <div class="modal-header">
        <h2>${title}</h2>
        <button type="button" class="modal-close-btn" aria-label="Cerrar modal">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal-body">
        ${body}
      </div>
      <div class="modal-actions">
        <button type="button" class="secondary modal-cancel">${confirmText ? 'Cancelar' : 'Cerrar'}</button>
        ${confirmBtnHtml}
      </div>
    </div>
  `;
  document.body.append(backdrop);

  const closeModal = () => backdrop.remove();
  backdrop.querySelector('.modal-cancel')?.addEventListener('click', closeModal);
  backdrop.querySelector('.modal-close-btn')?.addEventListener('click', closeModal);

  const confirmBtn = backdrop.querySelector('.modal-confirm');
  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      try {
        if (callback) await callback(backdrop);
        backdrop.remove();
      } catch (err) {
        toast(err.message || 'Error al procesar la acción.');
      }
    };
  }
  backdrop.addEventListener('click', event => {
    if (event.target === backdrop) backdrop.remove();
  });
  return backdrop;
}

export async function showRoleModal(roleName, roleId = null, onRender = () => {}) {
  const existingRole = roleId ? state.roles.find(r => String(r.id) === String(roleId)) : null;
  const isSystemRole = Boolean(existingRole?.isSystem || existingRole?.type === 'Sistema');
  const currentName = existingRole ? existingRole.name : (roleName === 'Nuevo rol' ? '' : roleName);
  const currentDesc = existingRole ? existingRole.description : '';

  let currentPermissions = new Set();
  if (roleId) {
    try {
      const res = await fetch(`/api/roles/${roleId}/permissions`, { credentials: 'include' });
      if (res.ok) {
        const ids = await res.json();
        ids.forEach(id => currentPermissions.add(id));
      }
    } catch (_) {}
  }

  const grouped = state.permissions.reduce((groups, permission) => {
    (groups[permission.module] ||= []).push(permission);
    return groups;
  }, {});

  const body = `
    <div class="field">
      <label>Nombre del rol</label>
      <input class="role-name" value="${escapeHtml(currentName)}" ${isSystemRole ? 'disabled' : ''} placeholder="Ej. Supervisor de Despacho">
      ${isSystemRole ? '<small style="color:var(--muted);font-size:11px;margin-top:3px;display:flex;align-items:center;gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Rol esencial del sistema: nombre protegido contra modificación.</small>' : ''}
    </div>
    <div class="field" style="margin-top:12px">
      <label>Descripción</label>
      <textarea class="role-description" placeholder="Alcance operativo y responsabilidades del rol">${escapeHtml(currentDesc || '')}</textarea>
    </div>
    <div style="display:flex;gap:8px;margin-top:18px;margin-bottom:8px;align-items:center;justify-content:space-between;padding-bottom:6px;border-bottom:1px solid var(--border,#334155);">
      <span style="font-weight:600;font-size:13px;">Funciones del Sistema</span>
      <div style="display:flex;gap:8px;font-size:12px;">
        <button type="button" class="btn-select-all" style="background:none;border:none;color:var(--primary,#3b82f6);cursor:pointer;font-weight:500;">Marcar todos</button>
        <span style="color:var(--muted,#64748b);">|</span>
        <button type="button" class="btn-deselect-all" style="background:none;border:none;color:var(--muted,#94a3b8);cursor:pointer;font-weight:500;">Desmarcar todos</button>
      </div>
    </div>
    <div class="permission-grid">
      ${Object.entries(grouped).map(([group, permissions]) => `
        <div class="permission-group">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <h3 style="margin:0;">${escapeHtml(group)}</h3>
            <button type="button" class="btn-toggle-group" style="background:none;border:none;color:var(--muted,#94a3b8);font-size:11px;cursor:pointer;">Alternar</button>
          </div>
          ${permissions.map(permission => `
            <label class="check">
              <input type="checkbox" data-permission-id="${permission.id}" ${!roleId || currentPermissions.has(permission.id) ? 'checked' : ''}>
              ${escapeHtml(permission.name)}
            </label>
          `).join('')}
        </div>
      `).join('')}
    </div>
  `;

  const modalTitle = !roleId
    ? 'Nuevo rol personalizado'
    : (isSystemRole ? `Funciones del Sistema · ${escapeHtml(currentName)}` : `Editar rol · ${escapeHtml(currentName)}`);

  showModal(modalTitle, body, 'Guardar cambios', async modal => {
    const nameInput = modal.querySelector('.role-name');
    const name = nameInput ? nameInput.value.trim() : '';
    const description = modal.querySelector('.role-description')?.value.trim() || '';
    const permissionIds = [...modal.querySelectorAll('[data-permission-id]:checked')].map(input => Number(input.dataset.permissionId));

    if (!roleId && !name) {
      toast('El nombre del rol es obligatorio.');
      return;
    }

    if (!roleId) {
      const response = await fetch('/api/roles', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, roleType: 'Personalizado', permissionIds })
      });
      const result = await response.json();
      if (!response.ok) {
        toast(result.message || 'No fue posible crear el rol.');
        return;
      }
      toast(`Rol "${name}" creado exitosamente.`);
    } else {
      const response = await fetch(`/api/roles/${roleId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: isSystemRole ? undefined : name,
          description,
          permissionIds
        })
      });
      const result = await response.json();
      if (!response.ok) {
        toast(result.message || 'No fue posible actualizar el rol.');
        return;
      }
      toast('Rol y funciones actualizados exitosamente.');
    }

    try {
      await loadData();
    } catch (_) {}
    if (typeof onRender === 'function') onRender();
  }, { size: 'lg' });

  // Delegación rápida para los botones de selección
  setTimeout(() => {
    const modalEl = document.querySelector('.modal');
    if (!modalEl) return;
    modalEl.querySelector('.btn-select-all')?.addEventListener('click', () => {
      modalEl.querySelectorAll('[data-permission-id]').forEach(cb => cb.checked = true);
    });
    modalEl.querySelector('.btn-deselect-all')?.addEventListener('click', () => {
      modalEl.querySelectorAll('[data-permission-id]').forEach(cb => cb.checked = false);
    });
    modalEl.querySelectorAll('.permission-group').forEach(group => {
      group.querySelector('.btn-toggle-group')?.addEventListener('click', () => {
        const cbs = group.querySelectorAll('[data-permission-id]');
        const anyChecked = [...cbs].some(cb => cb.checked);
        cbs.forEach(cb => cb.checked = !anyChecked);
      });
    });
  }, 50);
}
