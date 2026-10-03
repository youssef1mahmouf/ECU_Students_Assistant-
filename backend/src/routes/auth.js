'use strict';
/**
 * Authentication routes. Credentials are verified server side, sessions are issued by the
 * server, and failures return a single generic message so the endpoint cannot be used to
 * enumerate accounts. Passwords are never logged or returned in any response.
 */
const express = require('express');
const crypto = require('crypto');
const { store } = require('../db/store');
const config = require('../config/env');
const { sendEmail } = require('../services/mailer');
const v = require('../lib/validate');
const { ApiError, asyncHandler } = require('../lib/errors');
const { hashPassword, verifyPassword, TIMING_SAFE_DUMMY } = require('../lib/password');
const { issueSession, destroySession, revokeUserSessions, readCsrfToken, ensureCsrfToken } = require('../lib/session');
const { requireAuth } = require('../middleware/auth');
const { STAFF_ROLES } = require('../lib/permissions');
const { throttleByAccount, rateLimit } = require('../middleware/security');
const { selfView, permissionsFor } = require('../lib/dto');
const { logActivity } = require('../services/activity');

const router = express.Router();

/* One shared cooldown window so a mistyped password only pauses a few seconds. The per-route
   caps stay the real defence: an over-limit caller stays blocked until the window rolls over. */
const WINDOW = config.security.rateLimitWindowMs;

const loginLimiter = throttleByAccount({ windowMs: WINDOW, max: 8 });
const emailLookupLimiter = throttleByAccount({ windowMs: WINDOW, max: 12, prefix: 'email-lookup' });
const registerLimiter = rateLimit({ windowMs: WINDOW, max: 12, prefix: 'register' });
const emailCodeSendLimiter = rateLimit({ windowMs: WINDOW, max: 5, prefix: 'email-code-send' });
const emailCodeVerifyLimiter = rateLimit({ windowMs: WINDOW, max: 10, prefix: 'email-code-verify' });

/**
 * One wording for "this address is not authorised", used by every public endpoint so the
 * answer never reveals whether an account, a password or only a roster row exists.
 */
const NOT_REGISTERED = 'This email is not registered for access to this portal.';

/**
 * The roster is the allow-list: it authorises sign-in as well as registration. Staff roles are
 * exempt because a super admin creates those accounts by hand; a student account that an
 * administrator created deliberately (staffCreated) is likewise authorised by that person.
 * Nothing here trusts a role, group or id that a browser sent.
 */
async function isAuthorised(user, entry) {
  if (entry) return true;
  if (!user) return false;
  return STAFF_ROLES.includes(user.role) || user.staffCreated === true;
}

/** Hand out the CSRF cookie and report the current identity (guests get user: null). */
router.get('/me', async (req, res) => {
  const csrfToken = readCsrfToken(req) || ensureCsrfToken(res, {});
  let user = null;
  if (req.user) {
    // The full roster name is the canonical identity printed on the PDF; display-only.
    const entry = req.user.email ? await store.findRosterByEmail(req.user.email) : null;
    user = { ...selfView(req.user), rosterName: entry && entry.name ? entry.name : '' };
  }
  res.json({
    user,
    permissions: permissionsFor(req.user),
    csrfToken,
  });
});

/**
 * Step one of the email-first sign-in. Answers only what the next screen needs: whether to
 * ask for a password, and whether a first password can be set. Rate limited per email and
 * per address so it cannot be used to walk the roster.
 */
router.post(
  '/check-email',
  emailLookupLimiter,
  asyncHandler(async (req, res) => {
    const body = v.pick(req.body, ['email']);
    const email = v.email(body.email);
    const [account, entry] = await Promise.all([
      store.findUserByEmail(email),
      store.findRosterByEmail(email),
    ]);
    const authorised = await isAuthorised(account, entry);
    res.json({
      recognized: authorised,
      hasAccount: authorised && Boolean(account),
      canRegister: authorised && !account && Boolean(entry),
    });
  })
);

router.post(
  '/send-code',
  emailCodeSendLimiter,
  emailLookupLimiter,
  asyncHandler(async (req, res) => {
    const body = v.pick(req.body, ['email']);
    const email = v.email(body.email);
    if (!config.mail.apiKey || !config.mail.from) throw ApiError.badRequest('Email delivery is not configured. Set RESEND_API_KEY and MAIL_FROM.');
    const [rosterEntry, existingAccount] = await Promise.all([
      store.findRosterByEmail(email), store.findUserByEmail(email),
    ]);
    // Identical response for addresses outside the roster or with existing accounts.
    if (rosterEntry && !existingAccount) {
      const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
      const salt = crypto.randomBytes(16).toString('hex');
      const codeHash = crypto.createHash('sha256').update(`${salt}:${code}`).digest('hex');
      const expiresAt = new Date(Date.now() + config.mail.codeTtlMs).toISOString();
      await store.saveEmailVerification(email, { salt, codeHash, expiresAt, attempts: 0, verifiedAt: null });
      try {
        await sendEmail({ to: email, subject: 'Your ECU portal verification code', text: `Your six-digit verification code is ${code}. It expires in ${Math.round(config.mail.codeTtlMs / 60000)} minutes. If you did not request this, ignore this email.` });
      } catch (error) {
        await store.deleteEmailVerification(email);
        console.error('[mail] verification delivery failed:', error.status || error.message);
      }
    }
    res.status(202).json({ message: 'If this address is eligible, a verification code has been sent.' });
  })
);

router.post(
  '/verify-code',
  emailCodeVerifyLimiter,
  emailLookupLimiter,
  asyncHandler(async (req, res) => {
    const body = v.pick(req.body, ['email', 'code']);
    const email = v.email(body.email);
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    if (!/^\d{6}$/.test(code)) throw ApiError.badRequest('Enter the six-digit code from your email.');
    const challenge = await store.findEmailVerification(email);
    if (!challenge || challenge.verifiedAt || new Date(challenge.expiresAt).getTime() <= Date.now() || challenge.attempts >= 5) {
      throw ApiError.badRequest('The code is invalid or expired. Request a new code.');
    }
    const actual = crypto.createHash('sha256').update(`${challenge.salt}:${code}`).digest();
    const expected = Buffer.from(challenge.codeHash, 'hex');
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
      await store.updateEmailVerification(email, { attempts: challenge.attempts + 1 });
      throw ApiError.badRequest('The code is invalid or expired. Request a new code.');
    }
    await store.updateEmailVerification(email, { verifiedAt: new Date().toISOString() });
    res.json({ message: 'Email address verified. You can create your account now.' });
  })
);

router.post(
  '/register',
  registerLimiter,
  asyncHandler(async (req, res) => {
    const body = v.pick(req.body, ['email', 'password']);
    const email = v.email(body.email);
    const secret = v.password(body.password);
    // The allow-list decides who may have an account, and supplies the identity it prints:
    // name, student id and group are never taken from the request body.
    const entry = await store.findRosterByEmail(email);
    if (!entry) throw ApiError.forbidden(NOT_REGISTERED);

    const verification = await store.findEmailVerification(email);
    if (!verification?.verifiedAt || new Date(verification.expiresAt).getTime() <= Date.now()) {
      throw ApiError.forbidden('Verify your email address before creating an account.');
    }

    if (await store.findUserByEmail(email)) {
      throw ApiError.conflict('An account already uses this email address.');
    }
    const name = String(entry.name || email).slice(0, 80);
    const group = String(entry.group || '');
    if (!(await store.findGroupByName(group))) throw ApiError.badRequest('The selected group is not available.');
    const isTeachingAssistant = entry.type === 'ta';

    const user = await store.createUser({
      name,
      email,
      studentId: entry.studentId || '',
      advisorName: entry.advisorName || '',
      advisorEmail: entry.advisorEmail || '',
      academicYear: entry.academicYear || '',
      passwordHash: await hashPassword(secret),
      // A listed teaching assistant is still only a member of the application: staff/admin
      // roles are granted by a super admin from the admin area and can never be self-served.
      role: 'user',
      group,
      isTeachingAssistant,
      taGroups: Array.isArray(entry.taGroups) ? entry.taGroups : [],
      confirmed: false, // an administrator must approve the membership
      active: true,
      emailVerified: true,
    });
    await store.deleteEmailVerification(email);
    await logActivity({ actor: name, action: `Created account and requested access to ${group}.`, level: 'auth' });
    res.status(201).json({
      message: 'Account created. An administrator must approve your group membership before group content opens.',
      user: selfView(user),
    });
  })
);

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const body = v.pick(req.body, ['email', 'password', 'remember']);
    const email = v.email(body.email);
    const secret = body.password;
    if (typeof secret !== 'string' || secret.length === 0 || secret.length > 200) {
      throw ApiError.badRequest('Password is required.');
    }

    const user = await store.findUserByEmail(email);
    // Always run a scrypt verification so timing does not reveal account existence.
    const ok = await verifyPassword(secret, user ? user.passwordHash : TIMING_SAFE_DUMMY);
    if (!user || !ok) {
      await logActivity({ actor: email, action: 'Failed sign-in attempt.', level: 'security' });
      throw ApiError.unauthorized('Email or password is incorrect.');
    }
    if (user.active === false) {
      await logActivity({ actor: user.name, action: 'Sign-in blocked: account disabled.', level: 'security' });
      throw ApiError.forbidden('This account has been disabled. Contact an administrator.');
    }
    // Credentials alone are not enough: the address must still be authorised (allow-list or
    // staff). The answer stays generic so a failed attempt cannot enumerate the roster.
    if (!(await isAuthorised(user, await store.findRosterByEmail(email)))) {
      await logActivity({ actor: user.name, action: 'Sign-in blocked: email is not on the authorised roster.', level: 'security' });
      throw ApiError.forbidden(NOT_REGISTERED);
    }

    // New session id on every successful login prevents session fixation.
    await issueSession(res, req, user, { remember: v.boolean(body.remember) });
    loginLimiter.reset(req);
    const lastLoginAt = new Date().toISOString();
    await store.updateUser(user.id, { lastLoginAt });
    await logActivity({ actor: user.name, action: `Signed in as ${user.role}.`, level: 'auth', actorRole: user.role });
    const signedIn = { ...user, lastLoginAt };
    res.json({ user: selfView(signedIn), permissions: permissionsFor(signedIn) });
  })
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    if (req.user) {
      await logActivity({ actor: req.user.name, action: 'Signed out.', level: 'auth', actorRole: req.user.role });
    }
    await destroySession(req, res);
    res.json({ message: 'Signed out.' });
  })
);

router.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = v.pick(req.body, ['currentPassword', 'newPassword']);
    const current = String(body.currentPassword ?? '');
    const nextSecret = v.password(body.newPassword);
    if (!(await verifyPassword(current, req.user.passwordHash))) {
      await logActivity({ actor: req.user.name, action: 'Failed password change: current password incorrect.', level: 'security' });
      throw ApiError.unauthorized('Current password is incorrect.');
    }
    if (current === nextSecret) throw ApiError.badRequest('The new password must be different.');
    await store.updateUser(req.user.id, { passwordHash: await hashPassword(nextSecret) });
    // Rotate: keep this session, drop every other one.
    await revokeUserSessions(res, req.user.id);
    await issueSession(res, req, req.user, {});
    await logActivity({ actor: req.user.name, action: 'Changed their password.', level: 'admin' });
    res.json({ message: 'Password updated. Other devices were signed out.' });
  })
);

module.exports = router;
