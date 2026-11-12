import { state, canAccessView } from './state.js';
import { layout } from '../components/layout.js';
import { bind } from './events.js';
// Auth Views
import { login, resetPasswordView } from '../views/auth/login.view.js';

// Dashboard Views
import { dashboard } from '../views/dashboard/dashboard.view.js';

// Admin Views
import { myCompany } from '../views/admin/companies.view.js';
import { users } from '../views/admin/users.view.js';
import { userDetail } from '../views/admin/user-detail.view.js';
import { branches } from '../views/admin/branches.view.js';
import { branchDetail } from '../views/admin/branch-detail.view.js';
import { roles } from '../views/admin/roles.view.js';
import { audit } from '../views/admin/audit.view.js';
import { profile } from '../views/admin/profile.view.js';
import { form } from '../views/admin/forms.view.js';
import { branchForm } from '../views/admin/branch-form.view.js';

// Inventory Views
import { inventory } from '../views/inventory/inventory.dashboard.view.js';
import { products } from '../views/inventory/products.view.js';
import { stock } from '../views/inventory/stock.view.js';
import { movements } from '../views/inventory/movements.view.js';
import { alerts } from '../views/inventory/alerts.view.js';

// Finance Views
import {
  finance,
  financeTransactionsView,
  financeInvoicesView,
  financeContactsView,
  financeBankingView
} from '../views/finance/finance.view.js';

// HR Views
import { hrDashboard } from '../views/hr/hr.dashboard.view.js';
import { employeesView } from '../views/hr/employees.view.js';
import { employeeForm } from '../views/hr/employee-form.view.js';
import { employeeDetailView } from '../views/hr/employee-detail.view.js';
import { departmentsView } from '../views/hr/departments.view.js';
import { positionsView } from '../views/hr/positions.view.js';
import { orgChartView } from '../views/hr/org-chart.view.js';
import { attendanceView } from '../views/hr/attendance.view.js';
import { vacationsView } from '../views/hr/vacations.view.js';
import { approvalsView } from '../views/hr/approvals.view.js';

export function render() {
  const app = document.querySelector('#app');
  if (!app) return;

  if (!state.loggedIn) {
    app.innerHTML = state.view === 'reset-password' ? resetPasswordView() : login();
    bind(render);
    return;
  }

  // Protección integral de rutas basada en privilegios y alcance del rol
  if (!canAccessView(state.view)) {
    state.view = 'dashboard';
  }

  // Registro de vistas organizadas por arquitectura modular (Clean Code / Single Responsibility)
  const VIEW_REGISTRY = {
    // ── Inicio / Launchpad ────────────────────────
    dashboard: () => dashboard(),

    // ── Módulo: Administración ───────────────────
    companies: () => myCompany(),
    users: () => users(),
    'user-detail': () => userDetail(state.detail),
    'user-form': () => form('user'),
    branches: () => branches(),
    'branch-detail': () => branchDetail(state.detail),
    'branch-form': () => branchForm(),
    roles: () => roles(),
    audit: () => audit(),
    profile: () => profile(),

    // ── Módulo: Inventario & Stock ────────────────
    inventory: () => inventory(),
    products: () => products(),
    stock: () => stock(),
    movements: () => movements(),
    alerts: () => alerts(),

    // ── Módulo: Finanzas ──────────────────────────
    finance: () => finance(),
    'finance-transactions': () => financeTransactionsView(),
    'finance-invoices': () => financeInvoicesView(),
    'finance-contacts': () => financeContactsView(),
    'finance-banking': () => financeBankingView(),

    // ── Módulo: Recursos Humanos ─────────────────
    'hr-dashboard': () => hrDashboard(),
    'hr-employees': () => employeesView(),
    'hr-employee-form': () => employeeForm(state.hr.currentEmployee),
    'hr-employee-detail': () => employeeDetailView(state.hr.currentEmployee),
    'hr-departments': () => departmentsView(),
    'hr-positions': () => positionsView(),
    'hr-attendance': () => attendanceView(),
    'hr-vacations': () => vacationsView(),
    'hr-approvals': () => approvalsView(),
    'hr-orgchart': () => orgChartView()
  };

  const resolveView = VIEW_REGISTRY[state.view] || VIEW_REGISTRY.dashboard;
  const content = resolveView();

  app.innerHTML = layout(content);
  bind(render);
}

window.__renderFn = render;
