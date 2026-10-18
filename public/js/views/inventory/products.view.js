import { state, hasPermission } from '../../core/state.js';
import { escapeHtml } from '../../components/utils.js';
import { breadcrumb, pageHeader } from '../../components/ui.js';

export function products() {
  const items = state.products.filter(product => `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(state.query.toLowerCase()));
  const categories = Array.from(new Set(state.products.map(p => p.category).filter(Boolean)));
  return `
    ${breadcrumb([['inventory', 'Inventario'], ['products', 'Productos']])}
    ${pageHeader('Productos', 'Catálogo maestro, especificaciones y reglas de reposición.', hasPermission('Productos', 'Crear productos') ? '<button class="primary" data-action="new-product">＋ Nuevo producto</button>' : '')}
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
