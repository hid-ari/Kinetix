import { state, hasPermission } from '../../core/state.js';
import { escapeHtml, badge } from '../../components/utils.js';
import { breadcrumb, pageHeader } from '../../components/ui.js';

export function inventoryStats() {
  const lowStock = state.products.filter(product => product.stock <= product.minimum);
  const totalUnits = state.products.reduce((sum, product) => sum + product.stock, 0);
  const totalValue = state.products.reduce((sum, product) => sum + product.stock * product.price, 0);

  return `
    <div class="hr-stats-grid inventory-stats" style="margin-bottom: 24px;">
      <div class="stat-card">
        <div class="stat-icon-wrapper blue">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 2a1 1 0 00-.707.293l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7A1 1 0 0010 2z" clip-rule="evenodd"/></svg>
        </div>
        <div class="stat-content">
          <span class="stat-label">Productos Activos</span>
          <strong class="stat-value">${state.products.length}</strong>
          <span class="stat-sub">Catálogo actual registrado</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper green">
          <svg viewBox="0 0 20 20" fill="currentColor"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"/></svg>
        </div>
        <div class="stat-content">
          <span class="stat-label">Unidades en Stock</span>
          <strong class="stat-value">${totalUnits.toLocaleString()}</strong>
          <span class="stat-sub">En todos los almacenes</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper amber">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
        </div>
        <div class="stat-content">
          <span class="stat-label">Alertas de Stock</span>
          <strong class="stat-value" style="color: ${lowStock.length > 0 ? '#d97706' : '#0f172a'}">${lowStock.length}</strong>
          <span class="stat-sub">Bajo el umbral mínimo</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper purple">
          <svg viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clip-rule="evenodd"/></svg>
        </div>
        <div class="stat-content">
          <span class="stat-label">Valor Inventario</span>
          <strong class="stat-value" style="font-size:22px;">$${totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong>
          <span class="stat-sub">Costo acumulado estimado</span>
        </div>
      </div>
    </div>
  `;
}

export function inventory() {
  const lowStock = state.products.filter(product => product.stock <= product.minimum);
  return `
    ${breadcrumb([['dashboard', 'Espacio de trabajo'], ['inventory', 'Inventario']])}
    ${pageHeader('Inventario', 'Control operativo de productos, existencias y movimientos.', hasPermission('Movimientos', 'Registrar movimientos') ? '<button class="primary" data-nav="movements">＋ Registrar movimiento</button>' : '')}
    ${inventoryStats()}
    <div class="grid-2">
      <div class="panel">
        <div class="panel-head">
          <div>
            <h2>Existencias Críticas</h2>
            <p class="panel-note">Productos bajo el nivel mínimo de reposición</p>
          </div>
          <button class="row-action" data-nav="alerts">Ver todas las alertas →</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Stock</th>
                <th>Mínimo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${lowStock.map(product => `
                <tr>
                  <td>
                    <strong>${escapeHtml(product.name)}</strong>
                    <div style="margin-top:2px;">
                      <span class="folio-tag">#${escapeHtml(product.sku || product.id)}</span>
                    </div>
                  </td>
                  <td><strong>${product.stock}</strong> <small style="color:var(--muted)">${product.unit}</small></td>
                  <td>${product.minimum}</td>
                  <td>${badge('Reponer')}</td>
                </tr>
              `).join('') || '<tr><td colspan="4" class="empty">No hay existencias críticas. Todos los productos sobre el nivel mínimo.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head">
          <div>
            <h2>Últimos Movimientos</h2>
            <p class="panel-note">Actividad reciente de almacén y despachos</p>
          </div>
          <button class="row-action" data-nav="movements">Ver todos →</button>
        </div>
        <div class="panel-body activity">
          ${state.movements.slice(0, 4).map(movement => `
            <div class="activity-item">
              <span class="activity-bullet ${movement.type === 'Salida' ? 'movement-out' : ''}" style="${movement.type === 'Salida' ? 'background:#e11d48; box-shadow:0 0 6px rgba(225,29,72,.4);' : 'background:#059669; box-shadow:0 0 6px rgba(5,150,105,.4);'}"></span>
              <div style="flex:1;">
                <p>
                  <strong>${movement.type === 'Entrada' ? '+ ' : '- '}${movement.quantity}</strong> 
                  · <strong>${escapeHtml(movement.product)}</strong>
                  <span style="float:right;">${badge(movement.type)}</span>
                </p>
                <small>${movement.warehouse} · ${movement.date}</small>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}
