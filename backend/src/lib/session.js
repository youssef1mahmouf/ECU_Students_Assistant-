'use strict';
/**
 * Server-side sessions with opaque split tokens.
 * Cookie value is "<id>.<secret>"; only the SHA-256 of the secret is stored, so a data
 * read alone cannot be replayed as a session, and the secret never leaves the browser.
 * Session lookup always re-loads the user record so a revoked role takes effect
 * immediately - the session stores identity, never authorisation.
 */
const crypto = require('crypto');
const config = require('../config/env');
const { store } = require('../db/store');

const COOKIE = config.session.cookieName;
const CSRF_COOKIE = config.session.csrfCookieName;

function parseCookies(header) {
  const out = {};
  if (typeof header !== 'string') return out;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 1) continue;
    const name = part.slice(0, index).trim();
    if (name === COOKIE || name === CSRF_COOKIE) out[name] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return out;
}

function cookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    sameSite: config.session.cookie.sameSite,
    secure: config.session.cookie.secure,
    path: '/',
    domain: config.session.cookie.domain,
    // Express itself converts milliseconds to the Max-Age seconds attribute, so the
    // duration is passed through untouched. Dividing here as well would shorten every
    // session by a factor of 1000 (12 hours became 43 seconds).
    maxAge: maxAgeMs,
  };
}

const randomToken = (bytes) => crypto.randomBytes(bytes).toString('base64url');
const verifierHash = (value) => crypto.createHash('sha256').update(value).digest('hex');

function safeEqualHex(a, b) {
  const left = Buffer.from(String(a), 'hex');
  const right = Buffer.from(String(b), 'hex');
  return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right);
}

async function issueSession(res, req, user, { remember = false } = {}) {
  const id = randomToken(12);
  const secret = randomToken(32);
  const ttl = remember ? config.session.rememberTtlMs : config.session.ttlMs;
  const now = Date.now();
  await store.createSession({
    id,
    verifierHash: verifierHash(secret),
    userId: user.id,
    remember: Boolean(remember),
    createdAt: new Date(now).toISOString(),
    lastSeenAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttl).toISOString(),
    userAgent: String(req.get('user-agent') || '').slice(0, 200),
    ip: String(req.ip || '').slice(0, 64),
  });
  res.cookie(COOKIE, `${id}.${secret}`, cookieOptions(ttl));
  return id;
}

/** Destroys the session referenced by the request cookie and clears the cookie. */
async function destroySession(req, res) {
  const tokens = parseCookies(req.headers.cookie);
  const raw = tokens[COOKIE];
  if (raw) {
    const id = raw.split('.')[0];
    if (/^[\w-]{1,32}$/.test(id)) await store.deleteSession(id);
  }
  res.clearCookie(COOKIE, { path: '/' });
}

/** Revokes every session of a user (used on logout-all, role change, deactivation, delete). */
async function revokeUserSessions(res, userId) {
  await store.deleteSessionsForUser(userId);
  res.clearCookie(COOKIE, { path: '/' });
}

/** Returns { session, user } or null. Never throws on malformed cookies. */
async function resolveSession(req) {
  const tokens = parseCookies(req.headers.cookie);
  const raw = tokens[COOKIE];
  if (!raw || raw.length > 200) return null;
  const [id, secret] = raw.split('.');
  if (!/^[\w-]{1,32}$/.test(id || '') || !/^[\w-]{1,64}$/.test(secret || '')) return null;

  const session = await store.findSession(id);
  if (!session) return null;
  if (!safeEqualHex(verifierHash(secret), session.verifierHash)) return null;
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await store.deleteSession(id);
    return null;
  }
  const user = await store.findUserById(session.userId);
  if (!user || user.active === false) return null;

  const idleMs = config.session.idleTtlMs;
  if (idleMs && Date.now() - new Date(session.lastSeenAt).getTime() > idleMs) {
    await store.deleteSession(id);
    return null;
  }
  // Throttled touch: at most once a minute to avoid a write on every request.
  if (Date.now() - new Date(session.lastSeenAt).getTime() > 60_000) {
    await store.updateSession(id, { lastSeenAt: new Date().toISOString() });
  }
  return { session, user };
}

/** CSRF token lives in a readable cookie; the client must echo it in a header. */
function ensureCsrfToken(res, tokens) {
  const existing = tokens[CSRF_COOKIE];
  if (existing && /^[\w-]{16,64}$/.test(existing)) return existing;
  const token = randomToken(24);
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    sameSite: config.session.cookie.sameSite,
    secure: config.session.cookie.secure,
    path: '/',
    // Milliseconds: Express converts this to Max-Age seconds (see cookieOptions).
    maxAge: config.session.ttlMs,
  });
  return token;
}

function readCsrfToken(req) {
  return parseCookies(req.headers.cookie)[CSRF_COOKIE];
}

module.exports = {
  issueSession,
  destroySession,
  revokeUserSessions,
  resolveSession,
  ensureCsrfToken,
  readCsrfToken,
  parseCookies,
  cookieOptions,
};
