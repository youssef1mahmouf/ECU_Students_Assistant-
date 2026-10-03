'use strict';
/**
 * Central runtime configuration.
 * Loads backend/.env (resolved from this file, never from the process cwd) so the
 * server starts correctly no matter which folder `npm start` was called from.
 * No secret values are logged or exported anywhere else.
 */
const path = require('path');
const crypto = require('crypto');

const BACKEND_DIR = path.resolve(__dirname, '..', '..');
const REPO_ROOT = path.resolve(BACKEND_DIR, '..');

require('dotenv').config({ path: path.join(BACKEND_DIR, '.env') });

const asBool = (value, fallback) =>
  value === undefined || value === '' ? fallback : /^(1|true|yes|on)$/i.test(value);
const asInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isProduction = process.env.NODE_ENV === 'production';

const hasMongoCredentials = Boolean(
  process.env.MONGODB_URI || (process.env.MONGODB_USERNAME && process.env.MONGODB_PASSWORD)
);

// DATA_STORE=file|mongo overrides the automatic choice. 'file' keeps every record in
// backend/data_base/db.json so the app is runnable (and testable) without Atlas access.
let dataStore = (process.env.DATA_STORE || '').trim().toLowerCase();
if (dataStore !== 'file' && dataStore !== 'mongo') dataStore = hasMongoCredentials ? 'mongo' : 'file';

let sessionSecret = (process.env.SESSION_SECRET || '').trim();
if (sessionSecret.length < 32) {
  if (isProduction) {
    throw new Error('SESSION_SECRET (min 32 chars) must be set in backend/.env when NODE_ENV=production.');
  }
  sessionSecret = crypto.randomBytes(32).toString('hex');
  console.warn(
    '[config] SESSION_SECRET missing - generated an ephemeral development secret. ' +
      'Existing sessions are invalidated on every restart.'
  );
}

module.exports = {
  isProduction,
  env: process.env.NODE_ENV || 'development',
  port: asInt(process.env.PORT, 3000),
  host: process.env.HOST || '127.0.0.1',
  repoRoot: REPO_ROOT,
  backendDir: BACKEND_DIR,
  frontendDir: path.join(REPO_ROOT, 'frontend'),
  dataDir: process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(BACKEND_DIR, 'data_base'),

  dataStore,
  hasMongoCredentials,
  trustProxy: asBool(process.env.TRUST_PROXY, false),
  session: {
    secret: sessionSecret,
    cookieName: process.env.SESSION_COOKIE_NAME || 'ga6_sid',
    csrfCookieName: 'ga6_csrf_v2',
    // Sessions are short lived by default; "remember me" extends to REMEMBER_TTL_DAYS.
    ttlMs: asInt(process.env.SESSION_TTL_HOURS, 12) * 60 * 60 * 1000,
    rememberTtlMs: asInt(process.env.REMEMBER_TTL_DAYS, 30) * 24 * 60 * 60 * 1000,
    idleTtlMs: asInt(process.env.SESSION_IDLE_TTL_MINUTES, 0) * 60 * 1000,
    cookie: {
      secure: asBool(process.env.COOKIE_SECURE, isProduction),
      sameSite: process.env.COOKIE_SAME_SITE || 'lax',
      domain: process.env.COOKIE_DOMAIN || undefined,
    },
  },
  security: {
    loginMaxAttempts: asInt(process.env.LOGIN_MAX_ATTEMPTS, 8),
    loginWindowMs: asInt(process.env.LOGIN_WINDOW_MINUTES, 15) * 60 * 1000,
    /* Shared cooldown for every limiter. Short by default so a mistyped password never locks
       anyone out for a quarter of an hour; the per-route attempt caps below still stop a
       sustained attack, because an over-limit caller keeps being refused until the window
       rolls over rather than simply trying again. */
    rateLimitWindowMs: Math.max(asInt(process.env.RATE_LIMIT_WINDOW_SECONDS, 10), 1) * 1000,
    emailDomain: (process.env.ALLOWED_EMAIL_DOMAIN || 'ecu.edu.eg').trim().toLowerCase(),
    enforceEmailDomain: asBool(process.env.ENFORCE_EMAIL_DOMAIN, true),
    minPasswordLength: asInt(process.env.MIN_PASSWORD_LENGTH, 8),
    /* The primary owner account. Its password reset, disable, role change and delete are
       refused for every caller through the admin API (self-service password change still
       works: it needs the current password). */
    protectedOwnerEmail: (process.env.PROTECTED_OWNER_EMAIL || '192600250@ecu.edu.eg').trim().toLowerCase(),
  },
  dashboard: {
    /* "Online" on the dashboard = an account with a session seen within this period.
       Session lastSeenAt is touched at most once a minute by lib/session.js. */
    onlineWindowMinutes: Math.min(Math.max(asInt(process.env.ONLINE_WINDOW_MINUTES, 15), 1), 1440),
  },
  /* Uploads live under backend/storage (never under frontend/, so the static handler can
     never serve them) and are reachable only through the authorization-checked download
     route. maxBytes is the decoded file size; maxRequestBytes is the JSON body ceiling that
     allows for base64 (4/3) plus JSON overhead. */
  upload: (() => {
    const maxMb = asInt(process.env.UPLOAD_MAX_MB, 10);
    const maxBytes = Math.min(Math.max(maxMb, 1), 100) * 1024 * 1024;
    return {
      dir: process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.join(BACKEND_DIR, 'storage'),
      maxBytes,
      maxRequestBytes: Math.ceil((maxBytes * 4) / 3) + 131072,
    };
  })(),
  adminBootstrap: {
    email: (process.env.ADMIN_BOOTSTRAP_EMAIL || '').trim().toLowerCase(),
    name: process.env.ADMIN_BOOTSTRAP_NAME || 'Portal Administrator',
  },
  mail: {
    /* 'resend' (default) or 'outlook'. The provider is chosen here so no route has to know. */
    provider: (process.env.MAIL_PROVIDER || 'resend').trim().toLowerCase(),
    apiKey: process.env.RESEND_API_KEY || '',
    from: process.env.MAIL_FROM || (isProduction ? '' : 'ECU Students Portal <onboarding@resend.dev>'),
    reportTo: process.env.MAIL_REPORT_TO || '',
    codeTtlMs: Math.min(Math.max(asInt(process.env.EMAIL_CODE_TTL_MINUTES, 10), 2), 30) * 60 * 1000,
    /* Outlook / Microsoft 365 over the Graph API - a plain HTTPS call, no extra dependency.
       Tenant + client id + secret are for an app registration with the Mail.Send application
       permission and admin consent; nothing here is a user password. */
    outlook: {
      tenant: (process.env.OUTLOOK_TENANT_ID || '').trim(),
      clientId: (process.env.OUTLOOK_CLIENT_ID || '').trim(),
      clientSecret: (process.env.OUTLOOK_CLIENT_SECRET || '').trim(),
      /* The mailbox that sends, e.g. portal@ecu.edu.eg */
      sender: (process.env.OUTLOOK_SENDER || '').trim(),
    },
  },
};
