/**
 * Compatibility name for the admin area's boot step.
 *
 * The admin pages used to draw their own header, which is exactly why they
 * drifted away from the student pages. There is now ONE shell for the whole
 * portal; `bootAdmin` only adds the admin access gate before handing over to it.
 * Hiding an admin page is a convenience - backend/src/middleware/auth.js refuses
 * the request regardless of what the browser renders.
 */
import { bootChrome, refreshChrome, shellState } from '/shared/shell.js';
import { requireAdmin } from '/shared/session.js';

export { refreshChrome, shellState };

/**
 * Boot step for every admin page. Returns the session when the visitor really is
 * an administrator, and null (after starting a redirect) when they are not.
 */
export async function bootAdmin({ active = '' } = {}) {
  const session = await requireAdmin({ redirectTo: '/user/signin/' });
  if (!session) return null;
  await bootChrome({ area: 'admin', active });
  return session;
}