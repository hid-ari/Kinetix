import { state } from '../../core/state.js';
import { escapeHtml } from '../../components/utils.js';
import { breadcrumb, pageHeader } from '../../components/ui.js';

export function employeeForm(employee = null) {
  const isEdit = !!employee;
  const title = isEdit ? `Editar · ${employee.FirstName} ${employee.LastName}` : 'Nuevo Empleado';
  const desc = isEdit ? 'Actualiza los datos personales, de contacto y contractuales del colaborador.' : 'Registra un nuevo colaborador en la organización con su expediente digital.';

  const depts = state.hr.departments || [];
  const positions = state.hr.positions || [];
  const branches = state.branches || [];
  const users = state.users || [];
  const employees = state.hr.employees || [];

  const catalogs = state.hr.catalogs || {};
  const contractTypes = catalogs.ContractType || [];
  const workModalities = catalogs.WorkModality || [];

  const deptOptions = depts.map(d => `
    <option value="${d.Id}" ${employee?.DepartmentId === d.Id ? 'selected' : ''}>
      ${escapeHtml(d.Name)}
    </option>
  `).join('');

  const posOptions = positions.map(p => `
    <option value="${p.Id}" ${employee?.PositionId === p.Id ? 'selected' : ''}>
      ${escapeHtml(p.Title)} (Nivel ${p.HierarchyLevel})
    </option>
  `).join('');

  const branchOptions = branches.map(b => `
    <option value="${b.id}" ${employee?.BranchId === b.id ? 'selected' : ''}>
      ${escapeHtml(b.name)}
    </option>
  `).join('');

  const supOptions = employees
    .filter(e => !isEdit || e.Id !== employee.Id)
    .map(e => `
      <option value="${e.Id}" ${employee?.SupervisorEmployeeId === e.Id ? 'selected' : ''}>
        ${escapeHtml(e.FirstName)} ${escapeHtml(e.LastName)} (${escapeHtml(e.EmployeeCode)})
      </option>
    `).join('');

  const contractOptions = contractTypes.map(c => `
    <option value="${c.id}" ${employee?.ContractTypeId === c.id ? 'selected' : ''}>
      ${escapeHtml(c.name)}
    </option>
  `).join('');

  const modalityOptions = workModalities.map(m => `
    <option value="${m.id}" ${employee?.WorkModalityId === m.id ? 'selected' : ''}>
      ${escapeHtml(m.name)}
    </option>
  `).join('');

  const userOptions = users.map(u => `
    <option value="${escapeHtml(u.id)}" ${employee?.UserId === u.id ? 'selected' : ''}>
      ${escapeHtml(u.name)} (${escapeHtml(u.email)})
    </option>
  `).join('');

  const hireDateVal = employee?.HireDate ? new Date(employee.HireDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const birthDateVal = employee?.BirthDate ? new Date(employee.BirthDate).toISOString().slice(0, 10) : '';

  return `
    ${breadcrumb([['dashboard', 'Inicio'], ['hr-dashboard', 'Recursos Humanos'], ['hr-employees', 'Empleados'], [state.view, title]])}
    ${pageHeader(title, desc)}

    <div class="panel form-layout">
      <form id="hr-employee-form" data-employee-id="${employee?.Id || ''}">
        <!-- Section 1: Identidad Personal -->
        <div class="form-section">
          <h3>1. Información de Identidad Personal</h3>
          <div class="form-grid">
            <div class="field">
              <label>Nombres *</label>
              <input required name="firstName" placeholder="Ej. Carlos Manuel" value="${escapeHtml(employee?.FirstName || '')}">
            </div>
            <div class="field">
              <label>Apellidos *</label>
              <input required name="lastName" placeholder="Ej. Gómez Peralta" value="${escapeHtml(employee?.LastName || '')}">
            </div>
            <div class="field">
              <label>Tipo de Documento *</label>
              <select name="documentType" id="emp-doc-type">
                <option value="Cedula" ${employee?.DocumentType === 'Cedula' ? 'selected' : ''}>Cédula de Identidad (Rep. Dom.)</option>
                <option value="Pasaporte" ${employee?.DocumentType === 'Pasaporte' ? 'selected' : ''}>Pasaporte</option>
                <option value="Otro" ${employee?.DocumentType === 'Otro' ? 'selected' : ''}>Otro Documento</option>
              </select>
            </div>
            <div class="field">
              <label>Número de Documento *</label>
              <input required name="documentNumber" id="emp-doc-num" placeholder="001-1234567-8 o 11 dígitos" value="${escapeHtml(employee?.DocumentNumber || '')}">
              <span class="helper" id="emp-doc-helper">Validación algorítmica de cédula dominicana (Luhn).</span>
            </div>
            <div class="field">
              <label>Fecha de Nacimiento</label>
              <input type="date" name="birthDate" value="${birthDateVal}">
            </div>
            <div class="field">
              <label>Sexo</label>
              <select name="sex">
                <option value="">Seleccione...</option>
                <option value="M" ${employee?.Sex === 'M' ? 'selected' : ''}>Masculino</option>
                <option value="F" ${employee?.Sex === 'F' ? 'selected' : ''}>Femenino</option>
                <option value="X" ${employee?.Sex === 'X' ? 'selected' : ''}>Otro</option>
              </select>
            </div>
            <div class="field">
              <label>Nacionalidad</label>
              <input name="nationality" placeholder="Ej. Dominicana" value="${escapeHtml(employee?.Nationality || 'Dominicana')}">
            </div>
            <div class="field">
              <label>Estado Civil</label>
              <select name="maritalStatus">
                <option value="">Seleccione...</option>
                <option value="Soltero" ${employee?.MaritalStatus === 'Soltero' ? 'selected' : ''}>Soltero(a)</option>
                <option value="Casado" ${employee?.MaritalStatus === 'Casado' ? 'selected' : ''}>Casado(a)</option>
                <option value="Union libre" ${employee?.MaritalStatus === 'Union libre' ? 'selected' : ''}>Unión libre</option>
                <option value="Divorciado" ${employee?.MaritalStatus === 'Divorciado' ? 'selected' : ''}>Divorciado(a)</option>
                <option value="Viudo" ${employee?.MaritalStatus === 'Viudo' ? 'selected' : ''}>Viudo(a)</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Section 2: Contacto y Residencia -->
        <div class="form-section">
          <h3>2. Contacto y Residencia</h3>
          <div class="form-grid">
            <div class="field">
              <label>Teléfono Principal</label>
              <input name="phone" placeholder="809-555-0101" value="${escapeHtml(employee?.Phone || '')}">
            </div>
            <div class="field">
              <label>Correo Electrónico</label>
              <input type="email" name="email" placeholder="carlos.gomez@empresa.com" value="${escapeHtml(employee?.Email || '')}">
            </div>
            <div class="field full">
              <label>Dirección de Residencia</label>
              <textarea name="address" placeholder="Calle, número, sector, ciudad">${escapeHtml(employee?.Address || '')}</textarea>
            </div>
          </div>
        </div>

        <!-- Section 3: Datos Laborales y Puesto -->
        <div class="form-section">
          <h3>3. Ubicación Organizacional y Contrato</h3>
          <div class="form-grid">
            <div class="field">
              <label>Sucursal / Sede</label>
              <select name="branchId">
                <option value="">Sede Principal / General</option>
                ${branchOptions}
              </select>
            </div>
            <div class="field">
              <label>Departamento</label>
              <select name="departmentId">
                <option value="">Sin departamento</option>
                ${deptOptions}
              </select>
            </div>
            <div class="field">
              <label>Cargo / Puesto</label>
              <select name="positionId">
                <option value="">Sin cargo asignado</option>
                ${posOptions}
              </select>
            </div>
            <div class="field">
              <label>Supervisor Inmediato</label>
              <select name="supervisorEmployeeId">
                <option value="">Ninguno / Dirección General</option>
                ${supOptions}
              </select>
            </div>
            <div class="field">
              <label>Fecha de Ingreso *</label>
              <input required type="date" name="hireDate" value="${hireDateVal}">
            </div>
            <div class="field">
              <label>Tipo de Contrato</label>
              <select name="contractTypeId">
                <option value="">Seleccione contrato...</option>
                ${contractOptions}
              </select>
            </div>
            <div class="field">
              <label>Modalidad de Trabajo</label>
              <select name="workModalityId">
                <option value="">Seleccione modalidad...</option>
                ${modalityOptions}
              </select>
            </div>
            ${!isEdit ? `
              <div class="field">
                <label>Código de Empleado (Opcional)</label>
                <input name="employeeCode" placeholder="Auto-generado si se deja en blanco">
                <span class="helper">Si no se especifica, el sistema asignará el correlativo automático.</span>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Section 4: Compensación y Acceso -->
        <div class="form-section">
          <h3>4. Compensación y Vinculación de Usuario</h3>
          <div class="form-grid">
            <div class="field">
              <label>Salario Base Mensual (DOP)</label>
              <input type="number" step="0.01" min="0" name="baseSalary" placeholder="0.00" value="${employee?.BaseSalary ?? 0}">
            </div>
            <div class="field">
              <label>Frecuencia de Pago</label>
              <select name="payFrequency">
                <option value="Mensual" ${employee?.PayFrequency === 'Mensual' ? 'selected' : ''}>Mensual</option>
                <option value="Quincenal" ${employee?.PayFrequency === 'Quincenal' ? 'selected' : ''}>Quincenal</option>
                <option value="Semanal" ${employee?.PayFrequency === 'Semanal' ? 'selected' : ''}>Semanal</option>
              </select>
            </div>
            <div class="field full">
              <label>Vincular a Cuenta de Acceso Kinetix (Opcional)</label>
              <select name="userId">
                <option value="">Sin usuario vinculado</option>
                ${userOptions}
              </select>
              <span class="helper">Permite al empleado acceder al portal con su rol y permisos de usuario.</span>
            </div>
          </div>
        </div>

        <!-- Section 5: Contacto de Emergencia (solo en alta inicial) -->
        ${!isEdit ? `
          <div class="form-section">
            <h3>5. Contacto de Emergencia</h3>
            <div class="form-grid">
              <div class="field">
                <label>Nombre del Contacto</label>
                <input name="emergencyName" placeholder="Ej. María Gómez (Esposa)">
              </div>
              <div class="field">
                <label>Parentesco / Relación</label>
                <input name="emergencyRel" placeholder="Ej. Cónyuge, Madre, Hermano">
              </div>
              <div class="field">
                <label>Teléfono de Emergencia</label>
                <input name="emergencyPhone" placeholder="809-555-0199">
              </div>
            </div>
          </div>
        ` : ''}

        <div class="form-actions">
          <button type="button" class="secondary" data-nav="hr-employees">Cancelar</button>
          <button type="submit" class="primary">${isEdit ? 'Guardar Cambios' : 'Registrar Empleado'}</button>
        </div>
      </form>
    </div>
  `;
}
