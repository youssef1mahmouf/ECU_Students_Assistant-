/**
 * /user/library/ - the shared teaching-material index.
 *
 * This page exists so the index has a page of its own. Before the redesign it
 * was mounted inside the documents page, which is what produced the reported
 * "library card + loading card + another resource card" duplication: two
 * different data sets, drawn by two modules, on one screen.
 *
 * Here there is exactly one renderer and exactly one endpoint.
 */
import { bootChrome } from '/shared/shell.js';
import { requireSignIn } from '/shared/session.js';
import { mountLibraryExplorer } from '/shared/views/library.js';

await bootChrome({ area: 'user', active: 'library' });

const session = await requireSignIn({ redirectTo: '/user/signin/' });
if (!session) throw new Error('redirecting');

mountLibraryExplorer('#libraryExplorer');
