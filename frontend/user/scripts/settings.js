/** /user/settings/ - display preferences for a student. */
import { bootChrome, refreshChrome } from '/shared/shell.js';
import { requireSignIn } from '/shared/session.js';
import { mountSettings } from '/shared/views/settings.js';

await bootChrome({ area: 'user', active: 'settings' });

const session = await requireSignIn({ redirectTo: '/user/signin/' });
if (!session) throw new Error('redirecting');

mountSettings({ onLanguageChange: refreshChrome });
