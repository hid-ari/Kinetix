import { state, canManageRoles, canAccessView } from '../core/state.js';
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

export function breadcrumb(items) {
  return `<div class="breadcrumb">${items.map((item, i) => i < items.length - 1 ? `<button data-nav="${item[0]}">${item[1]}</button> <span> / </span>` : `<strong>${item[1]}</strong>`).join('')}</div>`;
}

export function currentOptions() {
  const cards = [];

  if (canAccessView('hr-dashboard') || canAccessView('hr-employees')) {
    cards.push(`
      <button class="option-card" data-nav="hr-dashboard">
        <span class="option-icon blue">
          <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
        </span>
        <span><strong>Recursos Humanos</strong><small>Colaboradores y organigrama</small></span>
        <b>→</b>
      </button>`);
  }

  if (canAccessView('hr-attendance')) {
    cards.push(`
      <button class="option-card" data-nav="hr-attendance">
        <span class="option-icon amber">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>
        </span>
        <span><strong>Asistencia y Turnos</strong><small>Terminal digital y ponches</small></span>
        <b>→</b>
      </button>`);
  }

  if (canAccessView('hr-vacations')) {
    cards.push(`
      <button class="option-card" data-nav="hr-vacations">
        <span class="option-icon green">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>
        </span>
        <span><strong>Vacaciones y Permisos</strong><small>Saldos y Código de Trabajo</small></span>
        <b>→</b>
      </button>`);
  }

  if (canAccessView('hr-approvals')) {
    cards.push(`
      <button class="option-card" data-nav="hr-approvals">
        <span class="option-icon purple">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
        </span>
        <span><strong>Bandeja Aprobaciones</strong><small>Resolución multinivel</small></span>
        <b>→</b>
      </button>`);
  }

  if (canAccessView('inventory')) {
    cards.push(`
      <button class="option-card" data-nav="inventory">
        <span class="option-icon green">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 2a1 1 0 00-1 1v1a1 1 0 002 0V3a1 1 0 00-1-1zM4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/></svg>
        </span>
        <span><strong>Inventario & Stock</strong><small>Existencias y movimientos</small></span>
        <b>→</b>
      </button>`);
  }

  if (canAccessView('finance')) {
    cards.push(`
      <button class="option-card" data-nav="finance">
        <span class="option-icon blue">
          <svg viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clip-rule="evenodd"/></svg>
        </span>
        <span><strong>Finanzas Operativas</strong><small>Ingresos, gastos y facturas</small></span>
        <b>→</b>
      </button>`);
  }

  if (canAccessView('companies')) {
    cards.push(`
      <button class="option-card" data-nav="companies">
        <span class="option-icon slate">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4zm3 1h6v4H7V5zm6 6H7v2h6v-2z" clip-rule="evenodd"/></svg>
        </span>
        <span><strong>Empresas & Sedes</strong><small>Estructura multiempresa</small></span>
        <b>→</b>
      </button>`);
  }

  if (canAccessView('users')) {
    cards.push(`
      <button class="option-card" data-nav="users">
        <span class="option-icon slate">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/></svg>
        </span>
        <span><strong>Usuarios & Cuentas</strong><small>Gestión de credenciales</small></span>
        <b>→</b>
      </button>`);
  }

  if (canManageRoles()) {
    cards.push(`
      <button class="option-card" data-nav="roles">
        <span class="option-icon purple">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
        </span>
        <span><strong>Roles y Permisos</strong><small>Control RBAC y accesos</small></span>
        <b>→</b>
      </button>`);
  }

  return `<div class="workspace-options">
    <div class="workspace-options-head">
      <div>
        <h3>Módulos y Servicios Habilitados</h3>
        <span class="panel-note">Accesos asignados según tu rol y privilegios</span>
      </div>
      <span class="page-heading-chip" style="margin:0;">ACCESO OPERATIVO</span>
    </div>
    <div class="option-grid">
      ${cards.join('')}
    </div>
  </div>`;
}

export function showModal(title, body, confirmText, callback = null) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const confirmBtnHtml = confirmText ? `<button class="primary modal-confirm">${confirmText}</button>` : '';
  backdrop.innerHTML = `<div class="modal"><h2>${title}</h2><div>${body}</div><div class="modal-actions"><button class="secondary modal-cancel">${confirmText ? 'Cancelar' : 'Cerrar'}</button>${confirmBtnHtml}</div></div>`;
  document.body.append(backdrop);
  backdrop.querySelector('.modal-cancel').onclick = () => backdrop.remove();
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
      ${isSystemRole ? '<small style="color:var(--muted);font-size:11px;margin-top:3px;display:block;">🔒 Rol esencial del sistema: nombre protegido contra modificación.</small>' : ''}
    </div>
    <div class="field" style="margin-top:12px">
      <label>Descripción</label>
      <textarea class="role-description" placeholder="Alcance operativo y responsabilidades del rol">${escapeHtml(currentDesc || '')}</textarea>
    </div>
    <div style="display:flex;gap:8px;margin-top:18px;margin-bottom:8px;align-items:center;justify-content:space-between;padding-bottom:6px;border-bottom:1px solid var(--border,#334155);">
      <span style="font-weight:600;font-size:13px;">Funciones del Sistema</span>
      <div style="display:flex;gap:8px;font-size:12px;">
        <button type="button" class="btn-select-all" style="background:none;border:none;color:var(--primary,#3b82f6);cursor:pointer;font-weight:500;">✓ Marcar todos</button>
        <span style="color:var(--muted,#64748b);">|</span>
        <button type="button" class="btn-deselect-all" style="background:none;border:none;color:var(--muted,#94a3b8);cursor:pointer;font-weight:500;">✗ Desmarcar todos</button>
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
  });

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
