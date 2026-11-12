import { state, hasPermission } from '../../core/state.js';
import { escapeHtml, displayDate, badge } from '../../components/utils.js';
import { breadcrumb, pageHeader } from '../../components/ui.js';

export function financeTransactionsView() {
  const canCreate = hasPermission('Finanzas', 'Registrar transacciones');
  return `
    ${breadcrumb([['finance', 'Finanzas'], ['finance-transactions', 'Transacciones']])}
    ${pageHeader('Libro de Transacciones', 'Ingresos y egresos operacionales con auditoría de estado y balance contable.', canCreate ? '<button class="primary" data-action="new-expense">＋ Nueva transacción</button>' : '')}

    <div class="panel">
      <div class="panel-head">
        <div>
          <h2>Movimientos Registrados</h2>
          <p class="panel-note">Control detallado de flujo monetario</p>
        </div>
        <span class="panel-note">${state.finance.transactions.length} registros</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Categoría</th>
              <th>Monto</th>
              <th>Vencimiento</th>
              <th>Estado</th>
              <th style="text-align:right;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${state.finance.transactions.map(item => `
              <tr>
                <td><span class="tag-neutral">${escapeHtml(item.type)}</span></td>
                <td><strong>${escapeHtml(item.category)}</strong></td>
                <td>
                  <strong style="color: ${item.type === 'Ingreso' ? '#059669' : '#e11d48'}; font-variant-numeric:tabular-nums; font-size:13.5px;">
                    ${item.type === 'Ingreso' ? '+' : '-'}$${Number(item.amount).toFixed(2)}
                  </strong>
                </td>
                <td><span style="font-variant-numeric:tabular-nums; color:var(--muted);">${displayDate(item.dueDate)}</span></td>
                <td>${badge(item.status)}</td>
                <td style="text-align:right;">
                  ${item.status === 'Pendiente' ? `<button class="row-action" data-action="finance-status" data-finance-id="${item.id}" data-finance-status="Aprobada" style="color:#059669;">Aprobar</button>` : ''}
                  ${item.status !== 'Revertida' ? `<button class="row-action" data-action="finance-status" data-finance-id="${item.id}" data-finance-status="Revertida" style="color:#e11d48;">Revertir</button>` : ''}
                </td>
              </tr>
            `).join('') || '<tr><td colspan="6" class="empty">No hay transacciones registradas.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
