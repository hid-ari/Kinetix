import { state } from '../../core/state.js';
import { escapeHtml, initials } from '../../components/utils.js';

export function attendanceView() {
  const today = state.hr.todayAttendance || {};
  const currentAttendance = today.attendance;
  const shift = today.shift;
  const employee = today.employee;
  const list = state.hr.attendanceList || [];
  const shifts = state.hr.shifts || [];

  const hasCheckedIn = Boolean(currentAttendance?.CheckInTime);
  const hasCheckedOut = Boolean(currentAttendance?.CheckOutTime);

  // Modern pill status badge helper
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Puntual':
        return '<span class="badge-pill success"><span class="badge-pill-dot"></span>Puntual</span>';
      case 'Tardanza':
        return '<span class="badge-pill warning"><span class="badge-pill-dot"></span>Tardanza</span>';
      case 'Ausente':
        return '<span class="badge-pill danger"><span class="badge-pill-dot"></span>Ausente</span>';
      case 'Vacaciones':
        return '<span class="badge-pill info"><span class="badge-pill-dot"></span>Vacaciones</span>';
      case 'Permiso':
        return '<span class="badge-pill purple"><span class="badge-pill-dot"></span>Permiso</span>';
      case 'Completado':
        return '<span class="badge-pill success"><span class="badge-pill-dot"></span>Completada</span>';
      default:
        return `<span class="badge-pill neutral"><span class="badge-pill-dot"></span>${escapeHtml(status || 'Pendiente')}</span>`;
    }
  };

  // Format time (HH:mm)
  const formatTime = (isoString) => {
    if (!isoString) return '--:--';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return isoString;
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
      <!-- Encabezado de Gestión de Asistencias -->
      <div class="view-header">
        <div>
          <h2>Control de Asistencia y Turnos</h2>
          <p class="subtitle">Registro en tiempo real, control de jornadas y cumplimiento de tolerancias laborales</p>
        </div>
        <div class="header-actions">
          <button class="secondary" data-action="hr-refresh-attendance">
            <svg viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/></svg>
            <span>Actualizar</span>
          </button>
          <button class="primary" data-action="hr-open-attendance-correction">
            <svg viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
            <span>Solicitar Corrección</span>
          </button>
        </div>
      </div>

      <!-- Terminal Digital de Ponche Kinetix -->
      <div class="attendance-hero-card">
        <!-- Terminal de Hora Digital -->
        <div class="attendance-clock-terminal">
          <div>
            <div class="terminal-header">
              <div class="terminal-live-tag">
                <span class="pulse-dot"></span>
                <span>Hora Oficial Kinetix</span>
              </div>
              <span style="font-size: 11.5px; color: #94a3b8; font-weight: 500;">Santo Domingo (GMT-4)</span>
            </div>
            <div class="live-clock-time" id="hr-live-clock">--:--:--</div>
            <div class="live-clock-date">${new Date().toLocaleDateString('es-DO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
          <div class="shift-info-pill">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>
            <span>Turno: <strong>${escapeHtml(shift?.Name || 'Jornada Estándar')}</strong> (${shift?.StartTime ? shift.StartTime.slice(0, 5) : '08:00'} - ${shift?.EndTime ? shift.EndTime.slice(0, 5) : '17:00'})</span>
          </div>
        </div>

        <!-- Panel de Acciones de Ponche -->
        <div class="attendance-punch-panel">
          <div class="punch-status-card ${hasCheckedOut ? 'completed' : hasCheckedIn ? 'active' : 'idle'}">
            <div class="punch-status-icon-wrap">
              ${hasCheckedOut
                ? `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>`
                : hasCheckedIn
                  ? `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>`
                  : `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>`}
            </div>
            <div class="punch-status-info">
              <h4>${hasCheckedOut ? 'Jornada Finalizada Hoy' : hasCheckedIn ? 'Jornada en Curso' : 'Sin Ponche de Entrada'}</h4>
              <p>
                ${hasCheckedOut
                  ? `Salida: ${formatTime(currentAttendance.CheckOutTime)} · Horas Regulares: ${currentAttendance.RegularHours || 0}h · Extras: ${currentAttendance.OvertimeHours || 0}h`
                  : hasCheckedIn
                    ? `Entrada registrada a las ${formatTime(currentAttendance.CheckInTime)} (${currentAttendance.Status || 'Puntual'})`
                    : 'Registre su entrada al iniciar sus labores para computar puntualidad y jornada reglamentaria'}
              </p>
            </div>
          </div>

          <div class="punch-buttons-grid">
            <button class="btn-punch btn-punch-in" data-action="hr-punch-in" ${hasCheckedIn ? 'disabled' : ''}>
              <div class="btn-punch-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>
              </div>
              <div class="btn-punch-text">
                <strong>Registrar Entrada</strong>
                <small>${hasCheckedIn ? `Marcado: ${formatTime(currentAttendance.CheckInTime)}` : 'Inicio de labores'}</small>
              </div>
            </button>

            <button class="btn-punch btn-punch-out" data-action="hr-punch-out" ${(!hasCheckedIn || hasCheckedOut) ? 'disabled' : ''}>
              <div class="btn-punch-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
              </div>
              <div class="btn-punch-text">
                <strong>Registrar Salida</strong>
                <small>${hasCheckedOut ? `Marcado: ${formatTime(currentAttendance.CheckOutTime)}` : 'Cierre de labores'}</small>
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- Métricas Resumen -->
      <div class="hr-stats-grid">
        <div class="stat-card">
          <div class="stat-icon-wrapper blue">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>
          </div>
          <div class="stat-content">
            <span class="stat-label">Registros Totales</span>
            <strong class="stat-value">${state.hr.attendanceTotal || 0}</strong>
            <span class="stat-sub">Historial auditado</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-wrapper green">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
          </div>
          <div class="stat-content">
            <span class="stat-label">Puntualidad</span>
            <strong class="stat-value">${list.filter(a => a.Status === 'Puntual' || a.Status === 'Completado').length}</strong>
            <span class="stat-sub">En el período consultado</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-wrapper amber">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
          </div>
          <div class="stat-content">
            <span class="stat-label">Tardanzas</span>
            <strong class="stat-value">${list.filter(a => a.Status === 'Tardanza' || (a.LateMinutes > 0)).length}</strong>
            <span class="stat-sub">Incidencias registradas</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-wrapper purple">
            <svg viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/></svg>
          </div>
          <div class="stat-content">
            <span class="stat-label">Horas Extras</span>
            <strong class="stat-value">${list.reduce((acc, curr) => acc + Number(curr.OvertimeHours || 0), 0).toFixed(1)} h</strong>
            <span class="stat-sub">Total acumulado</span>
          </div>
        </div>
      </div>

      <!-- Filtros de Consulta -->
      <div class="filter-panel">
        <div class="filter-row">
          <div class="filter-field">
            <label>Fecha Desde</label>
            <input type="date" id="hr-att-start-date" value="${state.hr.attendanceStartDate || ''}">
          </div>
          <div class="filter-field">
            <label>Fecha Hasta</label>
            <input type="date" id="hr-att-end-date" value="${state.hr.attendanceEndDate || ''}">
          </div>
          <div class="filter-field">
            <label>Estado</label>
            <select id="hr-att-status">
              <option value="">Todos los estados</option>
              <option value="Puntual" ${state.hr.attendanceStatusFilter === 'Puntual' ? 'selected' : ''}>Puntual</option>
              <option value="Tardanza" ${state.hr.attendanceStatusFilter === 'Tardanza' ? 'selected' : ''}>Tardanza</option>
              <option value="Completado" ${state.hr.attendanceStatusFilter === 'Completado' ? 'selected' : ''}>Completado</option>
              <option value="Vacaciones" ${state.hr.attendanceStatusFilter === 'Vacaciones' ? 'selected' : ''}>Vacaciones</option>
              <option value="Permiso" ${state.hr.attendanceStatusFilter === 'Permiso' ? 'selected' : ''}>Permiso / Licencia</option>
              <option value="Ausente" ${state.hr.attendanceStatusFilter === 'Ausente' ? 'selected' : ''}>Ausente</option>
            </select>
          </div>
          <div class="filter-field btn-field">
            <button class="primary" data-action="hr-filter-attendance">Filtrar</button>
            <button class="secondary" data-action="hr-clear-attendance-filter">Limpiar</button>
          </div>
        </div>
      </div>

      <!-- Tabla de Asistencia -->
      <div class="panel">
        <div class="panel-header">
          <h3>
            <svg viewBox="0 0 20 20" fill="currentColor" style="width:18px;height:18px;color:#2563eb;"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>
            <span>Bitácora Detallada de Asistencia</span>
          </h3>
          <span class="panel-header-badge">${list.length} registros</span>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Colaborador</th>
                <th>Turno</th>
                <th>Entrada</th>
                <th>Salida</th>
                <th>Tardanza</th>
                <th>Regulares</th>
                <th>Extras</th>
                <th>Estado</th>
                <th style="text-align:right;">Acción</th>
              </tr>
            </thead>
            <tbody>
              ${list.length === 0 ? `
                <tr>
                  <td colspan="10" class="empty-cell">
                    <div class="empty-state-modern">
                      <div class="empty-state-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l4 2"/></svg>
                      </div>
                      <h4>Sin Registros de Asistencia</h4>
                      <p>No se encontraron marcaciones para el período y filtros seleccionados.</p>
                    </div>
                  </td>
                </tr>
              ` : list.map(item => {
                const empName = item.FirstName ? `${item.FirstName} ${item.LastName}` : (employee ? `${employee.FirstName} ${employee.LastName}` : 'Colaborador');
                const empInit = initials(empName);
                return `
                <tr>
                  <td><strong>${formatDate(item.AttendanceDate)}</strong></td>
                  <td>
                    <div class="emp-cell-flex">
                      <div class="emp-avatar-sm">${escapeHtml(empInit)}</div>
                      <div class="emp-cell-info">
                        <strong>${escapeHtml(empName)}</strong>
                        <small>${escapeHtml(item.PositionTitle || item.EmployeeCode || 'Personal')}</small>
                      </div>
                    </div>
                  </td>
                  <td><span class="tag-neutral">${escapeHtml(item.ShiftName || 'Jornada Estándar')}</span></td>
                  <td>${formatTime(item.CheckInTime)}</td>
                  <td>${formatTime(item.CheckOutTime)}</td>
                  <td>${item.LateMinutes > 0 ? `<span class="late-tag">+${item.LateMinutes} min</span>` : '<span style="color:#94a3b8;">0 min</span>'}</td>
                  <td>${Number(item.RegularHours || 0).toFixed(2)} h</td>
                  <td>${item.OvertimeHours > 0 ? `<strong style="color:#059669;">${Number(item.OvertimeHours).toFixed(2)} h</strong>` : '<span style="color:#94a3b8;">0.00 h</span>'}</td>
                  <td>${renderStatusBadge(item.Status)}</td>
                  <td style="text-align:right;">
                    <button class="icon-btn-action" data-action="hr-correct-attendance-row" data-id="${item.Id}" data-date="${item.AttendanceDate?.slice(0, 10)}" title="Solicitar Corrección">
                      <svg viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
                    </button>
                  </td>
                </tr>
              `;}).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Turnos de Trabajo Activos en la Empresa -->
      <div class="panel">
        <div class="panel-header">
          <h3>
            <svg viewBox="0 0 20 20" fill="currentColor" style="width:18px;height:18px;color:#2563eb;"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>
            <span>Turnos Laborales Registrados</span>
          </h3>
          <span style="font-size:12px;color:#64748b;">Políticas horarias y tolerancias vigentes</span>
        </div>
        <div class="grid-cards-shifts">
          ${shifts.map(s => `
            <div class="shift-card">
              <div class="shift-card-head">
                <strong>${escapeHtml(s.Name)}</strong>
                <span class="badge-pill ${s.IsActive ? 'success' : 'neutral'}"><span class="badge-pill-dot"></span>${s.IsActive ? 'Activo' : 'Inactivo'}</span>
              </div>
              <p class="shift-desc">${escapeHtml(s.Description || 'Turno operativo regular')}</p>
              <div class="shift-times">
                <div><span>Horario laboral:</span> <strong>${s.StartTime ? s.StartTime.slice(0, 5) : '08:00'} - ${s.EndTime ? s.EndTime.slice(0, 5) : '17:00'}</strong></div>
                <div><span>Tolerancia de entrada:</span> <strong>${s.GracePeriodMinutes || 0} min</strong></div>
                <div><span>Tiempo de almuerzo:</span> <strong>${s.LunchDurationMinutes || 0} min</strong></div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}
