import { state } from '../../core/state.js';
import { escapeHtml, initials } from '../../components/utils.js';

export function financeContactsView() {
  return `
    <div class="panel">
      <div class="panel-head">
        <div>
          <h2>Directorio Comercial</h2>
          <p class="panel-note">Clientes y proveedores para transacciones comerciales</p>
        </div>
        <button class="primary" data-action="new-contact">＋ Nuevo contacto</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Nombre</th>
              <th>RNC / Cédula</th>
              <th>Email</th>
              <th>Teléfono</th>
            </tr>
          </thead>
          <tbody>
            ${state.finance.contacts.map(item => {
              const cInitials = initials(item.name || 'Contacto');
              return `
                <tr>
                  <td><span class="tag-neutral">${escapeHtml(item.type)}</span></td>
                  <td>
                    <div class="emp-cell-flex">
                      <div class="emp-avatar-sm" style="width:30px;height:30px;font-size:11px;">${escapeHtml(cInitials)}</div>
                      <div class="emp-cell-info">
                        <strong>${escapeHtml(item.name)}</strong>
                      </div>
                    </div>
                  </td>
                  <td><span class="folio-tag">${escapeHtml(item.taxId || 'N/D')}</span></td>
                  <td><small style="color:var(--muted); font-size:12px;">${escapeHtml(item.email || 'N/D')}</small></td>
                  <td><span style="font-size:12px; font-variant-numeric:tabular-nums;">${escapeHtml(item.phone || 'N/D')}</span></td>
                </tr>
              `;
            }).join('') || '<tr><td colspan="5" class="empty">No hay clientes o proveedores registrados.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
