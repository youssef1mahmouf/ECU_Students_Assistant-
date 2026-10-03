/**
 * Page chrome for the admin area. The visible links come from the shared header, so the
 * student and the administrator get exactly the navigation each role may use; access is
 * still decided by the server, never here.
 */
import { renderHeader, renderFooter, refreshChrome } from './layout.js?v=admin-home-nav-1';
import { applyI18n } from './i18n.js';
import { loadSession, requireAdmin } from './session.js';

export function renderAdminHeader({ active = '' } = {}) {
  renderHeader({ area: 'admin', active });
}

export function renderAdminFooter() {
  renderFooter();
}

/**
 * Boot step for every admin page. Returns the session when the visitor really is an
 * administrator, and null (after starting a redirect) when they are not.
 */
export async function bootAdmin({ active = '' } = {}) {
  const session = await requireAdmin({ redirectTo: '/user/signin/' });
  if (!session) return null;
  await loadSession();
  renderAdminHeader({ active });
  renderAdminFooter();
  applyI18n();
  return session;
}

/** Re-draw header and footer after the session or the profile name changed. */
export { refreshChrome };
