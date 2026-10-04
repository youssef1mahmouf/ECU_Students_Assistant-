/**
 * /admin/library/ - the same explorer the students use, for staff.
 *
 * Deliberately ONE component (shared/views/library.js) rather than a second
 * admin copy: if staff browsing and students browsing were separate renderers,
 * they would drift apart, which is exactly how the old page ended up drawing
 * three competing representations of the library.
 */
import { bootAdmin } from '/shared/admin-layout.js';
import { mountLibraryExplorer } from '/shared/views/library.js';

const session = await bootAdmin({ active: 'library' });
if (!session) throw new Error('redirecting');

const explorer = mountLibraryExplorer('#adminLibrary');

/* Staff can re-run the index generation from here, so a Refresh is meaningful. */
document.getElementById('adminLibraryRefresh')?.addEventListener('click', () => explorer?.view.reload());
