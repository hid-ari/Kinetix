import { state } from './state.js';
import { displayDate, toast } from '../components/utils.js';

export async function loadData() {
  const [companiesResponse, usersResponse, branchesResponse, rolesResponse, permissionsResponse, auditResponse, profileResponse, productsResponse, stockResponse, movementsResponse, financeResponse, financeTransactionsResponse, financeInvoicesResponse, financeContactsResponse, financeBankResponse] = await Promise.all([
    fetch(`/api/companies?page=${state.companiesPage}&pageSize=${state.companiesPageSize}`, { credentials: 'include' }),
    fetch(`/api/users?page=${state.usersPage}&pageSize=${state.usersPageSize}`, { credentials: 'include' }),
    fetch('/api/branches', { credentials: 'include' }),
    fetch('/api/roles', { credentials: 'include' }),
    fetch('/api/permissions', { credentials: 'include' }),
    fetch(`/api/audit?search=${encodeURIComponent(state.auditSearch)}&module=${encodeURIComponent(state.auditModule)}&action=${encodeURIComponent(state.auditAction)}`, { credentials: 'include' }),
    fetch('/api/profile', { credentials: 'include' }),
    fetch('/api/inventory/products', { credentials: 'include' }),
    fetch('/api/inventory/stock', { credentials: 'include' }),
    fetch('/api/inventory/movements', { credentials: 'include' }),
    fetch('/api/finance/summary', { credentials: 'include' }),
    fetch('/api/finance/transactions', { credentials: 'include' }),
    fetch('/api/finance/invoices', { credentials: 'include' }),
    fetch('/api/finance/contacts', { credentials: 'include' }),
    fetch('/api/finance/bank-transactions', { credentials: 'include' })
  ]);

  const requiredResponses = [
    ['empresas', companiesResponse], ['usuarios', usersResponse], ['sucursales', branchesResponse],
    ['auditoría', auditResponse], ['perfil', profileResponse], ['productos', productsResponse],
    ['existencias', stockResponse], ['movimientos', movementsResponse], ['finanzas', financeResponse],
    ['transacciones financieras', financeTransactionsResponse], ['facturas', financeInvoicesResponse],
    ['contactos financieros', financeContactsResponse], ['movimientos bancarios', financeBankResponse]
  ];

  const failedResources = requiredResponses.filter(([, response]) => !response.ok).map(([name]) => name);
  if (failedResources.length) {
    throw new Error(`No fue posible cargar: ${failedResources.join(', ')}.`);
  }

  const companiesPayload = await companiesResponse.json();
  state.companiesTotal = companiesPayload.total;
  state.companies = companiesPayload.data.map(company => ({
    id: company.Id, name: company.Name, rnc: company.Rnc, users: company.UserCount,
    activeUsers: company.ActiveUserCount, inactiveUsers: company.InactiveUserCount,
    branches: company.BranchCount, status: company.IsActive ? 'Activa' : 'Inactiva',
    date: displayDate(company.CreatedAt), email: company.ContactEmail || ''
  }));

  const usersPayload = await usersResponse.json();
  state.usersTotal = usersPayload.total ?? usersPayload.length;
  state.users = (usersPayload.data || usersPayload).map(user => ({
    id: user.id, name: user.name, email: user.email || 'Sin email', company: user.company,
    branch: user.branch || 'Sin sucursal', role: user.role, status: user.IsActive ? 'Activa' : 'Inactiva',
    last: displayDate(user.LastLoginAt)
  }));

  state.branches = (await branchesResponse.json()).map(branch => ({
    id: branch.id, name: branch.name, code: branch.code, company: branch.company,
    manager: branch.managerUserId || 'Sin encargado', users: branch.userCount,
    status: branch.IsActive ? 'Activa' : 'Inactiva'
  }));

  state.roles = rolesResponse.ok ? (await rolesResponse.json()).map(role => ({
    id: role.id, name: role.name, description: role.description || '', users: role.userCount, type: role.type
  })) : [];

  state.permissions = permissionsResponse.ok ? await permissionsResponse.json() : [];

  state.audit = (await auditResponse.json()).map(item => ({
    id: item.id, date: displayDate(item.CreatedAt), user: item.userName, action: item.action,
    module: item.module, record: item.record || item.entity || '', ip: item.ip || 'N/D'
  }));

  state.currentUser = await profileResponse.json();

  state.products = (await productsResponse.json()).map(product => ({
    id: product.id, sku: product.sku, name: product.name, category: product.category || 'Sin categoría',
    unit: product.unit, stock: Number(product.stock), minimum: Number(product.minimum), price: Number(product.price), active: product.isActive
  }));

  state.stock = (await stockResponse.json()).map(item => ({
    id: item.id, productId: item.productId, sku: item.sku, product: item.product,
    unit: item.unit, minimum: Number(item.minimum), quantity: Number(item.quantity), branchId: item.branchId, branch: item.branch
  }));

  state.movements = (await movementsResponse.json()).map(movement => ({
    id: movement.id, date: displayDate(movement.createdAt), type: movement.type, product: movement.product,
    productId: movement.productId, quantity: Number(movement.quantity), branchId: movement.branchId, warehouse: movement.branch, user: movement.userName
  }));

  const financePayload = await financeResponse.json();
  state.finance = {
    ...state.finance,
    ...Object.fromEntries(financePayload.transactions.map(item => [item.type === 'Ingreso' ? 'income' : 'expense', Number(item.total)])),
    transactions: await financeTransactionsResponse.json(),
    invoices: await financeInvoicesResponse.json(),
    contacts: await financeContactsResponse.json(),
    bank: await financeBankResponse.json()
  };

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
