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
 * Ends the session. The read cache is dropped first: cached rows belonged to the
 * account that is leaving, so keeping them would show one user's data to the
 * next person at a shared machine.
 */
export async function signOut({ redirectTo = '/' } = {}) {
  try {
    await api.post('/api/auth/logout');
  } finally {
    resetApiCache();
    current = { user: null, permissions: null };
    notify();
    window.location.href = redirectTo;
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