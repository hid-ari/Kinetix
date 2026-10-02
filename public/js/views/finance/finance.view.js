import { state } from '../../core/state.js';
import { escapeHtml, displayDate, badge } from '../../components/utils.js';
import { breadcrumb, pageHeader } from '../../components/ui.js';

export function finance() {
  const inventoryValue = state.products.reduce((sum, product) => sum + product.stock * product.price, 0);
  const income = state.finance.income || 0;
  const expense = state.finance.expense || 0;
  return `${breadcrumb([['dashboard', 'Espacio de trabajo'], ['finance', 'Finanzas']])}
  ${pageHeader('Finanzas', 'Controla ingresos, gastos, facturas y pagos de tu organización.', '<button class="primary" data-action="new-expense">＋ Registrar gasto</button>')}
  <div class="stats finance-stats">
    <div class="stat"><span class="stat-label">Valor del inventario</span><div class="stat-value">$${inventoryValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div><span class="stat-meta">Desde Inventario</span></div>
    <div class="stat"><span class="stat-label">Ingresos del mes</span><div class="stat-value">$${income.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div><span class="stat-meta">Transacciones aprobadas</span></div>
    <div class="stat"><span class="stat-label">Gastos del mes</span><div class="stat-value">$${expense.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div><span class="stat-meta">Transacciones registradas</span></div>
    <div class="stat"><span class="stat-label">Resultado del mes</span><div class="stat-value">$${(income - expense).toLocaleString('en-US', { maximumFractionDigits: 0 })}</div><span class="stat-meta">Ingresos menos gastos</span></div>
  </div>
  <div class="grid-2">
    <div class="panel">
      <div class="panel-head"><h2>Últimas transacciones</h2><span class="panel-note">${state.finance.transactions.length} registros</span></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Tipo</th><th>Categoría</th><th>Monto</th><th>Estado</th></tr></thead>
          <tbody>
            ${state.finance.transactions.slice(0, 6).map(item => `<tr><td>${escapeHtml(item.type)}</td><td>${escapeHtml(item.category)}</td><td>$${Number(item.amount).toFixed(2)}</td><td><span class="badge ${item.status === 'Revertida' ? 'inactive' : 'pending'}">${escapeHtml(item.status)}</span></td></tr>`).join('') || '<tr><td colspan="4" class="empty">No hay transacciones financieras.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
    <div class="panel">
      <div class="panel-head"><h2>Facturas y contactos</h2><span class="panel-note">${state.finance.invoices.length} facturas · ${state.finance.contacts.length} contactos</span></div>
      <div class="panel-body">
        <p class="subtitle">Clientes, proveedores y documentos quedan preparados para cuentas por cobrar y pagar.</p>
        <button class="row-action" data-action="new-contact">＋ Agregar cliente o proveedor</button>
      </div>
    </div>
  </div>`;
}

export function financeWorkspace() {
  const tabs = [['overview', 'Resumen'], ['transactions', 'Transacciones'], ['invoices', 'Facturas'], ['contacts', 'Clientes y proveedores'], ['bank', 'Conciliación bancaria']];
  let body = '';
  if (state.financeTab === 'transactions') {
    body = `<div class="panel">
      <div class="panel-head"><h2>Transacciones</h2><button class="primary" data-action="new-expense">＋ Nueva transacción</button></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Tipo</th><th>Categoría</th><th>Monto</th><th>Vencimiento</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            ${state.finance.transactions.map(item => `<tr><td>${escapeHtml(item.type)}</td><td>${escapeHtml(item.category)}</td><td>$${Number(item.amount).toFixed(2)}</td><td>${displayDate(item.dueDate)}</td><td><span class="badge pending">${escapeHtml(item.status)}</span></td><td>${item.status === 'Pendiente' ? `<button class="row-action" data-action="finance-status" data-finance-id="${item.id}" data-finance-status="Aprobada">Aprobar</button>` : ''}${item.status !== 'Revertida' ? `<button class="row-action" data-action="finance-status" data-finance-id="${item.id}" data-finance-status="Revertida">Revertir</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">No hay transacciones.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
  }
  if (state.financeTab === 'invoices') {
    body = `<div class="panel">
      <div class="panel-head"><h2>Facturas</h2><button class="primary" data-action="new-invoice">＋ Nueva factura</button></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Número</th><th>NCF</th><th>Tipo</th><th>Contacto</th><th>Total</th><th>Vencimiento</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            ${state.finance.invoices.map(item => `<tr><td><strong>${escapeHtml(item.number)}</strong></td><td>${escapeHtml(item.ncf || 'N/D')}</td><td>${escapeHtml(item.type)}</td><td>${escapeHtml(item.contact || 'Sin contacto')}</td><td>$${Number(item.total).toFixed(2)}</td><td>${displayDate(item.dueDate)}</td><td><span class="badge pending">${escapeHtml(item.status)}</span></td><td><button class="row-action" data-action="new-payment" data-invoice-id="${item.id}">Registrar pago</button></td></tr>`).join('') || '<tr><td colspan="8" class="empty">No hay facturas.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
  }
  if (state.financeTab === 'contacts') {
    body = `<div class="panel">
      <div class="panel-head"><h2>Clientes y proveedores</h2><button class="primary" data-action="new-contact">＋ Nuevo contacto</button></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Tipo</th><th>Nombre</th><th>Identificación</th><th>Email</th><th>Teléfono</th></tr></thead>
          <tbody>
            ${state.finance.contacts.map(item => `<tr><td>${escapeHtml(item.type)}</td><td><strong>${escapeHtml(item.name)}</strong></td><td>${escapeHtml(item.taxId || 'N/D')}</td><td>${escapeHtml(item.email || 'N/D')}</td><td>${escapeHtml(item.phone || 'N/D')}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No hay contactos.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
  }
  if (state.financeTab === 'bank') {
    body = `<div class="panel">
      <div class="panel-head"><h2>Conciliación bancaria</h2><button class="primary" data-action="new-bank">＋ Registrar movimiento</button></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Fecha</th><th>Descripción</th><th>Referencia</th><th>Monto</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            ${state.finance.bank.map(item => `<tr><td>${displayDate(item.transactionDate)}</td><td>${escapeHtml(item.description)}</td><td>${escapeHtml(item.reference || 'N/D')}</td><td>$${Number(item.amount).toFixed(2)}</td><td><span class="badge ${item.status === 'Conciliada' ? 'active' : 'pending'}">${escapeHtml(item.status)}</span></td><td>${item.status !== 'Conciliada' ? `<button class="row-action" data-action="reconcile-bank" data-bank-id="${item.id}">Conciliar</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">No hay movimientos bancarios.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
  }
  return `<div class="finance-workspace"><div class="detail-tabs finance-tabs">${tabs.map(([id, label]) => `<button class="${state.financeTab === id ? 'active' : ''}" data-finance-tab="${id}">${label}</button>`).join('')}</div>${body}</div>`;
}
