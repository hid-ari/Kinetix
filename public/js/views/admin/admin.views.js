import { state } from '../../core/state.js';
import { escapeHtml, badge, initials as getInitials } from '../../components/utils.js';
import { breadcrumb, pageHeader } from '../../components/ui.js';

export function myCompany() {
  const company = state.companies[0];
  if (!company) {
    return `${breadcrumb([['dashboard', 'Inicio'], ['companies', 'Mi empresa']])}${pageHeader('Mi empresa', 'No hay una organización disponible para tu usuario.')}<div class="panel empty">No se encontró el perfil de la empresa.</div>`;
  }
  
  const initials = escapeHtml((company.name || 'Empresa').slice(0, 2).toUpperCase());
  const rncFormatted = escapeHtml(company.rnc || 'Sin RNC');
  const emailFormatted = escapeHtml(company.email || 'Sin correo de contacto registrado');
  
  return `
    ${breadcrumb([['dashboard', 'Inicio'], ['companies', 'Mi empresa']])}
    ${pageHeader('Mi empresa', 'Información general de tu organización y alcance operativo en Kinetix.')}
    
    <div class="company-hero-card">
      <div class="company-hero-main">
        <div class="company-hero-avatar">${initials}</div>
        <div class="company-hero-details">
          <h1>${escapeHtml(company.name)}</h1>
          <p>
            <span>RNC ${rncFormatted}</span>
            <span>·</span>
            ${badge(company.status)}
          </p>
        </div>
      </div>
      <div class="inline-actions">
        <button class="secondary" data-nav="branches">
          <svg viewBox="0 0 20 20" fill="currentColor" style="width:15px;height:15px;"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/></svg>
          <span>Ver sucursales</span>
        </button>
        <button class="primary" data-nav="users">
          <svg viewBox="0 0 20 20" fill="currentColor" style="width:15px;height:15px;"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
          <span>Gestionar usuarios</span>
        </button>
      </div>
    </div>
    
    <div class="stats" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 24px;">
      <div class="company-metric-card">
        <div class="company-metric-icon">
          <svg viewBox="0 0 20 20" fill="currentColor" style="width:20px;height:20px;"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
        </div>
        <div class="company-metric-data">
          <strong>${company.users ?? 0}</strong>
          <span>Usuarios totales</span>
        </div>
      </div>
      
      <div class="company-metric-card branches">
        <div class="company-metric-icon">
          <svg viewBox="0 0 20 20" fill="currentColor" style="width:20px;height:20px;"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/></svg>
        </div>
        <div class="company-metric-data">
          <strong>${company.branches ?? 0}</strong>
          <span>Sucursales registradas</span>
        </div>
      </div>
      
      <div class="company-metric-card active">
        <div class="company-metric-icon">
          <svg viewBox="0 0 20 20" fill="currentColor" style="width:20px;height:20px;"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
        </div>
        <div class="company-metric-data">
          <strong>${company.activeUsers ?? 0}</strong>
          <span>Usuarios activos</span>
        </div>
      </div>
      
      <div class="company-metric-card inactive">
        <div class="company-metric-icon">
          <svg viewBox="0 0 20 20" fill="currentColor" style="width:20px;height:20px;"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>
        </div>
        <div class="company-metric-data">
          <strong>${company.inactiveUsers ?? 0}</strong>
          <span>Usuarios inactivos</span>
        </div>
      </div>
    </div>
    
    <div class="grid-2">
      <div class="panel">
        <div class="panel-head">
          <h2>Información de la empresa</h2>
          <span class="panel-note">Datos generales</span>
        </div>
        <div class="panel-body">
          <div class="form-grid" style="gap: 14px;">
            <div class="company-info-tile">
              <div class="company-info-icon">
                <svg viewBox="0 0 20 20" fill="currentColor" style="width:18px;height:18px;"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4zm3 1h6v4H7V5zm6 6H7v2h6v-2z" clip-rule="evenodd"/></svg>
              </div>
              <div class="company-info-text">
                <span>Nombre fiscal</span>
                <strong>${escapeHtml(company.name)}</strong>
              </div>
            </div>
            
            <div class="company-info-tile">
              <div class="company-info-icon">
                <svg viewBox="0 0 20 20" fill="currentColor" style="width:18px;height:18px;"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd"/></svg>
              </div>
              <div class="company-info-text">
                <span>RNC (Registro Nacional)</span>
                <strong>${rncFormatted}</strong>
              </div>
            </div>
            
            <div class="company-info-tile">
              <div class="company-info-icon">
                <svg viewBox="0 0 20 20" fill="currentColor" style="width:18px;height:18px;"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>
              </div>
              <div class="company-info-text">
                <span>Email de contacto</span>
                <strong>${emailFormatted}</strong>
              </div>
            </div>
            
            <div class="company-info-tile">
              <div class="company-info-icon">
                <svg viewBox="0 0 20 20" fill="currentColor" style="width:18px;height:18px;"><path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
              </div>
              <div class="company-info-text">
                <span>Estado de acceso</span>
                <div style="margin-top:2px;">${badge(company.status)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="panel">
        <div class="panel-head">
          <h2>Tu espacio de trabajo</h2>
          <span class="panel-note">Seguridad y alcance</span>
        </div>
        <div class="panel-body">
          <p class="subtitle" style="margin-top:0; margin-bottom:18px; line-height:1.5;">
            La información expuesta en este portal pertenece exclusivamente a la empresa <strong>${escapeHtml(company.name)}</strong>. Todos los accesos y registros están protegidos bajo aislamiento multi-inquilino.
          </p>
          
          <button class="space-action-card" data-nav="users">
            <div class="space-action-card-left">
              <div class="space-action-icon">
                <svg viewBox="0 0 20 20" fill="currentColor" style="width:16px;height:16px;"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
              </div>
              <div>
                <strong>Ver usuarios asignados</strong>
                <small>Consulta lista de colaboradores y permisos</small>
              </div>
            </div>
            <span class="space-action-arrow">→</span>
          </button>
          
          <button class="space-action-card" data-nav="branches">
            <div class="space-action-card-left">
              <div class="space-action-icon">
                <svg viewBox="0 0 20 20" fill="currentColor" style="width:16px;height:16px;"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/></svg>
              </div>
              <div>
                <strong>Sucursales de la empresa</strong>
                <small>Administra las sedes registradas</small>
              </div>
            </div>
            <span class="space-action-arrow">→</span>
          </button>
          
          <button class="space-action-card" data-nav="profile">
            <div class="space-action-card-left">
              <div class="space-action-icon">
                <svg viewBox="0 0 20 20" fill="currentColor" style="width:16px;height:16px;"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/></svg>
              </div>
              <div>
                <strong>Mi perfil de usuario</strong>
                <small>Modifica datos personales y contraseña</small>
              </div>
            </div>
            <span class="space-action-arrow">→</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

export function companies() {
  const items = state.companies.filter(c => `${c.name} ${c.rnc}`.toLowerCase().includes(state.query.toLowerCase()));
  const start = state.companiesTotal ? ((state.companiesPage - 1) * state.companiesPageSize) + 1 : 0;
  const end = start ? Math.min(start + items.length - 1, state.companiesTotal) : 0;
  const pageCount = Math.max(Math.ceil(state.companiesTotal / state.companiesPageSize), 1);
  return `
    ${breadcrumb([['dashboard', 'Administración'], ['companies', 'Empresas']])}
    ${pageHeader('Empresas', 'Administra las organizaciones y su estado de acceso.', '<button class="primary" data-action="new-company">＋ Nueva empresa</button>')}
    <div class="panel">
      <div class="table-toolbar">
        <div class="filter-row">
          <input id="page-search" placeholder="Buscar por nombre o RNC..." value="${escapeHtml(state.query)}" style="min-width:260px;">
          <select>
            <option>Todos los estados</option>
            <option>Activa</option>
            <option>Inactiva</option>
          </select>
        </div>
        <span class="panel-note">${state.companiesTotal} empresas registradas</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Empresa</th>
              <th>RNC</th>
              <th>Usuarios</th>
              <th>Sucursales</th>
              <th>Estado</th>
              <th>Fecha de Alta</th>
              <th style="text-align:right;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${items.length ? items.map(c => {
              const cInitials = getInitials(c.name || 'Empresa');
              return `
                <tr>
                  <td>
                    <div class="emp-cell-flex">
                      <div class="emp-avatar-sm" style="width:34px;height:34px;font-size:11.5px;background:linear-gradient(135deg,#0284c7 0%,#0369a1 100%);">
                        ${escapeHtml(cInitials)}
                      </div>
                      <div class="emp-cell-info">
                        <strong>${escapeHtml(c.name)}</strong>
                        <small>${escapeHtml(c.email)}</small>
                      </div>
                    </div>
                  </td>
                  <td><span class="folio-tag">${escapeHtml(c.rnc)}</span></td>
                  <td><strong style="font-variant-numeric:tabular-nums;">${c.users}</strong></td>
                  <td><strong style="font-variant-numeric:tabular-nums;">${c.branches}</strong></td>
                  <td>${badge(c.status)}</td>
                  <td><span style="font-variant-numeric:tabular-nums; color:var(--muted);">${c.date}</span></td>
                  <td style="text-align:right;">
                    <button class="row-action" data-detail="company" data-id="${c.id}">Ver detalle →</button>
                  </td>
                </tr>
              `;
            }).join('') : '<tr><td colspan="7" class="empty">No encontramos empresas con esa búsqueda.</td></tr>'}
          </tbody>
        </table>
      </div>
      <div class="pagination">
        <span>Mostrando ${start}-${end} de ${state.companiesTotal} registros</span>
        <div class="pages">
          ${Array.from({ length: pageCount }, (_, index) => `
            <button class="${index + 1 === state.companiesPage ? 'active' : ''}" data-page="${index + 1}">${index + 1}</button>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

export function companyDetail(id) {
  const c = state.companies.find(x => String(x.id) === String(id));
  if (!c) return '<div class="empty">Empresa no encontrada.</div>';
  return `
    ${breadcrumb([['dashboard', 'Administración'], ['companies', 'Empresas'], ['companies', escapeHtml(c.name)]])}
    <div class="detail-head">
      <div>
        <h1>${escapeHtml(c.name)}</h1>
        <p class="subtitle">RNC ${escapeHtml(c.rnc)} · ${badge(c.status)}</p>
      </div>
      <div class="inline-actions">
        <button class="secondary" data-action="edit-company">Editar</button>
        <button class="${c.status === 'Activa' ? 'danger' : 'primary'}" data-action="toggle-company">
          ${c.status === 'Activa' ? 'Desactivar' : 'Activar'}
        </button>
      </div>
    </div>
    <div class="detail-summary">
      <div><strong>${c.users}</strong><span>Usuarios totales</span></div>
      <div><strong>${c.branches}</strong><span>Sucursales</span></div>
      <div><strong>${c.activeUsers ?? 0}</strong><span>Usuarios activos</span></div>
      <div><strong>${c.inactiveUsers ?? 0}</strong><span>Usuarios inactivos</span></div>
    </div>
    <div class="detail-tabs">
      ${['Información', 'Usuarios', 'Sucursales', 'Auditoría'].map(t => `
        <button class="${state.tab === t ? 'active' : ''}" data-tab="${t}">${t}</button>
      `).join('')}
    </div>
    <div class="panel">
      <div class="panel-body">
        ${state.tab === 'Información' ? `
          <h2>Información general</h2>
          <div class="form-grid" style="margin-top:18px">
            <div><span class="panel-note">Email de contacto</span><p><strong>${escapeHtml(c.email)}</strong></p></div>
            <div><span class="panel-note">Fecha de creación</span><p><strong>${c.date}</strong></p></div>
            <div><span class="panel-note">Estado de cuenta</span><div style="margin-top:4px;">${badge(c.status)}</div></div>
          </div>
        ` : `
          <h2>${escapeHtml(state.tab)}</h2>
          <p class="subtitle" style="margin-top:10px">Contenido cargado bajo demanda para ${escapeHtml(c.name)}.</p>
        `}
      </div>
    </div>
  `;
}

export function users() {
  const items = state.users.filter(u => `${u.name} ${u.email} ${u.company}`.toLowerCase().includes(state.query.toLowerCase()) && (!state.usersStatusFilter || u.status === state.usersStatusFilter));
  const pageCount = Math.max(Math.ceil(state.usersTotal / state.usersPageSize), 1);
  const start = state.usersTotal ? ((state.usersPage - 1) * state.usersPageSize) + 1 : 0;
  const end = start ? Math.min(start + items.length - 1, state.usersTotal) : 0;
  return `
    ${breadcrumb([['dashboard', 'Administración'], ['users', 'Usuarios']])}
    ${pageHeader('Usuarios', 'Controla identidades, perfiles y acceso multi-inquilino por empresa.', '<button class="primary" data-action="new-user">＋ Nuevo usuario</button>')}
    <div class="panel">
      <div class="table-toolbar">
        <div class="filter-row">
          <input id="page-search" placeholder="Buscar nombre o email..." value="${escapeHtml(state.query)}" style="min-width:260px;">
          <select data-users-status-filter>
            <option value="">Todos los estados</option>
            <option value="Activa" ${state.usersStatusFilter === 'Activa' ? 'selected' : ''}>Activa</option>
            <option value="Inactiva" ${state.usersStatusFilter === 'Inactiva' ? 'selected' : ''}>Inactiva</option>
          </select>
        </div>
        <span class="panel-note">${state.usersTotal} usuarios</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Empresa</th>
              <th>Sucursal</th>
              <th>Rol de Acceso</th>
              <th>Estado</th>
              <th>Último Acceso</th>
              <th style="text-align:right;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(u => {
              const uInitials = getInitials(u.name || 'Usuario');
              return `
                <tr>
                  <td>
                    <div class="emp-cell-flex">
                      <div class="emp-avatar-sm" style="width:34px;height:34px;font-size:11.5px;">
                        ${escapeHtml(uInitials)}
                      </div>
                      <div class="emp-cell-info">
                        <strong>${escapeHtml(u.name)}</strong>
                        <small>${escapeHtml(u.email)}</small>
                      </div>
                    </div>
                  </td>
                  <td><strong>${escapeHtml(u.company)}</strong></td>
                  <td>${escapeHtml(u.branch || 'Todas')}</td>
                  <td><span class="tag-neutral">${escapeHtml(u.role)}</span></td>
                  <td>${badge(u.status)}</td>
                  <td><span style="font-variant-numeric:tabular-nums; color:var(--muted); font-size:12px;">${u.last}</span></td>
                  <td style="text-align:right;">
                    <button class="row-action" data-detail="user" data-id="${u.id}">Ver detalle →</button>
                  </td>
                </tr>
              `;
            }).join('') || '<tr><td colspan="7" class="empty">No encontramos usuarios con ese criterio.</td></tr>'}
          </tbody>
        </table>
      </div>
      <div class="pagination">
        <span>Mostrando ${start}-${end} de ${state.usersTotal} registros</span>
        <div class="pages">
          ${Array.from({ length: pageCount }, (_, i) => `
            <button class="${i + 1 === state.usersPage ? 'active' : ''}" data-users-page="${i + 1}">${i + 1}</button>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

export function userDetail(id) {
  const u = state.users.find(x => String(x.id) === String(id));
  if (!u) return '<div class="empty">Usuario no encontrado.</div>';
  return `
    ${breadcrumb([['dashboard', 'Administración'], ['users', 'Usuarios'], ['users', u.name]])}
    <div class="detail-head">
      <div>
        <h1>${u.name}</h1>
        <p class="subtitle">${u.email} · ${badge(u.status)}</p>
      </div>
      <div class="inline-actions">
        <button class="secondary" data-action="edit-user">Editar</button>
        <button class="secondary" data-action="change-password">Cambiar contraseña</button>
        <button class="${u.status === 'Activa' ? 'danger' : 'primary'}" data-action="toggle-user">
          ${u.status === 'Activa' ? 'Desactivar' : 'Activar'}
        </button>
      </div>
    </div>
    <div class="grid-2">
      <div class="panel">
        <div class="panel-head"><h2>Datos de acceso</h2></div>
        <div class="panel-body">
          <div class="form-grid">
            <div><span class="panel-note">Empresa</span><p><strong>${u.company}</strong></p></div>
            <div><span class="panel-note">Sucursal</span><p><strong>${u.branch}</strong></p></div>
            <div><span class="panel-note">Rol</span><p><span class="tag-neutral">${u.role}</span></p></div>
            <div><span class="panel-note">Último acceso</span><p><strong>${u.last}</strong></p></div>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Actividad reciente</h2></div>
        <div class="panel-body activity">
          ${state.audit.filter(a => a.user === u.name).map(a => `
            <div class="activity-item">
              <span class="activity-bullet"></span>
              <div>
                <p><strong>${a.action}</strong> en ${a.module}</p>
                <small>${a.date}</small>
              </div>
            </div>
          `).join('') || '<p class="panel-note">Sin actividad reciente registrada.</p>'}
        </div>
      </div>
    </div>
  `;
}

export function branches() {
  const companyOptions = state.companies.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('');
  return `
    ${breadcrumb([['dashboard', 'Administración'], ['branches', 'Sucursales']])}
    ${pageHeader('Sucursales', 'Consulta y organiza las sedes operativas de tus empresas.', '<button class="primary" data-action="new-branch">＋ Nueva sucursal</button>')}
    <div class="panel">
      <div class="table-toolbar">
        <div class="filter-row">
          <input id="page-search" placeholder="Buscar sucursal o código..." value="${escapeHtml(state.query)}" style="min-width:260px;">
          <select>
            <option value="">Todas las empresas</option>
            ${companyOptions}
          </select>
        </div>
        <span class="panel-note">${state.branches.length} sucursales</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Código</th>
              <th>Empresa</th>
              <th>Encargado</th>
              <th>Usuarios</th>
              <th>Estado</th>
              <th style="text-align:right;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${state.branches.filter(b => `${b.name} ${b.code}`.toLowerCase().includes(state.query.toLowerCase())).map(b => {
              const mInitials = getInitials(b.manager || 'Encargado');
              return `
                <tr>
                  <td><strong>${escapeHtml(b.name)}</strong></td>
                  <td><span class="folio-tag">#${escapeHtml(b.code)}</span></td>
                  <td>${escapeHtml(b.company)}</td>
                  <td>
                    <div class="emp-cell-flex">
                      <div class="emp-avatar-sm" style="width:26px;height:26px;font-size:10px;">${escapeHtml(mInitials)}</div>
                      <div class="emp-cell-info">
                        <strong style="font-size:12.5px;">${escapeHtml(b.manager)}</strong>
                      </div>
                    </div>
                  </td>
                  <td><strong style="font-variant-numeric:tabular-nums;">${b.users}</strong></td>
                  <td>${badge(b.status)}</td>
                  <td style="text-align:right;">
                    <button class="row-action" data-detail="branch" data-id="${b.id}">Ver detalle →</button>
                  </td>
                </tr>
              `;
            }).join('') || '<tr><td colspan="7" class="empty">No encontramos sucursales.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function branchDetail(id) {
  const branch = state.branches.find(item => item.id === id);
  if (!branch) return '<div class="empty">Sucursal no encontrada.</div>';
  return `
    ${breadcrumb([['dashboard', 'Administración'], ['branches', 'Sucursales'], ['branches', escapeHtml(branch.name)]])}
    <div class="detail-head">
      <div>
        <h1>${escapeHtml(branch.name)}</h1>
        <p class="subtitle">${escapeHtml(branch.code)} · ${escapeHtml(branch.company)} · ${badge(branch.status)}</p>
      </div>
      <div class="inline-actions">
        <button class="secondary" data-action="edit-branch">Editar</button>
        <button class="${branch.status === 'Activa' ? 'danger' : 'primary'}" data-action="toggle-branch">
          ${branch.status === 'Activa' ? 'Desactivar' : 'Activar'}
        </button>
      </div>
    </div>
    <div class="grid-2">
      <div class="panel">
        <div class="panel-head"><h2>Información general</h2></div>
        <div class="panel-body">
          <p><strong>Empresa:</strong> ${escapeHtml(branch.company)}</p>
          <p><strong>Usuarios asignados:</strong> ${branch.users}</p>
          <p><strong>Encargado:</strong> ${escapeHtml(branch.manager)}</p>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Estado</h2></div>
        <div class="panel-body">${badge(branch.status)}</div>
      </div>
    </div>
  `;
}

export function roles() {
  return `
    ${breadcrumb([['dashboard', 'Administración'], ['roles', 'Roles y permisos']])}
    ${pageHeader('Roles y Permisos', 'Define el alcance, privilegios y accesos de cada perfil dentro de Kinetix.', '<button class="primary" data-action="new-role">＋ Nuevo rol</button>')}
    <div class="panel">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nombre del Rol</th>
              <th>Descripción</th>
              <th>Usuarios Asignados</th>
              <th>Tipo</th>
              <th style="text-align:right;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${state.roles.map(r => `
              <tr>
                <td><strong>${escapeHtml(r.name)}</strong></td>
                <td><small style="color:var(--muted);">${escapeHtml(r.description)}</small></td>
                <td><strong style="font-variant-numeric:tabular-nums;">${r.users}</strong> activos</td>
                <td><span class="tag-neutral">${escapeHtml(r.type)}</span></td>
                <td style="text-align:right;">
                  <button class="row-action" data-action="edit-role" data-role="${escapeHtml(r.name)}" data-role-id="${r.id}">
                    Editar permisos
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function audit() {
  return `
    ${breadcrumb([['dashboard', 'Administración'], ['audit', 'Auditoría']])}
    ${pageHeader('Auditoría', 'Registro inmutable de trazabilidad de acciones operativas y de seguridad.', '<button class="secondary" data-action="export-audit">⇓ Exportar CSV</button>')}
    <div class="panel">
      <div class="table-toolbar">
        <div class="filter-row">
          <input id="page-search" placeholder="Buscar usuario o registro..." value="${escapeHtml(state.auditSearch)}" style="min-width:240px;">
          <select data-audit-filter="module">
            <option value="">Todos los módulos</option>
            <option value="Usuarios">Usuarios</option>
            <option value="Empresas">Empresas</option>
            <option value="Sucursales">Sucursales</option>
            <option value="Acceso">Acceso</option>
            <option value="Inventario">Inventario</option>
            <option value="Finanzas">Finanzas</option>
            <option value="Roles">Roles</option>
          </select>
          <select data-audit-filter="action">
            <option value="">Todas las acciones</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="LOGIN">LOGIN</option>
            <option value="LOGIN_FAILED">LOGIN_FAILED</option>
            <option value="ACTIVATE">ACTIVATE</option>
            <option value="DEACTIVATE">DEACTIVATE</option>
            <option value="PASSWORD_CHANGE">PASSWORD_CHANGE</option>
          </select>
          <button class="primary" data-action="refresh-audit" style="padding:0 16px;">Buscar</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha y Hora</th>
              <th>Usuario</th>
              <th>Acción</th>
              <th>Módulo</th>
              <th>Registro Afectado</th>
              <th>Dirección IP</th>
              <th style="text-align:right;">Detalle</th>
            </tr>
          </thead>
          <tbody>
            ${state.audit.map(a => {
              const aInitials = getInitials(a.user || 'Admin');
              return `
                <tr>
                  <td><span style="font-variant-numeric:tabular-nums; color:var(--muted); font-size:12px;">${a.date}</span></td>
                  <td>
                    <div class="emp-cell-flex">
                      <div class="emp-avatar-sm" style="width:28px;height:28px;font-size:10px;">${escapeHtml(aInitials)}</div>
                      <div class="emp-cell-info">
                        <strong style="font-size:12.5px;">${escapeHtml(a.user)}</strong>
                      </div>
                    </div>
                  </td>
                  <td>${badge(a.action)}</td>
                  <td><span class="tag-neutral">${escapeHtml(a.module)}</span></td>
                  <td><strong>${escapeHtml(a.record)}</strong></td>
                  <td><span class="folio-tag" style="font-size:11px;">${escapeHtml(a.ip)}</span></td>
                  <td style="text-align:right;">
                    <button class="row-action" data-action="audit-detail" data-audit-id="${a.id}">Ver →</button>
                  </td>
                </tr>
              `;
            }).join('') || '<tr><td colspan="7" class="empty">No hay eventos de auditoría registrados.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function profile() {
  const user = state.currentUser || {};
  return `${breadcrumb([['dashboard', 'Administración'], ['profile', 'Mi perfil']])}${pageHeader('Mi perfil', 'Gestiona tus datos personales y credenciales.')}<form id="profile-form" class="panel form-layout"><div class="form-section"><h3>Información personal</h3><div class="form-grid"><div class="field"><label>Nombre</label><input name="firstName" required value="${escapeHtml(user.firstName)}"></div><div class="field"><label>Apellido</label><input name="lastName" required value="${escapeHtml(user.lastName)}"></div><div class="field"><label>Email</label><input name="email" required value="${escapeHtml(user.email)}" type="email"></div><div class="field"><label>Teléfono</label><input name="phone" value="${escapeHtml(user.phone)}"></div></div></div><div class="form-section"><h3>Acceso y organización</h3><div class="form-grid"><div class="field"><label>Empresa</label><input value="${escapeHtml(user.company)}" disabled></div><div class="field"><label>Rol</label><input value="${escapeHtml(user.role)}" disabled></div><div class="field"><label>Sucursal</label><input value="${escapeHtml(user.branch || 'Sin sucursal')}" disabled></div></div></div><div class="form-actions"><button type="button" class="secondary" data-action="change-password">Cambiar contraseña</button><button type="button" class="danger" data-action="logout">Cerrar sesión</button><button type="submit" class="primary">Guardar cambios</button></div></form>`;
}

export function form(type) {
  const isUser = type === 'user';
  const title = isUser ? 'Nuevo usuario' : 'Nueva empresa';
  const desc = isUser ? 'Crea una identidad y define su alcance dentro de la organización.' : 'Registra una nueva organización para administrar sus accesos.';
  const companyOptions = state.companies.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('');
  const branchOptions = state.branches.map(b => `<option value="${escapeHtml(b.name)}">${escapeHtml(b.name)} · ${escapeHtml(b.company)}</option>`).join('');
  const isSuperAdmin = state.currentUser?.role === 'Super Admin';
  const rolesList = state.roles.length ? state.roles : [
    { name: 'Company Admin' },
    { name: 'Employee' },
    ...(isSuperAdmin ? [{ name: 'Super Admin' }] : [])
  ];
  const roleOptions = rolesList
    .filter(r => isSuperAdmin || r.name !== 'Super Admin')
    .map(r => {
      const displayName = r.name === 'Company Admin' ? 'Administrador de Empresa' : r.name === 'Employee' ? 'Empleado' : r.name;
      return `<option value="${escapeHtml(r.name)}">${escapeHtml(displayName)}</option>`;
    })
    .join('');
  return `${breadcrumb([[isUser ? 'users' : 'companies', 'Administración'], [isUser ? 'users' : 'companies', isUser ? 'Usuarios' : 'Empresas'], [state.view, title]])}${pageHeader(title, desc)}<div class="panel form-layout"><form id="entity-form"><div class="form-section"><h3>${isUser ? 'Información personal' : 'Información general'}</h3><div class="form-grid">${isUser ? '<div class="field"><label>Nombre</label><input required name="firstName" placeholder="Ej. Juan"></div><div class="field"><label>Apellido</label><input required name="lastName" placeholder="Ej. Pérez"></div>' : '<div class="field"><label>Nombre de empresa</label><input required name="name" placeholder="Ej. Grupo Altura"></div><div class="field"><label>RNC</label><input required name="rnc" placeholder="1-01-00000-0" pattern="[0-9]{9}|[0-9]{11}" title="RNC de 9 u 11 dígitos"></div>'}</div></div><div class="form-section"><h3>${isUser ? 'Contacto y organización' : 'Contacto'}</h3><div class="form-grid"><div class="field"><label>Email</label><input required type="email" name="email" placeholder="correo@empresa.com"></div><div class="field"><label>Teléfono</label><input name="phone" placeholder="+1 809 000 0000"></div>${isUser ? `<div class="field"><label>Empresa</label><select name="company">${companyOptions || '<option value="">Sin empresas disponibles</option>'}</select></div><div class="field"><label>Sucursal</label><select name="branch"><option value="">Sin sucursal</option>${branchOptions}</select><span class="helper">Solo se muestran sucursales registradas.</span></div>` : '<div class="field full"><label>Dirección</label><textarea name="address" placeholder="Dirección fiscal"></textarea></div>'}</div></div><div class="form-section"><h3>${isUser ? 'Acceso' : 'Estado'}</h3><div class="form-grid">${isUser ? `<div class="field"><label>Rol</label><select name="role">${roleOptions}</select></div><div class="field"><label>Contraseña temporal</label><input required type="password" name="password" placeholder="Mínimo 10 caracteres" minlength="10"></div>` : '<div class="field"><label>Estado</label><select name="status"><option>Activa</option><option>Inactiva</option></select></div>'}</div></div><div class="form-actions"><button type="button" class="secondary" data-action="cancel-form">Cancelar</button><button type="submit" class="primary">Guardar ${isUser ? 'usuario' : 'empresa'}</button></div></form></div>`;
}

export function branchForm() {
  return `${breadcrumb([['dashboard', 'Administración'], ['branches', 'Sucursales'], ['branch-form', 'Nueva sucursal']])}${pageHeader('Nueva sucursal', 'Registra una sede y asígnala a una empresa.')}<div class="panel form-layout"><form id="branch-form"><div class="form-section"><h3>Información general</h3><div class="form-grid"><div class="field"><label>Empresa</label><select name="companyId" required>${state.companies.map(company => `<option value="${company.id}">${escapeHtml(company.name)}</option>`).join('')}</select></div><div class="field"><label>Nombre</label><input name="name" required placeholder="Ej. Central"></div><div class="field"><label>Código</label><input name="code" required placeholder="Ej. CEN-001"></div><div class="field"><label>Encargado</label><select name="managerUserId"><option value="">Sin encargado</option>${state.users.map(u => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.name)}</option>`).join('')}</select></div></div></div><div class="form-section"><h3>Contacto</h3><div class="form-grid"><div class="field"><label>Email</label><input name="email" type="email"></div><div class="field"><label>Teléfono</label><input name="phone"></div><div class="field full"><label>Dirección</label><textarea name="address"></textarea></div></div></div><div class="form-actions"><button type="button" class="secondary" data-action="cancel-form">Cancelar</button><button type="submit" class="primary">Guardar sucursal</button></div></form></div>`;
}
