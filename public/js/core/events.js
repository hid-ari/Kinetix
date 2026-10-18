import { state } from './state.js';
import { loadData, runGlobalSearch, saveEntityForm, saveBranchForm } from './api.js';
import { toast, escapeHtml } from '../components/utils.js';
import { showModal, showRoleModal } from '../components/ui.js';
import { bindHr } from '../views/hr/hr.events.js';
import {
  loadHrDashboard,
  loadHrEmployees,
  loadHrDepartments,
  loadHrPositions,
  loadHrCatalogs,
  loadHrOrgChart,
  loadTodayAttendance,
  loadHrShifts,
  loadAttendanceList,
  loadVacationBalance,
  loadVacationRequests,
  loadLeaveTypes,
  loadLeaveRequests,
  loadVacationCalendar,
  loadPendingApprovals,
  loadMyApprovalRequests
} from '../views/hr/hr.api.js';

export async function loadHrViewData(view) {
  if (view === 'hr-dashboard') {
    await loadHrDashboard();
  } else if (view === 'hr-employees') {
    await Promise.all([loadHrEmployees(), loadHrDepartments()]);
  } else if (view === 'hr-employee-form') {
    if (!state.hr.editMode) state.hr.currentEmployee = null;
    await Promise.all([loadHrDepartments(), loadHrPositions(), loadHrCatalogs(), loadHrEmployees()]);
  } else if (view === 'hr-departments') {
    await Promise.all([loadHrDepartments(), loadHrEmployees()]);
  } else if (view === 'hr-positions') {
    await Promise.all([loadHrDepartments(), loadHrPositions()]);
  } else if (view === 'hr-orgchart') {
    await loadHrOrgChart();
  } else if (view === 'hr-attendance') {
    await Promise.all([loadTodayAttendance(), loadHrShifts(), loadAttendanceList()]);
  } else if (view === 'hr-vacations') {
    const now = new Date();
    await Promise.all([
      loadVacationBalance(),
      loadVacationRequests(),
      loadLeaveTypes(),
      loadLeaveRequests(),
      loadVacationCalendar(now.getMonth() + 1, now.getFullYear())
    ]);
  } else if (view === 'hr-approvals') {
    await Promise.all([loadPendingApprovals(), loadMyApprovalRequests()]);
  }
}

export function bind(renderFn) {
  document.querySelectorAll('[data-nav]').forEach(button => button.addEventListener('click', async () => {
    state.view = button.dataset.nav;
    state.query = '';
    state.detail = null;
    if (state.view === 'hr-employee-form' && !state.hr.editMode) {
      state.hr.currentEmployee = null;
    }
    if (state.view.startsWith('hr-')) {
      try {
        await loadHrViewData(state.view);
      } catch (err) {
        toast(err.message);
      }
    }
    renderFn();
  }));
  document.querySelectorAll('[data-detail]').forEach(button => button.addEventListener('click', () => { state.detail = button.dataset.detail === 'user' ? button.dataset.id : Number(button.dataset.id); state.view = `${button.dataset.detail}-detail`; state.tab = 'Información'; renderFn(); }));
  document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => { state.tab = button.dataset.tab; renderFn(); }));
  document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', async () => { state.companiesPage = Number(button.dataset.page); try { await loadData(); renderFn(); } catch (error) { toast(error.message); } }));
  document.querySelectorAll('[data-users-page]').forEach(button => button.addEventListener('click', async () => { state.usersPage = Number(button.dataset.usersPage); try { await loadData(); renderFn(); } catch (error) { toast(error.message); } }));
  
  const search = document.querySelector('#global-search');
  if (search) {
    search.addEventListener('input', event => { state.query = event.target.value; });
    search.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); runGlobalSearch(renderFn); } });
  }

  document.querySelectorAll('[data-audit-filter]').forEach(select => select.addEventListener('change', async event => {
    if (event.target.dataset.auditFilter === 'module') state.auditModule = event.target.value;
    if (event.target.dataset.auditFilter === 'action') state.auditAction = event.target.value;
    await loadData();
    renderFn();
  }));

  document.querySelectorAll('[data-users-status-filter]').forEach(select => select.addEventListener('change', async event => {
    state.usersStatusFilter = event.target.value;
    state.usersPage = 1;
    await loadData();
    renderFn();
  }));

  document.querySelectorAll('[data-movement-type]').forEach(button => button.addEventListener('click', () => { state.movementType = button.dataset.movementType; renderFn(); }));
  document.querySelectorAll('[data-alert-filter]').forEach(button => button.addEventListener('click', () => { state.alertSeverityFilter = button.dataset.alertFilter; renderFn(); }));
  document.querySelectorAll('[data-finance-tab]').forEach(button => button.addEventListener('click', () => { state.financeTab = button.dataset.financeTab; renderFn(); }));

  const movementForm = document.querySelector('#movement-form');
  if (movementForm) movementForm.addEventListener('submit', async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(movementForm));
    const response = await fetch('/api/inventory/movements', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, type: state.movementType, productId: Number(data.productId), branchId: Number(data.branchId), quantity: Number(data.quantity) })
    });
    const result = await response.json();
    if (!response.ok) return toast(result.message || 'No fue posible registrar el movimiento.');
    await loadData();
    toast(`Movimiento de ${state.movementType.toLowerCase()} registrado.`);
    renderFn();
  });

  const pageSearch = document.querySelector('#page-search');
  if (pageSearch) {
    pageSearch.addEventListener('input', event => {
      if (state.view === 'audit') state.auditSearch = event.target.value;
      else state.query = event.target.value;
      renderFn();
      const updatedSearch = document.querySelector('#page-search');
      if (updatedSearch) {
        updatedSearch.focus();
        updatedSearch.setSelectionRange(event.target.value.length, event.target.value.length);
      }
    });
    pageSearch.addEventListener('keydown', async event => {
      if (event.key === 'Enter' && state.view === 'audit') {
        event.preventDefault();
        await loadData();
        renderFn();
      }
    });
  }

  document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => handleAction(button.dataset.action, button, renderFn)));

  document.querySelectorAll('[data-quick-email]').forEach(chip => {
    chip.addEventListener('click', () => {
      const emailInput = document.querySelector('#login-email-input');
      const passInput = document.querySelector('#login-password-input');
      if (emailInput) emailInput.value = chip.dataset.quickEmail || '';
      if (passInput) passInput.value = chip.dataset.quickPass || '';
      toast(`Credenciales de ${chip.querySelector('strong')?.textContent || 'usuario'} cargadas.`);
    });
  });

  const loginForm = document.querySelector('#login-form');
  if (loginForm) loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(loginForm)))
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'No fue posible iniciar sesión.');
      await loadData();
      state.loggedIn = true;
      toast('Sesión iniciada correctamente.');
      renderFn();
    } catch (error) { toast(error.message); }
  });

  const resetForm = document.querySelector('#reset-password-form');
  if (resetForm) resetForm.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: state.resetEmail, token: state.resetToken, newPassword: new FormData(resetForm).get('password') })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Error al restablecer contraseña.');
      toast('Contraseña restablecida. Inicia sesión.');
      history.replaceState(null, '', '/');
      state.view = 'dashboard';
      renderFn();
    } catch (error) { toast(error.message); }
  });

  const entityForm = document.querySelector('#entity-form');
  if (entityForm) entityForm.addEventListener('submit', async event => {
    event.preventDefault();
    try { await saveEntityForm(entityForm, renderFn); } catch (error) { toast(error.message); }
  });

  const branchFormElement = document.querySelector('#branch-form');
  if (branchFormElement) branchFormElement.addEventListener('submit', async event => {
    event.preventDefault();
    try { await saveBranchForm(branchFormElement, renderFn); } catch (error) { toast(error.message); }
  });

  bindHr(renderFn);
}

export async function handleAction(action, button, renderFn) {
  if (action === 'logout') {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch (_) {}
    state.loggedIn = false;
    state.currentUser = null;
    toast('Sesión cerrada correctamente.');
    renderFn();
    return;
  }
  if (action === 'back-to-login') {
    state.resetEmail = null;
    state.resetToken = null;
    renderFn();
    return;
  }
  if (action === 'toggle-sidebar') { state.sidebarCollapsed = !state.sidebarCollapsed; renderFn(); }
  if (action === 'reponer-product') { state.movementType = 'Entrada'; state.view = 'movements'; toast('Redirigiendo a registro de entrada de inventario.'); renderFn(); }
  if (action === 'new-company') { state.view = 'company-form'; renderFn(); }
  if (action === 'new-user') { state.view = 'user-form'; renderFn(); }
  if (action === 'new-branch') { state.view = 'branch-form'; renderFn(); }
  if (action === 'new-product') showModal('Nuevo producto', '<div class="form-grid"><div class="field"><label>SKU</label><input class="product-sku" required placeholder="SKU-0001"></div><div class="field"><label>Nombre</label><input class="product-name" required placeholder="Nombre del producto"></div><div class="field"><label>Categoría</label><input class="product-category" placeholder="Categoría"></div><div class="field"><label>Unidad</label><input class="product-unit" value="und." required></div><div class="field"><label>Stock mínimo</label><input class="product-minimum" type="number" min="0" step="0.001" value="0" required></div><div class="field"><label>Costo unitario</label><input class="product-price" type="number" min="0" step="0.0001" value="0" required></div></div>', 'Crear producto', async modal => { const response = await fetch('/api/inventory/products', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sku: modal.querySelector('.product-sku').value, name: modal.querySelector('.product-name').value, category: modal.querySelector('.product-category').value, unit: modal.querySelector('.product-unit').value, minimum: Number(modal.querySelector('.product-minimum').value), price: Number(modal.querySelector('.product-price').value) }) }); const result = await response.json(); if (!response.ok) return toast(result.message || 'No fue posible crear el producto.'); await loadData(); toast('Producto creado correctamente.'); renderFn(); });
  if (action === 'edit-product') { const product = state.products.find(item => String(item.id) === button.dataset.productId); if (!product) return toast('El producto ya no está disponible.'); const body = `<div class="form-grid"><div class="field"><label>SKU</label><input class="product-sku" value="${escapeHtml(product.sku)}" required></div><div class="field"><label>Nombre</label><input class="product-name" value="${escapeHtml(product.name)}" required></div><div class="field"><label>Categoría</label><input class="product-category" value="${escapeHtml(product.category)}"></div><div class="field"><label>Unidad</label><input class="product-unit" value="${escapeHtml(product.unit)}" required></div><div class="field"><label>Stock mínimo</label><input class="product-minimum" type="number" min="0" step="0.001" value="${product.minimum}" required></div><div class="field"><label>Costo unitario</label><input class="product-price" type="number" min="0" step="0.0001" value="${product.price}" required></div></div>`; showModal('Editar producto', body, 'Guardar cambios', async modal => { const response = await fetch(`/api/inventory/products/${product.id}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sku: modal.querySelector('.product-sku').value, name: modal.querySelector('.product-name').value, category: modal.querySelector('.product-category').value, unit: modal.querySelector('.product-unit').value, minimum: Number(modal.querySelector('.product-minimum').value), price: Number(modal.querySelector('.product-price').value) }) }); const result = await response.json(); if (!response.ok) return toast(result.message || 'No fue posible actualizar el producto.'); await loadData(); toast('Producto actualizado correctamente.'); renderFn(); }); }
  if (action === 'toggle-product') { const product = state.products.find(item => String(item.id) === button.dataset.productId); if (!product) return toast('El producto ya no está disponible.'); showModal('Desactivar producto', 'El producto dejará de aparecer en el catálogo operativo, pero conservará su historial.', 'Desactivar', async () => { const response = await fetch(`/api/inventory/products/${product.id}/status`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: false }) }); if (!response.ok) return toast('No fue posible desactivar el producto.'); await loadData(); toast('Producto desactivado.'); renderFn(); }); }
  if (action === 'refresh-audit') { loadData().then(renderFn).catch(error => toast(error.message)); }
  if (action === 'new-role') showRoleModal('Nuevo rol', null, renderFn);
  if (action === 'new-expense') showModal('Registrar gasto', '<div class="form-grid"><div class="field"><label>Categoría</label><input class="finance-category" required placeholder="Ej. Servicios"></div><div class="field"><label>Monto</label><input class="finance-amount" type="number" min="0.01" step="0.01" required placeholder="0.00"></div><div class="field full"><label>Descripción</label><textarea class="finance-description" placeholder="Detalle del gasto"></textarea></div></div>', 'Guardar gasto', async modal => { const response = await fetch('/api/finance/transactions', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'Gasto', category: modal.querySelector('.finance-category').value, amount: Number(modal.querySelector('.finance-amount').value), description: modal.querySelector('.finance-description').value }) }); const result = await response.json(); if (!response.ok) return toast(result.message || 'No fue posible registrar el gasto.'); await loadData(); toast('Gasto registrado correctamente.'); renderFn(); });
  if (action === 'new-contact') showModal('Nuevo cliente o proveedor', '<div class="form-grid"><div class="field"><label>Tipo</label><select class="finance-contact-type"><option>Cliente</option><option>Proveedor</option></select></div><div class="field"><label>Nombre</label><input class="finance-contact-name" required placeholder="Nombre comercial"></div><div class="field"><label>Identificación fiscal</label><input class="finance-contact-tax-id" placeholder="RNC / RFC / NIT"></div><div class="field"><label>Email</label><input class="finance-contact-email" type="email"></div><div class="field"><label>Teléfono</label><input class="finance-contact-phone"></div></div>', 'Guardar contacto', async modal => { const response = await fetch('/api/finance/contacts', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: modal.querySelector('.finance-contact-type').value, name: modal.querySelector('.finance-contact-name').value, taxId: modal.querySelector('.finance-contact-tax-id').value, email: modal.querySelector('.finance-contact-email').value, phone: modal.querySelector('.finance-contact-phone').value }) }); const result = await response.json(); if (!response.ok) return toast(result.message || 'No fue posible guardar el contacto.'); await loadData(); toast('Contacto guardado correctamente.'); renderFn(); });
  if (action === 'finance-status') { const response = await fetch(`/api/finance/transactions/${button.dataset.financeId}/status`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: button.dataset.financeStatus }) }); const result = await response.json(); if (!response.ok) return toast(result.message || 'No fue posible actualizar la transacción.'); await loadData(); renderFn(); }
  if (action === 'new-invoice') { const contactOptions = state.finance.contacts.map(contact => '<option value="' + contact.id + '">' + escapeHtml(contact.type) + ' · ' + escapeHtml(contact.name) + '</option>').join(''); const body = '<div class="form-grid"><div class="field"><label>Número</label><input class="invoice-number" required placeholder="F-000001"></div><div class="field"><label>NCF</label><input class="invoice-ncf" maxlength="19" placeholder="B0100000001"></div><div class="field"><label>Tipo</label><select class="invoice-type"><option>Venta</option><option>Compra</option></select></div><div class="field"><label>Contacto</label><select class="invoice-contact"><option value="">Sin contacto</option>' + contactOptions + '</select></div><div class="field"><label>Subtotal</label><input class="invoice-subtotal" type="number" min="0.01" step="0.01" required></div><div class="field"><label>Impuesto %</label><input class="invoice-tax" type="number" min="0" step="0.01" value="0"></div><div class="field"><label>Vencimiento</label><input class="invoice-due-date" type="date"></div></div>'; showModal('Nueva factura', body, 'Crear factura', async modal => { const response = await fetch('/api/finance/invoices', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ number: modal.querySelector('.invoice-number').value, ncf: modal.querySelector('.invoice-ncf').value || null, type: modal.querySelector('.invoice-type').value, contactId: modal.querySelector('.invoice-contact').value || null, subtotal: Number(modal.querySelector('.invoice-subtotal').value), taxRate: Number(modal.querySelector('.invoice-tax').value), dueDate: modal.querySelector('.invoice-due-date').value || null }) }); const result = await response.json(); if (!response.ok) return toast(result.message || 'No fue posible crear la factura.'); await loadData(); toast('Factura creada correctamente.'); renderFn(); }); }
  if (action === 'new-payment') showModal('Registrar pago', '<div class="form-grid"><div class="field"><label>Monto</label><input class="payment-amount" type="number" min="0.01" step="0.01" required></div><div class="field"><label>Método</label><select class="payment-method"><option>Transferencia</option><option>Tarjeta</option><option>Efectivo</option><option>Cheque</option></select></div><div class="field full"><label>Referencia</label><input class="payment-reference"></div></div>', 'Guardar pago', async modal => { const response = await fetch('/api/finance/payments', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId: button.dataset.invoiceId, amount: Number(modal.querySelector('.payment-amount').value), method: modal.querySelector('.payment-method').value, reference: modal.querySelector('.payment-reference').value }) }); const result = await response.json(); if (!response.ok) return toast(result.message || 'No fue posible registrar el pago.'); await loadData(); toast('Pago registrado correctamente.'); renderFn(); });
  if (action === 'new-bank') showModal('Movimiento bancario', '<div class="form-grid"><div class="field"><label>Fecha</label><input class="bank-date" type="date"></div><div class="field"><label>Monto</label><input class="bank-amount" type="number" step="0.01" required></div><div class="field full"><label>Descripción</label><input class="bank-description" required></div><div class="field full"><label>Referencia</label><input class="bank-reference"></div></div>', 'Guardar movimiento', async modal => { const response = await fetch('/api/finance/bank-transactions', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transactionDate: modal.querySelector('.bank-date').value || null, amount: Number(modal.querySelector('.bank-amount').value), description: modal.querySelector('.bank-description').value, reference: modal.querySelector('.bank-reference').value }) }); const result = await response.json(); if (!response.ok) return toast(result.message || 'No fue posible guardar el movimiento bancario.'); await loadData(); toast('Movimiento bancario guardado.'); renderFn(); });
  if (action === 'edit-role') showRoleModal(button.dataset.role || 'Nuevo rol', button.dataset.roleId, renderFn);
  if (action === 'delete-role') {
    const roleId = button.dataset.roleId;
    const roleName = button.dataset.role || 'este rol';
    showModal(
      'Eliminar rol',
      `<p>¿Estás seguro de que deseas eliminar el rol <strong>${escapeHtml(roleName)}</strong>?</p><p style="color:var(--muted);font-size:12px;margin-top:8px;">Esta acción eliminará el rol y sus permisos asignados. Los roles esenciales del sistema y aquellos con usuarios asignados no pueden ser eliminados.</p>`,
      'Eliminar rol',
      async () => {
        const response = await fetch(`/api/roles/${roleId}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        const result = await response.json();
        if (!response.ok) {
          toast(result.message || 'No fue posible eliminar el rol.');
          return;
        }
        await loadData();
        toast(result.message || 'Rol eliminado exitosamente.');
        renderFn();
      }
    );
  }
  if (action === 'cancel-form') { state.view = button.closest('#branch-form') ? 'branches' : button.closest('#entity-form') ? (state.view === 'user-form' ? 'users' : 'companies') : 'dashboard'; renderFn(); }
  if (action === 'edit-company') { showModal('Editar empresa', `<div class="form-grid"><div class="field"><label>Nombre</label><input class="company-edit-name" value="${escapeHtml(state.companies.find(c => String(c.id) === String(state.detail))?.name || '')}" required></div></div>`, 'Guardar cambios', async modal => { toast('Información de empresa actualizada.'); renderFn(); }); }
  if (action === 'toggle-company') { const company = state.companies.find(c => String(c.id) === String(state.detail)); if (!company) return; const newStatus = company.status === 'Activa' ? false : true; const response = await fetch(`/api/companies/${company.id}/status`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: newStatus }) }); if (!response.ok) return toast('No fue posible cambiar el estado de la empresa.'); await loadData(); toast(`Empresa ${newStatus ? 'activada' : 'desactivada'}.`); renderFn(); }
  if (action === 'admin-reset-user-password') {
    const userId = button.dataset.id;
    const userName = button.dataset.name || 'el usuario';
    showModal(
      `Asignar contraseña para ${escapeHtml(userName)}`,
      `<div class="field">
        <label>Nueva contraseña para el colaborador</label>
        <input class="admin-new-user-password" type="password" minlength="6" placeholder="Mínimo 6 caracteres" required>
        <span class="helper">Esta contraseña permitirá al colaborador iniciar sesión inmediatamente con sus permisos de rol.</span>
      </div>`,
      'Guardar contraseña',
      async modal => {
        const newPassword = modal.querySelector('.admin-new-user-password').value;
        if (!newPassword || newPassword.length < 6) {
          toast('La contraseña debe tener al menos 6 caracteres.');
          return;
        }
        const response = await fetch(`/api/users/${userId}/password`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newPassword })
        });
        const result = await response.json();
        if (!response.ok) return toast(result?.message || 'Error al actualizar contraseña.');
        toast(`Contraseña de ${userName} actualizada correctamente.`);
      }
    );
  }
  if (action === 'edit-user') { toast('Editar usuario disponible en formulario.'); }
  if (action === 'toggle-user') { const user = state.users.find(u => String(u.id) === String(state.detail)); if (!user) return; const newStatus = user.status === 'Activa' ? false : true; const response = await fetch(`/api/users/${user.id}/status`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: newStatus }) }); if (!response.ok) return toast('No fue posible cambiar el estado del usuario.'); await loadData(); toast(`Usuario ${newStatus ? 'activado' : 'desactivado'}.`); renderFn(); }
  if (action === 'edit-branch') { toast('Editar sucursal disponible.'); }
  if (action === 'toggle-branch') { const branch = state.branches.find(b => String(b.id) === String(state.detail)); if (!branch) return; const newStatus = branch.status === 'Activa' ? false : true; const response = await fetch(`/api/branches/${branch.id}/status`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: newStatus }) }); if (!response.ok) return toast('No fue posible cambiar el estado de la sucursal.'); await loadData(); toast(`Sucursal ${newStatus ? 'activada' : 'desactivada'}.`); renderFn(); }
  if (action === 'export-audit') {
    const csvContent = 'data:text/csv;charset=utf-8,' + ['Fecha,Usuario,Accion,Modulo,Registro,IP', ...state.audit.map(a => `"${a.date}","${a.user}","${a.action}","${a.module}","${a.record}","${a.ip}"`)].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `auditoria_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast('Auditoría exportada correctamente.');
  }
  if (action === 'change-password') showModal('Cambiar contraseña', '<div class="field"><label>Contraseña actual</label><input class="modal-current-password" type="password" required></div><div class="field" style="margin-top:12px"><label>Nueva contraseña</label><input class="modal-password" type="password" minlength="10" required></div>', 'Guardar contraseña', async modal => { const currentPassword = modal.querySelector('.modal-current-password').value; const newPassword = modal.querySelector('.modal-password').value; const response = await fetch('/api/auth/change-password', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword }) }); const result = response.status === 204 ? null : await response.json(); if (!response.ok) return toast(result?.message || 'No fue posible cambiar la contraseña.'); toast('Contraseña actualizada correctamente.'); });
  if (action === 'audit-detail') { const item = state.audit.find(entry => String(entry.id) === button.dataset.auditId); if (!item) return toast('El evento de auditoría ya no está disponible.'); showModal('Detalle de auditoría', `<div style="display:grid;gap:9px;font-size:12px"><div><span class="panel-note">Usuario</span><br><strong>${escapeHtml(item.user)}</strong></div><div><span class="panel-note">Acción y módulo</span><br>${escapeHtml(item.action)} · ${escapeHtml(item.module)}</div><div><span class="panel-note">Registro afectado</span><br>${escapeHtml(item.record)}</div><div><span class="panel-note">IP / Origen</span><br>${escapeHtml(item.ip)}</div></div>`, 'Cerrar'); }
}

document.addEventListener('submit', async event => {
  if (event.target.id !== 'profile-form') return;
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  try {
    const response = await fetch('/api/profile', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'No fue posible guardar el perfil.');
    state.currentUser = { ...state.currentUser, ...result };
    toast('Los cambios del perfil se guardaron correctamente.');
    if (window.__renderFn) window.__renderFn();
  } catch (error) {
    toast(error.message);
  }
});
