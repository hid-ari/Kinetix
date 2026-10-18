import { state } from '../../core/state.js';
import { escapeHtml, displayDate, badge, initials } from '../../components/utils.js';

export function financeInvoicesView() {
  return `
    <div class="panel">
      <div class="panel-head">
        <div>
          <h2>Facturación y Documentos Fiscales</h2>
          <p class="panel-note">Cuentas por cobrar y cuentas por pagar con NCF</p>
        </div>
        <button class="primary" data-action="new-invoice">＋ Nueva factura</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Número</th>
              <th>NCF</th>
              <th>Tipo</th>
              <th>Contacto</th>
              <th>Total</th>
              <th>Vencimiento</th>
              <th>Estado</th>
              <th style="text-align:right;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${state.finance.invoices.map(item => {
              const cInitials = initials(item.contact || 'Cliente');
              return `
                <tr>
                  <td><span class="folio-tag">#${escapeHtml(item.number)}</span></td>
                  <td><span style="font-family:monospace; font-weight:700; color:var(--muted); font-size:11.5px;">${escapeHtml(item.ncf || 'N/D')}</span></td>
                  <td><span class="tag-neutral">${escapeHtml(item.type)}</span></td>
                  <td>
                    <div class="emp-cell-flex">
                      <div class="emp-avatar-sm" style="width:28px;height:28px;font-size:10px;">${escapeHtml(cInitials)}</div>
                      <div class="emp-cell-info">
                        <strong style="font-size:12.5px;">${escapeHtml(item.contact || 'Sin contacto')}</strong>
                      </div>
                    </div>
                  </td>
                  <td><strong style="font-size:14px; font-variant-numeric:tabular-nums; color:var(--navy);">$${Number(item.total).toFixed(2)}</strong></td>
                  <td><span style="font-variant-numeric:tabular-nums; color:var(--muted);">${displayDate(item.dueDate)}</span></td>
                  <td>${badge(item.status)}</td>
                  <td style="text-align:right;">
                    <button class="row-action" data-action="new-payment" data-invoice-id="${item.id}">Registrar pago</button>
                  </td>
                </tr>
              `;
            }).join('') || '<tr><td colspan="8" class="empty">No hay facturas registradas en el sistema.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
