import { state } from '../../core/state.js';
import { escapeHtml, displayDate, badge } from '../../components/utils.js';

export function financeTransactionsView() {
  return `
    <div class="panel">
      <div class="panel-head">
        <div>
          <h2>Libro de Transacciones</h2>
          <p class="panel-note">Ingresos y egresos operacionales con auditoría de estado</p>
        </div>
        <button class="primary" data-action="new-expense">＋ Nueva transacción</button>
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
