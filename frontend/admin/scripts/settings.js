/** /admin/settings/ - display preferences for staff, plus a route to site copy. */
import { bootAdmin, refreshChrome } from '/shared/admin-layout.js';
import { mountSettings } from '/shared/views/settings.js';

const session = await bootAdmin({ active: 'settings' });
if (!session) throw new Error('redirecting');

mountSettings({ onLanguageChange: refreshChrome });
