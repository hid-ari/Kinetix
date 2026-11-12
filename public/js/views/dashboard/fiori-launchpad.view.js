import { escapeHtml } from '../../components/utils.js';
import { getAllowedModules } from '../../core/modules.js';

/**
 * Genera el Launchpad de inicio empresarial estilo SAP Fiori Launchpad
 * enfocado de forma limpia en el acceso a los módulos autorizados de Kinetix.
 */
export function fioriLaunchpad() {
  const allowedModules = getAllowedModules();
  const modulesHtml = allowedModules.map(mod => `
    <div class="fiori-app-card" data-nav="${mod.getHome()}" role="button" tabindex="0">
      <div class="fiori-app-card-head">
        <div class="fiori-tile-icon-badge ${mod.color}">
          <svg viewBox="0 0 20 20" fill="currentColor">${mod.icon}</svg>
        </div>
        <span class="fiori-app-badge ${mod.badgeType}">${escapeHtml(mod.getBadgeText())}</span>
      </div>
      <div class="fiori-app-card-body">
        <h3 class="fiori-app-title">${escapeHtml(mod.label)}</h3>
        <p class="fiori-app-desc">${escapeHtml(mod.desc)}</p>
      </div>
      <div class="fiori-app-card-foot">
        <div class="fiori-app-submodules">
          ${mod.submoduleTags.map(sm => `<span class="fiori-app-tag">${escapeHtml(sm)}</span>`).join('')}
        </div>
        <span class="fiori-app-arrow">Abrir módulo →</span>
      </div>
    </div>`).join('');

  return `
    <div class="fiori-page-container">
      <section class="fiori-section">
        <div class="fiori-section-header">
          <div class="fiori-section-title-wrap">
            <h2 class="fiori-section-title">Módulos de Negocio</h2>
          </div>
        </div>

        <div class="fiori-apps-grid">
          ${modulesHtml}
        </div>
      </section>
    </div>
  `;
}
