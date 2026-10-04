/**
 * /user/viewer/ - the in-app resource viewer.
 *
 * Nothing here decides what to show: shared/views/viewer.js reads the query
 * string, resolves the target, and paints. The page module only boots the shell
 * and enforces the sign-in gate, so opening a file cannot bypass access control
 * any more than downloading it could.
 */
import { bootChrome } from '/shared/shell.js';
import { requireSignIn } from '/shared/session.js';
import { mountViewer } from '/shared/views/viewer.js';

await bootChrome({ area: 'user', active: 'library' });

const session = await requireSignIn({ redirectTo: '/user/signin/' });
if (!session) throw new Error('redirecting');

await mountViewer('#viewerRoot');
