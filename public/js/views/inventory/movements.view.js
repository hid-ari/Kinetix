import { state } from '../../core/state.js';
import { escapeHtml, badge, initials } from '../../components/utils.js';
import { breadcrumb, pageHeader } from '../../components/ui.js';

export function movements() {
  const totalEntradas = state.movements.filter(m => m.type === 'Entrada').reduce((sum, m) => sum + m.quantity, 0);
  const totalSalidas = state.movements.filter(m => m.type === 'Salida').reduce((sum, m) => sum + m.quantity, 0);
  const totalProducts = state.products.reduce((sum, p) => sum + p.stock, 0);
  const isEntrada = state.movementType === 'Entrada';
  
  return `
    ${breadcrumb([['inventory', 'Inventario'], ['movements', 'Entradas / salidas']])}
    ${pageHeader('Entradas y Salidas de Almacén', 'Gestión interactiva de movimientos de inventario con trazabilidad inmediata.')}
    
    <div class="hr-stats-grid" style="margin-bottom:24px;">
      <div class="stat-card">
        <div class="stat-icon-wrapper green">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clip-rule="evenodd"/></svg>
        </div>
        <div class="stat-content">
          <span class="stat-label">Total Entradas</span>
          <strong class="stat-value" style="color:#059669;">+${totalEntradas.toLocaleString()}</strong>
          <span class="stat-sub">Unidades ingresadas</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper amber">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-7.414l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 10.586V14a1 1 0 102 0v-3.414z" clip-rule="evenodd"/></svg>
        </div>
        <div class="stat-content">
          <span class="stat-label">Total Salidas</span>
          <strong class="stat-value" style="color:#e11d48;">-${totalSalidas.toLocaleString()}</strong>
          <span class="stat-sub">Unidades despachadas</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper blue">
          <svg viewBox="0 0 20 20" fill="currentColor"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"/></svg>
        </div>
        <div class="stat-content">
          <span class="stat-label">Stock Disponible</span>
          <strong class="stat-value">${totalProducts.toLocaleString()}</strong>
          <span class="stat-sub">Total global en catálogo</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper purple">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>
        </div>
        <div class="stat-content">
          <span class="stat-label">Movimientos</span>
          <strong class="stat-value">${state.movements.length}</strong>
          <span class="stat-sub">Registros auditables</span>
        </div>
      </div>
    </div>

    <div class="panel movement-form-panel" style="margin-bottom:24px;">
      <div class="panel-head">
        <div>
          <h2>Registrar Nuevo Movimiento</h2>
          <p class="panel-note">Selecciona el tipo de operación para actualizar las existencias en tiempo real.</p>
        </div>
      </div>
      <div class="panel-body">
        <div class="movement-type-selector">
          <button type="button" class="movement-type-card ${isEntrada ? 'active-entrada' : ''}" data-movement-type="Entrada">
            <div class="movement-icon-box">
              <svg viewBox="0 0 20 20" fill="currentColor" style="width:20px;height:20px;"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
            </div>
            <div>
              <strong>Entrada de inventario</strong>
              <small>Reabastecimiento, compras a proveedores o devoluciones.</small>
            </div>
          </button>
          <button type="button" class="movement-type-card ${!isEntrada ? 'active-salida' : ''}" data-movement-type="Salida">
            <div class="movement-icon-box">
              <svg viewBox="0 0 20 20" fill="currentColor" style="width:20px;height:20px;"><path fill-rule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>
            </div>
            <div>
              <strong>Salida de inventario</strong>
              <small>Ventas a clientes, transferencias o bajas operativas.</small>
            </div>
          </button>
        </div>

        <form id="movement-form" class="movement-form">
          <div class="movement-form-grid">
            <div class="field">
              <label>Producto a afectar</label>
              <select name="productId" required>
                ${state.products.map(product => `<option value="${product.id}">${escapeHtml(product.name)} (${escapeHtml(product.sku)}) · ${product.stock} ${escapeHtml(product.unit)} disponibles</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label>Sucursal / Almacén</label>
              <select name="branchId" required>
                ${state.branches.map(branch => `<option value="${branch.id}">${escapeHtml(branch.name)}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label>Cantidad de unidades</label>
              <input name="quantity" type="number" min="1" required placeholder="Ej. 10">
            </div>
            <div>
              <button class="movement-submit-btn ${isEntrada ? 'entry' : 'exit'}" type="submit">
                ${isEntrada ? 'Confirmar Entrada' : 'Confirmar Salida'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <div>
          <h2>Historial Trazable de Movimientos</h2>
          <p class="panel-note">Registro cronológico detallado con usuario responsable y almacén de origen/destino</p>
        </div>
        <span class="panel-note">${state.movements.length} movimientos</span>
      </div>
      <div class="table-toolbar">
        <div class="filter-row">
          <input id="page-search" placeholder="Buscar por producto, almacén o usuario..." value="${escapeHtml(state.query)}" style="min-width:280px;">
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Folio</th>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>Almacén</th>
              <th>Usuario Responsable</th>
            </tr>
          </thead>
          <tbody>
            ${state.movements.filter(m => `${m.product} ${m.warehouse} ${m.user} ${m.type}`.toLowerCase().includes(state.query.toLowerCase())).map(movement => {
              const uInitials = initials(movement.user || 'Admin');
              return `
                <tr>
                  <td><span class="folio-tag">#${movement.id}</span></td>
                  <td><span style="font-variant-numeric:tabular-nums; color:var(--muted);">${movement.date}</span></td>
                  <td>${badge(movement.type)}</td>
                  <td><strong>${escapeHtml(movement.product)}</strong></td>
                  <td>
                    <strong style="color: ${movement.type === 'Entrada' ? '#059669' : '#e11d48'}; font-variant-numeric:tabular-nums; font-size:13.5px;">
                      ${movement.type === 'Entrada' ? '+' : '-'}${movement.quantity}
                    </strong>
                  </td>
                  <td>${escapeHtml(movement.warehouse)}</td>
                  <td>
                    <div class="emp-cell-flex">
                      <div class="emp-avatar-sm" style="width:28px;height:28px;font-size:10px;">${escapeHtml(uInitials)}</div>
                      <div class="emp-cell-info">
                        <strong style="font-size:12.5px;">${escapeHtml(movement.user)}</strong>
                      </div>
                    </div>
                  </td>
                </tr>
              `;
            }).join('') || '<tr><td colspan="7" class="empty">No hay registros de movimientos en esta consulta.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
