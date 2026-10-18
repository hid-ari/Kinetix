export const state = {
  loggedIn: false,
  view: 'dashboard',
  detail: null,
  tab: 'Información',
  query: '',
  sidebarCollapsed: typeof window !== 'undefined' ? window.matchMedia('(max-width: 650px)').matches : false,
  currentUser: null,
  companies: [],
  companiesTotal: 0,
  companiesPage: 1,
  companiesPageSize: 20,
  users: [],
  usersTotal: 0,
  usersPage: 1,
  usersPageSize: 20,
  usersStatusFilter: '',
  auditSearch: '',
  auditModule: '',
  auditAction: '',
  branches: [],
  roles: [],
  permissions: [],
  audit: [],
  products: [],
  stock: [],
  movements: [],
  finance: { income: 0, expense: 0, transactions: [], invoices: [], contacts: [], bank: [] },
  financeTab: 'overview',
  movementType: 'Entrada',
  alertSeverityFilter: 'all',
  hr: {
    dashboard: null,
    catalogs: null,
    departments: [],
    positions: [],
    employees: [],
    employeesTotal: 0,
    employeesPage: 1,
    employeesPageSize: 20,
    employeesSearch: '',
    employeesStatusFilter: '',
    employeesDeptFilter: '',
    employeesBranchFilter: '',
    currentEmployee: null,
    currentEmployeeHistory: [],
    currentEmployeeDocuments: [],
    employeeTab: 'resumen',
    orgChart: null,
    // Fase 2
    unreadNotificationsCount: 0,
    notifications: [],
    pendingApprovals: [],
    pendingApprovalsTotal: 0,
    myApprovalRequests: [],
    approvalsTab: 'pending',
    todayAttendance: null,
    shifts: [],
    attendanceList: [],
    attendanceTotal: 0,
    attendancePage: 1,
    attendanceEmployeeFilter: '',
    attendanceStartDate: '',
    attendanceEndDate: '',
    attendanceStatusFilter: '',
    vacationBalance: null,
    vacationRequests: [],
    vacationCalendar: [],
    leaveTypes: [],
    leaveRequests: [],
    vacationsTab: 'vacations'
  }
};

export const nav = [
  { id: 'dashboard', icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 10a8 8 0 1116 0A8 8 0 012 10zm8-5a1 1 0 011 1v3.586l2.707 2.707a1 1 0 01-1.414 1.414l-3-3A1 1 0 019 10V6a1 1 0 011-1z"/></svg>`, label: 'Inicio', group: 'Inicio' },
  { id: 'hr-dashboard', icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/></svg>`, label: 'Recursos Humanos', group: 'Recursos Humanos' },
  { id: 'hr-employees', icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/></svg>`, label: 'Empleados', group: null },
  { id: 'hr-departments', icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4zm3 1h6v4H7V5zm6 6H7v2h6v-2z" clip-rule="evenodd"/></svg>`, label: 'Departamentos', group: null },
  { id: 'hr-positions', icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clip-rule="evenodd"/><path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z"/></svg>`, label: 'Cargos', group: null },
  { id: 'hr-attendance', icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>`, label: 'Asistencias y Turnos', group: null },
  { id: 'hr-vacations', icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>`, label: 'Vacaciones y Permisos', group: null },
  { id: 'hr-approvals', icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>`, label: 'Aprobaciones', group: null },
  { id: 'hr-orgchart', icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/></svg>`, label: 'Organigrama', group: null },
  { id: 'companies', icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4zm3 1h6v4H7V5zm6 6H7v2h6v-2z" clip-rule="evenodd"/></svg>`, label: 'Mi empresa', group: 'Administración' },
  { id: 'users', icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>`, label: 'Usuarios', group: null },
  { id: 'branches', icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/></svg>`, label: 'Sucursales', group: null },
  { id: 'roles', icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/><path d="M13 8a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1V9a1 1 0 011-1z"/></svg>`, label: 'Roles', group: null },
  { id: 'audit', icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>`, label: 'Auditoría', group: null },
  { id: 'inventory', icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 6.5L10 3l7 3.5v7L10 17l-7-3.5v-7z"/><path d="M3 6.5l7 3.5 7-3.5M10 10v7" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>`, label: 'Inventario', group: 'Operación' },
  { id: 'products', icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M4 4h12v12H4z"/><path d="M7 7h6M7 10h6M7 13h3" stroke="white" stroke-width="1.2" fill="none"/></svg>`, label: 'Productos', group: null },
  { id: 'stock', icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 15h14v2H3zM5 12h2v2H5zM9 8h2v6H9zM13 5h2v9h-2z"/></svg>`, label: 'Existencias', group: null },
  { id: 'movements', icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M4 5h9l-2-2 1.4-1.4L17.8 7l-5.4 5.4L11 11l2-2H4V5zM16 15H7l2 2-1.4 1.4L2.8 13l5.4-5.4L9.6 9l-2 2H16v4z"/></svg>`, label: 'Entradas / salidas', group: null },
  { id: 'alerts', icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a6 6 0 00-6 6v3l-2 3h16l-2-3V8a6 6 0 00-6-6zM8 16h4a2 2 0 01-4 0z"/></svg>`, label: 'Alertas', group: null },
  { id: 'finance', icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 4h14v12H3z"/><path d="M3 8h14M7 12h2" stroke="white" stroke-width="1.2" fill="none"/></svg>`, label: 'Finanzas', group: 'Finanzas' }
];

const navOrder = [
  'dashboard',
  'hr-dashboard', 'hr-employees', 'hr-departments', 'hr-positions', 'hr-attendance', 'hr-vacations', 'hr-approvals', 'hr-orgchart',
  'inventory', 'products', 'stock', 'movements', 'alerts',
  'finance',
  'companies', 'users', 'branches', 'roles', 'audit'
];
nav.sort((left, right) => navOrder.indexOf(left.id) - navOrder.indexOf(right.id));

export function isSuperAdmin() {
  return state.currentUser?.isSuperAdmin === true || state.currentUser?.role === 'Super Admin';
}

export function isCompanyAdmin() {
  return isSuperAdmin() || state.currentUser?.isCompanyAdmin === true || state.currentUser?.role === 'Company Admin';
}

export function canManageRoles() {
  return isSuperAdmin() || isCompanyAdmin() || hasPermission('Roles', 'Administrar roles');
}

export function hasPermission(moduleName, permissionName) {
  if (isSuperAdmin()) return true;
  const user = state.currentUser;
  if (!user) return false;
  if (user.role === 'Company Admin' || user.isCompanyAdmin) return true;

  const perms = Array.isArray(user.permissions) ? user.permissions : [];
  if (!permissionName) {
    return perms.some(p => p.startsWith(`${moduleName}|`));
  }
  return perms.includes(`${moduleName}|${permissionName}`);
}

export function canAccessView(viewId) {
  if (!state.loggedIn || !state.currentUser) return false;
  if (isSuperAdmin() || isCompanyAdmin()) return true;

  switch (viewId) {
    case 'dashboard':
      return true;
    case 'hr-dashboard':
      return hasPermission('RRHH Empleados', 'Ver empleados') || ['Director de RRHH', 'Analista de RRHH'].includes(state.currentUser?.role);
    case 'hr-employees':
    case 'hr-employee-detail':
    case 'hr-employee-form':
      return hasPermission('RRHH Empleados', 'Ver empleados');
    case 'hr-departments':
    case 'hr-positions':
    case 'hr-orgchart':
      return hasPermission('RRHH Estructura', 'Ver estructura');
    case 'hr-attendance':
      return hasPermission('RRHH Asistencia', 'Ver asistencia') || hasPermission('RRHH Asistencia', 'Registrar asistencia');
    case 'hr-vacations':
      return hasPermission('RRHH Vacaciones', 'Ver vacaciones') || hasPermission('RRHH Vacaciones', 'Solicitar vacaciones') || hasPermission('RRHH Permisos', 'Ver permisos');
    case 'hr-approvals':
      return hasPermission('RRHH Aprobaciones', 'Ver aprobaciones') || hasPermission('RRHH Aprobaciones', 'Aprobar solicitudes');
    case 'companies':
    case 'company-detail':
    case 'company-form':
      return hasPermission('Empresas', 'Ver empresas');
    case 'users':
    case 'user-detail':
    case 'user-form':
      return hasPermission('Usuarios', 'Ver usuarios');
    case 'branches':
    case 'branch-detail':
    case 'branch-form':
      return hasPermission('Sucursales', 'Ver sucursales');
    case 'roles':
      return canManageRoles() || hasPermission('Roles', 'Ver roles');
    case 'audit':
      return hasPermission('Auditoría', 'Ver auditoría');
    case 'inventory':
      return hasPermission('Inventario', 'Ver inventario');
    case 'products':
      return hasPermission('Productos', 'Ver productos');
    case 'stock':
      return hasPermission('Existencias', 'Ver existencias');
    case 'movements':
      return hasPermission('Movimientos', 'Ver movimientos');
    case 'alerts':
      return hasPermission('Alertas', 'Ver alertas');
    case 'finance':
      return hasPermission('Finanzas', 'Ver finanzas');
    case 'profile':
      return true;
    default:
      return true;
  }
}
