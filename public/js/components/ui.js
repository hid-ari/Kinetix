import { state, canManageRoles } from '../core/state.js';
import { escapeHtml, toast } from './utils.js';

export function pageHeader(title, description, action = '') {
  return `<div class="page-heading"><div><h1>${title}</h1><p class="subtitle">${description}</p></div>${action}</div>`;
}

export function breadcrumb(items) {
  return `<div class="breadcrumb">${items.map((item, i) => i < items.length - 1 ? `<button data-nav="${item[0]}">${item[1]}</button> <span> / </span>` : `<strong>${item[1]}</strong>`).join('')}</div>`;
}

export function currentOptions() {
  const rolesOption = canManageRoles() ? `
    <button class="option-card" data-nav="roles">
      <span class="option-icon">
        <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
      </span>
      <span><strong>Roles y permisos</strong><small>Control de capacidades</small></span>
      <b>→</b>
    </button>` : '';

  return `<div class="workspace-options">
    <div class="workspace-options-head">
      <h3>Acceso Rápido a Módulos</h3>
      <span class="panel-note">Atajos directos de navegación operativa</span>
    </div>
    <div class="option-grid">
      <button class="option-card" data-nav="hr-dashboard">
        <span class="option-icon">
          <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
        </span>
        <span><strong>Talento Humano</strong><small>Empleados y estructura</small></span>
        <b>→</b>
      </button>
      <button class="option-card" data-nav="inventory">
        <span class="option-icon">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 2a1 1 0 00-1 1v1a1 1 0 002 0V3a1 1 0 00-1-1zM4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/></svg>
        </span>
        <span><strong>Inventario</strong><small>Productos y existencias</small></span>
        <b>→</b>
      </button>
      <button class="option-card" data-nav="finance">
        <span class="option-icon">
          <svg viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clip-rule="evenodd"/></svg>
        </span>
        <span><strong>Finanzas</strong><small>Gastos y facturación</small></span>
        <b>→</b>
      </button>
      <button class="option-card" data-nav="companies">
        <span class="option-icon">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4zm3 1h6v4H7V5zm6 6H7v2h6v-2z" clip-rule="evenodd"/></svg>
        </span>
        <span><strong>Empresas</strong><small>Organización y sedes</small></span>
        <b>→</b>
      </button>
      <button class="option-card" data-nav="users">
        <span class="option-icon">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/></svg>
        </span>
        <span><strong>Usuarios</strong><small>Cuentas y acceso</small></span>
        <b>→</b>
      </button>
      ${rolesOption}
    </div>
  </div>`;
}

export function showModal(title, body, confirmText, callback = null) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal"><h2>${title}</h2><div>${body}</div><div class="modal-actions"><button class="secondary modal-cancel">Cancelar</button><button class="primary modal-confirm">${confirmText}</button></div></div>`;
  document.body.append(backdrop);
  backdrop.querySelector('.modal-cancel').onclick = () => backdrop.remove();
  backdrop.querySelector('.modal-confirm').onclick = async () => {
    if (callback) await callback(backdrop);
    backdrop.remove();
  };
  backdrop.addEventListener('click', event => {
    if (event.target === backdrop) backdrop.remove();
  });
}

export async function showRoleModal(roleName, roleId = null, onRender = () => {}) {
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
  const body = `<div class="field"><label>Nombre del rol</label><input class="role-name" value="${roleName === 'Nuevo rol' ? '' : escapeHtml(roleName)}" ${roleId ? 'disabled' : ''}></div><div class="field" style="margin-top:12px"><label>Descripción</label><textarea class="role-description" placeholder="Alcance del rol"></textarea></div><div class="permission-grid" style="margin-top:18px">${Object.entries(grouped).map(([group, permissions]) => `<div class="permission-group"><h3>${escapeHtml(group)}</h3>${permissions.map(permission => `<label class="check"><input type="checkbox" data-permission-id="${permission.id}" ${!roleId || currentPermissions.has(permission.id) ? 'checked' : ''}>${escapeHtml(permission.name)}</label>`).join('')}</div>`).join('')}</div>`;
  
  showModal(roleName === 'Nuevo rol' ? 'Nuevo rol' : `Permisos · ${roleName}`, body, 'Guardar cambios', async modal => {
    let targetRoleId = roleId;
    if (!targetRoleId) {
      const name = modal.querySelector('.role-name').value.trim();
      const description = modal.querySelector('.role-description').value.trim();
      const createResponse = await fetch('/api/roles', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description }) });
      const created = await createResponse.json();
      if (!createResponse.ok) return toast(created.message || 'No fue posible guardar el rol.');
      targetRoleId = created.id;
    }
    const permissionIds = [...modal.querySelectorAll('[data-permission-id]:checked')].map(input => Number(input.dataset.permissionId));
    const permissionsResponse = await fetch(`/api/roles/${targetRoleId}/permissions`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ permissionIds }) });
    if (!permissionsResponse.ok) return toast('No fue posible guardar los permisos del rol.');
    if (window.__loadDataAndRender) await window.__loadDataAndRender();
    toast(roleId ? 'Permisos actualizados correctamente.' : 'Rol creado correctamente.');
  });
}
