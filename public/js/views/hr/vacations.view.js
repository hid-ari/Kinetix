import { state } from '../../core/state.js';
import { escapeHtml, initials } from '../../components/utils.js';

export function vacationsView() {
  const balance = state.hr.vacationBalance || {
    HireDate: null,
    SeniorityYears: 0,
    DaysEntitled: 14,
    DaysPending: 0,
    DaysUsed: 0,
    DaysAvailable: 14
  };
  const vacationRequests = Array.isArray(state.hr.vacationRequests) ? state.hr.vacationRequests : (state.hr.vacationRequests?.data || []);
  const leaveRequests = Array.isArray(state.hr.leaveRequests) ? state.hr.leaveRequests : (state.hr.leaveRequests?.data || []);
  const leaveTypes = state.hr.leaveTypes || [];
  const calendarEvents = state.hr.vacationCalendar || [];
  const activeTab = (state.hr.vacationsTab === 'requests' ? 'vacations' : state.hr.vacationsTab) || 'vacations';

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Aprobado':
      case 'Aprobada':
        return '<span class="badge-pill success"><span class="badge-pill-dot"></span>Aprobada</span>';
      case 'Pendiente':
        return '<span class="badge-pill warning"><span class="badge-pill-dot"></span>En Aprobación</span>';
      case 'Rechazado':
      case 'Rechazada':
        return '<span class="badge-pill danger"><span class="badge-pill-dot"></span>Rechazada</span>';
      case 'Cancelado':
      case 'Cancelada':
        return '<span class="badge-pill neutral"><span class="badge-pill-dot"></span>Cancelada</span>';
      default:
        return `<span class="badge-pill neutral"><span class="badge-pill-dot"></span>${escapeHtml(status || 'Pendiente')}</span>`;
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return isoString;
    }
  };

  return `
    <div class="hr-view">
      <!-- Encabezado de Vacaciones y Permisos -->
      <div class="view-header">
        <div>
          <h2>Gestión de Vacaciones y Licencias</h2>
          <p class="subtitle">Cálculo de derecho legal dominicano (Art. 177 Código de Trabajo) y control de permisos</p>
        </div>
        <div class="header-actions">
          <button class="secondary" data-action="hr-open-leave-request">
            <svg viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>
            <span>Solicitar Licencia / Permiso</span>
          </button>
          <button class="primary" data-action="hr-open-vacation-request">
            <svg viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd"/></svg>
            <span>Solicitar Vacaciones</span>
          </button>
        </div>
      </div>

      <!-- Tarjetas de Saldo Legal Dominicano (Art. 177) -->
      <div class="vacations-balance-hero">
        <div class="balance-card hero-available">
          <div class="balance-card-head">
            <div class="balance-title">Días Disponibles</div>
            <div class="balance-icon-pill">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
            </div>
          </div>
          <div class="balance-number">${balance.DaysAvailable || 0}</div>
          <div class="balance-meta">Días hábiles remunerados para disfrutar</div>
        </div>

        <div class="balance-card">
          <div class="balance-card-head">
            <div class="balance-title">Derecho Generado</div>
            <div class="balance-icon-pill blue">
              <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" clip-rule="evenodd"/></svg>
            </div>
          </div>
          <div class="balance-number text-blue">${balance.DaysEntitled || 0}</div>
          <div class="balance-meta">Antigüedad: ${balance.SeniorityYears || 0} ${(balance.SeniorityYears || 0) === 1 ? 'año' : 'años'} · Escala Art. 177 (${(balance.SeniorityYears || 0) >= 5 ? '18 días' : '14 días'})</div>
        </div>

        <div class="balance-card">
          <div class="balance-card-head">
            <div class="balance-title">Días en Trámite</div>
            <div class="balance-icon-pill amber">
              <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>
            </div>
          </div>
          <div class="balance-number text-amber">${balance.DaysPending || 0}</div>
          <div class="balance-meta">En flujo de autorización multietapa</div>
        </div>

        <div class="balance-card">
          <div class="balance-card-head">
            <div class="balance-title">Días Disfrutados</div>
            <div class="balance-icon-pill green">
              <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
            </div>
          </div>
          <div class="balance-number text-green">${balance.DaysUsed || 0}</div>
          <div class="balance-meta">Histórico acumulado y liquidado</div>
        </div>
      </div>

      <!-- Selector de Pestañas Segmentado -->
      <div style="display: flex;">
        <div class="panel-tabs">
          <button class="tab-btn ${activeTab === 'vacations' ? 'active' : ''}" data-vacation-tab="vacations">
            <span>Solicitudes de Vacaciones</span>
            <span class="tab-badge">${vacationRequests.length}</span>
          </button>
          <button class="tab-btn ${activeTab === 'leaves' ? 'active' : ''}" data-vacation-tab="leaves">
            <span>Licencias y Permisos</span>
            <span class="tab-badge">${leaveRequests.length}</span>
          </button>
          <button class="tab-btn ${activeTab === 'calendar' ? 'active' : ''}" data-vacation-tab="calendar">
            <span>Calendario de Ausencias</span>
          </button>
          <button class="tab-btn ${activeTab === 'law' ? 'active' : ''}" data-vacation-tab="law">
            <span>Marco Legal Dominicano</span>
          </button>
        </div>
      </div>

      <!-- Pestaña 1: Solicitudes de Vacaciones -->
      ${activeTab === 'vacations' ? `
        <div class="panel">
          <div class="panel-header">
            <h3>
              <svg viewBox="0 0 20 20" fill="currentColor" style="width:18px;height:18px;color:#2563eb;"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>
              <span>Historial de Solicitudes de Vacaciones</span>
            </h3>
            <span class="panel-header-badge">${vacationRequests.length} solicitudes</span>
          </div>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Colaborador</th>
                  <th>Fecha Inicio</th>
                  <th>Fecha Fin</th>
                  <th>Días Solicitados</th>
                  <th>Fecha Solicitud</th>
                  <th>Estado</th>
                  <th>Comentarios</th>
                </tr>
              </thead>
              <tbody>
                ${vacationRequests.length === 0 ? `
                  <tr>
                    <td colspan="8" class="empty-cell">
                      <div class="empty-state-modern">
                        <div class="empty-state-icon">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                        </div>
                        <h4>Sin Solicitudes de Vacaciones</h4>
                        <p>No cuenta con solicitudes de vacaciones registradas. Utilice el botón "Solicitar Vacaciones" para crear una.</p>
                      </div>
                    </td>
                  </tr>
                ` : vacationRequests.map(v => {
                  const empName = v.EmployeeName || (v.FirstName ? `${v.FirstName} ${v.LastName}` : 'Colaborador');
                  const empInit = initials(empName);
                  return `
                  <tr>
                    <td><span class="folio-tag">#VAC-${String(v.Id).padStart(4, '0')}</span></td>
                    <td>
                      <div class="emp-cell-flex">
                        <div class="emp-avatar-sm">${escapeHtml(empInit)}</div>
                        <div class="emp-cell-info">
                          <strong>${escapeHtml(empName)}</strong>
                          <small>${escapeHtml(v.DepartmentName || v.PositionTitle || 'Personal')}</small>
                        </div>
                      </div>
                    </td>
                    <td><strong>${formatDate(v.StartDate)}</strong></td>
                    <td><strong>${formatDate(v.EndDate)}</strong></td>
                    <td><strong style="color:#0f172a;">${v.DaysRequested ?? v.RequestedDays ?? 0} días</strong></td>
                    <td>${formatDate(v.CreatedAt)}</td>
                    <td>${renderStatusBadge(v.Status)}</td>
                    <td style="color:#64748b;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(v.Reason || v.Comments || 'Sin comentarios adicionales')}</td>
                  </tr>
                `;}).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <!-- Pestaña 2: Licencias y Permisos -->
      ${activeTab === 'leaves' ? `
        <div class="panel">
          <div class="panel-header">
            <h3>
              <svg viewBox="0 0 20 20" fill="currentColor" style="width:18px;height:18px;color:#7c3aed;"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/></svg>
              <span>Licencias Médicas, Personales y Especiales</span>
            </h3>
            <span class="panel-header-badge">${leaveRequests.length} solicitudes</span>
          </div>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Colaborador</th>
                  <th>Tipo de Licencia</th>
                  <th>Desde</th>
                  <th>Hasta</th>
                  <th>Días</th>
                  <th>Goce de Sueldo</th>
                  <th>Estado</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                ${leaveRequests.length === 0 ? `
                  <tr>
                    <td colspan="9" class="empty-cell">
                      <div class="empty-state-modern">
                        <div class="empty-state-icon">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                        </div>
                        <h4>Sin Licencias ni Permisos</h4>
                        <p>No se registran solicitudes de licencias o permisos en el período actual.</p>
                      </div>
                    </td>
                  </tr>
                ` : leaveRequests.map(l => {
                  const empName = l.EmployeeName || (l.FirstName ? `${l.FirstName} ${l.LastName}` : 'Colaborador');
                  const empInit = initials(empName);
                  return `
                  <tr>
                    <td><span class="folio-tag">#LIC-${String(l.Id).padStart(4, '0')}</span></td>
                    <td>
                      <div class="emp-cell-flex">
                        <div class="emp-avatar-sm">${escapeHtml(empInit)}</div>
                        <div class="emp-cell-info">
                          <strong>${escapeHtml(empName)}</strong>
                          <small>${escapeHtml(l.DepartmentName || l.PositionTitle || 'Personal')}</small>
                        </div>
                      </div>
                    </td>
                    <td><span class="tag-neutral">${escapeHtml(l.LeaveTypeName || 'Licencia Laboral')}</span></td>
                    <td><strong>${formatDate(l.StartDate)}</strong></td>
                    <td><strong>${formatDate(l.EndDate)}</strong></td>
                    <td><strong style="color:#0f172a;">${l.Duration ?? l.DaysRequested ?? l.RequestedDays ?? 0} días</strong></td>
                    <td>
                      <span class="badge-pill ${l.IsPaid ? 'success' : 'neutral'}">
                        <span class="badge-pill-dot"></span>${l.IsPaid ? 'Con Goce' : 'Sin Goce'}
                      </span>
                    </td>
                    <td>${renderStatusBadge(l.Status)}</td>
                    <td style="color:#64748b;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(l.Reason || '-')}</td>
                  </tr>
                `;}).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <!-- Pestaña 3: Calendario de Ausencias -->
      ${activeTab === 'calendar' ? `
        <div class="panel">
          <div class="panel-header">
            <h3>
              <svg viewBox="0 0 20 20" fill="currentColor" style="width:18px;height:18px;color:#2563eb;"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>
              <span>Calendario Consolidado de Ausencias Programadas</span>
            </h3>
            <span style="font-size:12px;color:#64748b;">Visualización de personal fuera de oficina</span>
          </div>
          <div class="calendar-events-container">
            ${calendarEvents.length === 0 ? `
              <div class="empty-state-modern" style="padding: 48px 24px;">
                <div class="empty-state-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3"/></svg>
                </div>
                <h4>Todo el Equipo Presente</h4>
                <p>No hay ausencias ni vacaciones aprobadas programadas para este mes.</p>
              </div>
            ` : `
              <div class="events-list-grid">
                ${calendarEvents.map(e => `
                  <div class="calendar-event-card ${e.type === 'Vacaciones' ? 'event-vacation' : 'event-leave'}">
                    <div class="event-icon-circle">
                      ${e.type === 'Vacaciones'
                        ? `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd"/></svg>`
                        : `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/></svg>`}
                    </div>
                    <div class="event-details">
                      <strong>${escapeHtml(e.employeeName)}</strong>
                      <span class="event-type">${escapeHtml(e.type)} · ${e.days} ${e.days === 1 ? 'día' : 'días'}</span>
                      <small class="event-dates">${formatDate(e.startDate)} al ${formatDate(e.endDate)}</small>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>
      ` : ''}

      <!-- Pestaña 4: Marco Legal Art. 177 -->
      ${activeTab === 'law' ? `
        <div class="panel">
          <div class="panel-header">
            <h3>
              <svg viewBox="0 0 20 20" fill="currentColor" style="width:18px;height:18px;color:#2563eb;"><path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" clip-rule="evenodd"/></svg>
              <span>Disposiciones del Código de Trabajo de la República Dominicana</span>
            </h3>
            <span style="font-size:12px;color:#64748b;">Marco normativo Ley 16-92</span>
          </div>
          <div class="law-articles-grid">
            <div class="law-card">
              <div class="law-badge">Artículo 177</div>
              <h4>Escala de Vacaciones Remuneradas</h4>
              <p>Los empleadores tienen la obligación de conceder a todo trabajador un período anual de vacaciones remuneradas conforme a la antigüedad:</p>
              <ul>
                <li><strong>Catorce (14) días laborables</strong> con disfrute de salario, después de un trabajo continuo no menor de un año ni mayor de cinco.</li>
                <li><strong>Dieciocho (18) días laborables</strong> con disfrute de salario, después de un trabajo continuo de cinco años en adelante.</li>
              </ul>
            </div>

            <div class="law-card">
              <div class="law-badge">Artículo 181</div>
              <h4>Pago Anticipado de Vacaciones</h4>
              <p>El salario correspondiente al período de vacaciones debe ser pagado al trabajador el día anterior al inicio de las mismas, conjuntamente con los salarios ordinarios devengados hasta esa fecha.</p>
            </div>

            <div class="law-card">
              <div class="law-badge">Artículo 54</div>
              <h4>Licencias Especiales con Goce de Sueldo</h4>
              <p>El empleador está obligado por ley a conceder al trabajador licencias con disfrute de salario íntegro en los casos de:</p>
              <ul>
                <li><strong>5 días laborables</strong> por motivo de matrimonio civil o canónico del trabajador.</li>
                <li><strong>3 días laborables</strong> en caso de fallecimiento de cónyuge, padres, hijos o abuelos.</li>
                <li><strong>2 días laborables</strong> por alumbramiento de la esposa o compañera debidamente registrada.</li>
              </ul>
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}
