import { state, canManageRoles } from './state.js';
import { layout } from '../components/layout.js';
import { bind } from './events.js';
import { login, resetPasswordView } from '../views/auth/login.view.js';
import { dashboard } from '../views/dashboard/dashboard.view.js';
import {
  myCompany, companies, companyDetail, users, userDetail,
  branches, branchDetail, roles, audit, profile, form, branchForm
} from '../views/admin/admin.views.js';
import {
  inventory, products, stock, movements, alerts
} from '../views/inventory/inventory.views.js';
import { finance, financeWorkspace } from '../views/finance/finance.view.js';

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

  if (state.view === 'roles' && !canManageRoles()) state.view = 'dashboard';

  let content = state.view === 'dashboard' ? dashboard()
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
