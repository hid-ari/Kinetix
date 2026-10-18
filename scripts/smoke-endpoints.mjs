/**
 * Smoke test de conectividad: llama todos los endpoints GET con cada rol
 * y reporta respuestas 5xx (consultas rotas) o fallos de red.
 * Requiere el servidor corriendo. Uso: node scripts/smoke-endpoints.mjs
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const PASSWORD = 'Admin12345!';
const USERS = [
  'superadmin@kinetix.local', 'admin@kinetix.local', 'ana.martinez@kinetix.com',
  'director.rrhh@kinetix.local', 'carlos.mendoza@kinetix.local', 'carlos.gomez@kinetix.com'
];
const year = new Date().getFullYear();
const month = new Date().getMonth() + 1;
const ENDPOINTS = [
  '/api/health', '/api/profile', '/api/companies', '/api/users', '/api/branches',
  '/api/roles', '/api/permissions', '/api/audit', '/api/audit/export',
  '/api/inventory/products', '/api/inventory/stock', '/api/inventory/movements',
  '/api/finance/summary', '/api/finance/transactions', '/api/finance/contacts',
  '/api/finance/invoices', '/api/finance/bank-transactions',
  '/api/hr/dashboard', '/api/hr/org-chart', '/api/hr/catalogs', '/api/hr/settings',
  '/api/hr/departments', '/api/hr/positions', '/api/hr/employees', '/api/hr/employees/export',
  '/api/hr/attendance/today', '/api/hr/attendance', '/api/hr/attendance/shifts', '/api/hr/attendance/export',
  '/api/hr/vacations/balance', '/api/hr/vacations/requests', `/api/hr/vacations/calendar?month=${month}&year=${year}`,
  '/api/hr/leaves/types', '/api/hr/leaves/requests',
  '/api/hr/approvals/pending', '/api/hr/approvals/my-requests',
  '/api/hr/notifications', '/api/hr/notifications/unread-count'
];

let failures = 0;
for (const email of USERS) {
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD })
  });
  if (!login.ok) { console.log(`[${email}] LOGIN FALLÓ ${login.status}`); failures++; continue; }
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const profile = await (await fetch(`${BASE}/api/profile`, { headers: { Cookie: cookie } })).json();

  // Endpoints dependientes de un ID real
  const dyn = [];
  const emps = await fetch(`${BASE}/api/hr/employees`, { headers: { Cookie: cookie } });
  if (emps.ok) {
    const first = (await emps.json()).data?.[0];
    if (first) dyn.push(`/api/hr/employees/${first.Id}`, `/api/hr/employees/${first.Id}/history`,
      `/api/hr/employees/${first.Id}/documents`, `/api/hr/employees/${first.Id}/pdf`,
      `/api/hr/vacations/balance/${first.Id}`);
  }
  const deps = await fetch(`${BASE}/api/hr/departments`, { headers: { Cookie: cookie } });
  if (deps.ok) { const d = (await deps.json())[0]; if (d) dyn.push(`/api/hr/departments/${d.Id}`); }
  const pos = await fetch(`${BASE}/api/hr/positions`, { headers: { Cookie: cookie } });
  if (pos.ok) { const p = (await pos.json())[0]; if (p) dyn.push(`/api/hr/positions/${p.Id}`); }
  const roles = await fetch(`${BASE}/api/roles`, { headers: { Cookie: cookie } });
  if (roles.ok) { const r = (await roles.json())[0]; if (r) dyn.push(`/api/roles/${r.id}/permissions`); }

  const summary = {};
  for (const ep of [...ENDPOINTS, ...dyn]) {
    try {
      const res = await fetch(`${BASE}${ep}`, { headers: { Cookie: cookie } });
      summary[res.status] = (summary[res.status] || 0) + 1;
      if (res.status >= 500) {
        failures++;
        const body = await res.text();
        console.log(`  [${email}] ${res.status} ${ep} -> ${body.slice(0, 200)}`);
      }
    } catch (err) {
      failures++;
      console.log(`  [${email}] RED ${ep} -> ${err.message}`);
    }
  }
  console.log(`[${email}] rol=${profile.role} códigos=${JSON.stringify(summary)}`);
}
console.log(failures ? `\n${failures} fallos detectados.` : '\nOK: ningún endpoint devolvió 5xx.');
process.exit(failures ? 1 : 0);
