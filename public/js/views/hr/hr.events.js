import { state } from '../../core/state.js';
import { loadData } from '../../core/api.js';
import { toast, escapeHtml } from '../../components/utils.js';
import { showModal } from '../../components/ui.js';
import {
  loadHrEmployees,
  loadHrEmployeeDetail,
  loadHrDepartments,
  loadHrPositions,
  loadHrCatalogs,
  loadHrDashboard,
  loadHrOrgChart,
  saveEmployee,
  updateEmployee,
  submitLaborMovement,
  uploadEmployeeDocument,
  uploadEmployeePhoto,
  uploadDocumentVersion,
  deleteEmployeeDocument,
  saveDepartment,
  deleteDepartment,
  savePosition,
  deletePosition,
  // Fase 2
  loadTodayAttendance,
  loadHrShifts,
  saveWorkShift,
  recordCheckIn,
  recordCheckOut,
  loadAttendanceList,
  requestAttendanceCorrection,
  loadVacationBalance,
  loadVacationRequests,
  createVacationRequest,
  loadLeaveTypes,
  loadLeaveRequests,
  createLeaveRequest,
  loadPendingApprovals,
  loadMyApprovalRequests,
  loadApprovalDetail,
  processApprovalAction,
  loadHrNotifications,
  markHrNotificationRead,
  markAllHrNotificationsRead,
  loadUnreadNotificationsCount
} from './hr.api.js';

export function bindHr(renderFn) {
  // Tabs in employee detail
  document.querySelectorAll('[data-hr-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.hr.employeeTab = btn.dataset.hrTab;
      renderFn();
    });
  });

  // Navigate to employee detail
  document.querySelectorAll('[data-hr-detail="employee"]').forEach(el => {
    el.addEventListener('click', async () => {
      const id = el.dataset.id;
      try {
        await loadHrEmployeeDetail(id);
        state.view = 'hr-employee-detail';
        state.hr.employeeTab = 'resumen';
        renderFn();
      } catch (err) {
        toast(err.message);
      }
    });
  });

  // Employee pagination
  document.querySelectorAll('[data-hr-page]').forEach(btn => {
    btn.addEventListener('click', async () => {
      state.hr.employeesPage = Number(btn.dataset.hrPage);
      try {
        await loadHrEmployees();
        renderFn();
      } catch (err) {
        toast(err.message);
      }
    });
  });

  // Filter dropdowns
  document.querySelectorAll('[data-hr-filter]').forEach(select => {
    select.addEventListener('change', async event => {
      const filterType = event.target.dataset.hrFilter;
      const val = event.target.value;
      if (filterType === 'status') state.hr.employeesStatusFilter = val;
      if (filterType === 'department') state.hr.employeesDeptFilter = val;
      if (filterType === 'branch') state.hr.employeesBranchFilter = val;
      state.hr.employeesPage = 1;
      try {
        await loadHrEmployees();
        renderFn();
      } catch (err) {
        toast(err.message);
      }
    });
  });

  // Search input
  const searchInput = document.querySelector('#hr-search');
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      state.hr.employeesSearch = e.target.value;
    });
    searchInput.addEventListener('keydown', async e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        state.hr.employeesPage = 1;
        try {
          await loadHrEmployees();
          renderFn();
        } catch (err) {
          toast(err.message);
        }
      }
    });
  }

  // Employee form: Dynamic document type switching and cedula auto-dash formatting
  const docTypeSelect = document.querySelector('#emp-doc-type');
  const docNumInput = document.querySelector('#emp-doc-num');
  const docHelper = document.querySelector('#emp-doc-helper');

  if (docTypeSelect && docNumInput) {
    const handleDocFormatting = () => {
      const type = docTypeSelect.value;
      if (type === 'Cedula') {
        docNumInput.placeholder = '402-0000001-2';
        docNumInput.maxLength = 13;
        docNumInput.setAttribute('inputmode', 'numeric');

        let raw = docNumInput.value.replace(/\D/g, '');
        if (raw.length > 11) raw = raw.slice(0, 11);

        let formatted = raw;
        if (raw.length > 3 && raw.length <= 10) {
          formatted = `${raw.slice(0, 3)}-${raw.slice(3)}`;
        } else if (raw.length > 10) {
          formatted = `${raw.slice(0, 3)}-${raw.slice(3, 10)}-${raw.slice(10)}`;
        }

        if (docNumInput.value !== formatted) {
          docNumInput.value = formatted;
        }

        if (docHelper) {
          if (raw.length === 0) {
            docHelper.innerHTML = '<span style="color:var(--muted);">Formato automático: 000-0000000-0 (11 dígitos).</span>';
            docNumInput.setCustomValidity('');
          } else if (raw.length < 11) {
            docHelper.innerHTML = `<span style="color:var(--muted);">Faltan ${11 - raw.length} dígito(s) para completar los 11 dígitos requeridos.</span>`;
            docNumInput.setCustomValidity('La cédula debe contener 11 dígitos.');
          } else {
            const weights = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2];
            let sum = 0;
            for (let i = 0; i < 10; i++) {
              let product = parseInt(raw[i], 10) * weights[i];
              if (product >= 10) product = Math.floor(product / 10) + (product % 10);
              sum += product;
            }
            const expectedVerifier = (10 - (sum % 10)) % 10;
            const actualVerifier = parseInt(raw[10], 10);

            if (raw === '00000000000') {
              docHelper.innerHTML = '<span style="color:#ef4444; font-weight:600;">La cédula no puede estar compuesta solo de ceros.</span>';
              docNumInput.setCustomValidity('Cédula no válida');
            } else if (expectedVerifier === actualVerifier) {
              docHelper.innerHTML = '<span style="color:#16a34a; font-weight:600;">Cédula válida (dígito verificador correcto).</span>';
              docNumInput.setCustomValidity('');
            } else {
              docHelper.innerHTML = `<span style="color:#ef4444; font-weight:600;">Dígito verificador incorrecto. El dígito esperado para esta serie es <strong>${expectedVerifier}</strong> (${formatted.slice(0, 12)}${expectedVerifier}).</span>`;
              docNumInput.setCustomValidity('Dígito verificador incorrecto');
            }
          }
        }
      } else if (type === 'Pasaporte') {
        docNumInput.placeholder = 'Ej. RD1234567 (5 a 20 caracteres)';
        docNumInput.maxLength = 20;
        docNumInput.removeAttribute('inputmode');

        const val = docNumInput.value.trim();
        if (docHelper) {
          if (!val) {
            docHelper.innerHTML = '<span style="color:var(--muted);">Pasaporte oficial (entre 5 y 20 caracteres alfanuméricos).</span>';
            docNumInput.setCustomValidity('');
          } else if (val.length < 5 || val.length > 20) {
            docHelper.innerHTML = '<span style="color:#ef4444; font-weight:600;">El pasaporte debe tener entre 5 y 20 caracteres.</span>';
            docNumInput.setCustomValidity('Longitud inválida');
          } else {
            docHelper.innerHTML = '<span style="color:#16a34a; font-weight:600;">Formato de pasaporte válido.</span>';
            docNumInput.setCustomValidity('');
          }
        }
      } else {
        docNumInput.placeholder = 'Número de documento (3 a 30 caracteres)';
        docNumInput.maxLength = 30;
        docNumInput.removeAttribute('inputmode');
        docNumInput.setCustomValidity('');
        if (docHelper) {
          docHelper.innerHTML = '<span style="color:var(--muted);">Documento oficial de identidad (entre 3 y 30 caracteres).</span>';
        }
      }
    };

    docTypeSelect.addEventListener('change', () => {
      docNumInput.setCustomValidity('');
      handleDocFormatting();
    });

    docNumInput.addEventListener('input', handleDocFormatting);

    // Initial evaluation on form render
    handleDocFormatting();
  }

  // Employee form submit & unified access toggles
  const empForm = document.querySelector('#hr-employee-form');
  if (empForm) {
    const accessFields = empForm.querySelector('#emp-access-fields');
    const accessModeSelect = empForm.querySelector('#emp-access-mode');
    const passwordField = empForm.querySelector('#emp-password-field');
    const existingUserField = empForm.querySelector('#emp-existing-user-field');
    const existingUserSelect = empForm.querySelector('#emp-existing-user-select');
    const userRoleSelect = empForm.querySelector('#emp-user-role');

    if (accessModeSelect) {
      accessModeSelect.addEventListener('change', () => {
        const mode = accessModeSelect.value;
        if (accessFields) accessFields.style.display = (mode !== 'none') ? 'block' : 'none';
        if (passwordField) passwordField.style.display = (mode === 'direct') ? 'block' : 'none';
        if (existingUserField) existingUserField.style.display = (mode === 'link_existing') ? 'block' : 'none';
      });
    }

    if (existingUserSelect) {
      existingUserSelect.addEventListener('change', () => {
        const selectedUserId = existingUserSelect.value;
        if (!selectedUserId) return;
        const u = (state.users || []).find(user => String(user.id) === String(selectedUserId));
        if (!u) return;

        const firstNameInput = empForm.querySelector('input[name="firstName"]');
        const lastNameInput = empForm.querySelector('input[name="lastName"]');
        const emailInput = empForm.querySelector('input[name="email"]');
        const phoneInput = empForm.querySelector('input[name="phone"]');
        const branchSelect = empForm.querySelector('select[name="branchId"]');

        const names = (u.name || '').trim().split(/\s+/);
        const fName = u.firstName || names[0] || '';
        const lName = u.lastName || names.slice(1).join(' ') || '';

        if (firstNameInput && !firstNameInput.value.trim()) firstNameInput.value = fName;
        if (lastNameInput && !lastNameInput.value.trim()) lastNameInput.value = lName;
        if (emailInput && !emailInput.value.trim() && u.email && u.email !== 'Sin email') emailInput.value = u.email;
        if (phoneInput && !phoneInput.value.trim() && u.phone) phoneInput.value = u.phone;
        if (branchSelect && !branchSelect.value && (u.branchId || u.branch)) {
          const matchedBranch = (state.branches || []).find(b => Number(b.id) === Number(u.branchId) || b.name === u.branch);
          if (matchedBranch) branchSelect.value = String(matchedBranch.id);
        }
        if (userRoleSelect && u.role) {
          userRoleSelect.value = u.role;
        }
        toast(`Datos del usuario ${u.name} cargados en el formulario.`);
      });
    }

    empForm.addEventListener('submit', async event => {
      event.preventDefault();
      const empId = empForm.dataset.employeeId;
      const formData = new FormData(empForm);
      const data = Object.fromEntries(formData);

      // Clean empty string IDs to null
      ['branchId', 'departmentId', 'positionId', 'supervisorEmployeeId', 'contractTypeId', 'workModalityId', 'userId', 'existingUserId'].forEach(key => {
        if (!data[key]) data[key] = null;
      });

      // Unified System Access handling
      const mode = data.accessMode || 'none';
      const isAccessEnabled = mode !== 'none';
      data.createUserAccount = isAccessEnabled;

      if (isAccessEnabled) {
        if (mode === 'invite') {
          data.sendInvite = true;
          data.userPassword = null;
          data.existingUserId = null;
        } else if (mode === 'link_existing') {
          if (!data.existingUserId) {
            toast('Seleccione el usuario existente que desea vincular al expediente.');
            existingUserSelect?.focus();
            return;
          }
          data.userPassword = null;
          data.sendInvite = false;
        } else {
          data.sendInvite = false;
          data.existingUserId = null;
        }
      } else {
        data.userRole = null;
        data.userPassword = null;
        data.sendInvite = false;
        data.existingUserId = null;
        data.userId = null;
      }

      // Normalize and validate document number before submitting
      const docType = data.documentType || 'Cedula';
      if (docType === 'Cedula') {
        const cleanDigits = (data.documentNumber || '').replace(/\D/g, '');
        if (cleanDigits.length !== 11) {
          toast('La cédula dominicana debe contener 11 dígitos.');
          docNumInput?.focus();
          return;
        }
        data.documentNumber = `${cleanDigits.slice(0, 3)}-${cleanDigits.slice(3, 10)}-${cleanDigits.slice(10)}`;
      } else if (docType === 'Pasaporte') {
        data.documentNumber = (data.documentNumber || '').trim();
        if (data.documentNumber.length < 5 || data.documentNumber.length > 20) {
          toast('El pasaporte debe tener entre 5 y 20 caracteres.');
          docNumInput?.focus();
          return;
        }
      }

      try {
        if (empId) {
          await updateEmployee(empId, data);
          toast('Datos del empleado actualizados exitosamente.');
          await loadHrEmployeeDetail(empId);
          state.hr.editMode = false;
          state.view = 'hr-employee-detail';
        } else {
          // Prepare emergency contact if entered
          if (data.emergencyName && data.emergencyPhone) {
            data.emergencyContacts = [{
              fullName: data.emergencyName,
              relationship: data.emergencyRel,
              phone: data.emergencyPhone,
              isPrimary: true
            }];
          }
          const created = await saveEmployee(data);
          toast(`Empleado ${created.EmployeeCode} registrado exitosamente.`);
          await loadHrEmployeeDetail(created.Id);
          state.hr.editMode = false;
          state.view = 'hr-employee-detail';
        }
        await Promise.all([loadHrEmployees(), loadData()]);
        renderFn();
      } catch (err) {
        toast(err.message);
      }
    });
  }

  // Handle HR specific action buttons
  document.querySelectorAll('[data-action]').forEach(btn => {
    const action = btn.dataset.action;

    if (action === 'clear-hr-filters') {
      btn.addEventListener('click', async () => {
        state.hr.employeesSearch = '';
        state.hr.employeesStatusFilter = '';
        state.hr.employeesDeptFilter = '';
        state.hr.employeesBranchFilter = '';
        state.hr.employeesPage = 1;
        await loadHrEmployees();
        renderFn();
      });
    }

    if (action === 'export-hr-employees') {
      btn.addEventListener('click', () => {
        const params = new URLSearchParams();
        if (state.hr.employeesSearch) params.set('search', state.hr.employeesSearch);
        if (state.hr.employeesStatusFilter) params.set('status', state.hr.employeesStatusFilter);
        if (state.hr.employeesDeptFilter) params.set('departmentId', state.hr.employeesDeptFilter);
        if (state.hr.employeesBranchFilter) params.set('branchId', state.hr.employeesBranchFilter);
        window.location.href = `/api/hr/employees/export?${params.toString()}`;
      });
    }

    if (action === 'download-employee-pdf') {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        window.open(`/api/hr/employees/${id}/pdf`, '_blank');
      });
    }

    if (action === 'edit-employee') {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        state.hr.editMode = true;
        try {
          await Promise.all([
            loadHrEmployeeDetail(id),
            loadHrDepartments(),
            loadHrPositions(),
            loadHrCatalogs(),
            loadData()
          ]);
          state.view = 'hr-employee-form';
          renderFn();
        } catch (err) {
          toast(err.message);
        }
      });
    }

    if (action === 'open-link-user-modal') {
      btn.addEventListener('click', async () => {
        const empId = btn.dataset.id;
        const emp = state.hr.currentEmployee;
        try { await loadData(); } catch (_) {}

        const availableUsers = (state.users || []).filter(u =>
          !u.employeeId || (emp?.UserId && String(u.id) === String(emp.UserId))
        );

        const optionsHtml = availableUsers.map(u => `
          <option value="${escapeHtml(u.id)}" ${String(emp?.UserId || '') === String(u.id) ? 'selected' : ''}>
            ${escapeHtml(u.name)} (${escapeHtml(u.email)})${u.role ? ` · ${escapeHtml(u.role)}` : ''}
          </option>
        `).join('');

        showModal(
          'Vincular cuenta de usuario',
          `
            <div class="form-grid">
              <div class="field full">
                <label>Empleado</label>
                <input disabled value="${escapeHtml(emp ? `${emp.EmployeeCode} · ${emp.FirstName} ${emp.LastName}` : `#${empId}`)}">
              </div>
              <div class="field full">
                <label>Cuenta de Usuario (Administración)</label>
                <select id="modal-emp-link-user-select">
                  <option value="">— Sin usuario vinculado (solo expediente en RRHH) —</option>
                  ${optionsHtml}
                </select>
                <span class="helper">Solo se muestran usuarios que no tienen otro expediente de empleado asignado.</span>
              </div>
            </div>
          `,
          'Guardar vinculación',
          async modal => {
            const selectedUserId = modal.querySelector('#modal-emp-link-user-select')?.value || null;
            const res = await fetch(`/api/hr/employees/${empId}/link-user`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: selectedUserId })
            });
            const payload = await res.json();
            if (!res.ok) throw new Error(payload.message || 'No fue posible actualizar la vinculación.');
            await Promise.all([loadHrEmployeeDetail(empId), loadHrEmployees(), loadData()]);
            toast(selectedUserId ? 'Cuenta de usuario vinculada al expediente.' : 'Cuenta de usuario desvinculada del expediente.');
            renderFn();
          }
        );
      });
    }

    // Upload Document Modal
    if (action === 'open-upload-doc-modal') {
      btn.addEventListener('click', () => {
        const empId = btn.dataset.id;
        const catalogs = state.hr.catalogs?.DocumentType || [];
        const typeOptions = catalogs.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');

        const body = `
          <form id="upload-doc-form" style="display:grid; gap:14px;">
            <div class="field">
              <label>Archivo del Documento (PDF, Word, Excel, Imagen) *</label>
              <input type="file" name="file" required accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt">
            </div>
            <div class="field">
              <label>Tipo de Documento *</label>
              <select name="documentTypeId" required>${typeOptions}</select>
            </div>
            <div class="field">
              <label>Título del Documento *</label>
              <input name="title" required placeholder="Ej. Contrato de Trabajo Indefinido 2026">
            </div>
            <div class="field">
              <label>Descripción / Observaciones</label>
              <textarea name="description" placeholder="Notas relevantes sobre el documento"></textarea>
            </div>
            <div class="field">
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                <input type="checkbox" name="isConfidential" value="true">
                <span>Marcar como Documento Confidencial</span>
              </label>
              <small class="helper">Solo visible para directores y personal con permiso especial.</small>
            </div>
            <div class="form-grid">
              <div class="field">
                <label>Fecha de Emisión</label>
                <input type="date" name="issueDate">
              </div>
              <div class="field">
                <label>Fecha de Vencimiento</label>
                <input type="date" name="expiryDate">
              </div>
            </div>
          </form>
        `;

        showModal('Adjuntar Documento al Expediente', body, 'Cargar Documento', async modal => {
          const form = modal.querySelector('#upload-doc-form');
          const formData = new FormData(form);
          try {
            await uploadEmployeeDocument(empId, formData);
            toast('Documento adjuntado exitosamente.');
            await loadHrEmployeeDetail(empId);
            renderFn();
          } catch (err) {
            toast(err.message);
          }
        });
      });
    }

    // Upload Photo Modal
    if (action === 'open-photo-upload') {
      btn.addEventListener('click', () => {
        const empId = btn.dataset.id;
        const body = `
          <form id="upload-photo-form" style="display:grid; gap:14px;">
            <div class="field">
              <label>Selecciona una fotografía (JPEG, PNG, WebP) *</label>
              <input type="file" name="photo" required accept="image/jpeg,image/png,image/webp">
            </div>
          </form>
        `;

        showModal('Actualizar Fotografía del Empleado', body, 'Guardar Foto', async modal => {
          const form = modal.querySelector('#upload-photo-form');
          const formData = new FormData(form);
          try {
            await uploadEmployeePhoto(empId, formData);
            toast('Fotografía actualizada.');
            await loadHrEmployeeDetail(empId);
            renderFn();
          } catch (err) {
            toast(err.message);
          }
        });
      });
    }

    // Delete Document
    if (action === 'delete-document') {
      btn.addEventListener('click', () => {
        const docId = btn.dataset.docId;
        showModal('Confirmar Eliminación', '¿Estás seguro de que deseas eliminar este documento del expediente? El registro quedará archivado por trazabilidad.', 'Eliminar', async () => {
          try {
            await deleteEmployeeDocument(docId);
            toast('Documento eliminado.');
            await loadHrEmployeeDetail(state.hr.currentEmployee.Id);
            renderFn();
          } catch (err) {
            toast(err.message);
          }
        });
      });
    }

    // New Document Version Modal
    if (action === 'open-new-version-modal') {
      btn.addEventListener('click', () => {
        const docId = btn.dataset.docId;
        const currentDoc = (state.hr.currentEmployeeDocuments || []).find(d => String(d.Id) === String(docId));
        const body = `
          <form id="upload-version-form" style="display:grid; gap:14px;">
            <p class="panel-note">Subiendo nueva versión para: <strong>${escapeHtml(currentDoc?.Title || 'Documento')}</strong> (v${(currentDoc?.VersionNumber || 1) + 1})</p>
            <div class="field">
              <label>Nuevo archivo *</label>
              <input type="file" name="file" required accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt">
            </div>
            <div class="field">
              <label>Título / Notas de la versión</label>
              <input name="title" value="${escapeHtml(currentDoc?.Title || '')}" placeholder="Título de la versión">
            </div>
            <div class="field">
              <label>Descripción de los cambios</label>
              <textarea name="description" placeholder="Motivo de la actualización o cambios en la nueva versión"></textarea>
            </div>
          </form>
        `;

        showModal('Cargar Nueva Versión de Documento', body, 'Subir Versión', async modal => {
          const form = modal.querySelector('#upload-version-form');
          const formData = new FormData(form);
          try {
            await uploadDocumentVersion(docId, formData);
            toast('Nueva versión cargada exitosamente.');
            if (state.hr.currentEmployee?.Id) {
              await loadHrEmployeeDetail(state.hr.currentEmployee.Id);
            }
            renderFn();
          } catch (err) {
            toast(err.message);
          }
        });
      });
    }

    // Department Modal
    if (action === 'open-department-modal' || action === 'edit-department') {
      btn.addEventListener('click', () => {
        const isEdit = action === 'edit-department';
        const deptId = btn.dataset.id;
        const currentDept = isEdit ? state.hr.departments.find(d => String(d.Id) === String(deptId)) : null;

        const selectedDeptBranchId = currentDept?.BranchId != null
          ? currentDept.BranchId
          : (state.branches.length === 1 ? state.branches[0].id : '');

        const branchOptions = state.branches.map(b => `
          <option value="${b.id}" ${String(selectedDeptBranchId) === String(b.id) ? 'selected' : ''}>${escapeHtml(b.name)}</option>
        `).join('');

        const parentOptions = state.hr.departments
          .filter(d => !isEdit || String(d.Id) !== String(deptId))
          .map(d => `<option value="${d.Id}" ${currentDept?.ParentDepartmentId === d.Id ? 'selected' : ''}>${escapeHtml(d.Name)}</option>`)
          .join('');

        const empOptions = state.hr.employees.map(e => `
          <option value="${e.Id}" ${currentDept?.ManagerEmployeeId === e.Id ? 'selected' : ''}>${escapeHtml(e.FirstName)} ${escapeHtml(e.LastName)}</option>
        `).join('');

        const body = `
          <div class="form-grid">
            <div class="field">
              <label>Código *</label>
              <input class="dept-code" required placeholder="Ej. RRHH" value="${escapeHtml(currentDept?.Code || '')}">
            </div>
            <div class="field">
              <label>Nombre del Departamento *</label>
              <input class="dept-name" required placeholder="Ej. Recursos Humanos" value="${escapeHtml(currentDept?.Name || '')}">
            </div>
            <div class="field">
              <label>Sucursal</label>
              <select class="dept-branch">
                ${state.branches.length === 0 ? '<option value="">Sin sucursales registradas</option>' : ''}
                ${state.branches.length > 1 ? '<option value="">Seleccione una sucursal...</option>' : ''}
                ${branchOptions}
              </select>
            </div>
            <div class="field">
              <label>Departamento Superior (Padre)</label>
              <select class="dept-parent"><option value="">Nivel Superior</option>${parentOptions}</select>
            </div>
            <div class="field full">
              <label>Responsable / Gerente</label>
              <select class="dept-manager"><option value="">Sin responsable</option>${empOptions}</select>
            </div>
            <div class="field full">
              <label>Descripción</label>
              <textarea class="dept-desc" placeholder="Objetivos y alcance del departamento">${escapeHtml(currentDept?.Description || '')}</textarea>
            </div>
          </div>
        `;

        showModal(isEdit ? 'Editar Departamento' : 'Nuevo Departamento', body, isEdit ? 'Guardar Cambios' : 'Crear Departamento', async modal => {
          const payload = {
            code: modal.querySelector('.dept-code').value,
            name: modal.querySelector('.dept-name').value,
            branchId: modal.querySelector('.dept-branch').value || null,
            parentDepartmentId: modal.querySelector('.dept-parent').value || null,
            managerEmployeeId: modal.querySelector('.dept-manager').value || null,
            description: modal.querySelector('.dept-desc').value || null
          };
          try {
            await saveDepartment(payload, deptId);
            toast(isEdit ? 'Departamento actualizado.' : 'Departamento creado exitosamente.');
            await loadHrDepartments();
            renderFn();
          } catch (err) {
            toast(err.message);
          }
        });
      });
    }

    // Delete Department
    if (action === 'delete-department') {
      btn.addEventListener('click', () => {
        const deptId = btn.dataset.id;
        const deptName = btn.dataset.name || 'este departamento';
        const modalBackdrop = showModal(
          'Eliminar Departamento',
          `<p>¿Estás seguro de que deseas eliminar el departamento <strong>${escapeHtml(deptName)}</strong>?</p>
           <p style="color:var(--muted); font-size:12.5px; margin-top:8px;">Esta acción eliminará el registro permanentemente de la estructura organizativa.</p>`,
          'Eliminar',
          async () => {
            try {
              const res = await deleteDepartment(deptId);
              toast(res.message || 'Departamento eliminado exitosamente.');
              await loadHrDepartments();
              renderFn();
            } catch (err) {
              toast(err.message);
            }
          }
        );
        const confirmBtn = modalBackdrop.querySelector('.modal-confirm');
        if (confirmBtn) {
          confirmBtn.classList.remove('primary');
          confirmBtn.classList.add('danger');
          confirmBtn.style.background = 'var(--danger, #ef4444)';
          confirmBtn.style.borderColor = 'var(--danger, #ef4444)';
          confirmBtn.style.color = '#fff';
        }
      });
    }

    // Position Modal
    if (action === 'open-position-modal' || action === 'edit-position') {
      btn.addEventListener('click', () => {
        const isEdit = action === 'edit-position';
        const posId = btn.dataset.id;
        const currentPos = isEdit ? state.hr.positions.find(p => String(p.Id) === String(posId)) : null;

        const deptOptions = state.hr.departments.map(d => `
          <option value="${d.Id}" ${currentPos?.DepartmentId === d.Id ? 'selected' : ''}>${escapeHtml(d.Name)}</option>
        `).join('');

        const body = `
          <div class="form-grid">
            <div class="field">
              <label>Código del Cargo *</label>
              <input class="pos-code" required placeholder="Ej. CAR-001" value="${escapeHtml(currentPos?.Code || '')}">
            </div>
            <div class="field">
              <label>Título del Cargo *</label>
              <input class="pos-title" required placeholder="Ej. Especialista de Nómina" value="${escapeHtml(currentPos?.Title || '')}">
            </div>
            <div class="field">
              <label>Departamento *</label>
              <select class="pos-dept" required>${deptOptions}</select>
            </div>
            <div class="field">
              <label>Nivel Jerárquico (1 a 15) *</label>
              <input class="pos-level" type="number" min="1" max="15" value="${currentPos?.HierarchyLevel || 5}">
            </div>
            <div class="field">
              <label>Salario Mínimo Referencial (DOP)</label>
              <input class="pos-sal-min" type="number" step="0.01" value="${currentPos?.SalaryMin || ''}">
            </div>
            <div class="field">
              <label>Salario Máximo Referencial (DOP)</label>
              <input class="pos-sal-max" type="number" step="0.01" value="${currentPos?.SalaryMax || ''}">
            </div>
            <div class="field full">
              <label>Descripción y Perfil</label>
              <textarea class="pos-desc" placeholder="Resumen del puesto">${escapeHtml(currentPos?.Description || '')}</textarea>
            </div>
          </div>
        `;

        showModal(isEdit ? 'Editar Cargo' : 'Nuevo Cargo', body, isEdit ? 'Guardar Cambios' : 'Crear Cargo', async modal => {
          const payload = {
            code: modal.querySelector('.pos-code').value,
            title: modal.querySelector('.pos-title').value,
            departmentId: modal.querySelector('.pos-dept').value,
            hierarchyLevel: Number(modal.querySelector('.pos-level').value),
            salaryMin: modal.querySelector('.pos-sal-min').value || null,
            salaryMax: modal.querySelector('.pos-sal-max').value || null,
            description: modal.querySelector('.pos-desc').value || null
          };
          try {
            await savePosition(payload, posId);
            toast(isEdit ? 'Cargo actualizado.' : 'Cargo creado exitosamente.');
            await loadHrPositions();
            renderFn();
          } catch (err) {
            toast(err.message);
          }
        });
      });
    }

    // Delete Position
    if (action === 'delete-position') {
      btn.addEventListener('click', () => {
        const posId = btn.dataset.id;
        const posTitle = btn.dataset.title || 'este cargo';
        const modalBackdrop = showModal(
          'Eliminar Cargo',
          `<p>¿Estás seguro de que deseas eliminar el cargo <strong>${escapeHtml(posTitle)}</strong>?</p>
           <p style="color:var(--muted); font-size:12.5px; margin-top:8px;">Esta acción eliminará el registro permanentemente de la estructura ocupacional.</p>`,
          'Eliminar',
          async () => {
            try {
              const res = await deletePosition(posId);
              toast(res.message || 'Cargo eliminado exitosamente.');
              await loadHrPositions();
              renderFn();
            } catch (err) {
              toast(err.message);
            }
          }
        );
        const confirmBtn = modalBackdrop.querySelector('.modal-confirm');
        if (confirmBtn) {
          confirmBtn.classList.remove('primary');
          confirmBtn.classList.add('danger');
          confirmBtn.style.background = 'var(--danger, #ef4444)';
          confirmBtn.style.borderColor = 'var(--danger, #ef4444)';
          confirmBtn.style.color = '#fff';
        }
      });
    }

    // Labor Movement Modals (Transfer, Promote, Salary, Suspend, Leave, Reactivate, Terminate)
    if (action === 'open-movement-modal') {
      btn.addEventListener('click', () => {
        const movementType = btn.dataset.movement;
        const empId = btn.dataset.id;
        const emp = state.hr.currentEmployee;

        let title = '';
        let body = '';
        let submitAction = '';

        if (movementType === 'transfer') {
          title = 'Transferencia de Sucursal o Departamento';
          submitAction = 'transfer';
          const branchOptions = state.branches.map(b => `<option value="${b.id}" ${emp.BranchId === b.id ? 'selected' : ''}>${escapeHtml(b.name)}</option>`).join('');
          const deptOptions = state.hr.departments.map(d => `<option value="${d.Id}" ${emp.DepartmentId === d.Id ? 'selected' : ''}>${escapeHtml(d.Name)}</option>`).join('');
          body = `
            <div class="form-grid">
              <div class="field"><label>Nueva Sucursal</label><select class="mov-branch">${branchOptions}</select></div>
              <div class="field"><label>Nuevo Departamento</label><select class="mov-dept">${deptOptions}</select></div>
              <div class="field"><label>Fecha de Efectividad *</label><input type="date" class="mov-date" value="${new Date().toISOString().slice(0, 10)}"></div>
              <div class="field full"><label>Motivo de la Transferencia *</label><textarea class="mov-reason" placeholder="Razones operativas o administrativas"></textarea></div>
            </div>
          `;
        } else if (movementType === 'promote') {
          title = 'Ascenso de Cargo y Salario';
          submitAction = 'promote';
          const posOptions = state.hr.positions.map(p => `<option value="${p.Id}">${escapeHtml(p.Title)} (Nivel ${p.HierarchyLevel})</option>`).join('');
          const deptOptions = state.hr.departments.map(d => `<option value="${d.Id}" ${emp.DepartmentId === d.Id ? 'selected' : ''}>${escapeHtml(d.Name)}</option>`).join('');
          body = `
            <div class="form-grid">
              <div class="field"><label>Nuevo Cargo *</label><select class="mov-pos" required>${posOptions}</select></div>
              <div class="field"><label>Departamento</label><select class="mov-dept">${deptOptions}</select></div>
              <div class="field"><label>Nuevo Salario Base (DOP)</label><input type="number" step="0.01" class="mov-salary" value="${emp.BaseSalary || ''}"></div>
              <div class="field"><label>Fecha de Efectividad *</label><input type="date" class="mov-date" value="${new Date().toISOString().slice(0, 10)}"></div>
              <div class="field full"><label>Motivo del Ascenso *</label><textarea class="mov-reason" placeholder="Evaluación de desempeño, mérito, etc."></textarea></div>
            </div>
          `;
        } else if (movementType === 'salary') {
          title = 'Ajuste Salarial';
          submitAction = 'salary';
          body = `
            <div class="form-grid">
              <div class="field"><label>Salario Actual</label><input disabled value="${emp.BaseSalary || 0}"></div>
              <div class="field"><label>Nuevo Salario Base (DOP) *</label><input type="number" step="0.01" class="mov-salary" required placeholder="0.00"></div>
              <div class="field"><label>Fecha de Efectividad *</label><input type="date" class="mov-date" value="${new Date().toISOString().slice(0, 10)}"></div>
              <div class="field full"><label>Justificación del Ajuste *</label><textarea class="mov-reason" placeholder="Revisión salarial anual, ajuste inflacionario, etc."></textarea></div>
            </div>
          `;
        } else if (movementType === 'suspend') {
          title = 'Suspensión Laboral';
          submitAction = 'suspend';
          body = `
            <div class="form-grid">
              <div class="field"><label>Fecha de Inicio de Suspensión *</label><input type="date" class="mov-date" value="${new Date().toISOString().slice(0, 10)}"></div>
              <div class="field full"><label>Causa y Justificación de la Suspensión *</label><textarea class="mov-reason" placeholder="Causa legal o disciplinaria"></textarea></div>
            </div>
          `;
        } else if (movementType === 'leave') {
          title = 'Poner en Licencia (Médica / Personal)';
          submitAction = 'leave';
          body = `
            <div class="form-grid">
              <div class="field"><label>Fecha de Inicio de Licencia *</label><input type="date" class="mov-date" value="${new Date().toISOString().slice(0, 10)}"></div>
              <div class="field full"><label>Tipo de Licencia y Motivo *</label><textarea class="mov-reason" placeholder="Médica, maternidad, paternidad, etc."></textarea></div>
            </div>
          `;
        } else if (movementType === 'reactivate') {
          title = 'Reactivación Laboral';
          submitAction = 'reactivate';
          body = `
            <div class="form-grid">
              <div class="field"><label>Fecha de Reingreso / Reactivación *</label><input type="date" class="mov-date" value="${new Date().toISOString().slice(0, 10)}"></div>
              <div class="field full"><label>Observaciones de Reactivación</label><textarea class="mov-reason" placeholder="Fin de suspensión o reincorporación"></textarea></div>
            </div>
          `;
        } else if (movementType === 'terminate') {
          title = 'Registro de Desvinculación Definitiva';
          submitAction = 'terminate';
          const reasons = state.hr.catalogs?.TerminationReason || [];
          const reasonOptions = reasons.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
          body = `
            <div class="form-grid">
              <div class="field"><label>Motivo Legal de Desvinculación *</label><select class="mov-term-reason" required>${reasonOptions}</select></div>
              <div class="field"><label>Fecha Efectiva de Salida *</label><input type="date" class="mov-date" value="${new Date().toISOString().slice(0, 10)}"></div>
              <div class="field full"><label>Detalle y Notas de la Salida *</label><textarea class="mov-reason" required placeholder="Liquidación de prestaciones laborales, entrega de puesto, etc."></textarea></div>
            </div>
          `;
        }

        showModal(title, body, 'Confirmar Movimiento', async modal => {
          const payload = {
            effectiveDate: modal.querySelector('.mov-date')?.value || new Date().toISOString().slice(0, 10),
            reason: modal.querySelector('.mov-reason')?.value || null
          };

          if (modal.querySelector('.mov-branch')) payload.toBranchId = modal.querySelector('.mov-branch').value || null;
          if (modal.querySelector('.mov-dept')) payload.toDepartmentId = modal.querySelector('.mov-dept').value || null;
          if (modal.querySelector('.mov-pos')) payload.toPositionId = modal.querySelector('.mov-pos').value || null;
          if (modal.querySelector('.mov-salary')) payload.toSalary = Number(modal.querySelector('.mov-salary').value);
          if (modal.querySelector('.mov-term-reason')) {
            payload.terminationReasonId = modal.querySelector('.mov-term-reason').value;
            payload.terminationNotes = payload.reason;
          }

          try {
            await submitLaborMovement(empId, submitAction, payload);
            toast('Movimiento registrado en el historial exitosamente.');
            await loadHrEmployeeDetail(empId);
            await loadHrEmployees();
            renderFn();
          } catch (err) {
            toast(err.message);
          }
        });
      });
    }
  });

  /* =========================================================================
     FASE 2: RELOJ EN VIVO, ASISTENCIA Y PONCHES
     ========================================================================= */

  // Reloj en vivo en la tarjeta de ponche
  const liveClockEl = document.querySelector('#hr-live-clock');
  if (liveClockEl) {
    const updateClock = () => {
      const el = document.querySelector('#hr-live-clock');
      if (el) {
        el.textContent = new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      }
    };
    updateClock();
    if (!window.__hrClockInterval) {
      window.__hrClockInterval = setInterval(updateClock, 1000);
    }
  }

  // Registrar Ponche de Entrada
  document.querySelectorAll('[data-action="hr-punch-in"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        btn.disabled = true;
        const res = await recordCheckIn('Ponche web desde portal Kinetix');
        toast(res.message || 'Ponche de entrada registrado exitosamente.');
        await Promise.all([loadTodayAttendance(), loadAttendanceList()]);
        renderFn();
      } catch (err) {
        btn.disabled = false;
        toast(err.message);
      }
    });
  });

  // Registrar Ponche de Salida
  document.querySelectorAll('[data-action="hr-punch-out"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        btn.disabled = true;
        const res = await recordCheckOut('Ponche web desde portal Kinetix');
        toast(res.message || 'Ponche de salida registrado exitosamente.');
        await Promise.all([loadTodayAttendance(), loadAttendanceList()]);
        renderFn();
      } catch (err) {
        btn.disabled = false;
        toast(err.message);
      }
    });
  });

  // Actualizar Asistencia
  document.querySelectorAll('[data-action="hr-refresh-attendance"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await Promise.all([loadTodayAttendance(), loadAttendanceList()]);
        renderFn();
        toast('Datos de asistencia actualizados.');
      } catch (err) {
        toast(err.message);
      }
    });
  });

  // Filtrar Asistencia
  document.querySelectorAll('[data-action="hr-filter-attendance"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      state.hr.attendanceStartDate = document.querySelector('#hr-att-start-date')?.value || '';
      state.hr.attendanceEndDate = document.querySelector('#hr-att-end-date')?.value || '';
      state.hr.attendanceStatusFilter = document.querySelector('#hr-att-status')?.value || '';
      state.hr.attendancePage = 1;
      try {
        await loadAttendanceList();
        renderFn();
      } catch (err) {
        toast(err.message);
      }
    });
  });

  // Limpiar Filtros de Asistencia
  document.querySelectorAll('[data-action="hr-clear-attendance-filter"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      state.hr.attendanceStartDate = '';
      state.hr.attendanceEndDate = '';
      state.hr.attendanceStatusFilter = '';
      state.hr.attendancePage = 1;
      try {
        await loadAttendanceList();
        renderFn();
      } catch (err) {
        toast(err.message);
      }
    });
  });

  // Exportar Asistencia a CSV
  document.querySelectorAll('[data-action="hr-export-attendance"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const params = new URLSearchParams();
      if (state.hr.attendanceStartDate) params.set('startDate', state.hr.attendanceStartDate);
      if (state.hr.attendanceEndDate) params.set('endDate', state.hr.attendanceEndDate);
      window.open(`/api/hr/attendance/export?${params.toString()}`, '_blank');
    });
  });

  // Modal de Creación / Edición de Turno Laboral
  const openShiftModal = (shift = null) => {
    const isEdit = Boolean(shift);
    const startVal = shift?.StartTime ? String(shift.StartTime).slice(0, 5) : '08:00';
    const endVal = shift?.EndTime ? String(shift.EndTime).slice(0, 5) : '17:00';
    const body = `
      <div class="form-grid">
        <div class="field">
          <label>Código del Turno *</label>
          <input type="text" id="shift-code" value="${escapeHtml(shift?.Code || '')}" placeholder="Ej: DIU-01" required>
        </div>
        <div class="field">
          <label>Nombre del Turno *</label>
          <input type="text" id="shift-name" value="${escapeHtml(shift?.Name || '')}" placeholder="Ej: Jornada Administrativa" required>
        </div>
        <div class="field">
          <label>Hora de Entrada *</label>
          <input type="time" id="shift-start" value="${startVal}" required>
        </div>
        <div class="field">
          <label>Hora de Salida *</label>
          <input type="time" id="shift-end" value="${endVal}" required>
        </div>
        <div class="field">
          <label>Tolerancia Entrada (min)</label>
          <input type="number" id="shift-grace" min="0" max="120" value="${shift?.GraceMinutes ?? 10}">
        </div>
        <div class="field">
          <label>Tiempo de Almuerzo (min)</label>
          <input type="number" id="shift-break" min="0" max="180" value="${shift?.BreakMinutes ?? 60}">
        </div>
        <div class="field">
          <label>Tipo de Jornada</label>
          <select id="shift-type">
            <option value="Diurno" ${(shift?.ShiftType || 'Diurno') === 'Diurno' ? 'selected' : ''}>Diurno</option>
            <option value="Mixto" ${shift?.ShiftType === 'Mixto' ? 'selected' : ''}>Mixto</option>
            <option value="Nocturno" ${shift?.ShiftType === 'Nocturno' ? 'selected' : ''}>Nocturno</option>
          </select>
        </div>
        <div class="field">
          <label>Estado</label>
          <select id="shift-active">
            <option value="true" ${shift?.IsActive !== false ? 'selected' : ''}>Activo</option>
            <option value="false" ${shift?.IsActive === false ? 'selected' : ''}>Inactivo</option>
          </select>
        </div>
      </div>
    `;

    showModal(isEdit ? 'Editar Turno Laboral' : 'Nuevo Turno Laboral', body, 'Guardar Turno', async modal => {
      const code = modal.querySelector('#shift-code')?.value?.trim().toUpperCase();
      const name = modal.querySelector('#shift-name')?.value?.trim();
      const startTime = modal.querySelector('#shift-start')?.value;
      const endTime = modal.querySelector('#shift-end')?.value;
      const graceMinutes = Number(modal.querySelector('#shift-grace')?.value || 0);
      const breakMinutes = Number(modal.querySelector('#shift-break')?.value || 0);
      const shiftType = modal.querySelector('#shift-type')?.value || 'Diurno';
      const isActive = modal.querySelector('#shift-active')?.value !== 'false';

      if (!code || !name || !startTime || !endTime) {
        throw new Error('Código, nombre, hora de inicio y hora de fin son obligatorios.');
      }

      await saveWorkShift({
        id: shift?.Id || null,
        code,
        name,
        startTime,
        endTime,
        graceMinutes,
        breakMinutes,
        shiftType,
        isActive
      });

      toast(isEdit ? 'Turno actualizado exitosamente.' : 'Turno creado exitosamente.');
      await loadHrShifts();
      renderFn();
    });
  };

  document.querySelectorAll('[data-action="hr-open-shift-modal"]').forEach(btn => {
    btn.addEventListener('click', () => openShiftModal(null));
  });

  document.querySelectorAll('[data-action="hr-edit-shift"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const shift = (state.hr.shifts || []).find(s => String(s.Id) === String(btn.dataset.id));
      if (shift) openShiftModal(shift);
    });
  });

  // Solicitar Corrección de Asistencia (Modal)
  const openCorrectionModal = (prefillAttendanceId = null, prefillDate = null) => {
    const todayStr = prefillDate || new Date().toISOString().slice(0, 10);
    const body = `
      <div class="form-grid">
        <div class="field full">
          <label>Fecha a Corregir *</label>
          <input type="date" id="corr-date" value="${todayStr}" required>
        </div>
        <div class="field">
          <label>Hora de Entrada Correcta *</label>
          <input type="time" id="corr-in" value="08:00" required>
        </div>
        <div class="field">
          <label>Hora de Salida Correcta *</label>
          <input type="time" id="corr-out" value="17:00" required>
        </div>
        <div class="field full">
          <label>Justificación y Motivo *</label>
          <textarea id="corr-reason" required placeholder="Ej: Olvido de registro, falla biométrica, salida autorizada a diligencia institucional, etc."></textarea>
        </div>
      </div>
    `;

    showModal('Solicitud de Corrección de Asistencia', body, 'Enviar para Aprobación', async modal => {
      const dateVal = modal.querySelector('#corr-date')?.value;
      const inVal = modal.querySelector('#corr-in')?.value;
      const outVal = modal.querySelector('#corr-out')?.value;
      const reasonVal = modal.querySelector('#corr-reason')?.value?.trim();

      if (!dateVal || !inVal || !reasonVal) {
        throw new Error('Por favor complete la fecha, hora de entrada y el motivo de justificación.');
      }

      const requestedCheckIn = `${dateVal}T${inVal}:00`;
      const requestedCheckOut = outVal ? `${dateVal}T${outVal}:00` : null;

      try {
        const res = await requestAttendanceCorrection({
          attendanceId: prefillAttendanceId || undefined,
          attendanceDate: dateVal,
          requestedCheckIn,
          requestedCheckOut,
          reason: reasonVal
        });
        toast(res.message || 'Solicitud de corrección enviada al flujo de aprobación.');
        await Promise.all([loadAttendanceList(), loadPendingApprovals(), loadMyApprovalRequests()]);
        renderFn();
      } catch (err) {
        toast(err.message);
      }
    });
  };

  document.querySelectorAll('[data-action="hr-open-attendance-correction"]').forEach(btn => {
    btn.addEventListener('click', () => openCorrectionModal());
  });

  document.querySelectorAll('[data-action="hr-correct-attendance-row"]').forEach(btn => {
    btn.addEventListener('click', () => {
      openCorrectionModal(btn.dataset.id, btn.dataset.date);
    });
  });

  /* =========================================================================
     FASE 2: VACACIONES Y LICENCIAS
     ========================================================================= */

  // Tabs de Vacaciones
  document.querySelectorAll('[data-vacation-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.hr.vacationsTab = btn.dataset.vacationTab;
      renderFn();
    });
  });

  // Helper para calcular días laborables (Lun-Vie) entre dos fechas YYYY-MM-DD
  const countBusinessDays = (startStr, endStr) => {
    if (!startStr || !endStr) return 0;
    const start = new Date(`${startStr}T00:00:00`);
    const end = new Date(`${endStr}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
    let count = 0;
    const cur = new Date(start);
    while (cur <= end) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  };

  // Modal Solicitar Vacaciones
  document.querySelectorAll('[data-action="hr-open-vacation-request"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const balance = state.hr.vacationBalance || { DaysAvailable: 14 };
      const body = `
        <div class="form-grid">
          <div class="field full" style="background:var(--bg-card);padding:12px;border-radius:6px;border:1px solid var(--border);">
            <div style="font-size:12px;color:var(--text-muted);">Saldo Legal Disponible</div>
            <div style="font-size:18px;font-weight:700;color:var(--primary);">${balance.DaysAvailable || 0} días laborables</div>
            <small style="color:var(--text-muted);">Regulado por Art. 177 Código de Trabajo de la República Dominicana</small>
          </div>
          <div class="field">
            <label>Fecha de Inicio *</label>
            <input type="date" id="vac-start-date" required>
          </div>
          <div class="field">
            <label>Fecha de Fin *</label>
            <input type="date" id="vac-end-date" required>
          </div>
          <div class="field">
            <label>Días Hábiles Solicitados *</label>
            <input type="number" id="vac-days" min="1" max="${balance.DaysAvailable || 30}" required value="5">
          </div>
          <div class="field full">
            <label>Observaciones / Notas Adicionales</label>
            <textarea id="vac-comments" placeholder="Notas sobre entrega de guardia, plan de contingencia, etc."></textarea>
          </div>
        </div>
      `;

      showModal('Solicitud de Período de Vacaciones', body, 'Enviar para Aprobación', async modal => {
        const startDate = modal.querySelector('#vac-start-date')?.value;
        const endDate = modal.querySelector('#vac-end-date')?.value;
        const days = Number(modal.querySelector('#vac-days')?.value);
        const comments = modal.querySelector('#vac-comments')?.value?.trim();

        if (!startDate || !endDate || !days) {
          throw new Error('Debe completar la fecha de inicio, fecha de fin y la cantidad de días.');
        }

        try {
          const res = await createVacationRequest({
            startDate,
            endDate,
            requestedDays: days,
            comments
          });
          toast(res.message || 'Solicitud de vacaciones registrada y enviada a aprobación.');
          await Promise.all([loadVacationBalance(), loadVacationRequests(), loadMyApprovalRequests()]);
          renderFn();
        } catch (err) {
          toast(err.message);
        }
      });

      const modalEl = document.querySelector('.modal');
      if (modalEl) {
        const startInput = modalEl.querySelector('#vac-start-date');
        const endInput = modalEl.querySelector('#vac-end-date');
        const daysInput = modalEl.querySelector('#vac-days');
        const syncDays = () => {
          const calc = countBusinessDays(startInput?.value, endInput?.value);
          if (calc > 0 && daysInput) daysInput.value = String(calc);
        };
        startInput?.addEventListener('change', syncDays);
        endInput?.addEventListener('change', syncDays);
      }
    });
  });

  // Modal Solicitar Licencia / Permiso
  document.querySelectorAll('[data-action="hr-open-leave-request"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const types = state.hr.leaveTypes || [];
      const typeOptions = types.map(t => `<option value="${t.Id}" data-unit="${t.Unit || 'Dias'}" data-attach="${t.RequiresAttachment ? '1' : '0'}">${escapeHtml(t.Name)} (${t.IsPaid ? 'Con Goce' : 'Sin Goce'}) - Max ${t.MaxDaysPerYear ?? t.DefaultDays ?? 'N/A'} ${t.Unit === 'Horas' ? 'horas' : 'días'}</option>`).join('');

      const body = `
        <div class="form-grid">
          <div class="field full">
            <label>Tipo de Licencia o Permiso *</label>
            <select id="leave-type-id" required>
              ${typeOptions}
            </select>
          </div>
          <div class="field">
            <label>Fecha de Inicio *</label>
            <input type="date" id="leave-start-date" required>
          </div>
          <div class="field">
            <label>Fecha de Fin *</label>
            <input type="date" id="leave-end-date" required>
          </div>
          <div class="field leave-hours-field" style="display:none;">
            <label>Hora Inicio *</label>
            <input type="time" id="leave-start-time" value="08:00">
          </div>
          <div class="field leave-hours-field" style="display:none;">
            <label>Hora Fin *</label>
            <input type="time" id="leave-end-time" value="10:00">
          </div>
          <div class="field">
            <label id="leave-duration-label">Días / Horas Solicitados *</label>
            <input type="number" id="leave-days" min="0.5" step="0.5" max="90" required value="3">
          </div>
          <div class="field full">
            <label id="leave-file-label">Constancia o Certificado de Soporte (PDF, Imagen)</label>
            <input type="file" id="leave-document" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx">
          </div>
          <div class="field full">
            <label>Motivo y Justificación *</label>
            <textarea id="leave-reason" required placeholder="Detalle médico, constancia judicial, motivo personal justificado"></textarea>
          </div>
        </div>
      `;

      showModal('Solicitud de Licencia o Permiso Especial', body, 'Enviar para Aprobación', async modal => {
        const leaveTypeId = modal.querySelector('#leave-type-id')?.value;
        const selectedType = types.find(t => String(t.Id) === String(leaveTypeId));
        const startDate = modal.querySelector('#leave-start-date')?.value;
        const endDate = modal.querySelector('#leave-end-date')?.value;
        const startTime = modal.querySelector('#leave-start-time')?.value;
        const endTime = modal.querySelector('#leave-end-time')?.value;
        const days = Number(modal.querySelector('#leave-days')?.value);
        const reason = modal.querySelector('#leave-reason')?.value?.trim();
        const file = modal.querySelector('#leave-document')?.files?.[0] || null;

        if (!leaveTypeId || !startDate || !endDate || !reason) {
          throw new Error('Debe completar el tipo de permiso, fechas y motivo.');
        }

        if (selectedType?.RequiresAttachment && !file) {
          throw new Error(`El permiso "${selectedType.Name}" requiere adjuntar certificado o documento de soporte.`);
        }

        try {
          let payload;
          if (file) {
            payload = new FormData();
            payload.append('leaveTypeId', leaveTypeId);
            payload.append('startDate', startDate);
            payload.append('endDate', endDate);
            payload.append('duration', String(days));
            payload.append('reason', reason);
            if (selectedType?.Unit === 'Horas') {
              if (startTime) payload.append('startTime', startTime);
              if (endTime) payload.append('endTime', endTime);
            }
            payload.append('document', file);
          } else {
            payload = {
              leaveTypeId,
              startDate,
              endDate,
              duration: days,
              reason,
              ...(selectedType?.Unit === 'Horas' ? { startTime, endTime } : {})
            };
          }

          const res = await createLeaveRequest(payload);
          toast(res.message || 'Solicitud de licencia enviada al flujo de aprobación.');
          await Promise.all([loadLeaveRequests(), loadMyApprovalRequests()]);
          renderFn();
        } catch (err) {
          toast(err.message);
        }
      });

      const modalEl = document.querySelector('.modal');
      if (modalEl) {
        const typeSelect = modalEl.querySelector('#leave-type-id');
        const durationLabel = modalEl.querySelector('#leave-duration-label');
        const fileLabel = modalEl.querySelector('#leave-file-label');
        const startInput = modalEl.querySelector('#leave-start-date');
        const endInput = modalEl.querySelector('#leave-end-date');
        const daysInput = modalEl.querySelector('#leave-days');

        const updateLeaveFields = () => {
          const opt = typeSelect?.selectedOptions?.[0];
          const isHours = opt?.dataset?.unit === 'Horas';
          const needsAttach = opt?.dataset?.attach === '1';
          modalEl.querySelectorAll('.leave-hours-field').forEach(el => {
            el.style.display = isHours ? '' : 'none';
          });
          if (durationLabel) durationLabel.textContent = isHours ? 'Horas Solicitadas *' : 'Días Solicitados *';
          if (fileLabel) {
            fileLabel.textContent = needsAttach
              ? 'Constancia o Certificado de Soporte (Obligatorio) *'
              : 'Constancia o Certificado de Soporte (Opcional)';
          }
        };

        const syncLeaveDays = () => {
          const opt = typeSelect?.selectedOptions?.[0];
          if (opt?.dataset?.unit !== 'Horas') {
            const calc = countBusinessDays(startInput?.value, endInput?.value);
            if (calc > 0 && daysInput) daysInput.value = String(calc);
          }
        };

        typeSelect?.addEventListener('change', updateLeaveFields);
        startInput?.addEventListener('change', syncLeaveDays);
        endInput?.addEventListener('change', syncLeaveDays);
        updateLeaveFields();
      }
    });
  });

  /* =========================================================================
     FASE 2: BANDEJA DE APROBACIONES
     ========================================================================= */

  // Tabs de Aprobaciones
  document.querySelectorAll('[data-approvals-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.hr.approvalsTab = btn.dataset.approvalsTab;
      renderFn();
    });
  });

  // Actualizar Aprobaciones
  document.querySelectorAll('[data-action="hr-refresh-approvals"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await Promise.all([loadPendingApprovals(), loadMyApprovalRequests()]);
        renderFn();
        toast('Bandeja de aprobaciones actualizada.');
      } catch (err) {
        toast(err.message);
      }
    });
  });

  // Helper para renderizar el resumen de la entidad en el modal de aprobación
  const renderEntitySummaryBox = (summary) => {
    if (!summary) return '';
    const fmtDate = d => d ? new Date(d).toLocaleDateString('es-DO') : '-';
    const fmtTime = d => d ? new Date(d).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }) : '--:--';
    if (summary.kind === 'Vacaciones') {
      return `
        <div style="background:var(--bg-soft, #f8fafc);padding:12px;border-radius:6px;border:1px solid var(--border);font-size:13px;">
          <div style="font-weight:600;margin-bottom:6px;color:var(--primary);">Detalle de Vacaciones Solicitadas</div>
          <div><strong>Período:</strong> ${fmtDate(summary.StartDate)} al ${fmtDate(summary.EndDate)} (${summary.DaysRequested || 0} días laborables)</div>
          ${summary.Reason ? `<div style="margin-top:4px;"><strong>Observaciones:</strong> ${escapeHtml(summary.Reason)}</div>` : ''}
        </div>
      `;
    }
    if (summary.kind === 'Permiso') {
      return `
        <div style="background:var(--bg-soft, #f8fafc);padding:12px;border-radius:6px;border:1px solid var(--border);font-size:13px;">
          <div style="font-weight:600;margin-bottom:6px;color:var(--primary);">Detalle de Licencia / Permiso (${escapeHtml(summary.LeaveTypeName || 'Permiso')})</div>
          <div><strong>Período:</strong> ${fmtDate(summary.StartDate)} al ${fmtDate(summary.EndDate)} · <strong>Duración:</strong> ${summary.Duration || 0} ${summary.Unit === 'Horas' ? 'horas' : 'días'} (${summary.IsPaid ? 'Con Goce' : 'Sin Goce'})</div>
          ${summary.Reason ? `<div style="margin-top:4px;"><strong>Motivo:</strong> ${escapeHtml(summary.Reason)}</div>` : ''}
          ${summary.HasAttachment ? `<div style="margin-top:6px;"><a href="/api/hr/leaves/requests/${summary.Id}/attachment" target="_blank" style="color:var(--primary);font-weight:600;">📎 Descargar constancia adjunta (${escapeHtml(summary.AttachmentFileName || 'Soporte')})</a></div>` : ''}
        </div>
      `;
    }
    if (summary.kind === 'CorreccionAsistencia') {
      return `
        <div style="background:var(--bg-soft, #f8fafc);padding:12px;border-radius:6px;border:1px solid var(--border);font-size:13px;">
          <div style="font-weight:600;margin-bottom:6px;color:var(--primary);">Detalle de Corrección de Asistencia</div>
          <div><strong>Fecha de Jornada:</strong> ${fmtDate(summary.WorkDate)}</div>
          <div><strong>Entrada Solicitada:</strong> ${fmtTime(summary.RequestedCheckIn)} · <strong>Salida Solicitada:</strong> ${fmtTime(summary.RequestedCheckOut)}</div>
          ${summary.Reason ? `<div style="margin-top:4px;"><strong>Justificación:</strong> ${escapeHtml(summary.Reason)}</div>` : ''}
        </div>
      `;
    }
    return '';
  };

  // Revisar y Decidir Aprobación (Modal)
  document.querySelectorAll('[data-action="hr-review-approval"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const reqId = btn.dataset.id;
      try {
        const detail = await loadApprovalDetail(reqId);
        const req = detail.request;
        const step = detail.currentStep;
        const history = detail.history || [];

        const historyHtml = history.map(h => `
          <div style="font-size:12px;padding:6px 0;border-bottom:1px solid var(--border);">
            <strong>Paso ${h.StepNumber}: ${escapeHtml(h.StepName)}</strong> -
            <span class="badge ${h.Action === 'Aprobado' ? 'badge-success' : 'badge-danger'}">${h.Action}</span>
            por ${escapeHtml(h.ApproverName || 'Sistema')} el ${new Date(h.CreatedAt).toLocaleDateString('es-DO')}
            ${h.Comments ? `<div class="muted" style="margin-top:2px;">"${escapeHtml(h.Comments)}"</div>` : ''}
          </div>
        `).join('');

        const body = `
          <div class="approval-detail-view" style="display:flex;flex-direction:column;gap:14px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;background:var(--bg-card);padding:14px;border-radius:6px;border:1px solid var(--border);">
              <div><small class="muted">Trámite</small><div><strong>${escapeHtml(req.FlowName || req.FlowCode)}</strong></div></div>
              <div><small class="muted">Solicitante</small><div><strong>${escapeHtml(req.RequesterName)}</strong></div></div>
              <div><small class="muted">Paso en Curso</small><div>Paso ${req.CurrentStepNumber}: ${escapeHtml(step?.StepName || 'Evaluación')}</div></div>
              <div><small class="muted">Fecha de Solicitud</small><div>${new Date(req.CreatedAt).toLocaleDateString('es-DO')}</div></div>
            </div>

            ${renderEntitySummaryBox(detail.entitySummary)}

            ${history.length > 0 ? `
              <div>
                <strong>Historial del Flujo de Autorización:</strong>
                <div style="margin-top:6px;max-height:120px;overflow-y:auto;">${historyHtml}</div>
              </div>
            ` : ''}

            <div class="field full">
              <label>Observaciones o Comentarios de la Decisión</label>
              <textarea id="approval-decision-comments" placeholder="Ingrese comentarios para el empleado y constancia de auditoría..."></textarea>
            </div>

            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:10px;">
              <button class="secondary" id="btn-reject-approval" style="color:var(--danger);border-color:var(--danger);">
                Rechazar Solicitud
              </button>
              <button class="primary" id="btn-approve-approval">
                Aprobar Solicitud
              </button>
            </div>
          </div>
        `;

        showModal(`Revisión de Solicitud #AP-${String(req.Id).padStart(4, '0')}`, body, null, null);

        // Bind custom approve / reject buttons inside modal
        const modalContainer = document.querySelector('.modal');
        if (modalContainer) {
          modalContainer.querySelector('#btn-approve-approval')?.addEventListener('click', async () => {
            const comments = modalContainer.querySelector('#approval-decision-comments')?.value?.trim();
            try {
              const res = await processApprovalAction(reqId, 'Aprobado', comments);
              toast(res.message || 'Solicitud aprobada exitosamente.');
              document.querySelector('.modal-backdrop')?.remove();
              await Promise.all([loadPendingApprovals(), loadMyApprovalRequests(), loadVacationBalance()]);
              renderFn();
            } catch (err) {
              toast(err.message);
            }
          });

          modalContainer.querySelector('#btn-reject-approval')?.addEventListener('click', async () => {
            const comments = modalContainer.querySelector('#approval-decision-comments')?.value?.trim();
            if (!comments) {
              toast('Debe ingresar un motivo para rechazar la solicitud.');
              return;
            }
            try {
              const res = await processApprovalAction(reqId, 'Rechazado', comments);
              toast(res.message || 'Solicitud rechazada.');
              document.querySelector('.modal-backdrop')?.remove();
              await Promise.all([loadPendingApprovals(), loadMyApprovalRequests()]);
              renderFn();
            } catch (err) {
              toast(err.message);
            }
          });
        }
      } catch (err) {
        toast(err.message);
      }
    });
  });

  // Ver Detalle e Historial de Mi Solicitud
  document.querySelectorAll('[data-action="hr-view-approval-detail"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const reqId = btn.dataset.id;
      try {
        const detail = await loadApprovalDetail(reqId);
        const req = detail.request;
        const history = detail.history || [];

        const historyHtml = history.length === 0
          ? '<p class="muted">En espera de primera revisión por el aprobador designado.</p>'
          : history.map(h => `
              <div style="font-size:12px;padding:8px 0;border-bottom:1px solid var(--border);">
                <strong>Paso ${h.StepNumber}: ${escapeHtml(h.StepName)}</strong> -
                <span class="badge ${h.Action === 'Aprobado' ? 'badge-success' : 'badge-danger'}">${h.Action}</span>
                por ${escapeHtml(h.ApproverName || 'Sistema')} el ${new Date(h.CreatedAt).toLocaleDateString('es-DO')}
                ${h.Comments ? `<div class="muted" style="margin-top:2px;">"${escapeHtml(h.Comments)}"</div>` : ''}
              </div>
            `).join('');

        const body = `
          <div style="display:flex;flex-direction:column;gap:12px;">
            <div style="background:var(--bg-card);padding:12px;border-radius:6px;border:1px solid var(--border);">
              <div><strong>Trámite:</strong> ${escapeHtml(req.FlowName || req.FlowCode)}</div>
              <div><strong>Estado:</strong> ${req.Status}</div>
              <div><strong>Paso Actual:</strong> Paso ${req.CurrentStepNumber}</div>
            </div>
            ${renderEntitySummaryBox(detail.entitySummary)}
            <div>
              <strong>Trazabilidad de Pasos y Firmas:</strong>
              <div style="margin-top:8px;">${historyHtml}</div>
            </div>
          </div>
        `;

        showModal(`Trazabilidad de Solicitud #AP-${String(req.Id).padStart(4, '0')}`, body, 'Cerrar', () => {});
      } catch (err) {
        toast(err.message);
      }
    });
  });

  /* =========================================================================
     FASE 2: SISTEMA DE NOTIFICACIONES IN-APP (CAMPANA Y POPOVER)
     ========================================================================= */

  // Toggle dropdown de notificaciones
  document.querySelectorAll('[data-action="toggle-notifications"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const popover = document.querySelector('#notifications-popover');
      if (!popover) return;

      const isHidden = popover.classList.contains('hidden');
      if (isHidden) {
        popover.classList.remove('hidden');
        const container = document.querySelector('#notifications-list-container');
        if (container) {
          container.innerHTML = '<div style="padding:16px;text-align:center;font-size:12px;color:var(--text-muted);">Cargando notificaciones...</div>';
          try {
            const list = await loadHrNotifications();
            if (list.length === 0) {
              container.innerHTML = '<div style="padding:20px;text-align:center;font-size:12px;color:var(--text-muted);">No tiene notificaciones pendientes.</div>';
            } else {
              container.innerHTML = list.slice(0, 10).map(n => `
                <div class="notification-item ${n.IsRead ? 'read' : 'unread'}" data-notif-id="${n.Id}">
                  <div class="notif-title">
                    <strong>${escapeHtml(n.Title)}</strong>
                    <small>${new Date(n.CreatedAt).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}</small>
                  </div>
                  <div class="notif-msg">${escapeHtml(n.Message)}</div>
                  ${!n.IsRead ? `<button class="mark-read-btn" data-action="mark-single-read" data-id="${n.Id}">Marcar como leída</button>` : ''}
                </div>
              `).join('');

              // Bind individual mark read
              container.querySelectorAll('[data-action="mark-single-read"]').forEach(b => {
                b.addEventListener('click', async (ev) => {
                  ev.stopPropagation();
                  await markHrNotificationRead(b.dataset.id);
                  b.closest('.notification-item')?.classList.remove('unread');
                  b.closest('.notification-item')?.classList.add('read');
                  b.remove();
                  renderFn();
                });
              });
            }
          } catch {
            container.innerHTML = '<div style="padding:16px;text-align:center;font-size:12px;color:var(--danger);">Error al cargar notificaciones.</div>';
          }
        }
      } else {
        popover.classList.add('hidden');
      }
    });
  });

  // Cerrar popover de notificaciones si se hace click fuera (singleton para evitar fuga de listeners)
  if (!window.__hrOutsideClickBound) {
    window.__hrOutsideClickBound = true;
    document.addEventListener('click', (e) => {
      const popover = document.querySelector('#notifications-popover');
      if (popover && !popover.classList.contains('hidden') && !e.target.closest('.topbar-notifications-wrapper')) {
        popover.classList.add('hidden');
      }
    });
  }

  // Marcar todas las notificaciones como leídas
  document.querySelectorAll('[data-action="mark-all-notifications-read"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await markAllHrNotificationsRead();
        document.querySelectorAll('.notification-item.unread').forEach(item => {
          item.classList.remove('unread');
          item.classList.add('read');
          item.querySelector('.mark-read-btn')?.remove();
        });
        toast('Todas las notificaciones marcadas como leídas.');
        renderFn();
      } catch (err) {
        toast(err.message);
      }
    });
  });
}
