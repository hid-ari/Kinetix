import { state } from '../../core/state.js';
import { toast } from '../../components/utils.js';

/**
 * Loads HR dashboard metrics
 */
export async function loadHrDashboard() {
  const res = await fetch('/api/hr/dashboard', { credentials: 'include' });
  if (!res.ok) throw new Error('No fue posible cargar el panel de RRHH.');
  state.hr.dashboard = await res.json();
  return state.hr.dashboard;
}

/**
 * Loads HR catalogs and settings
 */
export async function loadHrCatalogs() {
  const res = await fetch('/api/hr/catalogs', { credentials: 'include' });
  if (!res.ok) throw new Error('No fue posible cargar catálogos de RRHH.');
  state.hr.catalogs = await res.json();
  return state.hr.catalogs;
}

/**
 * Loads departments list
 */
export async function loadHrDepartments(filters = {}) {
  const params = new URLSearchParams();
  if (filters.branchId) params.set('branchId', filters.branchId);
  if (filters.search) params.set('search', filters.search);
  const res = await fetch(`/api/hr/departments?${params.toString()}`, { credentials: 'include' });
  if (!res.ok) throw new Error('No fue posible cargar departamentos.');
  state.hr.departments = await res.json();
  return state.hr.departments;
}

/**
 * Loads positions list
 */
export async function loadHrPositions(filters = {}) {
  const params = new URLSearchParams();
  if (filters.departmentId) params.set('departmentId', filters.departmentId);
  if (filters.search) params.set('search', filters.search);
  const res = await fetch(`/api/hr/positions?${params.toString()}`, { credentials: 'include' });
  if (!res.ok) throw new Error('No fue posible cargar cargos.');
  state.hr.positions = await res.json();
  return state.hr.positions;
}

/**
 * Loads employees with pagination and filters
 */
export async function loadHrEmployees() {
  const params = new URLSearchParams({
    page: String(state.hr.employeesPage || 1),
    pageSize: String(state.hr.employeesPageSize || 20)
  });

  if (state.hr.employeesSearch) params.set('search', state.hr.employeesSearch);
  if (state.hr.employeesStatusFilter) params.set('status', state.hr.employeesStatusFilter);
  if (state.hr.employeesDeptFilter) params.set('departmentId', state.hr.employeesDeptFilter);
  if (state.hr.employeesBranchFilter) params.set('branchId', state.hr.employeesBranchFilter);

  const res = await fetch(`/api/hr/employees?${params.toString()}`, { credentials: 'include' });
  if (!res.ok) throw new Error('No fue posible cargar empleados.');
  const payload = await res.json();
  state.hr.employees = payload.data;
  state.hr.employeesTotal = payload.total;
  return payload;
}

/**
 * Loads single employee detail along with documents and movement history
 */
export async function loadHrEmployeeDetail(id) {
  const [empRes, histRes, docsRes] = await Promise.all([
    fetch(`/api/hr/employees/${id}`, { credentials: 'include' }),
    fetch(`/api/hr/employees/${id}/history`, { credentials: 'include' }),
    fetch(`/api/hr/employees/${id}/documents`, { credentials: 'include' })
  ]);

  if (!empRes.ok) throw new Error('No fue posible cargar los datos del empleado.');
  state.hr.currentEmployee = await empRes.json();
  state.hr.currentEmployeeHistory = histRes.ok ? await histRes.json() : [];
  state.hr.currentEmployeeDocuments = docsRes.ok ? await docsRes.json() : [];
  return state.hr.currentEmployee;
}

/**
 * Loads org chart data
 */
export async function loadHrOrgChart() {
  const res = await fetch('/api/hr/org-chart', { credentials: 'include' });
  if (!res.ok) throw new Error('No fue posible cargar la estructura organizativa.');
  state.hr.orgChart = await res.json();
  return state.hr.orgChart;
}

/**
 * Creates new employee
 */
export async function saveEmployee(data) {
  const res = await fetch('/api/hr/employees', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.message || 'Error al guardar empleado.');
  return result;
}

/**
 * Updates basic employee information
 */
export async function updateEmployee(id, data) {
  const res = await fetch(`/api/hr/employees/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.message || 'Error al actualizar empleado.');
  return result;
}

/**
 * Submits a labor movement
 */
export async function submitLaborMovement(employeeId, actionType, data) {
  const endpoint = `/api/hr/employees/${employeeId}/${actionType}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.message || 'Error al registrar movimiento.');
  return result;
}

/**
 * Uploads a document to employee dossier
 */
export async function uploadEmployeeDocument(employeeId, formData) {
  const res = await fetch(`/api/hr/employees/${employeeId}/documents`, {
    method: 'POST',
    credentials: 'include',
    body: formData
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.message || 'Error al subir documento.');
  return result;
}

/**
 * Uploads employee photo
 */
export async function uploadEmployeePhoto(employeeId, formData) {
  const res = await fetch(`/api/hr/employees/${employeeId}/photo`, {
    method: 'PUT',
    credentials: 'include',
    body: formData
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.message || 'Error al actualizar foto.');
  return result;
}

/**
 * Uploads a new version of an existing document
 */
export async function uploadDocumentVersion(documentId, formData) {
  const res = await fetch(`/api/hr/documents/${documentId}/versions`, {
    method: 'POST',
    credentials: 'include',
    body: formData
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.message || 'Error al subir nueva versión del documento.');
  return result;
}

/**
 * Soft deletes document
 */
export async function deleteEmployeeDocument(documentId) {
  const res = await fetch(`/api/hr/documents/${documentId}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.message || 'Error al eliminar documento.');
  return result;
}

/**
 * Creates / updates department
 */
export async function saveDepartment(data, id = null) {
  const url = id ? `/api/hr/departments/${id}` : '/api/hr/departments';
  const method = id ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.message || 'Error al guardar departamento.');
  return result;
}

/**
 * Creates / updates position
 */
export async function savePosition(data, id = null) {
  const url = id ? `/api/hr/positions/${id}` : '/api/hr/positions';
  const method = id ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.message || 'Error al guardar cargo.');
  return result;
}

/* =========================================================================
   FASE 2: NOTIFICACIONES, APROBACIONES, ASISTENCIA, VACACIONES Y PERMISOS
   ========================================================================= */

/**
 * Carga contador de notificaciones no leídas
 */
export async function loadUnreadNotificationsCount() {
  try {
    const res = await fetch('/api/hr/notifications/unread-count', { credentials: 'include' });
    if (!res.ok) return 0;
    const data = await res.json();
    state.hr.unreadNotificationsCount = data.unreadCount || 0;
    return state.hr.unreadNotificationsCount;
  } catch {
    return 0;
  }
}

/**
 * Carga notificaciones del usuario
 */
export async function loadHrNotifications() {
  const res = await fetch('/api/hr/notifications', { credentials: 'include' });
  if (!res.ok) throw new Error('No fue posible cargar las notificaciones.');
  const payload = await res.json();
  const list = Array.isArray(payload) ? payload : (payload.data || []);
  state.hr.notifications = list;
  return list;
}

/**
 * Marca notificación como leída
 */
export async function markHrNotificationRead(id) {
  const res = await fetch(`/api/hr/notifications/${id}/read`, {
    method: 'PUT',
    credentials: 'include'
  });
  if (!res.ok) throw new Error('Error al actualizar notificación.');
  if (state.hr.unreadNotificationsCount > 0) state.hr.unreadNotificationsCount--;
  return await res.json();
}

/**
 * Marca todas las notificaciones como leídas
 */
export async function markAllHrNotificationsRead() {
  const res = await fetch('/api/hr/notifications/mark-all-read', {
    method: 'PUT',
    credentials: 'include'
  });
  if (!res.ok) throw new Error('Error al actualizar notificaciones.');
  state.hr.unreadNotificationsCount = 0;
  return await res.json();
}

/**
 * Carga solicitudes de aprobación pendientes del usuario actual
 */
export async function loadPendingApprovals() {
  const res = await fetch('/api/hr/approvals/pending', { credentials: 'include' });
  if (!res.ok) throw new Error('No fue posible cargar aprobaciones pendientes.');
  const data = await res.json();
  state.hr.pendingApprovals = data.requests || [];
  state.hr.pendingApprovalsTotal = data.totalPending || 0;
  return data;
}

/**
 * Carga solicitudes enviadas por el usuario
 */
export async function loadMyApprovalRequests() {
  const res = await fetch('/api/hr/approvals/my-requests', { credentials: 'include' });
  if (!res.ok) throw new Error('No fue posible cargar mis solicitudes.');
  state.hr.myApprovalRequests = await res.json();
  return state.hr.myApprovalRequests;
}

/**
 * Carga el detalle completo de un flujo de aprobación
 */
export async function loadApprovalDetail(id) {
  const res = await fetch(`/api/hr/approvals/${id}`, { credentials: 'include' });
  if (!res.ok) throw new Error('No fue posible cargar el detalle de la solicitud.');
  return await res.json();
}

/**
 * Procesa acción de aprobación o rechazo
 */
export async function processApprovalAction(id, action, comments = '') {
  const res = await fetch(`/api/hr/approvals/${id}/action`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, comments })
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.message || 'Error al procesar la aprobación.');
  return result;
}

/**
 * Carga estado de asistencia del día de hoy para el usuario o empleado
 */
export async function loadTodayAttendance() {
  const res = await fetch('/api/hr/attendance/today', { credentials: 'include' });
  if (!res.ok) throw new Error('No fue posible obtener el estado de asistencia.');
  state.hr.todayAttendance = await res.json();
  return state.hr.todayAttendance;
}

/**
 * Carga lista de turnos de trabajo configurados
 */
export async function loadHrShifts() {
  const res = await fetch('/api/hr/attendance/shifts', { credentials: 'include' });
  if (!res.ok) throw new Error('No fue posible cargar los turnos de trabajo.');
  state.hr.shifts = await res.json();
  return state.hr.shifts;
}

/**
 * Carga el registro general de asistencias con filtros
 */
export async function loadAttendanceList(filters = {}) {
  const params = new URLSearchParams({
    page: String(filters.page || state.hr.attendancePage || 1),
    pageSize: String(filters.pageSize || 20)
  });
  if (filters.employeeId || state.hr.attendanceEmployeeFilter) {
    params.set('employeeId', filters.employeeId || state.hr.attendanceEmployeeFilter);
  }
  if (filters.startDate || state.hr.attendanceStartDate) {
    params.set('startDate', filters.startDate || state.hr.attendanceStartDate);
  }
  if (filters.endDate || state.hr.attendanceEndDate) {
    params.set('endDate', filters.endDate || state.hr.attendanceEndDate);
  }
  if (filters.status || state.hr.attendanceStatusFilter) {
    params.set('status', filters.status || state.hr.attendanceStatusFilter);
  }

  const res = await fetch(`/api/hr/attendance?${params.toString()}`, { credentials: 'include' });
  if (!res.ok) throw new Error('No fue posible cargar el registro de asistencia.');
  const payload = await res.json();
  state.hr.attendanceList = payload.data || [];
  state.hr.attendanceTotal = payload.total || 0;
  return payload;
}

/**
 * Registra ponche de entrada
 */
export async function recordCheckIn(notes = '') {
  const res = await fetch('/api/hr/attendance/check-in', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes })
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.message || 'Error al registrar entrada.');
  return result;
}

/**
 * Registra ponche de salida
 */
export async function recordCheckOut(notes = '') {
  const res = await fetch('/api/hr/attendance/check-out', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes })
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.message || 'Error al registrar salida.');
  return result;
}

/**
 * Envía una solicitud de corrección de asistencia
 */
export async function requestAttendanceCorrection(data) {
  const res = await fetch('/api/hr/attendance/corrections', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.message || 'Error al solicitar corrección.');
  return result;
}

/**
 * Carga balance de vacaciones de un empleado
 */
export async function loadVacationBalance(employeeId = null) {
  const url = employeeId ? `/api/hr/vacations/balance?employeeId=${employeeId}` : '/api/hr/vacations/balance';
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('No fue posible calcular el balance de vacaciones.');
  const data = await res.json();
  state.hr.vacationBalance = data;
  return data;
}

/**
 * Carga solicitudes de vacaciones
 */
export async function loadVacationRequests(employeeId = null) {
  const url = employeeId ? `/api/hr/vacations/requests?employeeId=${employeeId}` : '/api/hr/vacations/requests';
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('No fue posible cargar las solicitudes de vacaciones.');
  const payload = await res.json();
  state.hr.vacationRequests = Array.isArray(payload) ? payload : (payload.data || []);
  return state.hr.vacationRequests;
}

/**
 * Crea solicitud de vacaciones
 */
export async function createVacationRequest(data) {
  const res = await fetch('/api/hr/vacations/request', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.message || 'Error al solicitar vacaciones.');
  return result;
}

/**
 * Carga eventos de vacaciones para el calendario
 */
export async function loadVacationCalendar(month, year, departmentId = null) {
  const params = new URLSearchParams({ month: String(month), year: String(year) });
  if (departmentId) params.set('departmentId', departmentId);
  const res = await fetch(`/api/hr/vacations/calendar?${params.toString()}`, { credentials: 'include' });
  if (!res.ok) throw new Error('No fue posible cargar el calendario de ausencias.');
  state.hr.vacationCalendar = await res.json();
  return state.hr.vacationCalendar;
}

/**
 * Carga catálogo de tipos de licencias
 */
export async function loadLeaveTypes() {
  const res = await fetch('/api/hr/leaves/types', { credentials: 'include' });
  if (!res.ok) throw new Error('No fue posible cargar los tipos de licencia.');
  state.hr.leaveTypes = await res.json();
  return state.hr.leaveTypes;
}

/**
 * Carga solicitudes de licencias
 */
export async function loadLeaveRequests(employeeId = null) {
  const url = employeeId ? `/api/hr/leaves/requests?employeeId=${employeeId}` : '/api/hr/leaves/requests';
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('No fue posible cargar las solicitudes de licencias.');
  const payload = await res.json();
  state.hr.leaveRequests = Array.isArray(payload) ? payload : (payload.data || []);
  return state.hr.leaveRequests;
}

/**
 * Crea solicitud de licencia
 */
export async function createLeaveRequest(data) {
  const res = await fetch('/api/hr/leaves/request', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.message || 'Error al solicitar licencia.');
  return result;
}

