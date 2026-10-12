import { state } from '../../core/state.js';
import { escapeHtml, badge, initials } from '../../components/utils.js';
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
    ${pageHeader('Inventario', 'Control operativo de productos, existencias y movimientos.', '<button class="primary" data-nav="movements">＋ Registrar movimiento</button>')}
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

export function products() {
  const items = state.products.filter(product => `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(state.query.toLowerCase()));
  const categories = Array.from(new Set(state.products.map(p => p.category).filter(Boolean)));
  return `
    ${breadcrumb([['inventory', 'Inventario'], ['products', 'Productos']])}
    ${pageHeader('Productos', 'Catálogo maestro, especificaciones y reglas de reposición.', '<button class="primary" data-action="new-product">＋ Nuevo producto</button>')}
    <div class="panel">
      <div class="table-toolbar">
        <div class="filter-row">
          <input id="page-search" placeholder="Buscar producto o SKU..." value="${escapeHtml(state.query)}" style="min-width:240px;">
          <select>
            <option value="">Todas las categorías</option>
            ${categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
          </select>
        </div>
        <span class="panel-note">${items.length} productos registrados</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>SKU</th>
              <th>Categoría</th>
              <th>Unidad</th>
              <th>Stock Actual</th>
              <th>Mínimo</th>
              <th>Costo Unitario</th>
              <th style="text-align:right;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(product => `
              <tr>
                <td>
                  <strong>${escapeHtml(product.name)}</strong>
                </td>
                <td>
                  <span class="folio-tag">#${escapeHtml(product.sku)}</span>
                </td>
                <td>
                  <span class="tag-neutral">${escapeHtml(product.category || 'General')}</span>
                </td>
                <td><small style="color:var(--muted); font-weight:600;">${escapeHtml(product.unit)}</small></td>
                <td>
                  <strong style="color: ${product.stock <= product.minimum ? '#e11d48' : '#0f172a'}; font-variant-numeric: tabular-nums;">${product.stock}</strong>
                </td>
                <td><span style="font-variant-numeric: tabular-nums; color:var(--muted);">${product.minimum}</span></td>
                <td>
                  <span style="font-weight:700; color:var(--navy); font-variant-numeric: tabular-nums;">$${product.price.toFixed(2)}</span>
                </td>
                <td style="text-align:right;">
                  <button class="row-action" data-action="edit-product" data-product-id="${product.id}">Editar</button>
                  <button class="row-action" data-action="toggle-product" data-product-id="${product.id}" style="color:#64748b;">Desactivar</button>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="8" class="empty">No encontramos productos con los criterios de búsqueda.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function stock() {
  const branches = state.branches;
  const branchHeaders = branches.map(branch => `<th>${escapeHtml(branch.name)}</th>`).join('');
  const items = state.products.filter(product => `${product.name} ${product.sku}`.toLowerCase().includes(state.query.toLowerCase()));
  return `
    ${breadcrumb([['inventory', 'Inventario'], ['stock', 'Existencias']])}
    ${pageHeader('Existencias', 'Consulta el stock disponible por producto y distribución en sucursales.', '<button class="secondary" data-nav="alerts">Ver alertas de stock</button>')}
    <div class="panel">
      <div class="table-toolbar">
        <div class="filter-row">
          <input id="page-search" placeholder="Buscar en existencias por nombre o SKU..." value="${escapeHtml(state.query)}" style="min-width:280px;">
        </div>
        <span class="panel-note">Datos actualizados en tiempo real</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>SKU</th>
              ${branchHeaders}
              <th>Stock Total</th>
              <th>Nivel Mínimo</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(product => {
              const locations = state.stock.filter(item => item.productId === product.id);
              const total = locations.reduce((sum, item) => sum + item.quantity, 0);
              const isLow = total <= product.minimum;
              return `
                <tr>
                  <td><strong>${escapeHtml(product.name)}</strong></td>
                  <td><span class="folio-tag">#${escapeHtml(product.sku)}</span></td>
                  ${branches.map(branch => `
                    <td>
                      <span style="font-weight:600; font-variant-numeric:tabular-nums;">${locations.find(item => item.branchId === branch.id)?.quantity || 0}</span> 
                      <small style="color:var(--muted)">${escapeHtml(product.unit)}</small>
                    </td>
                  `).join('')}
                  <td>
                    <strong style="color: ${isLow ? '#e11d48' : '#0f172a'}; font-variant-numeric:tabular-nums; font-size:14px;">${total}</strong>
                  </td>
                  <td><span style="color:var(--muted);">${product.minimum}</span></td>
                  <td>${badge(isLow ? 'Bajo' : 'Saludable')}</td>
                </tr>
              `;
            }).join('') || `<tr><td colspan="${branches.length + 5}" class="empty">No hay productos para mostrar en existencias.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

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

export function alerts() {
  const alertProducts = state.products.filter(product => product.stock <= product.minimum);
  const outOfStock = alertProducts.filter(product => product.stock <= 0);
  const lowStock = alertProducts.filter(product => product.stock > 0);
  const totalDeficit = alertProducts.reduce((sum, p) => sum + Math.max(0, p.minimum - p.stock), 0);
  
  const healthyCount = state.products.length - alertProducts.length;
  const healthPercentage = state.products.length > 0 
    ? Math.round((healthyCount / state.products.length) * 100) 
    : 100;

  const currentFilter = state.alertSeverityFilter || 'all';
  
  let filtered = alertProducts.filter(product => {
    const matchesSearch = `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(state.query.toLowerCase());
    if (!matchesSearch) return false;
    if (currentFilter === 'out_of_stock') return product.stock <= 0;
    if (currentFilter === 'low_stock') return product.stock > 0 && product.stock <= product.minimum;
    return true;
  });

  return `
    ${breadcrumb([['inventory', 'Inventario'], ['alerts', 'Alertas de Stock']])}
    ${pageHeader('Alertas de Existencias y Reposición', 'Monitoreo preventivo de déficit de inventario con prioridad operativa.', '<button class="primary" data-nav="movements">＋ Registrar reabastecimiento</button>')}

    <div class="hr-stats-grid" style="margin-bottom:24px;">
      <div class="stat-card">
        <div class="stat-icon-wrapper red" style="background:#fff1f2; color:#e11d48;">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>
        </div>
        <div class="stat-content">
          <span class="stat-label">Stock Agotado</span>
          <strong class="stat-value" style="color:#e11d48;">${outOfStock.length}</strong>
          <span class="stat-sub">Prioridad crítica inmediata</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper amber">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
        </div>
        <div class="stat-content">
          <span class="stat-label">Bajo Nivel Mínimo</span>
          <strong class="stat-value" style="color:#d97706;">${lowStock.length}</strong>
          <span class="stat-sub">Requieren reposición</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper blue">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>
        </div>
        <div class="stat-content">
          <span class="stat-label">Déficit Total</span>
          <strong class="stat-value" style="color:#2563eb;">${totalDeficit.toLocaleString()}</strong>
          <span class="stat-sub">Unidades faltantes</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper green">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
        </div>
        <div class="stat-content">
          <span class="stat-label">Salud del Catálogo</span>
          <strong class="stat-value">${healthPercentage}%</strong>
          <span class="stat-sub">${healthyCount} de ${state.products.length} estables</span>
        </div>
      </div>
    </div>

    <div class="panel" style="margin-bottom:24px;">
      <div class="panel-head">
        <div>
          <h2>Filtrar por Nivel de Riesgo</h2>
          <p class="panel-note">Selecciona la categoría para priorizar compras y reabastecimiento en almacén.</p>
        </div>
      </div>
      <div class="panel-body">
        <div class="alert-type-selector">
          <button type="button" class="alert-type-card ${currentFilter === 'all' ? 'active-all' : ''}" data-alert-filter="all">
            <div class="alert-icon-box blue">
              <svg viewBox="0 0 20 20" fill="currentColor" style="width:20px;height:20px;"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
            </div>
            <div>
              <strong>Todas las alertas (${alertProducts.length})</strong>
              <small>Resumen completo de existencias en o por debajo del límite mínimo.</small>
            </div>
          </button>
          <button type="button" class="alert-type-card ${currentFilter === 'out_of_stock' ? 'active-critical' : ''}" data-alert-filter="out_of_stock">
            <div class="alert-icon-box red">
              <svg viewBox="0 0 20 20" fill="currentColor" style="width:20px;height:20px;"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>
            </div>
            <div>
              <strong>Agotados (${outOfStock.length})</strong>
              <small>Existencia cero en inventario con riesgo de rotura de stock.</small>
            </div>
          </button>
          <button type="button" class="alert-type-card ${currentFilter === 'low_stock' ? 'active-warning' : ''}" data-alert-filter="low_stock">
            <div class="alert-icon-box amber">
              <svg viewBox="0 0 20 20" fill="currentColor" style="width:20px;height:20px;"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
            </div>
            <div>
              <strong>Bajo mínimo (${lowStock.length})</strong>
              <small>Disponibles pero cercanos al umbral mínimo de seguridad.</small>
            </div>
          </button>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <div>
          <h2>Listado Operativo de Productos Vulnerables</h2>
          <p class="panel-note">Control detallado con calculador de reposición inmediata</p>
        </div>
        <span class="panel-note">${filtered.length} productos en filtro</span>
      </div>
      <div class="table-toolbar">
        <div class="filter-row">
          <input id="page-search" placeholder="Buscar por producto, SKU o categoría..." value="${escapeHtml(state.query)}" style="min-width:280px;">
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>SKU</th>
              <th>Categoría</th>
              <th>Stock Actual</th>
              <th>Nivel Mínimo</th>
              <th>Cobertura</th>
              <th>Déficit</th>
              <th>Nivel de Riesgo</th>
              <th style="text-align:right;">Acción</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(product => {
              const isZero = product.stock <= 0;
              const ratio = product.minimum > 0 ? Math.min(100, Math.round((product.stock / product.minimum) * 100)) : 0;
              const deficit = Math.max(0, product.minimum - product.stock);
              
              return `
                <tr>
                  <td>
                    <strong>${escapeHtml(product.name)}</strong>
                  </td>
                  <td>
                    <span class="folio-tag">#${escapeHtml(product.sku)}</span>
                  </td>
                  <td><span class="tag-neutral">${escapeHtml(product.category)}</span></td>
                  <td><strong style="color: ${isZero ? '#e11d48' : '#d97706'}; font-variant-numeric:tabular-nums;">${product.stock} ${escapeHtml(product.unit)}</strong></td>
                  <td><span style="font-variant-numeric:tabular-nums; color:var(--muted);">${product.minimum} ${escapeHtml(product.unit)}</span></td>
                  <td style="width: 140px;">
                    <div class="alert-progress-bar-wrap">
                      <div class="alert-progress-bar ${isZero ? 'zero' : 'low'}" style="width: ${ratio}%;"></div>
                    </div>
                    <small class="panel-note" style="font-size:11px;">${ratio}% del mínimo</small>
                  </td>
                  <td><strong style="color: #2563eb; font-variant-numeric:tabular-nums;">+${deficit} ${escapeHtml(product.unit)}</strong></td>
                  <td>
                    ${badge(isZero ? 'Agotado' : 'Bajo Mínimo')}
                  </td>
                  <td style="text-align:right;">
                    <button class="primary" style="padding:6px 12px; font-size:12px;" data-action="reponer-product" data-product-id="${product.id}">
                      Reponer
                    </button>
                  </td>
                </tr>
              `;
            }).join('') || '<tr><td colspan="9" class="empty">No hay productos en alerta para esta consulta.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
