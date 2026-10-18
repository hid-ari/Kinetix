import { state } from '../../core/state.js';
import { escapeHtml, badge } from '../../components/utils.js';
import { breadcrumb, pageHeader } from '../../components/ui.js';

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
