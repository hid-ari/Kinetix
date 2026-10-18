import { state } from '../../core/state.js';
import { escapeHtml } from '../../components/utils.js';
import { breadcrumb, pageHeader } from '../../components/ui.js';

export function form(type) {
  const isUser = type === 'user';
  const title = isUser ? 'Nuevo usuario' : 'Nueva empresa';
  const desc = isUser ? 'Crea una identidad y define su alcance dentro de la organización.' : 'Registra una nueva organización para administrar sus accesos.';
  const companyOptions = state.companies.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('');
  const branchOptions = state.branches.map(b => `<option value="${escapeHtml(b.name)}">${escapeHtml(b.name)} · ${escapeHtml(b.company)}</option>`).join('');
  const isSuperAdmin = state.currentUser?.role === 'Super Admin';
  const rolesList = state.roles.length ? state.roles : [
    { name: 'Company Admin' },
    { name: 'Employee' },
    ...(isSuperAdmin ? [{ name: 'Super Admin' }] : [])
  ];
  const roleOptions = rolesList
    .filter(r => isSuperAdmin || r.name !== 'Super Admin')
    .map(r => {
      const displayName = r.name === 'Company Admin' ? 'Administrador de Empresa' : r.name === 'Employee' ? 'Empleado' : r.name;
      return `<option value="${escapeHtml(r.name)}">${escapeHtml(displayName)}</option>`;
    })
    .join('');
  return `
    ${breadcrumb([[isUser ? 'users' : 'companies', 'Administración'], [isUser ? 'users' : 'companies', isUser ? 'Usuarios' : 'Empresas'], [state.view, title]])}
    ${pageHeader(title, desc)}
    <div class="panel form-layout">
      <form id="entity-form">
        <div class="form-section">
          <h3>${isUser ? 'Información personal' : 'Información general'}</h3>
          <div class="form-grid">
            ${isUser ? `
              <div class="field"><label>Nombre</label><input required name="firstName" placeholder="Ej. Juan"></div>
              <div class="field"><label>Apellido</label><input required name="lastName" placeholder="Ej. Pérez"></div>
            ` : `
              <div class="field"><label>Nombre de empresa</label><input required name="name" placeholder="Ej. Grupo Altura"></div>
              <div class="field"><label>RNC</label><input required name="rnc" placeholder="1-01-00000-0" pattern="[0-9]{9}|[0-9]{11}" title="RNC de 9 u 11 dígitos"></div>
            `}
          </div>
        </div>
        <div class="form-section">
          <h3>${isUser ? 'Contacto y organización' : 'Contacto'}</h3>
          <div class="form-grid">
            <div class="field"><label>Email</label><input required type="email" name="email" placeholder="correo@empresa.com"></div>
            <div class="field"><label>Teléfono</label><input name="phone" placeholder="+1 809 000 0000"></div>
            ${isUser ? `
              <div class="field"><label>Empresa</label><select name="company">${companyOptions || '<option value="">Sin empresas disponibles</option>'}</select></div>
              <div class="field"><label>Sucursal</label><select name="branch"><option value="">Sin sucursal</option>${branchOptions}</select><span class="helper">Solo se muestran sucursales registradas.</span></div>
            ` : `
              <div class="field full"><label>Dirección</label><textarea name="address" placeholder="Dirección fiscal"></textarea></div>
            `}
          </div>
        </div>
        <div class="form-section">
          <h3>${isUser ? 'Acceso' : 'Estado'}</h3>
          <div class="form-grid">
            ${isUser ? `
              <div class="field"><label>Rol</label><select name="role">${roleOptions}</select></div>
              <div class="field"><label>Contraseña temporal</label><input required type="password" name="password" placeholder="Mínimo 10 caracteres" minlength="10"></div>
            ` : `
              <div class="field"><label>Estado</label><select name="status"><option>Activa</option><option>Inactiva</option></select></div>
            `}
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="secondary" data-action="cancel-form">Cancelar</button>
          <button type="submit" class="primary">Guardar ${isUser ? 'usuario' : 'empresa'}</button>
        </div>
      </form>
    </div>
  `;
}
