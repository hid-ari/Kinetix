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
    financeInvoicesResponse, financeContactsResponse, financeBankResponse,
    hrDashResponse, hrAppResponse
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
    fetch('/api/finance/bank-transactions', { credentials: 'include' }),
    fetch('/api/hr/dashboard', { credentials: 'include' }).catch(() => null),
    fetch('/api/hr/approvals/pending', { credentials: 'include' }).catch(() => null)
  ]);

  if (companiesResponse.ok) {
    const companiesPayload = await companiesResponse.json();
    state.companiesTotal = companiesPayload.total || 0;
    state.companies = (companiesPayload.data || []).map(company => ({
      id: company.Id,
      name: company.Name,
      rnc: company.Rnc,
      users: company.UserCount,
      activeUsers: company.ActiveUserCount,
      inactiveUsers: company.InactiveUserCount,
      branches: company.BranchCount,
      status: company.IsActive ? 'Activa' : 'Inactiva',
      date: displayDate(company.CreatedAt),
      email: company.ContactEmail || '',
      phone: company.Phone || '',
      address: company.Address || ''
    }));
  } else {
    state.companiesTotal = 0;
    state.companies = [];
  }

  if (usersResponse.ok) {
    const usersPayload = await usersResponse.json();
    state.usersTotal = usersPayload.total ?? (Array.isArray(usersPayload) ? usersPayload.length : (usersPayload.data?.length || 0));
    state.users = ((usersPayload.data || usersPayload) || []).map(user => ({
      id: user.id,
      name: user.name,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || 'Sin email',
      phone: user.phone || '',
      company: user.company,
      branchId: user.branchId || null,
      branch: user.branch || 'Sin sucursal',
      role: user.role,
      status: user.IsActive ? 'Activa' : 'Inactiva',
      last: displayDate(user.LastLoginAt),
      employeeId: user.employeeId || null,
      employeeCode: user.employeeCode || '',
      employeeName: user.employeeName || ''
    }));
  } else {
    state.usersTotal = 0;
    state.users = [];
  }

  if (branchesResponse.ok) {
    const branchesData = await branchesResponse.json();
    state.branches = (Array.isArray(branchesData) ? branchesData : []).map(branch => ({
      id: branch.id, companyId: branch.companyId, name: branch.name, code: branch.code, company: branch.company,
      address: branch.address || '', phone: branch.phone || '', email: branch.email || '',
      managerUserId: branch.managerUserId || '', manager: branch.managerName || 'Sin encargado',
      users: Number(branch.userCount) || 0,
      status: branch.IsActive ?? branch.isActive ? 'Activa' : 'Inactiva'
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

  if (hrDashResponse?.ok) {
    try { state.hr.dashboard = await hrDashResponse.json(); } catch (_) {}
  }
  if (hrAppResponse?.ok) {
    try {
      const appData = await hrAppResponse.json();
      state.hr.pendingApprovals = Array.isArray(appData) ? appData : (appData.requests || []);
    } catch (_) {}
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
  if (state.users.some(user => `${user.name} ${user.email}`.toLowerCase().includes(query))) state.view = 'users';
  else if (state.branches.some(branch => `${branch.name} ${branch.code}`.toLowerCase().includes(query))) state.view = 'branches';
  else { toast('No encontramos coincidencias.'); return; }
  renderFn();
}

export async function saveEntityForm(formElement, renderFn) {
  const data = Object.fromEntries(new FormData(formElement));
  const isEditUser = state.userEditId != null;

  const endpoint = isEditUser ? `/api/users/${state.userEditId}` : '/api/users';
  const method = isEditUser ? 'PUT' : 'POST';

  const response = await fetch(endpoint, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'No fue posible guardar la información.');

  await loadData();

  if (isEditUser) {
    state.detail = state.userEditId;
    state.view = 'user-detail';
    state.userEditId = null;
    toast('Usuario actualizado correctamente.');
  } else {
    state.view = 'users';
    toast('Usuario creado correctamente.');
  }
  state.query = '';
  renderFn();
  return { result, isEditUser, data };
}

/** Carga los usuarios activos de una empresa para el selector de encargado. */
export async function loadBranchManagers(companyId) {
  state.branchManagers = [];
  if (!companyId) return;
  try {
    const response = await fetch(`/api/branches/managers?companyId=${encodeURIComponent(companyId)}`, { credentials: 'include' });
    if (response.ok) state.branchManagers = await response.json();
  } catch { /* el selector queda con "Sin encargado" */ }
}

/** Carga los usuarios asignados a la sucursal abierta en el detalle. */
export async function loadBranchUsers(branchId) {
  state.branchUsers = [];
  try {
    const response = await fetch(`/api/branches/${branchId}/users`, { credentials: 'include' });
    if (response.ok) state.branchUsers = await response.json();
  } catch { /* se muestra la lista vacía */ }
}

export async function saveBranchForm(formElement, renderFn) {
  const editing = state.branchEditId != null;
  const payload = Object.fromEntries(new FormData(formElement));
  const response = await fetch(editing ? `/api/branches/${state.branchEditId}` : '/api/branches', {
    method: editing ? 'PUT' : 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'No fue posible guardar la sucursal.');
  await loadData();
  if (editing) {
    state.detail = state.branchEditId;
    state.view = 'branch-detail';
    await loadBranchUsers(state.detail);
  } else {
    state.view = 'branches';
  }
  state.branchEditId = null;
  toast(editing ? 'Sucursal actualizada correctamente.' : 'Sucursal creada correctamente.');
  renderFn();
}
