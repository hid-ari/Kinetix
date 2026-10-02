import { state } from '../../core/state.js';
import { escapeHtml, badge } from '../../components/utils.js';
import { breadcrumb, pageHeader } from '../../components/ui.js';

export function inventoryStats() {
  const lowStock = state.products.filter(product => product.stock <= product.minimum);
  const totalUnits = state.products.reduce((sum, product) => sum + product.stock, 0);
  return `<div class="stats inventory-stats">
    <div class="stat"><span class="stat-label">Productos activos</span><div class="stat-value">${state.products.length}</div><span class="stat-meta">Catálogo actual</span></div>
    <div class="stat"><span class="stat-label">Unidades en stock</span><div class="stat-value">${totalUnits}</div><span class="stat-meta">En todos los almacenes</span></div>
    <div class="stat"><span class="stat-label">Alertas de stock</span><div class="stat-value">${lowStock.length}</div><span class="stat-meta">Requieren atención</span></div>
    <div class="stat"><span class="stat-label">Valor inventario</span><div class="stat-value">$${state.products.reduce((sum, product) => sum + product.stock * product.price, 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</div><span class="stat-meta">Costo estimado</span></div>
  </div>`;
}

export function inventory() {
  const lowStock = state.products.filter(product => product.stock <= product.minimum);
  return `${breadcrumb([['dashboard', 'Espacio de trabajo'], ['inventory', 'Inventario']])}
  ${pageHeader('Inventario', 'Control operativo de productos, existencias y movimientos.', '<button class="primary" data-nav="movements">＋ Registrar movimiento</button>')}
  ${inventoryStats()}
  <div class="grid-2">
    <div class="panel">
      <div class="panel-head"><div><h2>Existencias críticas</h2><p class="panel-note">Productos bajo el nivel mínimo</p></div><button class="row-action" data-nav="alerts">Ver alertas</button></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Producto</th><th>Stock</th><th>Mínimo</th><th>Estado</th></tr></thead>
          <tbody>
            ${lowStock.map(product => `<tr><td><strong>${escapeHtml(product.name)}</strong><br><span class="panel-note">${product.id}</span></td><td>${product.stock} ${product.unit}</td><td>${product.minimum}</td><td><span class="badge inactive">Reponer</span></td></tr>`).join('') || '<tr><td colspan="4" class="empty">No hay existencias críticas.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
    <div class="panel">
      <div class="panel-head"><div><h2>Últimos movimientos</h2><p class="panel-note">Actividad reciente del almacén</p></div><button class="row-action" data-nav="movements">Ver todos</button></div>
      <div class="panel-body activity">
        ${state.movements.slice(0, 4).map(movement => `<div class="activity-item"><span class="activity-bullet ${movement.type === 'Salida' ? 'movement-out' : ''}"></span><div><p><strong>${movement.type}</strong> · ${escapeHtml(movement.product)}</p><small>${movement.quantity} unidades · ${movement.warehouse} · ${movement.date}</small></div></div>`).join('')}
      </div>
    </div>
  </div>`;
}

export function products() {
  const items = state.products.filter(product => `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(state.query.toLowerCase()));
  const categories = Array.from(new Set(state.products.map(p => p.category).filter(Boolean)));
  return `${breadcrumb([['inventory', 'Inventario'], ['products', 'Productos']])}
  ${pageHeader('Productos', 'Catálogo maestro y reglas de reposición.', '<button class="primary" data-action="new-product">＋ Nuevo producto</button>')}
  <div class="panel">
    <div class="table-toolbar">
      <div class="filter-row">
        <input id="page-search" placeholder="Buscar producto o SKU" value="${escapeHtml(state.query)}">
        <select><option value="">Todas las categorías</option>${categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}</select>
      </div>
      <span class="panel-note">${items.length} productos</span>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Producto</th><th>Categoría</th><th>Unidad</th><th>Stock actual</th><th>Mínimo</th><th>Costo</th><th></th></tr></thead>
        <tbody>
          ${items.map(product => `<tr><td><strong>${escapeHtml(product.name)}</strong><br><span class="panel-note">${escapeHtml(product.sku)}</span></td><td>${escapeHtml(product.category)}</td><td>${product.unit}</td><td>${product.stock}</td><td>${product.minimum}</td><td>$${product.price.toFixed(2)}</td><td><button class="row-action" data-action="edit-product" data-product-id="${product.id}">Editar</button><button class="row-action" data-action="toggle-product" data-product-id="${product.id}">Desactivar</button></td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

export function stock() {
  const branches = state.branches;
  const branchHeaders = branches.map(branch => `<th>${escapeHtml(branch.name)}</th>`).join('');
  const items = state.products.filter(product => `${product.name} ${product.sku}`.toLowerCase().includes(state.query.toLowerCase()));
  return `${breadcrumb([['inventory', 'Inventario'], ['stock', 'Existencias']])}
  ${pageHeader('Existencias', 'Consulta el stock disponible por producto y sucursal.', '<button class="secondary" data-nav="alerts">Ver alertas</button>')}
  <div class="panel">
    <div class="table-toolbar">
      <div class="filter-row"><input id="page-search" placeholder="Buscar en existencias" value="${escapeHtml(state.query)}"></div>
      <span class="panel-note">Cantidades tomadas de la base de datos</span>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Producto</th>${branchHeaders}<th>Total</th><th>Nivel mínimo</th><th>Estado</th></tr></thead>
        <tbody>
          ${items.map(product => {
            const locations = state.stock.filter(item => item.productId === product.id);
            const total = locations.reduce((sum, item) => sum + item.quantity, 0);
            return `<tr><td><strong>${escapeHtml(product.name)}</strong><br><span class="panel-note">${escapeHtml(product.sku)}</span></td>${branches.map(branch => `<td>${locations.find(item => item.branchId === branch.id)?.quantity || 0} ${escapeHtml(product.unit)}</td>`).join('')}<td><strong>${total}</strong></td><td>${product.minimum}</td><td><span class="badge ${total <= product.minimum ? 'inactive' : 'active'}">${total <= product.minimum ? 'Bajo' : 'Saludable'}</span></td></tr>`;
          }).join('') || `<tr><td colspan="${branches.length + 4}" class="empty">No hay productos para mostrar.</td></tr>`}
        </tbody>
      </table>
    </div>
  </div>`;
}

export function movements() {
  const totalEntradas = state.movements.filter(m => m.type === 'Entrada').reduce((sum, m) => sum + m.quantity, 0);
  const totalSalidas = state.movements.filter(m => m.type === 'Salida').reduce((sum, m) => sum + m.quantity, 0);
  const totalProducts = state.products.reduce((sum, p) => sum + p.stock, 0);
  const isEntrada = state.movementType === 'Entrada';
  
  return `${breadcrumb([['inventory', 'Inventario'], ['movements', 'Entradas / salidas']])}
  ${pageHeader('Entradas y salidas de almacén', 'Gestión interactiva de movimientos de inventario con trazabilidad inmediata.')}
  
  <div class="stats" style="margin-bottom:20px;">
    <div class="stat">
      <span class="stat-label">Total entradas</span>
      <div class="stat-value" style="color:#059669;">+${totalEntradas}</div>
      <span class="stat-meta" style="color:#059669;">Unidades ingresadas</span>
    </div>
    <div class="stat">
      <span class="stat-label">Total salidas</span>
      <div class="stat-value" style="color:#e11d48;">-${totalSalidas}</div>
      <span class="stat-meta" style="color:#e11d48;">Unidades despachadas</span>
    </div>
    <div class="stat">
      <span class="stat-label">Stock disponible</span>
      <div class="stat-value">${totalProducts}</div>
      <span class="stat-meta">Total global en catálogo</span>
    </div>
    <div class="stat">
      <span class="stat-label">Movimientos</span>
      <div class="stat-value">${state.movements.length}</div>
      <span class="stat-meta">Registros en historial</span>
    </div>
  </div>

  <div class="panel movement-form-panel" style="margin-bottom:24px;">
    <div class="panel-head">
      <div>
        <h2>Registrar nuevo movimiento</h2>
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
        <h2>Historial trazable de movimientos</h2>
        <p class="panel-note">Registro cronológico detallado de ingresos y despachos</p>
      </div>
      <span class="panel-note">${state.movements.length} registros</span>
    </div>
    <div class="table-toolbar">
      <div class="filter-row">
        <input id="page-search" placeholder="Buscar por producto, almacén o usuario..." value="${escapeHtml(state.query)}">
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Referencia</th>
            <th>Fecha</th>
            <th>Tipo</th>
            <th>Producto</th>
            <th>Cantidad</th>
            <th>Almacén</th>
            <th>Usuario responsable</th>
          </tr>
        </thead>
        <tbody>
          ${state.movements.filter(m => `${m.product} ${m.warehouse} ${m.user} ${m.type}`.toLowerCase().includes(state.query.toLowerCase())).map(movement => `<tr>
            <td><strong>#${movement.id}</strong></td>
            <td>${movement.date}</td>
            <td>
              <span class="badge ${movement.type === 'Entrada' ? 'active' : 'inactive'}">
                ${movement.type === 'Entrada' ? 'Entrada' : 'Salida'}
              </span>
            </td>
            <td><strong>${escapeHtml(movement.product)}</strong></td>
            <td><strong>${movement.type === 'Entrada' ? '+' : '-'}${movement.quantity}</strong></td>
            <td>${escapeHtml(movement.warehouse)}</td>
            <td>${escapeHtml(movement.user)}</td>
          </tr>`).join('') || '<tr><td colspan="7" class="empty">No hay registros de movimientos en esta consulta.</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
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

  return `${breadcrumb([['inventory', 'Inventario'], ['alerts', 'Alertas de Stock']])}
  ${pageHeader('Alertas de existencias y reposición', 'Monitoreo preventivo de déficit de inventario con prioridad operativa.', '<button class="primary" data-nav="movements">＋ Registrar reabastecimiento</button>')}

  <div class="stats" style="margin-bottom:20px;">
    <div class="stat">
      <span class="stat-label">Stock agotado (0 und.)</span>
      <div class="stat-value" style="color:#e11d48;">${outOfStock.length}</div>
      <span class="stat-meta" style="color:#e11d48;">Prioridad crítica inmediata</span>
    </div>
    <div class="stat">
      <span class="stat-label">Bajo nivel mínimo</span>
      <div class="stat-value" style="color:#d97706;">${lowStock.length}</div>
      <span class="stat-meta" style="color:#d97706;">Requieren reposición</span>
    </div>
    <div class="stat">
      <span class="stat-label">Déficit total</span>
      <div class="stat-value" style="color:#2563eb;">${totalDeficit}</div>
      <span class="stat-meta">Unidades faltantes</span>
    </div>
    <div class="stat">
      <span class="stat-label">Salud del catálogo</span>
      <div class="stat-value">${healthPercentage}%</div>
      <span class="stat-meta">${healthyCount} de ${state.products.length} estables</span>
    </div>
  </div>

  <div class="panel" style="margin-bottom:24px;">
    <div class="panel-head">
      <div>
        <h2>Filtrar por nivel de riesgo</h2>
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
        <h2>Listado operativo de productos vulnerables</h2>
        <p class="panel-note">Control detallado con calculador de reposición inmediata</p>
      </div>
      <span class="panel-note">${filtered.length} productos en filtro</span>
    </div>
    <div class="table-toolbar">
      <div class="filter-row">
        <input id="page-search" placeholder="Buscar por producto, SKU o categoría..." value="${escapeHtml(state.query)}">
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Producto / SKU</th>
            <th>Categoría</th>
            <th>Stock actual</th>
            <th>Nivel mínimo</th>
            <th>Cobertura</th>
            <th>Déficit</th>
            <th>Nivel de riesgo</th>
            <th>Acción directa</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(product => {
            const isZero = product.stock <= 0;
            const ratio = product.minimum > 0 ? Math.min(100, Math.round((product.stock / product.minimum) * 100)) : 0;
            const deficit = Math.max(0, product.minimum - product.stock);
            
            return `<tr>
              <td>
                <strong>${escapeHtml(product.name)}</strong><br>
                <span class="panel-note">${escapeHtml(product.sku)}</span>
              </td>
              <td>${escapeHtml(product.category)}</td>
              <td><strong style="color: ${isZero ? '#e11d48' : '#d97706'}">${product.stock} ${escapeHtml(product.unit)}</strong></td>
              <td>${product.minimum} ${escapeHtml(product.unit)}</td>
              <td style="width: 130px;">
                <div class="alert-progress-bar-wrap">
                  <div class="alert-progress-bar ${isZero ? 'zero' : 'low'}" style="width: ${ratio}%;"></div>
                </div>
                <small class="panel-note" style="font-size:11px;">${ratio}% del mínimo</small>
              </td>
              <td><strong style="color: #2563eb;">+${deficit} ${escapeHtml(product.unit)}</strong></td>
              <td>
                <span class="badge ${isZero ? 'inactive' : 'pending'}">
                  ${isZero ? 'Stock Agotado' : 'Bajo Mínimo'}
                </span>
              </td>
              <td>
                <button class="primary" style="padding:5px 10px;font-size:12px;" data-action="reponer-product" data-product-id="${product.id}">
                  Reponer
                </button>
              </td>
            </tr>`;
          }).join('') || '<tr><td colspan="8" class="empty">No hay productos en alerta para esta consulta.</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}
