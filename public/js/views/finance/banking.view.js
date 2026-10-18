import { state } from '../../core/state.js';
import { escapeHtml, displayDate, badge } from '../../components/utils.js';

export function financeBankingView() {
  return `
    <div class="panel">
      <div class="panel-head">
        <div>
          <h2>Conciliación Bancaria</h2>
          <p class="panel-note">Verificación de extractos y movimientos en cuentas bancarias</p>
        </div>
        <button class="primary" data-action="new-bank">＋ Registrar movimiento</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Descripción</th>
              <th>Referencia</th>
              <th>Monto</th>
              <th>Estado</th>
              <th style="text-align:right;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${state.finance.bank.map(item => `
              <tr>
                <td><span style="font-variant-numeric:tabular-nums; color:var(--muted);">${displayDate(item.transactionDate)}</span></td>
                <td><strong>${escapeHtml(item.description)}</strong></td>
                <td><span class="folio-tag">${escapeHtml(item.reference || 'N/D')}</span></td>
                <td><strong style="font-size:14px; font-variant-numeric:tabular-nums; color:var(--navy);">$${Number(item.amount).toFixed(2)}</strong></td>
                <td>${badge(item.status)}</td>
                <td style="text-align:right;">
                  ${item.status !== 'Conciliada' ? `<button class="row-action" data-action="reconcile-bank" data-bank-id="${item.id}" style="color:#059669;">Conciliar</button>` : ''}
                </td>
              </tr>
            `).join('') || '<tr><td colspan="6" class="empty">No hay movimientos bancarios registrados.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
