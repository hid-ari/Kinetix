import { state } from '../../core/state.js';
import { escapeHtml } from '../../components/utils.js';
import { breadcrumb, pageHeader } from '../../components/ui.js';

export function form() {
  const editUser = state.userEditId ? state.users.find(u => String(u.id) === String(state.userEditId)) : null;

  const title = editUser ? `Editar usuario · ${editUser.name}` : 'Nuevo usuario';
  const desc = editUser
    ? 'Modifica la identidad, alcance de sucursal y perfil de permisos del usuario.'
    : 'Crea una identidad y define su alcance dentro de la organización.';

  const isSuperAdmin = state.currentUser?.role === 'Super Admin';
  const companyBranches = state.branches || [];

  const branchOptions = companyBranches.map(b => `
    <option value="${escapeHtml(b.name)}" ${editUser?.branch === b.name ? 'selected' : ''}>
      ${escapeHtml(b.name)}
    </option>
  `).join('');
  const rolesList = state.roles.length ? state.roles : [
    { name: 'Company Admin' },
    { name: 'Employee' },
    ...(isSuperAdmin ? [{ name: 'Super Admin' }] : [])
  ];

  const roleOptions = rolesList
    .filter(r => isSuperAdmin || r.name !== 'Super Admin')
    .map(r => {
      const displayName = r.name === 'Company Admin' ? 'Administrador de Empresa' : r.name === 'Employee' ? 'Empleado' : r.name;
      const isSelected = editUser ? editUser.role === r.name : false;
      return `<option value="${escapeHtml(r.name)}" ${isSelected ? 'selected' : ''}>${escapeHtml(displayName)}</option>`;
    })
    .join('');

  const firstNameVal = editUser ? (editUser.firstName || editUser.name.split(' ')[0] || '') : '';
  const lastNameVal = editUser ? (editUser.lastName || editUser.name.split(' ').slice(1).join(' ') || '') : '';

  const allEmployees = state.hr?.employees || [];
  const availableEmployees = allEmployees.filter(emp =>
    !emp.UserId || (editUser && String(emp.UserId) === String(editUser.id))
  );

  const employeeOptions = availableEmployees.map(emp => {
    const fullName = emp.FullName || `${emp.FirstName || ''} ${emp.LastName || ''}`.trim();
    const isSelected = editUser?.employeeId && Number(editUser.employeeId) === Number(emp.Id);
    return `<option value="${emp.Id}" ${isSelected ? 'selected' : ''}>${escapeHtml(emp.EmployeeCode)} · ${escapeHtml(fullName)}${emp.PositionName ? ` (${escapeHtml(emp.PositionName)})` : ''}</option>`;
  }).join('');

  return `
    ${breadcrumb([['users', 'Administración'], ['users', 'Usuarios'], [state.view, title]])}
    ${pageHeader(title, desc)}
    <div class="panel form-layout">
      <form id="entity-form">
        <div class="form-section">
          <h3>Información personal</h3>
          <div class="form-grid">
            <div class="field"><label>Nombre *</label><input required name="firstName" value="${escapeHtml(firstNameVal)}" placeholder="Ej. Juan"></div>
            <div class="field"><label>Apellido *</label><input required name="lastName" value="${escapeHtml(lastNameVal)}" placeholder="Ej. Pérez"></div>
          </div>
        </div>

        <div class="form-section">
          <h3>Contacto y sucursal</h3>
          <div class="form-grid">
            <div class="field"><label>Email *</label><input required type="email" name="email" value="${escapeHtml(editUser?.email || '')}" placeholder="correo@empresa.com"></div>
            <div class="field"><label>Teléfono</label><input name="phone" value="${escapeHtml(editUser?.phone || '')}" placeholder="+1 809 000 0000"></div>
            <div class="field">
              <label>Sucursal</label>
              <select name="branch">
                <option value="">${companyBranches.length ? 'Sin sucursal' : 'Sin sucursales registradas'}</option>
                ${branchOptions}
              </select>
            </div>
          </div>
        </div>

        <div class="form-section">
          <h3>Acceso y credenciales</h3>
          <div class="form-grid">
            <div class="field"><label>Rol *</label><select name="role">${roleOptions}</select></div>
            ${editUser ? `
              <div class="field">
                <label>Nueva contraseña (opcional)</label>
                <input type="password" name="password" placeholder="Dejar en blanco para conservar la actual" minlength="8">
                <span class="helper">Solo ingrese un valor (mínimo 8 caracteres) si desea actualizar la clave del usuario.</span>
              </div>
            ` : `
              <div class="field">
                <label>Contraseña temporal *</label>
                <input required type="password" name="password" placeholder="Mínimo 8 caracteres" minlength="8">
              </div>
            `}
          </div>
        </div>

        <div class="form-section" style="border-top: 1px solid var(--border,#e2e8f0); padding-top: 16px;">
          <h3>Expediente de Empleado (RRHH)</h3>
          <p class="section-desc" style="font-size:12px; color:var(--muted,#64748b); margin:0 0 12px;">
            Puedes vincular esta cuenta a un expediente de empleado ya registrado en Recursos Humanos o dejarla sin vincular para crear su expediente más adelante.
          </p>
          <div class="form-grid">
            <div class="field full">
              <label>Vincular expediente existente (opcional)</label>
              <select name="employeeId" id="user-link-employee-select">
                <option value="">— No vincular ahora / Crear expediente después —</option>
                ${employeeOptions}
              </select>
              <span class="helper">
                ${availableEmployees.length
                  ? 'Solo se listan los expedientes de empleados que aún no tienen un usuario asignado. Al seleccionar uno, se autocompletarán los datos vacíos del formulario.'
                  : 'No hay expedientes sin usuario disponibles actualmente. Podrás crear un nuevo expediente en RRHH al guardar el usuario.'}
              </span>
            </div>
          </div>

          ${editUser ? (editUser.employeeId ? `
            <div class="panel" style="background:#f8fafc; border:1px solid #cbd5e1; padding:14px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; margin-top:12px;">
              <div>
                <strong style="color:var(--navy); font-size:13.5px;">Expediente vinculado: ${escapeHtml(editUser.employeeCode || `#${editUser.employeeId}`)} ${editUser.employeeName ? `· ${escapeHtml(editUser.employeeName)}` : ''}</strong>
                <p style="margin:3px 0 0; font-size:12px; color:var(--muted);">Este usuario está asociado a su ficha laboral en Recursos Humanos.</p>
              </div>
              <button type="button" class="row-action" data-hr-detail="employee" data-id="${editUser.employeeId}" style="background:#ffffff; font-weight:600;">Ver expediente →</button>
            </div>
          ` : `
            <div class="panel" style="background:#f0f9ff; border:1px solid #bae6fd; padding:14px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; margin-top:12px;">
              <div>
                <strong style="color:#0369a1; font-size:13.5px;">¿El empleado aún no tiene expediente en RRHH?</strong>
                <p style="margin:3px 0 0; font-size:12px; color:#0284c7;">Si no aparece en la lista superior, puedes abrir el formulario de RRHH con los datos de este usuario prellenados.</p>
              </div>
              <button type="button" class="primary" data-action="create-employee-for-user" data-user-id="${editUser.id}" style="padding:6px 14px; font-size:12px; white-space:nowrap;">Crear nuevo expediente →</button>
            </div>
          `) : ''}
        </div>

        <div class="form-actions">
          <button type="button" class="secondary" data-action="cancel-form">Cancelar</button>
          <button type="submit" class="primary">${editUser ? 'Guardar cambios' : 'Guardar usuario'}</button>
        </div>
      </form>
    </div>
  `;
}
