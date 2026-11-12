import { state, hasPermission } from '../../core/state.js';
import { escapeHtml, displayDate, badge } from '../../components/utils.js';
import { breadcrumb, pageHeader } from '../../components/ui.js';

export function financeBankingView() {
  const canCreate = hasPermission('Finanzas', 'Registrar transacciones');
  return `
    ${breadcrumb([['finance', 'Finanzas'], ['finance-banking', 'Conciliación Bancaria']])}
    ${pageHeader('Conciliación Bancaria', 'Verificación de extractos y movimientos en cuentas bancarias registradas.', canCreate ? '<button class="primary" data-action="new-bank">＋ Registrar movimiento</button>' : '')}

    <div class="panel">
      <div class="panel-head">
        <div>
          <h2>Extractos y Movimientos</h2>
          <p class="panel-note">Trazabilidad de fondos y balances</p>
        </div>
        <span class="panel-note">${state.finance.bank.length} movimientos</span>
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
