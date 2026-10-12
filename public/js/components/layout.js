import { state, nav, canManageRoles } from '../core/state.js';
import { escapeHtml, initials } from './utils.js';

export function layout(content) {
  const user = state.currentUser || {};
  const userName = `${user.firstName || 'Usuario'} ${user.lastName || ''}`.trim();
  let navHtml = '';
  let currentGroup = undefined;

  nav.filter(item => item.id !== 'roles' || canManageRoles()).forEach(item => {
    const itemLabel = item.id === 'companies' && state.currentUser?.role === 'Super Admin' ? 'Empresas' : item.id === 'companies' ? 'Mi empresa' : item.label;
    if (item.group !== currentGroup) {
      currentGroup = item.group;
      if (item.group) navHtml += `<div class="nav-group-label">${item.group}</div>`;
      else if (navHtml) navHtml += `<div class="nav-divider"></div>`;
    }
    const isActive = state.view === item.id || (item.id === 'dashboard' && state.view === 'dashboard');
    navHtml += `<button class="nav-item ${isActive ? 'active' : ''}" data-nav="${item.id}" title="${itemLabel}">
      <span class="nav-item-icon">${item.icon}</span>
      <span class="nav-item-label">${itemLabel}</span>
      ${isActive ? '<span class="nav-item-dot"></span>' : ''}
    </button>`;
  });

  return `<div class="app-shell ${state.sidebarCollapsed ? 'sidebar-collapsed' : ''}">
    <aside class="sidebar">
      <div class="sidebar-inner">
        <div class="sidebar-head">
          <div class="brand">
            <div class="brand-mark"><img src="/logo.png" alt="Kinetix Logo"></div>
            <div class="brand-text"><strong>Kinetix</strong><small>Core Administration</small></div>
          </div>
          <button class="sidebar-toggle" data-action="toggle-sidebar" title="${state.sidebarCollapsed ? 'Expandir' : 'Colapsar'}">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>
          </button>
        </div>
        <nav class="nav-menu">${navHtml}</nav>
        <div class="sidebar-footer">
          <div class="sidebar-footer-divider"></div>
          <button class="profile-card" data-nav="profile" title="Mi perfil">
            <div class="profile-avatar">${escapeHtml(initials(userName))}</div>
            <div class="profile-info">
              <strong>${escapeHtml(userName)}</strong>
              <small>${escapeHtml(user.role || 'Usuario')}</small>
            </div>
            <svg class="profile-chevron" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>
          </button>
        </div>
      </div>
    </aside>
    <main class="main">
      <header class="topbar">
        <div class="topbar-left">
          <button class="mobile-menu-btn" data-action="toggle-sidebar" title="Abrir menú">☰</button>
          <div class="search"><span>⌕</span><input id="global-search" placeholder="Buscar en Kinetix..." value="${escapeHtml(state.query)}"></div>
        </div>
        <div class="top-actions">
          <div class="topbar-notifications-wrapper">
            <button class="topbar-bell-btn" data-action="toggle-notifications" title="Notificaciones internas">
              <svg viewBox="0 0 20 20" fill="currentColor" style="width:18px;height:18px;">
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
          <button class="topbar-profile-btn" data-nav="profile" title="Mi perfil">
            <div class="profile-avatar">${escapeHtml(initials(userName))}</div>
            <div class="profile-info">
              <strong>${escapeHtml(userName)}</strong>
              <small>${escapeHtml(user.role || 'Usuario')}</small>
            </div>
            <svg class="profile-chevron" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>
          </button>
          <button class="secondary" data-action="logout" title="Cerrar sesión" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;font-size:12px;cursor:pointer;">
            <svg viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;"><path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clip-rule="evenodd"/></svg>
            <span>Cerrar sesión</span>
          </button>
        </div>
      </header>
      <section class="content">${content}</section>
    </main>
  </div>`;
}
