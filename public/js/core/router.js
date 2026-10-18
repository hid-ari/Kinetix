import { state, canManageRoles, canAccessView } from './state.js';
import { layout } from '../components/layout.js';
import { bind } from './events.js';
// Auth Views
import { login, resetPasswordView } from '../views/auth/login.view.js';

// Dashboard Views
import { dashboard } from '../views/dashboard/dashboard.view.js';

// Admin Views
import { myCompany, companies } from '../views/admin/companies.view.js';
import { companyDetail } from '../views/admin/company-detail.view.js';
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
import { finance } from '../views/finance/finance.dashboard.view.js';
import { financeWorkspace } from '../views/finance/finance.workspace.view.js';

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

export function syncCompanySummary() {
  if (state.view !== 'company-detail') return;
  const company = state.companies.find(item => String(item.id) === String(state.detail));
  const values = document.querySelectorAll('.detail-summary strong');
  if (!company || values.length < 4) return;
  values[2].textContent = company.activeUsers ?? 0;
  values[3].textContent = company.inactiveUsers ?? 0;
}

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

  let content = state.view === 'dashboard' ? dashboard()
    : state.view === 'hr-dashboard' ? hrDashboard()
    : state.view === 'hr-employees' ? employeesView()
    : state.view === 'hr-employee-form' ? employeeForm(state.hr.editMode ? state.hr.currentEmployee : null)
    : state.view === 'hr-employee-detail' ? employeeDetailView(state.hr.currentEmployee)
    : state.view === 'hr-departments' ? departmentsView()
    : state.view === 'hr-positions' ? positionsView()
    : state.view === 'hr-attendance' ? attendanceView()
    : state.view === 'hr-vacations' ? vacationsView()
    : state.view === 'hr-approvals' ? approvalsView()
    : state.view === 'hr-orgchart' ? orgChartView()
    : state.view === 'inventory' ? inventory()
    : state.view === 'products' ? products()
    : state.view === 'stock' ? stock()
    : state.view === 'movements' ? movements()
    : state.view === 'alerts' ? alerts()
    : state.view === 'finance' ? finance() + financeWorkspace()
    : state.view === 'companies' ? (state.currentUser?.role === 'Super Admin' ? companies() : myCompany())
    : state.view === 'users' ? users()
    : state.view === 'branches' ? branches()
    : state.view === 'roles' ? roles()
    : state.view === 'audit' ? audit()
    : state.view === 'profile' ? profile()
    : state.view === 'company-form' ? form('company')
    : state.view === 'user-form' ? form('user')
    : state.view === 'branch-form' ? branchForm()
    : state.view === 'company-detail' ? companyDetail(state.detail)
    : state.view === 'user-detail' ? userDetail(state.detail)
    : state.view === 'branch-detail' ? branchDetail(state.detail)
    : dashboard();

  app.innerHTML = layout(content);
  bind(render);
  syncCompanySummary();
}

window.__renderFn = render;
