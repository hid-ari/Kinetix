import { state } from '../../core/state.js';
import { escapeHtml } from '../../components/utils.js';
import { breadcrumb, pageHeader } from '../../components/ui.js';

export function branchForm() {
  return `
    ${breadcrumb([['dashboard', 'Administración'], ['branches', 'Sucursales'], ['branch-form', 'Nueva sucursal']])}
    ${pageHeader('Nueva sucursal', 'Registra una sede y asígnala a una empresa.')}
    <div class="panel form-layout">
      <form id="branch-form">
        <div class="form-section">
          <h3>Información general</h3>
          <div class="form-grid">
            <div class="field">
              <label>Empresa</label>
              <select name="companyId" required>
                ${state.companies.map(company => `<option value="${company.id}">${escapeHtml(company.name)}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label>Nombre</label>
              <input name="name" required placeholder="Ej. Central">
            </div>
            <div class="field">
              <label>Código</label>
              <input name="code" required placeholder="Ej. CEN-001">
            </div>
            <div class="field">
              <label>Encargado</label>
              <select name="managerUserId">
                <option value="">Sin encargado</option>
                ${state.users.map(u => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.name)}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
        <div class="form-section">
          <h3>Contacto</h3>
          <div class="form-grid">
            <div class="field">
              <label>Email</label>
              <input name="email" type="email">
            </div>
            <div class="field">
              <label>Teléfono</label>
              <input name="phone">
            </div>
            <div class="field full">
              <label>Dirección</label>
              <textarea name="address"></textarea>
            </div>
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="secondary" data-action="cancel-form">Cancelar</button>
          <button type="submit" class="primary">Guardar sucursal</button>
        </div>
      </form>
    </div>
  `;
}
