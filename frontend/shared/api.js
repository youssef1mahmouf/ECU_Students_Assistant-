/**
 * Thin API client. Everything goes through this module so that credentials never
 * appear in page code: the browser sends the httpOnly session cookie and echoes the
 * CSRF cookie in a header, exactly as backend/src/middleware/security.js expects.
 */

export class ApiError extends Error {
  constructor(message, { status = 0, code = '', fieldErrors = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

const CSRF_COOKIE = 'ga6_csrf_v2';
let csrfFromServer = '';

/**
 * Where the API lives. Empty (the default) means same origin, which is how the Express server
 * serves this frontend today - that path is unchanged. When the frontend is deployed on its own
 * host, the build writes globalThis.ECU_API_BASE from API_BASE_URL.
 */
const API_BASE = String(globalThis.ECU_API_BASE || '').replace(/\/+$/, '');
const CROSS_ORIGIN = /^https?:\/\//i.test(API_BASE);

/* Exported so link hrefs (downloads, inline viewers) can honour the same base as fetch. */
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

async function request(method, path, body, { retryCsrf = true } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && method !== 'HEAD') headers['X-CSRF-Token'] = csrfToken();

  let response;
  try {
    response = await fetch(apiUrl(path), {
      method,
      /* Same-origin needs 'same-origin'. A separate frontend origin must send the session
         cookie explicitly, which only works if the API also allows CORS and sets
         SameSite=None; Secure on the session cookie. */
      credentials: CROSS_ORIGIN ? 'include' : 'same-origin',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (networkFailure) {
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

  // /api/auth/me returns the server's parsed CSRF cookie value. Keeping that value
  // avoids mismatches when a browser has a stale duplicate cookie after a restart.
  if (path === '/api/auth/me' && typeof payload?.csrfToken === 'string') {
    csrfFromServer = payload.csrfToken;
  }

  if (!response.ok) {
    // The API answers failures with { error: "message" }; tolerate a nested shape too.
    const raw = payload && payload.error;
    const message = typeof raw === 'string' ? raw : (raw && raw.message) || payload?.message || '';
    // The CSRF middleware rejects before the route handler runs, so one retry after
    // refreshing the server-issued token cannot duplicate a completed mutation.
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
  return payload;
}

/** GET that never throws: pages keep their empty-state markup instead. */
async function getQuiet(path) {
  try {
    return await request('GET', path);
  } catch (error) {
    console.debug('[api]', path, error.status, error.message);
    return null;
  }
}

export const api = {
  get: (path) => request('GET', path),
  getQuiet,
  post: (path, body) => request('POST', path, body === undefined ? {} : body),
  put: (path, body) => request('PUT', path, body === undefined ? {} : body),
  patch: (path, body) => request('PATCH', path, body === undefined ? {} : body),
  del: (path) => request('DELETE', path, {}),
};
