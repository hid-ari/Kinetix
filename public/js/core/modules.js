import { state, canAccessView } from './state.js';

/**
 * Arquitectura modular de Kinetix Suite (Single Source of Truth).
 * Mapea 1:1 los módulos del backend (server/modules) con los módulos y sub-vistas del cliente.
 */
export const MODULES_CONFIG = [
  {
    id: 'admin',
    label: 'Administración',
    desc: 'Información institucional, usuarios del sistema, sucursales, roles y auditoría corporativa.',
    color: 'slate',
    badgeType: 'blue',
    icon: '<path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/>',
    getHome: () => ['companies', 'users', 'branches', 'roles', 'audit'].find(v => canAccessView(v)) || 'companies',
    match: ['companies', 'users', 'user-detail', 'user-form', 'branches', 'branch-detail', 'branch-form', 'roles', 'audit'],
    items: [
      { id: 'companies', label: 'Resumen', match: ['companies'] },
      { id: 'users', label: 'Usuarios', match: ['users', 'user-detail', 'user-form'] },
      { id: 'branches', label: 'Sucursales', match: ['branches', 'branch-detail', 'branch-form'] },
      { id: 'roles', label: 'Roles y permisos', match: ['roles'] },
      { id: 'audit', label: 'Auditoría', match: ['audit'] }
    ],
    getBadgeText: () => `${state.branches?.length || 0} sucursales · ${state.users?.length || 0} usuarios`,
    submoduleTags: ['Resumen', 'Usuarios', 'Sucursales', 'Roles', 'Auditoría']
  },
  {
    id: 'hr',
    label: 'Recursos Humanos',
    desc: 'Gestión integral de personal, asistencias, vacaciones y estructura organizacional.',
    color: 'blue',
    badgeType: 'blue',
    icon: '<path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>',
    getHome: () => 'hr-dashboard',
    match: ['hr-dashboard', 'hr-employees', 'hr-employee-detail', 'hr-employee-form', 'hr-departments', 'hr-positions', 'hr-orgchart', 'hr-attendance', 'hr-vacations', 'hr-approvals'],
    items: [
      { id: 'hr-dashboard', label: 'Resumen', match: ['hr-dashboard'] },
      { id: 'hr-employees', label: 'Empleados', match: ['hr-employees', 'hr-employee-detail', 'hr-employee-form'] },
      { id: 'hr-departments', label: 'Departamentos', match: ['hr-departments'] },
      { id: 'hr-positions', label: 'Cargos y Puestos', match: ['hr-positions'] },
      { id: 'hr-orgchart', label: 'Organigrama', match: ['hr-orgchart'] },
      { id: 'hr-attendance', label: 'Asistencia & Turnos', match: ['hr-attendance'] },
      { id: 'hr-vacations', label: 'Vacaciones & Permisos', match: ['hr-vacations'] },
      { id: 'hr-approvals', label: 'Aprobaciones', match: ['hr-approvals'], getBadge: () => state.hr?.pendingApprovals?.length || 0 }
    ],
    getBadgeText: () => {
      const pending = state.hr?.pendingApprovals?.length || 0;
      return pending > 0 ? `${pending} por aprobar` : `${state.hr?.dashboard?.totalEmployees ?? state.users?.length ?? 0} empleados`;
    },
    submoduleTags: ['Empleados', 'Asistencia', 'Vacaciones', 'Estructura', 'Aprobaciones']
  },
  {
    id: 'inventory',
    label: 'Inventario & Stock',
    desc: 'Control de existencias multialmacén, catálogo de productos y trazabilidad de movimientos.',
    color: 'royal',
    badgeType: 'royal',
    icon: '<path d="M3 6.5L10 3l7 3.5v7L10 17l-7-3.5v-7z"/><path d="M3 6.5l7 3.5 7-3.5M10 10v7" fill="none" stroke="currentColor" stroke-width="1.2"/>',
    getHome: () => 'inventory',
    match: ['inventory', 'products', 'stock', 'movements', 'alerts'],
    items: [
      { id: 'inventory', label: 'Resumen', match: ['inventory'] },
      { id: 'products', label: 'Productos', match: ['products'] },
      { id: 'stock', label: 'Existencias', match: ['stock'] },
      { id: 'movements', label: 'Entradas / salidas', match: ['movements'] },
      { id: 'alerts', label: 'Alertas', match: ['alerts'] }
    ],
    getBadgeText: () => `${state.products?.length || 0} productos`,
    submoduleTags: ['Productos', 'Existencias', 'Movimientos', 'Alertas']
  },
  {
    id: 'finance',
    label: 'Finanzas',
    desc: 'Gestión de cobros, pagos a proveedores, facturación electrónica y bancos.',
    color: 'purple',
    badgeType: 'purple',
    icon: '<path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clip-rule="evenodd"/>',
    getHome: () => 'finance',
    match: ['finance', 'finance-transactions', 'finance-invoices', 'finance-contacts', 'finance-banking'],
    items: [
      { id: 'finance', label: 'Resumen', match: ['finance'] },
      { id: 'finance-transactions', label: 'Transacciones', match: ['finance-transactions'], getBadge: () => state.finance?.transactions?.length || 0 },
      { id: 'finance-invoices', label: 'Facturas', match: ['finance-invoices'], getBadge: () => state.finance?.invoices?.length || 0 },
      { id: 'finance-contacts', label: 'Clientes y Proveedores', match: ['finance-contacts'] },
      { id: 'finance-banking', label: 'Conciliación Bancaria', match: ['finance-banking'] }
    ],
    getBadgeText: () => 'Operaciones',
    submoduleTags: ['Facturación', 'Ingresos & Gastos', 'Bancos']
  }
];

/** Devuelve los módulos accesibles para el usuario actual */
export function getAllowedModules() {
  return MODULES_CONFIG.filter(mod => mod.items.some(item => canAccessView(item.id)));
}

/** Devuelve el módulo activo según la vista actual */
export function getActiveModule(view) {
  return MODULES_CONFIG.find(mod => mod.match.includes(view)) || null;
}

/** Resuelve el home de administración según permisos */
export function getAdminHome() {
  const adminMod = MODULES_CONFIG.find(m => m.id === 'admin');
  return adminMod ? adminMod.getHome() : 'companies';
}
