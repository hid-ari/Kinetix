import { state, canManageRoles } from '../core/state.js';
import { escapeHtml, toast } from './utils.js';

export function pageHeader(title, description, action = '') {
  return `<div class="page-heading"><div><h1>${title}</h1><p class="subtitle">${description}</p></div>${action}</div>`;
}

export function breadcrumb(items) {
  return `<div class="breadcrumb">${items.map((item, i) => i < items.length - 1 ? `<button data-nav="${item[0]}">${item[1]}</button> <span> / </span>` : `<strong>${item[1]}</strong>`).join('')}</div>`;
}

export function currentOptions() {
  const rolesOption = canManageRoles() ? '<button class="option-card" data-nav="roles"><span class="option-icon">◇</span><span><strong>Roles y permisos</strong><small>Control de capacidades</small></span><b>→</b></button>' : '';
  return `<div class="workspace-options">
    <div class="workspace-options-head">
      <h3>Acceso rápido</h3>
      <span class="panel-note">Atajos a módulos principales</span>
    </div>
    <div class="option-grid">
      <button class="option-card" data-nav="inventory"><span class="option-icon">◈</span><span><strong>Inventario</strong><small>Productos y existencias</small></span><b>→</b></button>
      <button class="option-card" data-nav="finance"><span class="option-icon">$</span><span><strong>Finanzas</strong><small>Gastos y facturación</small></span><b>→</b></button>
      <button class="option-card" data-nav="companies"><span class="option-icon">▦</span><span><strong>Empresas</strong><small>Organización y sedes</small></span><b>→</b></button>
      <button class="option-card" data-nav="users"><span class="option-icon">♙</span><span><strong>Usuarios</strong><small>Cuentas y acceso</small></span><b>→</b></button>
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
