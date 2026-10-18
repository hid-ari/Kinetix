import { state } from './state.js';
import { displayDate, toast } from '../components/utils.js';

export async function loadData() {
  // 1. Validar autenticación de perfil antes de disparar consultas operativas
  const profileResponse = await fetch('/api/profile', { credentials: 'include' });
  if (!profileResponse.ok) {
    state.loggedIn = false;
    state.currentUser = null;
    if (profileResponse.status === 401) return;
    throw new Error('No fue posible cargar el perfil del usuario.');
  }

  state.currentUser = await profileResponse.json();
  state.loggedIn = true;

  // 2. Cargar en paralelo únicamente cuando hay sesión activa comprobada
  const [
    companiesResponse, usersResponse, branchesResponse, rolesResponse,
    permissionsResponse, auditResponse, productsResponse, stockResponse,
    movementsResponse, financeResponse, financeTransactionsResponse,
    financeInvoicesResponse, financeContactsResponse, financeBankResponse
  ] = await Promise.all([
    fetch(`/api/companies?page=${state.companiesPage}&pageSize=${state.companiesPageSize}`, { credentials: 'include' }),
    fetch(`/api/users?page=${state.usersPage}&pageSize=${state.usersPageSize}`, { credentials: 'include' }),
    fetch('/api/branches', { credentials: 'include' }),
    fetch('/api/roles', { credentials: 'include' }),
    fetch('/api/permissions', { credentials: 'include' }),
    fetch(`/api/audit?search=${encodeURIComponent(state.auditSearch)}&module=${encodeURIComponent(state.auditModule)}&action=${encodeURIComponent(state.auditAction)}`, { credentials: 'include' }),
    fetch('/api/inventory/products', { credentials: 'include' }),
    fetch('/api/inventory/stock', { credentials: 'include' }),
    fetch('/api/inventory/movements', { credentials: 'include' }),
    fetch('/api/finance/summary', { credentials: 'include' }),
    fetch('/api/finance/transactions', { credentials: 'include' }),
    fetch('/api/finance/invoices', { credentials: 'include' }),
    fetch('/api/finance/contacts', { credentials: 'include' }),
    fetch('/api/finance/bank-transactions', { credentials: 'include' })
  ]);

  if (companiesResponse.ok) {
    const companiesPayload = await companiesResponse.json();
    state.companiesTotal = companiesPayload.total || 0;
    state.companies = (companiesPayload.data || []).map(company => ({
      id: company.Id, name: company.Name, rnc: company.Rnc, users: company.UserCount,
      activeUsers: company.ActiveUserCount, inactiveUsers: company.InactiveUserCount,
      branches: company.BranchCount, status: company.IsActive ? 'Activa' : 'Inactiva',
      date: displayDate(company.CreatedAt), email: company.ContactEmail || ''
    }));
  } else {
    state.companiesTotal = 0;
    state.companies = [];
  }

  if (usersResponse.ok) {
    const usersPayload = await usersResponse.json();
    state.usersTotal = usersPayload.total ?? (Array.isArray(usersPayload) ? usersPayload.length : (usersPayload.data?.length || 0));
    state.users = ((usersPayload.data || usersPayload) || []).map(user => ({
      id: user.id, name: user.name, email: user.email || 'Sin email', company: user.company,
      branch: user.branch || 'Sin sucursal', role: user.role, status: user.IsActive ? 'Activa' : 'Inactiva',
      last: displayDate(user.LastLoginAt)
    }));
  } else {
    state.usersTotal = 0;
    state.users = [];
  }

  if (branchesResponse.ok) {
    const branchesData = await branchesResponse.json();
    state.branches = (Array.isArray(branchesData) ? branchesData : []).map(branch => ({
      id: branch.id, name: branch.name, code: branch.code, company: branch.company,
      manager: branch.managerUserId || 'Sin encargado', users: branch.userCount,
      status: branch.IsActive ? 'Activa' : 'Inactiva'
    }));
  } else {
    state.branches = [];
  }

  state.roles = rolesResponse.ok ? (await rolesResponse.json()).map(role => ({
    id: role.id, name: role.name, description: role.description || '', users: role.userCount, userCount: role.userCount, type: role.type, isSystem: Boolean(role.isSystem || role.type === 'Sistema')
  })) : [];

  state.permissions = permissionsResponse.ok ? await permissionsResponse.json() : [];

  if (auditResponse.ok) {
    const auditData = await auditResponse.json();
    state.audit = (Array.isArray(auditData) ? auditData : []).map(item => ({
      id: item.id, date: displayDate(item.CreatedAt), user: item.userName, action: item.action,
      module: item.module, record: item.record || item.entity || '', ip: item.ip || 'N/D'
    }));
  } else {
    state.audit = [];
  }

  if (productsResponse.ok) {
    const productsData = await productsResponse.json();
    state.products = (Array.isArray(productsData) ? productsData : []).map(product => ({
      id: product.id, sku: product.sku, name: product.name, category: product.category || 'Sin categoría',
      unit: product.unit, stock: Number(product.stock), minimum: Number(product.minimum), price: Number(product.price), active: product.isActive
    }));
  } else {
    state.products = [];
  }

  if (stockResponse.ok) {
    const stockData = await stockResponse.json();
    state.stock = (Array.isArray(stockData) ? stockData : []).map(item => ({
      id: item.id, productId: item.productId, sku: item.sku, product: item.product,
      unit: item.unit, minimum: Number(item.minimum), quantity: Number(item.quantity), branchId: item.branchId, branch: item.branch
    }));
  } else {
    state.stock = [];
  }

  if (movementsResponse.ok) {
    const movementsData = await movementsResponse.json();
    state.movements = (Array.isArray(movementsData) ? movementsData : []).map(movement => ({
      id: movement.id, date: displayDate(movement.createdAt), type: movement.type, product: movement.product,
      productId: movement.productId, quantity: Number(movement.quantity), branchId: movement.branchId, warehouse: movement.branch, user: movement.userName
    }));
  } else {
    state.movements = [];
  }

  if (financeResponse.ok) {
    const financePayload = await financeResponse.json();
    state.finance = {
      ...state.finance,
      ...Object.fromEntries(((financePayload && financePayload.transactions) || []).map(item => [item.type === 'Ingreso' ? 'income' : 'expense', Number(item.total)])),
      transactions: financeTransactionsResponse.ok ? await financeTransactionsResponse.json() : [],
      invoices: financeInvoicesResponse.ok ? await financeInvoicesResponse.json() : [],
      contacts: financeContactsResponse.ok ? await financeContactsResponse.json() : [],
      bank: financeBankResponse.ok ? await financeBankResponse.json() : []
    };
  } else {
    state.finance = {
      ...state.finance,
      income: 0,
      expense: 0,
      transactions: [],
      invoices: [],
      contacts: [],
      bank: []
    };
  }

  try {
    const notifRes = await fetch('/api/hr/notifications/unread-count', { credentials: 'include' });
    if (notifRes.ok) {
      const nd = await notifRes.json();
      state.hr.unreadNotificationsCount = nd.unreadCount || 0;
    }
  } catch {}
}

export function runGlobalSearch(renderFn) {
  const query = state.query.trim().toLowerCase();
  if (!query) return;
  if (state.users.some(user => `${user.name} ${user.email} ${user.company}`.toLowerCase().includes(query))) state.view = 'users';
  else if (state.companies.some(company => `${company.name} ${company.rnc}`.toLowerCase().includes(query))) state.view = 'companies';
  else if (state.branches.some(branch => `${branch.name} ${branch.code} ${branch.company}`.toLowerCase().includes(query))) state.view = 'branches';
  else { toast('No encontramos coincidencias.'); return; }
  renderFn();
}

export async function saveEntityForm(formElement, renderFn) {
  const data = Object.fromEntries(new FormData(formElement));
  const endpoint = state.view === 'company-form' ? '/api/companies' : '/api/users';
  const response = await fetch(endpoint, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'No fue posible guardar la información.');
  await loadData();
  state.view = state.view === 'company-form' ? 'companies' : 'users';
  state.query = '';
  toast(state.view === 'companies' ? 'Empresa creada correctamente.' : 'Usuario creado correctamente.');
  renderFn();
}

export async function saveBranchForm(formElement, renderFn) {
  const response = await fetch('/api/branches', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(formElement))) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'No fue posible guardar la sucursal.');
  await loadData();
  state.view = 'branches';
  toast('Sucursal creada correctamente.');
  renderFn();
}
