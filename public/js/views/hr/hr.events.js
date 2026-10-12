import { state } from '../../core/state.js';
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
  savePosition,
  // Fase 2
  loadTodayAttendance,
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

  // Employee form submit
  const empForm = document.querySelector('#hr-employee-form');
  if (empForm) {
    empForm.addEventListener('submit', async event => {
      event.preventDefault();
      const empId = empForm.dataset.employeeId;
      const formData = new FormData(empForm);
      const data = Object.fromEntries(formData);

      // Clean empty string IDs to null
      ['branchId', 'departmentId', 'positionId', 'supervisorEmployeeId', 'contractTypeId', 'workModalityId', 'userId'].forEach(key => {
        if (!data[key]) data[key] = null;
      });

      try {
        if (empId) {
          await updateEmployee(empId, data);
          toast('Datos del empleado actualizados exitosamente.');
          await loadHrEmployeeDetail(empId);
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
          state.view = 'hr-employee-detail';
        }
        await loadHrEmployees();
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
            loadHrCatalogs()
          ]);
          state.view = 'hr-employee-form';
          renderFn();
        } catch (err) {
          toast(err.message);
        }
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

        const branchOptions = state.branches.map(b => `
          <option value="${b.id}" ${currentDept?.BranchId === b.id ? 'selected' : ''}>${escapeHtml(b.name)}</option>
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
              <select class="dept-branch"><option value="">Sede Principal</option>${branchOptions}</select>
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
    });
  });

  // Modal Solicitar Licencia / Permiso
  document.querySelectorAll('[data-action="hr-open-leave-request"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const types = state.hr.leaveTypes || [];
      const typeOptions = types.map(t => `<option value="${t.Id}">${escapeHtml(t.Name)} (${t.IsPaid ? 'Con Goce' : 'Sin Goce'}) - Max ${t.DefaultDays || 'N/A'}d</option>`).join('');

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
          <div class="field">
            <label>Días Solicitados *</label>
            <input type="number" id="leave-days" min="1" max="90" required value="3">
          </div>
          <div class="field full">
            <label>Motivo y Justificación *</label>
            <textarea id="leave-reason" required placeholder="Detalle médico, constancia judicial, motivo personal justificado"></textarea>
          </div>
        </div>
      `;

      showModal('Solicitud de Licencia o Permiso Especial', body, 'Enviar para Aprobación', async modal => {
        const leaveTypeId = modal.querySelector('#leave-type-id')?.value;
        const startDate = modal.querySelector('#leave-start-date')?.value;
        const endDate = modal.querySelector('#leave-end-date')?.value;
        const days = Number(modal.querySelector('#leave-days')?.value);
        const reason = modal.querySelector('#leave-reason')?.value?.trim();

        if (!leaveTypeId || !startDate || !endDate || !reason) {
          throw new Error('Debe completar el tipo de permiso, fechas y motivo.');
        }

        try {
          const res = await createLeaveRequest({
            leaveTypeId,
            startDate,
            endDate,
            requestedDays: days,
            reason
          });
          toast(res.message || 'Solicitud de licencia enviada al flujo de aprobación.');
          await Promise.all([loadLeaveRequests(), loadMyApprovalRequests()]);
          renderFn();
        } catch (err) {
          toast(err.message);
        }
      });
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

            ${history.length > 0 ? `
              <div>
                <strong>Historial del Flujo de Autorización:</strong>
                <div style="margin-top:6px;max-height:120px;overflow-y:auto;">${historyHtml}</div>
              </div>
            ` : ''}

            <div class="field full">
              <label>Observaciones o Comentarios de la Decisión</label>
              <textarea id="approval-decision-comments" placeholder="Ingrese comentarios para el colaborador y constancia de auditoría..."></textarea>
            </div>

            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:10px;">
              <button class="secondary" id="btn-reject-approval" style="color:var(--danger);border-color:var(--danger);">
                ✕ Rechazar Solicitud
              </button>
              <button class="primary" id="btn-approve-approval">
                ✓ Aprobar Solicitud
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
              document.querySelector('.modal-overlay')?.remove();
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
              document.querySelector('.modal-overlay')?.remove();
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

  // Cerrar popover de notificaciones si se hace click fuera
  document.addEventListener('click', (e) => {
    const popover = document.querySelector('#notifications-popover');
    if (popover && !popover.classList.contains('hidden') && !e.target.closest('.topbar-notifications-wrapper')) {
      popover.classList.add('hidden');
    }
  });

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
