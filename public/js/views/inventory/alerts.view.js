import { state } from '../../core/state.js';
import { escapeHtml, badge } from '../../components/utils.js';
import { breadcrumb, pageHeader } from '../../components/ui.js';

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
