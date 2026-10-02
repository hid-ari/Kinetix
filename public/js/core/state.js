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
  alertSeverityFilter: 'all'
};

export const nav = [
  { id: 'dashboard', icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 10a8 8 0 1116 0A8 8 0 012 10zm8-5a1 1 0 011 1v3.586l2.707 2.707a1 1 0 01-1.414 1.414l-3-3A1 1 0 019 10V6a1 1 0 011-1z"/></svg>`, label: 'Inicio', group: 'Inicio' },
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

const navOrder = ['dashboard', 'inventory', 'products', 'stock', 'movements', 'alerts', 'finance', 'companies', 'users', 'branches', 'roles', 'audit'];
nav.sort((left, right) => navOrder.indexOf(left.id) - navOrder.indexOf(right.id));

export function canManageRoles() {
  return ['Super Admin', 'Company Admin'].includes(state.currentUser?.role);
}
