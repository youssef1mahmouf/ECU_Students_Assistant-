/** Session helpers shared by the user and admin areas. */
import { api, ApiError } from './api.js';

let current = null;

export async function loadSession({ force = false } = {}) {
  if (current && !force) return current;
  try {
    current = await api.get('/api/auth/me');
  } catch (error) {
    current = { user: null, permissions: null, error: error.message };
  }
  return current;
}

export function currentUser() {
  return current ? current.user : null;
}

export function permissions() {
  return (current && current.permissions) || {};
}

export function isAdmin() {
  const permissions_ = permissions();
  return Boolean(permissions_.isAdmin);
}

/**
 * Convenience redirect for the browser. The server enforces the same rule, so this is
 * only about user experience - removing it would not grant access to anything.
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

export async function requireAdmin({ redirectTo = '/admin/' } = {}) {
  const session = await loadSession();
  if (!session.user) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`${redirectTo}?next=${next}`);
    return null;
  }
  if (!session.permissions || !session.permissions.isAdmin) {
    window.location.replace(`/user/?denied=1`);
    return null;
  }
  return session;
}

export async function signOut({ redirectTo = '/' } = {}) {
  try {
    await api.post('/api/auth/logout');
  } finally {
    current = { user: null, permissions: null };
    window.location.href = redirectTo;
  }
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
