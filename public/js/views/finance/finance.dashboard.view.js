import { state, hasPermission } from '../../core/state.js';
import { escapeHtml, badge } from '../../components/utils.js';
import { breadcrumb, pageHeader } from '../../components/ui.js';

export function finance() {
  const inventoryValue = state.products.reduce((sum, product) => sum + product.stock * product.price, 0);
  const income = state.finance.income || 0;
  const expense = state.finance.expense || 0;
  const balance = income - expense;

  return `
    ${breadcrumb([['dashboard', 'Espacio de trabajo'], ['finance', 'Finanzas']])}
    ${pageHeader('Finanzas', 'Controla ingresos, gastos, facturas y pagos de tu organización.', hasPermission('Finanzas', 'Registrar transacciones') ? '<button class="primary" data-action="new-expense">＋ Registrar gasto</button>' : '')}
    
    <div class="hr-stats-grid finance-stats" style="margin-bottom: 24px;">
      <div class="stat-card">
        <div class="stat-icon-wrapper blue">
          <svg viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clip-rule="evenodd"/></svg>
        </div>
        <div class="stat-content">
          <span class="stat-label">Valor del Inventario</span>
          <strong class="stat-value" style="font-size:22px;">$${inventoryValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong>
          <span class="stat-sub">Activo circulante en almacén</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper green">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clip-rule="evenodd"/></svg>
        </div>
        <div class="stat-content">
          <span class="stat-label">Ingresos del Mes</span>
          <strong class="stat-value" style="color:#059669; font-size:22px;">$${income.toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong>
          <span class="stat-sub">Transacciones aprobadas</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper amber">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M12 13a1 1 0 100 2h5a1 1 0 001-1V9a1 1 0 10-2 0v2.586l-4.293-4.293a1 1 0 00-1.414 0L8 9.586 3.707 5.293a1 1 0 00-1.414 1.414l5 5a1 1 0 001.414 0L11 9.414 14.586 13H12z" clip-rule="evenodd"/></svg>
        </div>
        <div class="stat-content">
          <span class="stat-label">Gastos del Mes</span>
          <strong class="stat-value" style="color:#e11d48; font-size:22px;">$${expense.toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong>
          <span class="stat-sub">Egresos operacionales</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper purple">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" clip-rule="evenodd"/></svg>
        </div>
        <div class="stat-content">
          <span class="stat-label">Resultado Neto</span>
          <strong class="stat-value" style="color: ${balance >= 0 ? '#059669' : '#e11d48'}; font-size:22px;">$${balance.toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong>
          <span class="stat-sub">Flujo neto consolidado</span>
        </div>
      </div>
    </div>

    <div class="grid-2">
      <div class="panel">
        <div class="panel-head">
          <div>
            <h2>Últimas Transacciones</h2>
            <p class="panel-note">Movimientos financieros recientes en cuenta</p>
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
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${state.finance.transactions.slice(0, 6).map(item => `
                <tr>
                  <td><span class="tag-neutral">${escapeHtml(item.type)}</span></td>
                  <td><strong>${escapeHtml(item.category)}</strong></td>
                  <td>
                    <strong style="color: ${item.type === 'Ingreso' ? '#059669' : '#e11d48'}; font-variant-numeric:tabular-nums;">
                      ${item.type === 'Ingreso' ? '+' : '-'}$${Number(item.amount).toFixed(2)}
                    </strong>
                  </td>
                  <td>${badge(item.status)}</td>
                </tr>
              `).join('') || '<tr><td colspan="4" class="empty">No hay transacciones financieras registradas.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <div>
            <h2>Facturas y Cartera Comercial</h2>
            <p class="panel-note">Gestión de cobros, pagos y contactos</p>
          </div>
          <span class="panel-note">${state.finance.invoices.length} facturas · ${state.finance.contacts.length} contactos</span>
        </div>
        <div class="panel-body">
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:18px; margin-bottom:16px;">
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:10px;">
              <div style="width:38px; height:38px; border-radius:10px; background:#eff6ff; color:#2563eb; display:grid; place-items:center;">
                <svg viewBox="0 0 20 20" fill="currentColor" style="width:18px;height:18px;"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd"/></svg>
              </div>
              <div>
                <strong style="color:var(--navy); font-size:14px;">Emisión Fiscal y Cobranzas</strong>
                <p class="subtitle" style="margin:2px 0 0; font-size:12px;">Comprobantes fiscales NCF y control de vencimientos</p>
              </div>
            </div>
            <p style="font-size:12.5px; color:#475569; margin:0; line-height:1.5;">
              Centraliza proveedores para facturación de gastos operativos y gestiona facturas a clientes con trazabilidad directa hacia conciliación bancaria.
            </p>
          </div>
          <div class="inline-actions">
            ${hasPermission('Finanzas', 'Registrar transacciones') ? `
              <button class="primary" data-action="new-contact">＋ Agregar cliente o proveedor</button>
              <button class="secondary" data-action="new-invoice">＋ Nueva factura</button>
            ` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}
