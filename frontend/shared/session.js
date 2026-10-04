/**
 * Session helpers shared by the user and admin areas.
 *
 * The session itself lives in an httpOnly cookie the browser attaches on its
 * own, so nothing sensitive is ever kept here, in localStorage, or in a module
 * variable that page code could read. This module holds only the *result* of
 * /api/auth/me for the lifetime of one page load, so two components asking
 * "who am I" share one request.
 */
import { api, ApiError, resetApiCache } from '/shared/api.js';

let current = null;
const watchers = new Set();

function notify() {
  for (const watcher of watchers) {
    try {
      watcher(current);
    } catch (error) {
      console.error('[session] watcher failed', error);
    }
  }
}

export async function loadSession({ force = false } = {}) {
  if (current && !force) return current;
  try {
    current = await api.get('/api/auth/me');
  } catch (error) {
    current = { user: null, permissions: null, error: error.message };
  }
  notify();
  return current;
}

/** Notified whenever the resolved session changes, for chrome that must redraw. */
export function onSessionChange(watcher) {
  watchers.add(watcher);
  return () => watchers.delete(watcher);
}

export function currentUser() {
  return current ? current.user : null;
}

export function permissions() {
  return (current && current.permissions) || {};
}

export function isAdmin() {
  return Boolean(permissions().isAdmin);
}

/**
 * Convenience redirect for the browser. The server enforces the same rule, so
 * removing this would grant access to nothing.
 */
export async function requireSignIn({ redirectTo = '/user/signin/' } = {}) {
  const session = await loadSession();
  if (!session.user) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`${redirectTo}?next=${next}`);
    return null;
  }
  return session;
}

export async function requireAdmin({ redirectTo = '/user/signin/' } = {}) {
  const session = await loadSession();
  if (!session.user) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`${redirectTo}?next=${next}`);
    return null;
  }
  if (!session.permissions || !session.permissions.isAdmin) {
    window.location.replace('/user/?denied=1');
    return null;
  }
  return session;
}

/**
 * Ends the session. This is the single exit: the server is told first, the
 * local state is cleared second, and only then does the browser move.
 *
 * Order matters. Clearing locally before the server answers would leave a
 * window where the interface says "signed out" while the cookie still works.
 * Doing the reverse would leave the opposite window. So the request goes first,
 * and the `finally` block runs whichever way it went - a logout that fails on
 * the network still ends locally, because a browser that keeps showing an
 * account menu after someone pressed Sign Out is the worse of the two.
 *
 * `location.replace`, never `location.href`: href would push the public page
 * onto the history stack, so the Back button would return to the authenticated
 * page still holding its rendered chrome. replace() overwrites the entry.
 */
export async function signOut({ redirectTo = '/' } = {}) {
  try {
    await api.post('/api/auth/logout');
  } catch {
    /* Deliberate. The local clear below is what must always happen. */
  } finally {
    /* Cached reads belonged to the account that is leaving. Keeping them would
       show one user's rows to the next person at a shared machine. */
    resetApiCache();
    current = { user: null, permissions: null };
    /* Wakes the shell so the account menu, the bell and the protected
       navigation are gone from this document immediately, rather than after a
       reload has been requested but not yet completed. */
    notify();
    window.location.replace(redirectTo);
  }
}

/**
 * Re-reads everything scoped to the account after a mutation. Used by the pages
 * that change what the server would return to *this* user, so the interface
 * updates without anyone pressing refresh.
 */
export async function refreshSession() {
  resetApiCache();
  return loadSession({ force: true });
}

export function isAuthError(error) {
  return error instanceof ApiError && error.status === 401;
}

/** Reads ?next= safely: only same-origin relative paths are accepted. */
export function safeNext(fallback) {
  const raw = new URLSearchParams(window.location.search).get('next') || '';
  if (!/^\/[A-Za-z0-9\-._/]*$/.test(raw) || raw.startsWith('//')) return fallback;
  return raw;
}