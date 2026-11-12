import { state, canAccessView } from '../core/state.js';
import { escapeHtml, initials } from './utils.js';
import { getAllowedModules, getActiveModule } from '../core/modules.js';

export function layout(content) {
  const user = state.currentUser || {};
  const userName = `${user.firstName || 'Usuario'} ${user.lastName || ''}`.trim();
  const userInitials = initials(userName) || 'KX';
  const currentView = state.view || 'dashboard';

  // Barra de módulos principal (Mi Inicio + Módulos permitidos)
  const allowedModules = getAllowedModules();
  const spaces = [
    { id: 'dashboard', label: 'Mi Inicio', nav: 'dashboard', match: ['dashboard'] },
    ...allowedModules.map(m => ({ id: m.id, label: m.label, nav: m.getHome(), match: m.match }))
  ];

  const tabsHtml = spaces.map(space => {
    const isActive = space.match.includes(currentView);
    const badgeCount = space.id === 'hr' ? (state.hr?.pendingApprovals?.length || 0) : 0;
    return `
      <button class="fiori-space-tab ${isActive ? 'active' : ''}" data-nav="${space.nav}">
        <span>${escapeHtml(space.label)}</span>
        ${badgeCount > 0 ? `<span class="fiori-tab-badge">${badgeCount}</span>` : ''}
      </button>`;
  }).join('');

  // Barra secundaria contextual: se activa al entrar a cualquier módulo para ver todas sus herramientas juntas
  const activeModule = getActiveModule(currentView);
  let subnavHtml = '';
  if (activeModule) {
    const visibleItems = activeModule.items.filter(item => canAccessView(item.id));
    if (visibleItems.length > 0) {
      subnavHtml = `
        <div class="fiori-app-bar" role="navigation" aria-label="${escapeHtml(activeModule.label)}">
          <div class="fiori-spaces-scroll-wrap">
            <button class="fiori-app-bar-title" data-nav="${activeModule.getHome()}" title="Ir al inicio de ${escapeHtml(activeModule.label)}">${escapeHtml(activeModule.label)}</button>
            <span class="fiori-app-bar-sep"></span>
            ${visibleItems.map(item => {
              const label = item.getLabel ? item.getLabel() : item.label;
              const badge = item.getBadge ? item.getBadge() : 0;
              return `
              <button class="fiori-subnav-item ${item.match.includes(currentView) ? 'active' : ''}" data-nav="${item.id}">
                ${escapeHtml(label)}${badge ? `<span class="fiori-tab-badge">${badge}</span>` : ''}
              </button>`;
            }).join('')}
          </div>
        </div>`;
    }
  }

  return `
    <div class="fiori-app-shell">
      
      <!-- 1. SHELL BAR SUPERIOR (SAP Fiori Shell) -->
      <header class="fiori-shell-bar">
        <!-- Izquierda: Marca Kinetix -->
        <div class="fiori-shell-left">
          <button class="fiori-brand-btn" data-nav="dashboard" title="Ir a Mi Inicio">
            <div class="fiori-brand-mark"><img src="/logo.png" alt="Kinetix Logo"></div>
            <span class="fiori-brand-name">Kinetix</span>
          </button>
        </div>

        <!-- Centro: Buscador Unificado -->
        <div class="fiori-shell-center">
          <div class="fiori-search-omnibar">
            <svg class="fiori-search-icon" style="width:16px;height:16px;min-width:16px;flex-shrink:0;color:#94a3b8;margin-right:8px;" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/>
            </svg>
            <input id="global-search" class="fiori-search-input" placeholder="Buscar empleados, módulos, documentos... (Presiona Enter)" value="${escapeHtml(state.query)}">
          </div>
        </div>

        <!-- Derecha: Notificaciones, Avatar y Cerrar Sesión -->
        <div class="fiori-shell-right">
          <!-- Notificaciones Internas -->
          <div class="topbar-notifications-wrapper">
            <button class="fiori-shell-icon-btn topbar-bell-btn" data-action="toggle-notifications" title="Notificaciones internas">
              <svg viewBox="0 0 20 20" fill="currentColor" style="width:18px;height:18px">
                <path d="M10 2a6 6 0 00-6 6v3l-2 3h16l-2-3V8a6 6 0 00-6-6zM8 16h4a2 2 0 01-4 0z"/>
              </svg>
              ${(state.hr?.unreadNotificationsCount || 0) > 0 ? `<span class="notification-badge">${state.hr.unreadNotificationsCount}</span>` : ''}
            </button>
            <div class="notifications-dropdown hidden" id="notifications-popover">
              <div class="notifications-head">
                <strong>Notificaciones</strong>
                <button class="link-btn" data-action="mark-all-notifications-read">Marcar leídas</button>
              </div>
              <div class="notifications-body" id="notifications-list-container">
                <div class="notifications-loading">Cargando notificaciones...</div>
              </div>
              <div class="notifications-foot">
                <button class="link-btn full-width" data-nav="hr-approvals">Ir a Bandeja de Aprobaciones →</button>
              </div>
            </div>
          </div>

          <!-- Perfil con Avatar Circle -->
          <button class="fiori-avatar-btn" data-nav="profile" title="Mi perfil (${escapeHtml(userName)})">
            <div class="fiori-user-avatar">${escapeHtml(userInitials)}</div>
          </button>

          <!-- Cerrar Sesión -->
          <button class="fiori-shell-icon-btn" data-action="logout" title="Cerrar sesión">
            <svg viewBox="0 0 20 20" fill="currentColor" style="width:16px;height:16px"><path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clip-rule="evenodd"/></svg>
          </button>
        </div>
      </header>

      <!-- 2. BARRA DE ESPACIOS Y PÁGINAS (Spaces & Pages Navigation) -->
      <nav class="fiori-spaces-bar">
        <div class="fiori-spaces-scroll-wrap">
          ${tabsHtml}
        </div>
      </nav>
      ${subnavHtml}

      <!-- 3. CONTENIDO PRINCIPAL -->
      <main class="fiori-main-viewport">
        <div class="fiori-content-wrapper">
          ${content}
        </div>
      </main>

    </div>
  `;
}
