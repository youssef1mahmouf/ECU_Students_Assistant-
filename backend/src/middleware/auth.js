'use strict';
/**
 * Authentication and authorisation middleware.
 * These checks are the enforcement point for every protected operation - the frontend
 * hides controls for convenience only, and a request that bypasses the UI still lands here.
 * The role -> capability rules live in lib/permissions.js.
 */
const config = require('../config/env');
const { ApiError } = require('../lib/errors');
const { resolveSession } = require('../lib/session');
const { ROLES, STAFF_ROLES, hasCap, capabilitiesFor } = require('../lib/permissions');

/** Populates req.user / req.session when a valid session cookie exists. Never rejects. */
async function attachIdentity(req, res, next) {
  try {
    const result = await resolveSession(req);
    req.user = result ? result.user : null;
    req.session = result ? result.session : null;
  } catch (error) {
    req.user = null;
    req.session = null;
    if (config.isProduction) req.logSecurity?.('Session resolution failed', error);
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return next(ApiError.unauthorized('Sign in to continue.'));
  if (req.user.active === false) return next(ApiError.forbidden('This account has been disabled.'));
  return next();
}

/** Admin area: any role that holds the adminArea capability (see lib/permissions.js). */
function requireAdmin(req, res, next) {
  if (!req.user) return next(ApiError.unauthorized('Sign in to continue.'));
  if (!hasCap(req.user.role, 'adminArea')) {
    return next(ApiError.forbidden('Administrator access required.'));
  }
  return next();
}

/**
 * Fine-grained gate: the route names the capability it needs and the matrix decides.
 * Used on top of requireAdmin so a read-only staff role cannot reach a mutating route.
 */
function requireCap(capability) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized('Sign in to continue.'));
    if (!hasCap(req.user.role, capability)) {
      return next(ApiError.forbidden('You do not have permission to perform this action.'));
    }
    return next();
  };
}

/** Only the permanent super admin may change roles or remove staff accounts. */
function requireSuperAdmin(req, res, next) {
  if (!req.user) return next(ApiError.unauthorized('Sign in to continue.'));
  if (req.user.role !== 'superAdmin') return next(ApiError.forbidden('Super admin access required.'));
  return next();
}

/**
 * Group membership gate. A user may read a group's content only when their own assigned
 * group matches; the requested group is never taken from the client.
 */
function requireConfirmedMember(req, res, next) {
  if (!req.user) return next(ApiError.unauthorized('Sign in to continue.'));
  if (hasCap(req.user.role, 'adminArea')) return next();
  if (!req.user.group) return next(ApiError.forbidden('Join a group to view its content.'));
  if (!req.user.confirmed) return next(ApiError.forbidden('Your group membership is awaiting approval.'));
  return next();
}

/** Page guard for server-rendered/static app shells: redirects instead of returning JSON. */
function requireAuthPage(loginPath) {
  return (req, res, next) => {
    if (req.user && req.user.active !== false) return next();
    return res.redirect(303, `${loginPath}?next=${encodeURIComponent(req.originalUrl)}`);
  };
}

function requireRolePage(roles, loginPath) {
  return (req, res, next) => {
    if (req.user && req.user.active !== false && roles.includes(req.user.role)) return next();
    if (req.user) return res.status(403).type('html').send(PAGE_DENIED);
    return res.redirect(303, `${loginPath}?next=${encodeURIComponent(req.originalUrl)}`);
  };
}

/**
 * Page guard driven by the permission matrix: `capability` must hold for the visitor,
 * or - when it is null - any staff capability (adminArea). Anonymous visitors are
 * redirected; a signed-in visitor without the capability gets the 403 page and never
 * sees the markup.
 */
function requirePageCapability(capability, loginPath) {
  return (req, res, next) => {
    if (!req.user || req.user.active === false) {
      return res.redirect(303, `${loginPath}?next=${encodeURIComponent(req.originalUrl)}`);
    }
    if (capability ? hasCap(req.user.role, capability) : hasCap(req.user.role, 'adminArea')) return next();
    return res.status(403).type('html').send(PAGE_DENIED);
  };
}

const PAGE_DENIED = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Access denied</title>
<style>body{font-family:system-ui,sans-serif;background:#0f1720;color:#e6edf3;display:grid;place-items:center;min-height:100vh;margin:0}
main{max-width:34rem;padding:2rem;text-align:center}a{color:#4fd1c5}</style></head>
<body><main><h1>403 - Access denied</h1><p>Administrator access is required for this page. If you reached this page from a bookmark, sign in with an admin account.</p>
<p><a href="/admin/">Go to admin sign in</a> &middot; <a href="/">Home</a></p></main></body></html>`;

module.exports = {
  ROLES,
  STAFF_ROLES,
  capabilitiesFor,
  attachIdentity,
  requireAuth,
  requireAdmin,
  requireCap,
  requireSuperAdmin,
  requireConfirmedMember,
  requireAuthPage,
  requireRolePage,
  requirePageCapability,
  PAGE_DENIED,
};
