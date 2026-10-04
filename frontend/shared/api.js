/**
 * The one API client. Nothing else in the frontend is allowed to call `fetch`.
 *
 * Responsibilities:
 *   - credentials and CSRF   the session cookie is httpOnly and never appears in
 *                             page code; every unsafe method echoes the CSRF cookie.
 *   - request de-duplication two components asking for the same GET at the same
 *                             time share one network round trip.
 *   - a short read cache     navigating between pages must not re-fetch the same
 *                             reference data on every click.
 *   - explicit invalidation a mutation drops exactly the keys it could have
 *                             changed, so the UI updates without a manual reload.
 *
 * Nothing here caches a mutation, retries one automatically, or writes anything
 * to localStorage: the session lives in a cookie the browser attaches itself.
 */

export class ApiError extends Error {
  constructor(message, { status = 0, code = '', fieldErrors = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }

  /** True when the request never reached the server (offline, DNS, refused). */
  get isNetwork() {
    return this.status === 0;
  }
}

const CSRF_COOKIE = 'ga6_csrf_v2';
let csrfFromServer = '';

/**
 * Where the API lives. Empty (the default) means same origin, which is how the
 * Express server serves this frontend today. When the frontend is deployed on its
 * own host, the build writes globalThis.ECU_API_BASE from API_BASE_URL.
 */
const API_BASE = String(globalThis.ECU_API_BASE || '').replace(/\/+$/, '');
const CROSS_ORIGIN = /^https?:\/\//i.test(API_BASE);

/* Exported so link hrefs (downloads, the viewer) honour the same base as fetch. */
export function apiUrl(path) {
  return `${API_BASE}${path}`;
}

function csrfToken() {
  if (csrfFromServer) return csrfFromServer;
  let found = '';
  for (const part of document.cookie.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() === CSRF_COOKIE) found = decodeURIComponent(part.slice(index + 1).trim());
  }
  return found;
}

/* --------------------------------------------------------------- caching */

/* Only these safe reads are cached, and only briefly. User-scoped reads such as
   /api/documents are deliberately absent: they must always reflect the current
   session, and the cache window is not a licence to serve one user's rows. */
const CACHE_TTL_MS = 20_000;
const CACHEABLE = new Set([
  '/api/auth/me',
  '/api/public/site',
  '/api/public/groups',
  '/api/public/assessments',
]);
const cache = new Map();
const inFlight = new Map();

function cacheRead(path) {
  const hit = cache.get(path);
  if (!hit) return undefined;
  if (Date.now() > hit.expires) {
    cache.delete(path);
    return undefined;
  }
  return hit.value;
}

/**
 * Drops cached reads. Called after every successful mutation with the paths that
 * could have changed; anything not named here survives, which keeps the cache
 * useful without ever serving data the mutation invalidated.
 */
export function invalidateApi(paths) {
  for (const path of (Array.isArray(paths) ? paths : [paths])) {
    if (!path) continue;
    cache.delete(path);
    inFlight.delete(path);
    /* A prefix such as '/api/documents' also clears everything below it, which
       is what a caller means when it names a collection rather than one row. */
    if (!path.includes('?') && !path.includes(':')) {
      for (const key of [...cache.keys()]) if (key.startsWith(path)) cache.delete(key);
      for (const key of [...inFlight.keys()]) if (key.startsWith(path)) inFlight.delete(key);
    }
  }
}

/** Clears every cached read. Used when the session itself changes. */
export function resetApiCache() {
  cache.clear();
  inFlight.clear();
}

/* -------------------------------------------------------------- requests */

async function request(method, path, body, { retryCsrf = true, signal } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && method !== 'HEAD') headers['X-CSRF-Token'] = csrfToken();

  let response;
  try {
    response = await fetch(apiUrl(path), {
      method,
      /* Same-origin needs 'same-origin'. A separate frontend origin must send the
         session cookie explicitly, which only works when the API also allows CORS
         and sets SameSite=None; Secure on the session cookie. */
      credentials: CROSS_ORIGIN ? 'include' : 'same-origin',
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (networkFailure) {
    /* An aborted request is the caller's decision, not a failure to report. */
    if (networkFailure?.name === 'AbortError') throw networkFailure;
    throw new ApiError('تعذر الاتصال بالخادم. تحقق من تشغيل الخادم ثم أعد المحاولة.', { status: 0 });
  }

  let payload = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (parseFailure) {
      payload = null;
    }
  }

  /* /api/auth/me returns the server's parsed CSRF cookie value. Keeping it avoids
     mismatches when a browser still holds a stale duplicate cookie. */
  if (path === '/api/auth/me' && typeof payload?.csrfToken === 'string') {
    csrfFromServer = payload.csrfToken;
  }

  if (!response.ok) {
    /* The API answers failures with { error: "message" }; a nested shape is tolerated. */
    const raw = payload && payload.error;
    const message = typeof raw === 'string' ? raw : (raw && raw.message) || payload?.message || '';
    /* The CSRF middleware rejects before the route handler runs, so a single retry
       after refreshing the server-issued token cannot duplicate a finished mutation. */
    if (retryCsrf && method !== 'GET' && method !== 'HEAD'
      && response.status === 403
      && message === 'Security token missing or invalid. Reload the page and try again.') {
      csrfFromServer = '';
      await request('GET', '/api/auth/me', undefined, { retryCsrf: false });
      return request(method, path, body, { retryCsrf: false });
    }
    throw new ApiError(message || `طلب فشل (${response.status}).`, {
      status: response.status,
      code: (raw && raw.code) || '',
      fieldErrors: (raw && raw.fields) || null,
    });
  }

  return cacheWrite(path, payload);
}

async function read(path, options) {
  const cached = cacheRead(path);
  if (cached !== undefined) return cached;

  /* Two identical reads in flight share one response instead of racing. */
  const pending = inFlight.get(path);
  if (pending) return pending;

  const flight = request('GET', path, undefined, options).finally(() => inFlight.delete(path));
  inFlight.set(path, flight);
  return flight;
}

export const api = {
  get: (path, options) => read(path, options),
  post: (path, body) => request('POST', path, body === undefined ? {} : body),
  put: (path, body) => request('PUT', path, body === undefined ? {} : body),
  patch: (path, body) => request('PATCH', path, body === undefined ? {} : body),
  del: (path) => request('DELETE', path, {}),
};

/**
 * GET that answers null instead of throwing. Reserved for genuinely optional reads
 * - a background badge, a decorative site notice - where a failure must not take
 * the page down. Every load-bearing read uses `api.get` so the error state shows.
 */
export async function getQuiet(path) {
  try {
    return await read(path);
  } catch (error) {
    if (error instanceof ApiError) return null;
    throw error;
  }
}

function cacheWrite(path, value) {
  if (CACHEABLE.has(path)) cache.set(path, { value, expires: Date.now() + CACHE_TTL_MS });
  return value;
}