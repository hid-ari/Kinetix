import { state } from '../../core/state.js';
import { escapeHtml } from '../../components/utils.js';
import { breadcrumb, pageHeader } from '../../components/ui.js';

/** Formulario de sucursal: crea una nueva o edita `state.branchEditId`. */
export function branchForm() {
  const editing = state.branchEditId != null;
  const branch = editing ? state.branches.find(b => b.id === state.branchEditId) : null;
  if (editing && !branch) return '<div class="empty">Sucursal no encontrada.</div>';

  const title = editing ? 'Editar sucursal' : 'Nueva sucursal';
  const value = field => escapeHtml(branch?.[field] ?? '');
  const selectedCompany = branch ? branch.companyId : state.companies[0]?.id;
  const managers = [...state.branchManagers];
  // Si el encargado actual ya no figura como candidato (p. ej. usuario inactivo), se conserva visible
  if (branch?.managerUserId && !managers.some(u => u.id === branch.managerUserId)) {
    managers.unshift({ id: branch.managerUserId, name: `${branch.manager} (inactivo)` });
  }

  return `
    ${breadcrumb([['branches', 'Sucursales'], ['branch-form', title]])}
    ${pageHeader(title, editing ? 'Actualiza los datos operativos de la sucursal.' : 'Registra una nueva sede operativa.')}
    <div class="panel form-layout">
      <form id="branch-form">
        <input type="hidden" name="companyId" value="${escapeHtml(selectedCompany || state.currentUser?.companyId || 1)}">
        <div class="form-section">
          <h3>Información general</h3>
          <div class="form-grid">
            <div class="field">
              <label for="branch-name">Nombre</label>
              <input id="branch-name" name="name" required maxlength="150" placeholder="Ej. Central" value="${value('name')}">
            </div>
            <div class="field">
              <label for="branch-code">Código</label>
              <input id="branch-code" name="code" required maxlength="30" placeholder="Ej. CEN-001" value="${value('code')}">
            </div>
            <div class="field">
              <label for="branch-manager">Encargado</label>
              <select id="branch-manager" name="managerUserId">
                <option value="">Sin encargado</option>
                ${managers.map(u => `<option value="${escapeHtml(u.id)}" ${u.id === branch?.managerUserId ? 'selected' : ''}>${escapeHtml(u.name)}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
        <div class="form-section">
          <h3>Contacto</h3>
          <div class="form-grid">
            <div class="field">
              <label for="branch-email">Email</label>
              <input id="branch-email" name="email" type="email" maxlength="254" value="${value('email')}">
            </div>
            <div class="field">
              <label for="branch-phone">Teléfono</label>
              <input id="branch-phone" name="phone" maxlength="30" value="${value('phone')}">
            </div>
            <div class="field full">
              <label for="branch-address">Dirección</label>
              <textarea id="branch-address" name="address" maxlength="300">${value('address')}</textarea>
            </div>
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="secondary" data-action="cancel-form">Cancelar</button>
          <button type="submit" class="primary">${editing ? 'Guardar cambios' : 'Guardar sucursal'}</button>
        </div>
      </form>
    </div>
  `;
}
