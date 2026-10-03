'use strict';
/**
 * Response hardening and request guards: security headers + CSP, CSRF double-submit
 * check, and an in-memory fixed-window rate limiter. No external dependency is needed
 * because the existing stack (express 5 + node:crypto) already covers these needs.
 */
const crypto = require('crypto');
const config = require('../config/env');
const { ApiError } = require('../lib/errors');
const { readCsrfToken } = require('../lib/session');

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function securityHeaders(req, res, next) {
  const directives = [
    "default-src 'self'",
    // No inline or eval'd script: injected markup cannot execute.
    "script-src 'self'",
    // Inline style attributes are used by the existing page markup.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ];
  if (config.session.cookie.secure) directives.push('upgrade-insecure-requests');
  if (config.isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  res.setHeader('Content-Security-Policy', directives.join('; '));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=(), interest-cohort=()');
  res.removeHeader('X-Powered-By');
  next();
}

/** API responses must not be cached by a shared cache or the browser back/forward list. */
function noApiCache(req, res, next) {
  res.setHeader('Cache-Control', 'no-store');
  next();
}

/**
 * CSRF defence in depth: SameSite=Lax cookies stop cross-site posting, and this check
 * additionally requires every state-changing API call to echo the CSRF cookie in a
 * header (which a cross-origin form cannot set) and to originate from this site.
 */
function csrfProtection(req, res, next) {
  if (!UNSAFE_METHODS.has(req.method)) return next();
  const header = req.get('x-csrf-token');
  const cookie = readCsrfToken(req);
  if (!header || !cookie || header !== cookie) {
    return next(ApiError.forbidden('Security token missing or invalid. Reload the page and try again.'));
  }
  const origin = req.get('origin');
  const referer = req.get('referer');
  const host = req.headers.host ? `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}` : null;
  const source = origin || (referer ? new URL(referer).origin : null);
  if (host && source && source !== host) {
    return next(ApiError.forbidden('Cross-origin request blocked.'));
  }
  return next();
}

const buckets = new Map();

/** Fixed-window limiter keyed per route + client. Returns a middleware and a reset hook. */
function rateLimit({ windowMs = config.security.rateLimitWindowMs, max = 10, prefix = 'rl' } = {}) {
  const middleware = (req, res, next) => {
    const key = `${prefix}:${req.ip}`;
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > max) {
      res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
      return next(ApiError.tooManyRequests('Too many attempts. Please wait before trying again.'));
    }
    return next();
  };
  middleware.reset = (ip) => buckets.delete(`${prefix}:${ip}`);
  return middleware;
}

/** Per-account limiter used for credential checks so one noisy client cannot lock out others. */
function throttleByAccount({ windowMs = config.security.rateLimitWindowMs, max = 8, prefix = 'auth' } = {}) {
  const middleware = (req, res, next) => {
    const account = String((req.body && req.body.email) || '').trim().toLowerCase() || 'anonymous';
    const key = crypto.createHash('sha256').update(`${prefix}:${req.ip}:${account}`).digest('hex');
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > max) {
      res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
      req.throttled = true;
      return next(ApiError.tooManyRequests('Too many sign-in attempts. Try again in a few minutes.'));
    }
    return next();
  };
  middleware.reset = (req) => {
    const account = String((req.body && req.body.email) || '').trim().toLowerCase() || 'anonymous';
    buckets.delete(crypto.createHash('sha256').update(`${prefix}:${req.ip}:${account}`).digest('hex'));
  };
  return middleware;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}, 60_000).unref();

module.exports = { securityHeaders, noApiCache, csrfProtection, rateLimit, throttleByAccount };
