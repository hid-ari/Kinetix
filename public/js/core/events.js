import { state } from './state.js';
import { loadData, runGlobalSearch, saveEntityForm, saveBranchForm, loadBranchManagers, loadBranchUsers } from './api.js';
import { toast, escapeHtml } from '../components/utils.js';
import { showModal, showRoleModal } from '../components/ui.js';
import { bindHr } from '../views/hr/hr.events.js';
import { getAdminHome } from './modules.js';
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
  switch (view) {
    case 'hr-dashboard':
      await loadHrDashboard();
      break;
    case 'hr-employees':
      await Promise.all([loadHrEmployees(), loadHrDepartments()]);
      break;
    case 'hr-employee-form':
      if (!state.hr.editMode && state.hr.currentEmployee?.Id) state.hr.currentEmployee = null;
      await Promise.all([loadHrDepartments(), loadHrPositions(), loadHrCatalogs(), loadHrEmployees()]);
      break;
    case 'hr-departments':
      await Promise.all([loadHrDepartments(), loadHrEmployees()]);
      break;
    case 'hr-positions':
      await Promise.all([loadHrDepartments(), loadHrPositions()]);
      break;
    case 'hr-orgchart':
      await loadHrOrgChart();
      break;
    case 'hr-attendance':
      await Promise.all([loadTodayAttendance(), loadHrShifts(), loadAttendanceList()]);
      break;
    case 'hr-vacations': {
      const now = new Date();
      await Promise.all([
        loadVacationBalance(),
        loadVacationRequests(),
        loadLeaveTypes(),
        loadLeaveRequests(),
        loadVacationCalendar(now.getMonth() + 1, now.getFullYear())
      ]);
      break;
    }
    case 'hr-approvals':
      await Promise.all([loadPendingApprovals(), loadMyApprovalRequests()]);
      break;
  }
}

export function bind(renderFn) {
  // Navegación principal y submódulos
  document.querySelectorAll('[data-nav]').forEach(button => {
    button.addEventListener('click', async () => {
      let targetView = button.dataset.nav;
      if (targetView === 'admin') {
        targetView = getAdminHome();
      }
      state.view = targetView;
      state.query = '';
      state.detail = null;

      if (state.view === 'hr-employee-form') {
        state.hr.editMode = false;
        state.hr.currentEmployee = null;
      }
      if (state.view === 'user-form') {
        try { await loadHrEmployees(); } catch (_) {}
      }
      if (state.view.startsWith('hr-')) {
        try {
          await loadHrViewData(state.view);
        } catch (err) {
          toast(err.message);
        }
      }
      renderFn();
    });
  });

  // Vistas de detalle
  document.querySelectorAll('[data-detail]').forEach(button => {
    button.addEventListener('click', async () => {
      state.detail = button.dataset.detail === 'user' ? button.dataset.id : Number(button.dataset.id);
      state.view = `${button.dataset.detail}-detail`;
      state.tab = 'Información';
      if (button.dataset.detail === 'branch') {
        await loadBranchUsers(state.detail);
      }
      renderFn();
    });
  });

  // Filtros de sucursal
  document.querySelectorAll('[data-branch-filter]').forEach(select => {
    select.addEventListener('change', event => {
      if (event.target.dataset.branchFilter === 'status') state.branchStatusFilter = event.target.value;
      renderFn();
    });
  });

  // Pestañas y paginación
  document.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', () => { state.tab = btn.dataset.tab; renderFn(); }));
  document.querySelectorAll('[data-users-page]').forEach(btn => btn.addEventListener('click', async () => {
    state.usersPage = Number(btn.dataset.usersPage);
    try { await loadData(); renderFn(); } catch (err) { toast(err.message); }
  }));

  // Búsqueda global
  const search = document.querySelector('#global-search');
  if (search) {
    search.addEventListener('input', event => { state.query = event.target.value; });
    search.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); runGlobalSearch(renderFn); } });
  }

  // Filtros de auditoría y usuarios
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

  // Filtros operativos
  document.querySelectorAll('[data-movement-type]').forEach(btn => btn.addEventListener('click', () => { state.movementType = btn.dataset.movementType; renderFn(); }));
  document.querySelectorAll('[data-alert-filter]').forEach(btn => btn.addEventListener('click', () => { state.alertSeverityFilter = btn.dataset.alertFilter; renderFn(); }));

  // Formulario de movimientos de inventario
  const movementForm = document.querySelector('#movement-form');
  if (movementForm) {
    movementForm.addEventListener('submit', async event => {
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
  }

  // Búsqueda interna de página
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

  // Acciones generales
  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => handleAction(btn.dataset.action, btn, renderFn));
  });

  // Acceso rápido en login
  document.querySelectorAll('[data-quick-email]').forEach(chip => {
    chip.addEventListener('click', () => {
      const emailInput = document.querySelector('#login-email-input');
      const passInput = document.querySelector('#login-password-input');
      if (emailInput) emailInput.value = chip.dataset.quickEmail || '';
      if (passInput) passInput.value = chip.dataset.quickPass || '';
      toast(`Credenciales de ${chip.querySelector('strong')?.textContent || 'usuario'} cargadas.`);
    });
  });

  // Formularios de autenticación
  bindAuthForms(renderFn);

  // Formularios administrativos
  const entityForm = document.querySelector('#entity-form');
  if (entityForm) {
    const linkEmpSelect = entityForm.querySelector('#user-link-employee-select');
    if (linkEmpSelect) {
      linkEmpSelect.addEventListener('change', () => {
        const empId = linkEmpSelect.value;
        if (!empId) return;
        const emp = (state.hr?.employees || []).find(e => String(e.Id) === String(empId));
        if (!emp) return;

        const firstNameInput = entityForm.querySelector('input[name="firstName"]');
        const lastNameInput = entityForm.querySelector('input[name="lastName"]');
        const emailInput = entityForm.querySelector('input[name="email"]');
        const phoneInput = entityForm.querySelector('input[name="phone"]');
        const branchSelect = entityForm.querySelector('select[name="branch"]');

        if (firstNameInput && !firstNameInput.value.trim()) firstNameInput.value = emp.FirstName || '';
        if (lastNameInput && !lastNameInput.value.trim()) lastNameInput.value = emp.LastName || '';
        if (emailInput && !emailInput.value.trim()) emailInput.value = emp.Email || emp.WorkEmail || '';
        if (phoneInput && !phoneInput.value.trim()) phoneInput.value = emp.Phone || '';
        if (branchSelect && !branchSelect.value && emp.BranchName) {
          branchSelect.value = emp.BranchName;
        }
        toast(`Datos de ${emp.FirstName || ''} ${emp.LastName || ''} cargados en el formulario.`);
      });
    }

    entityForm.addEventListener('submit', async event => {
    event.preventDefault();
    const wasNewUser = state.view === 'user-form' && state.userEditId == null;
    try {
      const outcome = await saveEntityForm(entityForm, renderFn);
      try { await loadHrEmployees(); } catch (_) {}

      if (wasNewUser && outcome?.result) {
        const createdUser = outcome.result;
        const formData = outcome.data || {};

        if (createdUser.employeeId || formData.employeeId) {
          toast('Usuario creado y vinculado exitosamente a su expediente de RRHH.');
          renderFn();
          return;
        }

        const fullName = `${formData.firstName || ''} ${formData.lastName || ''}`.trim() || createdUser.name || 'Usuario';
        const firstName = formData.firstName || createdUser.firstName || fullName.split(' ')[0] || '';
        const lastName = formData.lastName || createdUser.lastName || fullName.split(' ').slice(1).join(' ') || '';
        const branchObj = state.branches.find(b => b.name === formData.branch || b.id === createdUser.branchId);

        showModal(
          'Usuario creado exitosamente',
          `
            <div style="text-align:left;">
              <p style="margin-bottom:12px; font-size:14px; color:var(--navy);">
                La cuenta de acceso para <strong>${escapeHtml(fullName)}</strong> ha sido creada sin un expediente vinculado.
              </p>
              <div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:8px; padding:12px 14px; margin-bottom:14px; font-size:13px; color:#0369a1; line-height:1.5;">
                <strong>Siguiente paso sugerido:</strong> Puedes completar ahora su expediente laboral en Recursos Humanos (cédula, cargo, contrato y salario) o vincularlo más adelante desde su ficha de usuario.
              </div>
            </div>
          `,
          'Crear expediente en RRHH',
          async () => {
            state.hr.currentEmployee = {
              FirstName: firstName,
              LastName: lastName,
              Email: formData.email || createdUser.email || '',
              WorkEmail: formData.email || createdUser.email || '',
              Phone: formData.phone || createdUser.phone || '',
              UserId: createdUser.id || createdUser.UserId,
              BranchId: branchObj?.id || createdUser.branchId || null
            };
            state.hr.editMode = false;
            state.view = 'hr-employee-form';
            try {
              await loadHrViewData('hr-employee-form');
            } catch (err) {
              toast(err.message);
            }
            renderFn();
          }
        );
      }
    } catch (error) {
      toast(error.message);
    }
  });
  }

  const branchFormElement = document.querySelector('#branch-form');
  if (branchFormElement) {
    branchFormElement.addEventListener('submit', async event => {
      event.preventDefault();
      try { await saveBranchForm(branchFormElement, renderFn); } catch (error) { toast(error.message); }
    });
    const companySelect = branchFormElement.querySelector('select[name="companyId"]');
    const managerSelect = branchFormElement.querySelector('select[name="managerUserId"]');
    if (companySelect && managerSelect) {
      companySelect.addEventListener('change', async () => {
        await loadBranchManagers(companySelect.value);
        managerSelect.innerHTML = '<option value="">Sin encargado</option>' + state.branchManagers
          .map(u => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.name)}</option>`).join('');
      });
    }
  }

  const profileForm = document.querySelector('#profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', async event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(profileForm));
      try {
        const response = await fetch('/api/profile', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'No fue posible guardar el perfil.');
        state.currentUser = { ...state.currentUser, ...result };
        toast('Los cambios del perfil se guardaron correctamente.');
        renderFn();
      } catch (error) {
        toast(error.message);
      }
    });
  }

  bindHr(renderFn);
}

function bindAuthForms(renderFn) {
  const loginForm = document.querySelector('#login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async event => {
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
      } catch (error) {
        toast(error.message);
      }
    });
  }

  const resetForm = document.querySelector('#reset-password-form');
  if (resetForm) {
    resetForm.addEventListener('submit', async event => {
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
      } catch (error) {
        toast(error.message);
      }
    });
  }
}

// ── Controladores de acción (Clean Code / Single Responsibility) ────────────────────

export async function handleAction(action, button, renderFn) {
  switch (action) {
    case 'logout':
      try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch (_) {}
      state.loggedIn = false;
      state.currentUser = null;
      toast('Sesión cerrada correctamente.');
      renderFn();
      break;

    case 'back-to-login':
      state.resetEmail = null;
      state.resetToken = null;
      renderFn();
      break;

    case 'toggle-sidebar':
      state.sidebarCollapsed = !state.sidebarCollapsed;
      renderFn();
      break;

    case 'reponer-product':
      state.movementType = 'Entrada';
      state.view = 'movements';
      toast('Redirigiendo a registro de entrada de inventario.');
      renderFn();
      break;

    // Navegación a formularios
    case 'new-user':
      state.userEditId = null;
      state.view = 'user-form';
      try { await loadHrEmployees(); } catch (_) {}
      renderFn();
      break;

    case 'edit-user':
      state.userEditId = button.dataset.id;
      state.view = 'user-form';
      try { await loadHrEmployees(); } catch (_) {}
      renderFn();
      break;

    case 'link-existing-employee-to-user': {
      const userId = button.dataset.userId;
      const user = state.users.find(u => String(u.id) === String(userId));
      try { await loadHrEmployees(); } catch (_) {}
      const unlinkedEmployees = (state.hr?.employees || []).filter(e => !e.UserId);

      if (unlinkedEmployees.length === 0) {
        toast('No hay expedientes sin usuario disponibles en RRHH. Crea un nuevo expediente.');
        break;
      }

      const optionsHtml = unlinkedEmployees.map(emp => {
        const fullName = emp.FullName || `${emp.FirstName || ''} ${emp.LastName || ''}`.trim();
        return `<option value="${emp.Id}">${escapeHtml(emp.EmployeeCode)} · ${escapeHtml(fullName)}${emp.PositionName ? ` (${escapeHtml(emp.PositionName)})` : ''}</option>`;
      }).join('');

      showModal(
        'Vincular expediente existente',
        `
          <div class="form-grid">
            <div class="field full">
              <label>Usuario seleccionado</label>
              <input disabled value="${escapeHtml(user ? `${user.name} (${user.email})` : userId)}">
            </div>
            <div class="field full">
              <label>Expediente de Empleado (RRHH) *</label>
              <select id="modal-link-emp-id" required>
                <option value="">Seleccione un expediente disponible...</option>
                ${optionsHtml}
              </select>
              <span class="helper">Solo se muestran los empleados registrados en RRHH que aún no tienen usuario asignado.</span>
            </div>
          </div>
        `,
        'Vincular expediente',
        async modal => {
          const empId = modal.querySelector('#modal-link-emp-id')?.value;
          if (!empId) throw new Error('Debe seleccionar un expediente para vincular.');
          const res = await fetch(`/api/hr/employees/${empId}/link-user`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || 'No fue posible vincular el expediente.');
          await Promise.all([loadData(), loadHrEmployees()]);
          toast('Expediente vinculado correctamente al usuario.');
          renderFn();
        }
      );
      break;
    }

    case 'create-employee-for-user': {
      const userId = button.dataset.userId;
      const user = state.users.find(u => String(u.id) === String(userId));
      const branchObj = user ? state.branches.find(b => b.name === user.branch || b.id === user.branchId) : null;
      const names = (user?.name || '').trim().split(/\s+/);
      const firstName = user?.firstName || names[0] || '';
      const lastName = user?.lastName || names.slice(1).join(' ') || '';

      state.hr.currentEmployee = {
        FirstName: firstName,
        LastName: lastName,
        Email: user?.email || '',
        WorkEmail: user?.email || '',
        Phone: user?.phone || '',
        UserId: user?.id || userId,
        BranchId: branchObj?.id || user?.branchId || null
      };
      state.hr.editMode = false;
      state.view = 'hr-employee-form';
      try {
        await loadHrViewData('hr-employee-form');
      } catch (err) {
        toast(err.message);
      }
      renderFn();
      break;
    }

    case 'new-branch':
      state.branchEditId = null;
      await loadBranchManagers(state.companies[0]?.id);
      state.view = 'branch-form';
      renderFn();
      break;

    case 'cancel-form':
      handleCancelForm(button, renderFn);
      break;

    // Productos
    case 'new-product':
      handleNewProductModal(renderFn);
      break;

    case 'edit-product':
      handleEditProductModal(button, renderFn);
      break;

    case 'toggle-product':
      handleToggleProductModal(button, renderFn);
      break;

    // Finanzas
    case 'new-expense':
      handleNewExpenseModal(renderFn);
      break;

    case 'new-contact':
      handleNewContactModal(renderFn);
      break;

    case 'new-invoice':
      handleNewInvoiceModal(renderFn);
      break;

    case 'new-payment':
      handleNewPaymentModal(button, renderFn);
      break;

    case 'new-bank':
      handleNewBankModal(renderFn);
      break;

    case 'finance-status':
      handleFinanceStatusChange(button, renderFn);
      break;

    // Roles
    case 'new-role':
      showRoleModal('Nuevo rol', null, renderFn);
      break;

    case 'edit-role':
      showRoleModal(button.dataset.role || 'Nuevo rol', button.dataset.roleId, renderFn);
      break;

    case 'delete-role':
      handleDeleteRoleModal(button, renderFn);
      break;

    // Sucursales
    case 'edit-branch':
      handleEditBranch(renderFn);
      break;

    case 'toggle-branch':
      await handleToggleStatus(`/api/branches/${state.detail}/status`, 'Sucursal', state.branches.find(b => String(b.id) === String(state.detail))?.status, renderFn);
      break;

    case 'toggle-user':
      await handleToggleStatus(`/api/users/${state.detail}/status`, 'Usuario', state.users.find(u => String(u.id) === String(state.detail))?.status, renderFn);
      break;

    case 'delete-user':
      handleDeleteUserModal(button, renderFn);
      break;

    case 'admin-reset-user-password':
      handleResetUserPasswordModal(button);
      break;

    case 'edit-company':
      handleEditCompanyModal(renderFn);
      break;

    case 'clear-audit-filters':
      state.auditSearch = '';
      state.auditModule = '';
      state.auditAction = '';
      try { await loadData(); renderFn(); } catch (err) { toast(err.message); }
      break;

    case 'refresh-audit':
      try { await loadData(); renderFn(); } catch (err) { toast(err.message); }
      break;

    case 'export-audit':
      exportAuditCsv();
      break;

    case 'audit-detail':
      showAuditDetailModal(button);
      break;

    case 'change-password':
      handleChangePasswordModal();
      break;
  }
}

// ── Modales y Helpers Desacoplados ─────────────────────────────────────────────────

function handleEditCompanyModal(renderFn) {
  const company = state.companies[0];
  if (!company) return toast('No hay datos de empresa disponibles.');

  const body = `
    <div class="form-grid">
      <div class="field full">
        <label>Razón social / Nombre comercial *</label>
        <input class="company-name" value="${escapeHtml(company.name || '')}" required placeholder="Ej. Corporación Dominicana S.R.L.">
      </div>
      <div class="field">
        <label>RNC / Cédula fiscal *</label>
        <input class="company-rnc" value="${escapeHtml(company.rnc || '')}" required placeholder="9 u 11 dígitos">
      </div>
      <div class="field">
        <label>Correo corporativo *</label>
        <input class="company-email" type="email" value="${escapeHtml(company.email || '')}" required placeholder="contacto@empresa.com">
      </div>
      <div class="field">
        <label>Teléfono principal</label>
        <input class="company-phone" value="${escapeHtml(company.phone || '')}" placeholder="809-555-0000">
      </div>
      <div class="field">
        <label>Domicilio fiscal</label>
        <input class="company-address" value="${escapeHtml(company.address || '')}" placeholder="Dirección principal">
      </div>
    </div>`;

  showModal('Editar información institucional', body, 'Guardar cambios', async modal => {
    const payload = {
      name: modal.querySelector('.company-name').value.trim(),
      rnc: modal.querySelector('.company-rnc').value.trim(),
      email: modal.querySelector('.company-email').value.trim(),
      phone: modal.querySelector('.company-phone').value.trim(),
      address: modal.querySelector('.company-address').value.trim()
    };

    const response = await fetch(`/api/companies/${company.id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'No fue posible actualizar la empresa.');
    await loadData();
    toast('Información institucional actualizada correctamente.');
    renderFn();
  });
}

function handleCancelForm(button, renderFn) {
  if (button.closest('#branch-form')) {
    const wasEditing = state.branchEditId != null;
    state.branchEditId = null;
    state.view = wasEditing ? 'branch-detail' : 'branches';
  } else if (button.closest('#entity-form')) {
    const wasEditingUser = state.userEditId != null;
    state.userEditId = null;
    state.view = wasEditingUser ? 'user-detail' : 'users';
  } else {
    state.view = 'dashboard';
  }
  renderFn();
}

function handleEditBranch(renderFn) {
  const branch = state.branches.find(b => String(b.id) === String(state.detail));
  if (!branch) return toast('La sucursal ya no está disponible.');
  state.branchEditId = branch.id;
  loadBranchManagers(branch.companyId).then(() => {
    state.view = 'branch-form';
    renderFn();
  });
}

async function handleToggleStatus(endpoint, entityName, currentStatus, renderFn) {
  if (!currentStatus) return;
  const newStatus = currentStatus !== 'Activa';
  try {
    const response = await fetch(endpoint, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: newStatus })
    });
    if (!response.ok) throw new Error(`No fue posible actualizar el estado de ${entityName.toLowerCase()}.`);
    await loadData();
    toast(`${entityName} ${newStatus ? 'activada' : 'desactivada'}.`);
    renderFn();
  } catch (err) {
    toast(err.message);
  }
}

function handleNewProductModal(renderFn) {
  const body = `
    <div class="form-grid">
      <div class="field"><label>SKU</label><input class="product-sku" required placeholder="SKU-0001"></div>
      <div class="field"><label>Nombre</label><input class="product-name" required placeholder="Nombre del producto"></div>
      <div class="field"><label>Categoría</label><input class="product-category" placeholder="Categoría"></div>
      <div class="field"><label>Unidad</label><input class="product-unit" value="und." required></div>
      <div class="field"><label>Stock mínimo</label><input class="product-minimum" type="number" min="0" step="0.001" value="0" required></div>
      <div class="field"><label>Costo unitario</label><input class="product-price" type="number" min="0" step="0.0001" value="0" required></div>
    </div>`;

  showModal('Nuevo producto', body, 'Crear producto', async modal => {
    const response = await fetch('/api/inventory/products', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sku: modal.querySelector('.product-sku').value,
        name: modal.querySelector('.product-name').value,
        category: modal.querySelector('.product-category').value,
        unit: modal.querySelector('.product-unit').value,
        minimum: Number(modal.querySelector('.product-minimum').value),
        price: Number(modal.querySelector('.product-price').value)
      })
    });
    const result = await response.json();
    if (!response.ok) return toast(result.message || 'No fue posible crear el producto.');
    await loadData();
    toast('Producto creado correctamente.');
    renderFn();
  });
}

function handleEditProductModal(button, renderFn) {
  const product = state.products.find(item => String(item.id) === button.dataset.productId);
  if (!product) return toast('El producto ya no está disponible.');
  const body = `
    <div class="form-grid">
      <div class="field"><label>SKU</label><input class="product-sku" value="${escapeHtml(product.sku)}" required></div>
      <div class="field"><label>Nombre</label><input class="product-name" value="${escapeHtml(product.name)}" required></div>
      <div class="field"><label>Categoría</label><input class="product-category" value="${escapeHtml(product.category)}"></div>
      <div class="field"><label>Unidad</label><input class="product-unit" value="${escapeHtml(product.unit)}" required></div>
      <div class="field"><label>Stock mínimo</label><input class="product-minimum" type="number" min="0" step="0.001" value="${product.minimum}" required></div>
      <div class="field"><label>Costo unitario</label><input class="product-price" type="number" min="0" step="0.0001" value="${product.price}" required></div>
    </div>`;

  showModal('Editar producto', body, 'Guardar cambios', async modal => {
    const response = await fetch(`/api/inventory/products/${product.id}`, {
      method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sku: modal.querySelector('.product-sku').value,
        name: modal.querySelector('.product-name').value,
        category: modal.querySelector('.product-category').value,
        unit: modal.querySelector('.product-unit').value,
        minimum: Number(modal.querySelector('.product-minimum').value),
        price: Number(modal.querySelector('.product-price').value)
      })
    });
    const result = await response.json();
    if (!response.ok) return toast(result.message || 'No fue posible actualizar el producto.');
    await loadData();
    toast('Producto actualizado correctamente.');
    renderFn();
  });
}

function handleToggleProductModal(button, renderFn) {
  const product = state.products.find(item => String(item.id) === button.dataset.productId);
  if (!product) return toast('El producto ya no está disponible.');
  showModal('Desactivar producto', 'El producto dejará de aparecer en el catálogo operativo, pero conservará su historial.', 'Desactivar', async () => {
    const response = await fetch(`/api/inventory/products/${product.id}/status`, {
      method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false })
    });
    if (!response.ok) return toast('No fue posible desactivar el producto.');
    await loadData();
    toast('Producto desactivado.');
    renderFn();
  });
}

function handleNewExpenseModal(renderFn) {
  const body = `
    <div class="form-grid">
      <div class="field"><label>Categoría</label><input class="finance-category" required placeholder="Ej. Servicios"></div>
      <div class="field"><label>Monto</label><input class="finance-amount" type="number" min="0.01" step="0.01" required placeholder="0.00"></div>
      <div class="field full"><label>Descripción</label><textarea class="finance-description" placeholder="Detalle del gasto"></textarea></div>
    </div>`;

  showModal('Registrar gasto', body, 'Guardar gasto', async modal => {
    const response = await fetch('/api/finance/transactions', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'Gasto',
        category: modal.querySelector('.finance-category').value,
        amount: Number(modal.querySelector('.finance-amount').value),
        description: modal.querySelector('.finance-description').value
      })
    });
    const result = await response.json();
    if (!response.ok) return toast(result.message || 'No fue posible registrar el gasto.');
    await loadData();
    toast('Gasto registrado correctamente.');
    renderFn();
  });
}

function handleNewContactModal(renderFn) {
  const body = `
    <div class="form-grid">
      <div class="field"><label>Tipo</label><select class="finance-contact-type"><option>Cliente</option><option>Proveedor</option></select></div>
      <div class="field"><label>Nombre</label><input class="finance-contact-name" required placeholder="Nombre comercial"></div>
      <div class="field"><label>Identificación fiscal</label><input class="finance-contact-tax-id" placeholder="RNC / RFC / NIT"></div>
      <div class="field"><label>Email</label><input class="finance-contact-email" type="email"></div>
      <div class="field"><label>Teléfono</label><input class="finance-contact-phone"></div>
    </div>`;

  showModal('Nuevo cliente o proveedor', body, 'Guardar contacto', async modal => {
    const response = await fetch('/api/finance/contacts', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: modal.querySelector('.finance-contact-type').value,
        name: modal.querySelector('.finance-contact-name').value,
        taxId: modal.querySelector('.finance-contact-tax-id').value,
        email: modal.querySelector('.finance-contact-email').value,
        phone: modal.querySelector('.finance-contact-phone').value
      })
    });
    const result = await response.json();
    if (!response.ok) return toast(result.message || 'No fue posible guardar el contacto.');
    await loadData();
    toast('Contacto guardado correctamente.');
    renderFn();
  });
}

function handleNewInvoiceModal(renderFn) {
  const contactOptions = state.finance.contacts.map(c => `<option value="${c.id}">${escapeHtml(c.type)} · ${escapeHtml(c.name)}</option>`).join('');
  const body = `
    <div class="form-grid">
      <div class="field"><label>Número</label><input class="invoice-number" required placeholder="F-000001"></div>
      <div class="field"><label>NCF</label><input class="invoice-ncf" maxlength="19" placeholder="B0100000001"></div>
      <div class="field"><label>Tipo</label><select class="invoice-type"><option>Venta</option><option>Compra</option></select></div>
      <div class="field"><label>Contacto</label><select class="invoice-contact"><option value="">Sin contacto</option>${contactOptions}</select></div>
      <div class="field"><label>Subtotal</label><input class="invoice-subtotal" type="number" min="0.01" step="0.01" required></div>
      <div class="field"><label>Impuesto %</label><input class="invoice-tax" type="number" min="0" step="0.01" value="0"></div>
      <div class="field"><label>Vencimiento</label><input class="invoice-due-date" type="date"></div>
    </div>`;

  showModal('Nueva factura', body, 'Crear factura', async modal => {
    const response = await fetch('/api/finance/invoices', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        number: modal.querySelector('.invoice-number').value,
        ncf: modal.querySelector('.invoice-ncf').value || null,
        type: modal.querySelector('.invoice-type').value,
        contactId: modal.querySelector('.invoice-contact').value || null,
        subtotal: Number(modal.querySelector('.invoice-subtotal').value),
        taxRate: Number(modal.querySelector('.invoice-tax').value),
        dueDate: modal.querySelector('.invoice-due-date').value || null
      })
    });
    const result = await response.json();
    if (!response.ok) return toast(result.message || 'No fue posible crear la factura.');
    await loadData();
    toast('Factura creada correctamente.');
    renderFn();
  });
}

function handleNewPaymentModal(button, renderFn) {
  const body = `
    <div class="form-grid">
      <div class="field"><label>Monto</label><input class="payment-amount" type="number" min="0.01" step="0.01" required></div>
      <div class="field"><label>Método</label><select class="payment-method"><option>Transferencia</option><option>Tarjeta</option><option>Efectivo</option><option>Cheque</option></select></div>
      <div class="field full"><label>Referencia</label><input class="payment-reference"></div>
    </div>`;

  showModal('Registrar pago', body, 'Guardar pago', async modal => {
    const response = await fetch('/api/finance/payments', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceId: button.dataset.invoiceId,
        amount: Number(modal.querySelector('.payment-amount').value),
        method: modal.querySelector('.payment-method').value,
        reference: modal.querySelector('.payment-reference').value
      })
    });
    const result = await response.json();
    if (!response.ok) return toast(result.message || 'No fue posible registrar el pago.');
    await loadData();
    toast('Pago registrado correctamente.');
    renderFn();
  });
}

function handleNewBankModal(renderFn) {
  const body = `
    <div class="form-grid">
      <div class="field"><label>Fecha</label><input class="bank-date" type="date"></div>
      <div class="field"><label>Monto</label><input class="bank-amount" type="number" step="0.01" required></div>
      <div class="field full"><label>Descripción</label><input class="bank-description" required></div>
      <div class="field full"><label>Referencia</label><input class="bank-reference"></div>
    </div>`;

  showModal('Movimiento bancario', body, 'Guardar movimiento', async modal => {
    const response = await fetch('/api/finance/bank-transactions', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transactionDate: modal.querySelector('.bank-date').value || null,
        amount: Number(modal.querySelector('.bank-amount').value),
        description: modal.querySelector('.bank-description').value,
        reference: modal.querySelector('.bank-reference').value
      })
    });
    const result = await response.json();
    if (!response.ok) return toast(result.message || 'No fue posible guardar el movimiento bancario.');
    await loadData();
    toast('Movimiento bancario guardado.');
    renderFn();
  });
}

async function handleFinanceStatusChange(button, renderFn) {
  const response = await fetch(`/api/finance/transactions/${button.dataset.financeId}/status`, {
    method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: button.dataset.financeStatus })
  });
  const result = await response.json();
  if (!response.ok) return toast(result.message || 'No fue posible actualizar la transacción.');
  await loadData();
  renderFn();
}

function handleDeleteRoleModal(button, renderFn) {
  const roleId = button.dataset.roleId;
  const roleName = button.dataset.role || 'este rol';
  showModal(
    'Eliminar rol',
    `<p>¿Estás seguro de que deseas eliminar el rol <strong>${escapeHtml(roleName)}</strong>?</p>
     <p style="color:var(--muted);font-size:12px;margin-top:8px;">Esta acción eliminará el rol y sus permisos asignados. Los roles esenciales del sistema y aquellos con usuarios asignados no pueden ser eliminados.</p>`,
    'Eliminar rol',
    async () => {
      const response = await fetch(`/api/roles/${roleId}`, { method: 'DELETE', credentials: 'include' });
      const result = await response.json();
      if (!response.ok) return toast(result.message || 'No fue posible eliminar el rol.');
      await loadData();
      toast(result.message || 'Rol eliminado exitosamente.');
      renderFn();
    }
  );
}

function handleDeleteUserModal(button, renderFn) {
  const userId = button.dataset.id || (state.view === 'user-detail' ? state.detail : null);
  const userName = button.dataset.name || 'este usuario';

  if (!userId) return toast('Usuario no especificado.');

  showModal(
    'Eliminar usuario',
    `<p>¿Estás seguro de que deseas eliminar al usuario <strong>${escapeHtml(userName)}</strong>?</p>
     <p style="color:var(--muted);font-size:12px;margin-top:8px;">
       Esta acción revocará inmediatamente sus accesos, desvinculará sus roles y cerrará todas sus sesiones activas. Si el usuario cuenta con registros históricos de auditoría u operaciones, se archivará de forma permanente preservando la trazabilidad.
     </p>`,
    'Eliminar usuario',
    async () => {
      try {
        const response = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        const result = await response.json();
        if (!response.ok) {
          return toast(result.message || 'No fue posible eliminar el usuario.');
        }

        if (state.view === 'user-detail' && String(state.detail) === String(userId)) {
          state.view = 'users';
          state.detail = null;
        }

        await loadData();
        toast(result.message || 'Usuario eliminado exitosamente.');
        renderFn();
      } catch (err) {
        toast(err.message || 'Error de conexión al eliminar el usuario.');
      }
    }
  );
}

function handleResetUserPasswordModal(button) {
  const userId = button.dataset.id;
  const userName = button.dataset.name || 'el usuario';
  showModal(
    `Asignar contraseña para ${escapeHtml(userName)}`,
    `<div class="field">
      <label>Nueva contraseña para el usuario</label>
      <input class="admin-new-user-password" type="password" minlength="8" placeholder="Mínimo 8 caracteres" required>
      <span class="helper">Esta contraseña permitirá al usuario iniciar sesión inmediatamente con sus permisos de rol.</span>
    </div>`,
    'Guardar contraseña',
    async modal => {
      const newPassword = modal.querySelector('.admin-new-user-password').value;
      if (!newPassword || newPassword.length < 8) {
        return toast('La contraseña debe tener al menos 8 caracteres.');
      }
      const response = await fetch(`/api/users/${userId}/password`, {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword })
      });
      const result = await response.json();
      if (!response.ok) return toast(result?.message || 'Error al actualizar contraseña.');
      toast(`Contraseña de ${userName} actualizada correctamente.`);
    }
  );
}

function exportAuditCsv() {
  const params = new URLSearchParams();
  if (state.auditSearch) params.set('search', state.auditSearch);
  if (state.auditModule) params.set('module', state.auditModule);
  if (state.auditAction) params.set('action', state.auditAction);
  const qs = params.toString();
  const link = document.createElement('a');
  link.href = `/api/audit/export${qs ? `?${qs}` : ''}`;
  link.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  toast('Exportación de auditoría iniciada.');
}

function showAuditDetailModal(button) {
  const item = state.audit.find(entry => String(entry.id) === button.dataset.auditId);
  if (!item) return toast('El evento de auditoría ya no está disponible.');
  showModal('Detalle de auditoría', `
    <div style="display:grid;gap:9px;font-size:12px">
      <div><span class="panel-note">Usuario</span><br><strong>${escapeHtml(item.user)}</strong></div>
      <div><span class="panel-note">Acción y módulo</span><br>${escapeHtml(item.action)} · ${escapeHtml(item.module)}</div>
      <div><span class="panel-note">Registro afectado</span><br>${escapeHtml(item.record)}</div>
      <div><span class="panel-note">IP / Origen</span><br>${escapeHtml(item.ip)}</div>
    </div>`, 'Cerrar');
}

function handleChangePasswordModal() {
  const body = `
    <div class="field"><label>Contraseña actual</label><input class="modal-current-password" type="password" required></div>
    <div class="field" style="margin-top:12px"><label>Nueva contraseña</label><input class="modal-password" type="password" minlength="10" required></div>`;

  showModal('Cambiar contraseña', body, 'Guardar contraseña', async modal => {
    const currentPassword = modal.querySelector('.modal-current-password').value;
    const newPassword = modal.querySelector('.modal-password').value;
    const response = await fetch('/api/auth/change-password', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const result = response.status === 204 ? null : await response.json();
    if (!response.ok) return toast(result?.message || 'No fue posible cambiar la contraseña.');
    toast('Contraseña actualizada correctamente.');
  });
}

