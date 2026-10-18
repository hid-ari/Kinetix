import { state } from '../../core/state.js';
import { escapeHtml, badge } from '../../components/utils.js';
import { breadcrumb } from '../../components/ui.js';

export function branchDetail(id) {
  const branch = state.branches.find(item => item.id === id);
  if (!branch) return '<div class="empty">Sucursal no encontrada.</div>';
  return `
    ${breadcrumb([['dashboard', 'Administración'], ['branches', 'Sucursales'], ['branches', escapeHtml(branch.name)]])}
    <div class="detail-head">
      <div>
        <h1>${escapeHtml(branch.name)}</h1>
        <p class="subtitle">${escapeHtml(branch.code)} · ${escapeHtml(branch.company)} · ${badge(branch.status)}</p>
      </div>
      <div class="inline-actions">
        <button class="secondary" data-action="edit-branch">Editar</button>
        <button class="${branch.status === 'Activa' ? 'danger' : 'primary'}" data-action="toggle-branch">
          ${branch.status === 'Activa' ? 'Desactivar' : 'Activar'}
        </button>
      </div>
    </div>
    <div class="grid-2">
      <div class="panel">
        <div class="panel-head"><h2>Información general</h2></div>
        <div class="panel-body">
          <p><strong>Empresa:</strong> ${escapeHtml(branch.company)}</p>
          <p><strong>Usuarios asignados:</strong> ${branch.users}</p>
          <p><strong>Encargado:</strong> ${escapeHtml(branch.manager)}</p>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Estado</h2></div>
        <div class="panel-body">${badge(branch.status)}</div>
      </div>
    </div>
  `;
}
