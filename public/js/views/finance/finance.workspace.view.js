import { state } from '../../core/state.js';
import { financeTransactionsView } from './transactions.view.js';
import { financeInvoicesView } from './invoices.view.js';
import { financeContactsView } from './contacts.view.js';
import { financeBankingView } from './banking.view.js';

export function financeWorkspace() {
  const tabs = [
    ['overview', 'Resumen'],
    ['transactions', 'Transacciones'],
    ['invoices', 'Facturas'],
    ['contacts', 'Clientes y Proveedores'],
    ['bank', 'Conciliación Bancaria']
  ];

  let body = '';

  if (state.financeTab === 'transactions') {
    body = financeTransactionsView();
  } else if (state.financeTab === 'invoices') {
    body = financeInvoicesView();
  } else if (state.financeTab === 'contacts') {
    body = financeContactsView();
  } else if (state.financeTab === 'bank') {
    body = financeBankingView();
  }

  return `
    <div class="finance-workspace">
      <div class="detail-tabs finance-tabs">
        ${tabs.map(([id, label]) => `
          <button class="${state.financeTab === id ? 'active' : ''}" data-finance-tab="${id}">
            ${label}
          </button>
        `).join('')}
      </div>
      ${body}
    </div>
  `;
}
