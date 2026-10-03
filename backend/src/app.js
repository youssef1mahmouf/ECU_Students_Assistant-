'use strict';
/**
 * Application assembly: middleware order, API routes, page-level access guards and
 * static hosting of the three frontend areas. Order matters: body parsing -> headers ->
 * identity -> CSRF -> routes -> static -> fallbacks -> error handler.
 *
 * No CORS middleware is mounted on purpose: the frontend and the API are same-origin,
 * and a permissive CORS policy would weaken the CSRF/session posture.
 */
const path = require('path');
const express = require('express');

const config = require('./config/env');
const { ApiError } = require('./lib/errors');
const { parseCookies, ensureCsrfToken } = require('./lib/session');
const { attachIdentity, requireAuthPage, requireRolePage, requirePageCapability } = require('./middleware/auth');
const { securityHeaders, noApiCache, csrfProtection, rateLimit } = require('./middleware/security');
const authRoutes = require('./routes/auth');
const publicRoutes = require('./routes/public');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');
const { readerRouter: documentReaderRoutes, managerRouter: documentManagerRoutes } = require('./routes/documents');
const { logPageVisit } = require('./services/activity');

/* Admin page -> the capability the permission matrix requires (null = any staff role).
   Keep in step with frontend/shared/layout.js navigation. */
const ADMIN_PAGES = {
  '/dashboard': 'dashboard',
  '/groups': 'groupsView',
  '/accounts': 'accountsView',
  '/subjects': 'subjectsManage',
  '/documents': 'documentsView',
  '/activity': 'activityView',
  '/information': 'reportsView',
  '/problems': 'problemsView',
  '/profile': null, // every staff role may open its own profile
};
const USER_PAGES = ['/profile', '/groups', '/documents', '/report'];
/* Public documents whose visits are recorded when a session exists. */
const PUBLIC_PAGES = new Set(['/', '/guest/', '/guest/assessments/', '/user/', '/user/signin/', '/user/register/']);

const simplePage = (status, title, message, links = '') => `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title><style>body{font-family:system-ui,sans-serif;background:#0f1720;color:#e6edf3;display:grid;place-items:center;min-height:100vh;margin:0}
main{max-width:36rem;padding:2rem;text-align:center}h1{color:#4fd1c5}a{color:#4fd1c5}</style></head>
<body><main><h1>${status}</h1><p>${title}</p><p>${message}</p>${links}</main></body></html>`;

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.disable('etag');
  if (config.trustProxy) app.set('trust proxy', 1);

  // Uploads carry a base64 file, so that one route parses its own larger JSON body first;
  // every other route keeps the small 32 kb limit (body-parser skips an already parsed body).
  app.use(
    '/api/admin/documents',
    express.json({ limit: config.upload.maxRequestBytes, type: 'application/json' })
  );
  app.use(express.json({ limit: '32kb' }));
  app.use(securityHeaders);

  /* ------------------------------------------------------------------ API */
  app.use('/api', noApiCache, attachIdentity);
  // Any safe request hands out the CSRF cookie the client must echo back.
  app.use('/api', (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') ensureCsrfToken(res, parseCookies(req.headers.cookie));
    next();
  });
  app.use('/api', csrfProtection);

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', store: config.dataStore, env: config.env, time: new Date().toISOString() });
  });
  app.use('/api/auth', rateLimit({ windowMs: config.security.rateLimitWindowMs, max: 120, prefix: 'auth-api' }), authRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api/user', userRoutes);
  // Mounted before the admin router so /api/admin/documents reaches its own handler.
  app.use('/api/admin/documents', documentManagerRoutes);
  app.use('/api/documents', documentReaderRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', (req, res, next) => next(ApiError.notFound('Unknown API route.')));

  /* ------------------------------------------------- page-level access guards */
  // Authoritative checks live in the API. These guards add defence in depth so an
  // unauthenticated visitor is not handed the admin/user page markup at all, and they
  // follow the same permission matrix as the API (lib/permissions.js).
  // Identity is resolved for the guarded documents only - plain assets stay cheap.
  // A completed page visit (the document request itself) is recorded once per user and
  // page inside a deduplication window, so reloads or repeated requests never double it.
  const recordVisit = (page) => (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') {
      logPageVisit(req.user, page).catch(() => {});
    }
    next();
  };
  for (const [page, capability] of Object.entries(ADMIN_PAGES)) {
    app.use(
      `/admin${page}`,
      attachIdentity,
      requirePageCapability(capability, '/user/signin/'),
      recordVisit(`/admin${page}/`)
    );
  }
  for (const page of USER_PAGES) {
    app.use(`/user${page}`, attachIdentity, requireAuthPage('/user/signin/'), recordVisit(`/user${page}/`));
  }

  /* Public pages: only a signed-in visitor's visit is recorded, never an anonymous one. */
  app.use((req, res, next) => {
    if (req.method !== 'GET' || !PUBLIC_PAGES.has(req.path)) return next();
    return attachIdentity(req, res, () => {
      if (req.user) logPageVisit(req.user, req.path).catch(() => {});
      next();
    });
  });

  /* One sign-in page serves every role. The old standalone admin entry is gone, so /admin/
     and its aliases now forward to the same form students and staff both use. Mounted
     before the static handler, which would otherwise serve frontend/admin/index.html. */
  app.get(['/admin', '/admin/', '/administrator'], (req, res) => res.redirect(302, '/user/signin/'));

  /* ---------------------------------------------------------------- static */
  app.use(
    express.static(config.frontendDir, {
      index: ['index.html'],
      extensions: ['html'],
      maxAge: config.isProduction ? '1h' : 0,
      fallthrough: true,
    })
  );

  app.get('/', (req, res) => res.sendFile(path.join(config.frontendDir, 'guest', 'index.html')));
  app.get(['/login', '/signin'], (req, res) => res.redirect(302, '/user/signin/'));
  app.get(['/register', '/signup'], (req, res) => res.redirect(302, '/user/register/'));
  app.get('/login-legacy', (req, res) => res.redirect(302, '/user/signin/'));

  /* ------------------------------------------------------------ fallbacks */
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next(ApiError.notFound('Unknown API route.'));
    return res.status(404).type('html').send(simplePage(404, 'Page not found', 'The page you requested does not exist.',
      '<p><a href="/">Go to the public home</a></p>'));
  });

  // eslint-disable-next-line no-unused-vars -- express needs the 4-argument signature
  app.use((error, req, res, next) => {
    let status = Number.isInteger(error.status) && error.status < 600 ? error.status : 500;
    let message = error.message || 'Request failed.';
    if (error.type === 'entity.parse.failed' || error instanceof SyntaxError) {
      status = 400;
      message = 'Malformed request body.';
    } else if (error.type === 'entity.too.large') {
      status = 413;
      message = 'Request body is too large.';
    }
    if (status >= 500) console.error('[error]', error.stack || error.message);
    // Never echo internal details or stack traces to the browser.
    if (status >= 500 && config.isProduction) message = 'Unexpected server error. Please try again.';

    if (req.path.startsWith('/api/')) {
      return res.status(status).json({ error: message });
    }
    return res.status(status).type('html').send(simplePage(status, 'Request failed', message,
      '<p><a href="/">Home</a></p>'));
  });

  return app;
}

module.exports = { createApp };
