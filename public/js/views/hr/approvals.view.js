import { state } from '../../core/state.js';
import { escapeHtml, initials } from '../../components/utils.js';

export function approvalsView() {
  const pending = state.hr.pendingApprovals || [];
  const myRequests = state.hr.myApprovalRequests || [];
  const activeTab = state.hr.approvalsTab || 'pending';

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Aprobado':
      case 'Aprobada':
        return '<span class="badge-pill success"><span class="badge-pill-dot"></span>Aprobado</span>';
      case 'Pendiente':
        return '<span class="badge-pill warning"><span class="badge-pill-dot"></span>En Proceso</span>';
      case 'Rechazado':
      case 'Rechazada':
        return '<span class="badge-pill danger"><span class="badge-pill-dot"></span>Rechazado</span>';
      case 'Cancelado':
      case 'Cancelada':
        return '<span class="badge-pill neutral"><span class="badge-pill-dot"></span>Cancelado</span>';
      default:
        return `<span class="badge-pill neutral"><span class="badge-pill-dot"></span>${escapeHtml(status || 'Pendiente')}</span>`;
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const getFlowTypeIcon = (code) => {
    switch (code) {
      case 'Vacaciones': return '🏖️';
      case 'Permiso': return '📋';
      case 'CorreccionAsistencia': return '⏰';
      default: return '📄';
    }
  };

  return `
    <div class="hr-view">
      <!-- Encabezado de Aprobaciones -->
      <div class="view-header">
        <div>
          <h2>Bandeja Centralizada de Aprobaciones</h2>
          <p class="subtitle">Flujos de autorización multietapa auditables para solicitudes del personal</p>
        </div>
        <div class="header-actions">
          <button class="secondary" data-action="hr-refresh-approvals">
            <svg viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/></svg>
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      <!-- Tarjetas de Métricas -->
      <div class="hr-stats-grid">
        <div class="stat-card">
          <div class="stat-icon-wrapper amber">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>
          </div>
          <div class="stat-content">
            <span class="stat-label">Requieren mi Aprobación</span>
            <strong class="stat-value">${pending.length}</strong>
            <span class="stat-sub">Acción requerida</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-wrapper blue">
            <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/></svg>
          </div>
          <div class="stat-content">
            <span class="stat-label">Mis Solicitudes</span>
            <strong class="stat-value">${myRequests.length}</strong>
            <span class="stat-sub">Enviadas por mi</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-wrapper green">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
          </div>
          <div class="stat-content">
            <span class="stat-label">Completadas con Éxito</span>
            <strong class="stat-value">${myRequests.filter(r => r.Status === 'Aprobado').length}</strong>
            <span class="stat-sub">Aprobaciones finales</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-wrapper purple">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/></svg>
          </div>
          <div class="stat-content">
            <span class="stat-label">Flujos Auditados</span>
            <strong class="stat-value">100%</strong>
            <span class="stat-sub">Trazabilidad inmutable</span>
          </div>
        </div>
      </div>

      <!-- Selector de Pestañas Segmentado -->
      <div style="display: flex;">
        <div class="panel-tabs">
          <button class="tab-btn ${activeTab === 'pending' ? 'active' : ''}" data-approvals-tab="pending">
            <span>Pendientes de mi Aprobación</span>
            <span class="tab-badge">${pending.length}</span>
          </button>
          <button class="tab-btn ${activeTab === 'my-requests' ? 'active' : ''}" data-approvals-tab="my-requests">
            <span>Mis Solicitudes Enviadas</span>
            <span class="tab-badge">${myRequests.length}</span>
          </button>
        </div>
      </div>

      <!-- Pestaña 1: Pendientes de mi aprobación -->
      ${activeTab === 'pending' ? `
        <div class="panel">
          <div class="panel-header">
            <h3>
              <svg viewBox="0 0 20 20" fill="currentColor" style="width:18px;height:18px;color:#d97706;"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>
              <span>Solicitudes en Espera de su Decisión</span>
            </h3>
            <span class="panel-header-badge">${pending.length} por autorizar</span>
          </div>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Tipo</th>
                  <th>Solicitante</th>
                  <th>Paso Actual</th>
                  <th>Fecha Solicitud</th>
                  <th>Estado</th>
                  <th style="text-align:right;">Acción</th>
                </tr>
              </thead>
              <tbody>
                ${pending.length === 0 ? `
                  <tr>
                    <td colspan="7" class="empty-cell">
                      <div class="empty-state-modern">
                        <div class="empty-state-icon">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        </div>
                        <h4>Bandeja al Día</h4>
                        <p>No tiene solicitudes pendientes de aprobación que requieran su firma o autorización en este momento.</p>
                      </div>
                    </td>
                  </tr>
                ` : pending.map(req => {
                  const empName = req.RequesterName || 'Colaborador';
                  const empInit = initials(empName);
                  return `
                  <tr>
                    <td><span class="folio-tag">#AP-${String(req.Id).padStart(4, '0')}</span></td>
                    <td>
                      <div style="display:inline-flex;align-items:center;gap:6px;">
                        <span>${getFlowTypeIcon(req.FlowCode)}</span>
                        <strong>${escapeHtml(req.FlowName || req.FlowCode)}</strong>
                      </div>
                    </td>
                    <td>
                      <div class="emp-cell-flex">
                        <div class="emp-avatar-sm">${escapeHtml(empInit)}</div>
                        <div class="emp-cell-info">
                          <strong>${escapeHtml(empName)}</strong>
                          <small>${escapeHtml(req.RequesterPosition || req.RequesterDept || 'Colaborador')}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span class="tag-neutral">Paso ${req.CurrentStepNumber}: ${escapeHtml(req.CurrentStepName || 'Revisión')}</span>
                    </td>
                    <td>${formatDate(req.CreatedAt)}</td>
                    <td>${renderStatusBadge(req.Status)}</td>
                    <td style="text-align:right;">
                      <button class="primary" data-action="hr-review-approval" data-id="${req.Id}" style="height: 32px; padding: 0 12px; font-size: 12px;">
                        <svg viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                        <span>Revisar y Decidir</span>
                      </button>
                    </td>
                  </tr>
                `;}).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <!-- Pestaña 2: Mis Solicitudes Enviadas -->
      ${activeTab === 'my-requests' ? `
        <div class="panel">
          <div class="panel-header">
            <h3>
              <svg viewBox="0 0 20 20" fill="currentColor" style="width:18px;height:18px;color:#2563eb;"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/></svg>
              <span>Seguimiento y Trazabilidad de Mis Solicitudes</span>
            </h3>
            <span class="panel-header-badge">${myRequests.length} registradas</span>
          </div>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Tipo de Trámite</th>
                  <th>Paso Actual</th>
                  <th>Fecha Envío</th>
                  <th>Estado</th>
                  <th style="text-align:right;">Detalle</th>
                </tr>
              </thead>
              <tbody>
                ${myRequests.length === 0 ? `
                  <tr>
                    <td colspan="6" class="empty-cell">
                      <div class="empty-state-modern">
                        <div class="empty-state-icon">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                        </div>
                        <h4>Sin Solicitudes Enviadas</h4>
                        <p>No ha enviado solicitudes de aprobación recientemente desde este perfil.</p>
                      </div>
                    </td>
                  </tr>
                ` : myRequests.map(req => `
                  <tr>
                    <td><span class="folio-tag">#AP-${String(req.Id).padStart(4, '0')}</span></td>
                    <td>
                      <div style="display:inline-flex;align-items:center;gap:6px;">
                        <span>${getFlowTypeIcon(req.FlowCode)}</span>
                        <strong>${escapeHtml(req.FlowName || req.FlowCode)}</strong>
                      </div>
                    </td>
                    <td>
                      <span class="tag-neutral">Paso ${req.CurrentStepNumber}: ${escapeHtml(req.CurrentStepName || 'Revisión')}</span>
                    </td>
                    <td>${formatDate(req.CreatedAt)}</td>
                    <td>${renderStatusBadge(req.Status)}</td>
                    <td style="text-align:right;">
                      <button class="secondary" data-action="hr-view-approval-detail" data-id="${req.Id}" style="height: 32px; padding: 0 12px; font-size: 12px;">
                        Ver Historial
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}
