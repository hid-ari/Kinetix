import { state, hasPermission } from '../../core/state.js';
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
    ${pageHeader('Empresas', 'Administra las organizaciones y su estado de acceso.', hasPermission('Empresas', 'Crear empresas') ? '<button class="primary" data-action="new-company">＋ Nueva empresa</button>' : '')}
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
