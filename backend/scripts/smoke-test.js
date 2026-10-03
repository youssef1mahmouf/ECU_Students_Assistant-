'use strict';
/**
 * End-to-end permission and security checks (`npm run verify`).
 * Boots the real app against an isolated temporary file store in os.tmpdir(), seeds its
 * own accounts, and asserts the boundaries a browser cannot fake. Nothing is written
 * into the project data folder and no credential is ever printed.
 */
const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

process.env.DATA_STORE = 'file';
process.env.DATA_DIR = path.join(os.tmpdir(), `ga6-verify-${crypto.randomBytes(6).toString('hex')}`);
process.env.NODE_ENV = 'development';
process.env.SESSION_SECRET = crypto.randomBytes(48).toString('base64url');
process.env.PORT = '0';
process.env.RESEND_API_KEY = 'resend-smoke-test-key';
process.env.MAIL_FROM = 'ECU Portal <onboarding@resend.dev>';
process.env.MAIL_REPORT_TO = 'report-inbox@example.test';
const sentEmails = [];
let failNextEmail = false;
const nativeFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = async (url, options = {}) => {
  if (String(url) === 'https://api.resend.com/emails') {
    sentEmails.push(JSON.parse(options.body || '{}'));
    if (failNextEmail) {
      failNextEmail = false;
      return new Response('{"error":"mock failure"}', { status: 503, headers: { 'content-type': 'application/json' } });
    }
    return new Response('{"id":"smoke-email"}', { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return nativeFetch(url, options);
};

const config = require('../src/config/env');
const { createApp } = require('../src/app');
const { store, init, close } = require('../src/db/store');
const { hashPassword } = require('../src/lib/password');

const PASSWORDS = {
  super: 'Super#Pass1',
  admin: 'Admin#Pass1',
  studentOne: 'Student#One1',
  studentTwo: 'Student#Two1',
  ghost: 'Ghost#Pass1',
  listed: 'Listed#Pass1',
  ta: 'Listed#Ta12',
};

let passed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`);
  }
}

/* ------------------------------------------------------------- tiny cookie jar */
function makeJar() {
  const jar = new Map();
  return {
    header: () => [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
    absorb: (res) => {
      for (const raw of res.headers.getSetCookie ? res.headers.getSetCookie() : []) {
        const [pair] = raw.split(';');
        const index = pair.indexOf('=');
        if (index < 0) continue;
        const name = pair.slice(0, index).trim();
        const value = pair.slice(index + 1).trim();
        if (value === '' || /Expires=Thu, 01 Jan 1970/i.test(raw)) jar.delete(name);
        else jar.set(name, value);
      }
    },
    get: (name) => jar.get(name),
    raw: () => [],
  };
}

let baseUrl = '';
async function call(pathname, { method = 'GET', body, jar, csrf, headers = {} } = {}) {
  const init = { method, headers: { ...headers } };
  if (jar && jar.header()) init.headers.cookie = jar.header();
  if (body !== undefined) {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  if (csrf) init.headers['x-csrf-token'] = csrf;
  const res = await fetch(baseUrl + pathname, init);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* html response */
  }
  if (jar) jar.absorb(res);
  return { status: res.status, headers: res.headers, json, text };
}

async function login(email, password) {
  const jar = makeJar();
  await call('/api/auth/me', { jar }); // obtain the CSRF cookie
  const csrf = jar.get('ga6_csrf_v2');
  const res = await call('/api/auth/login', { method: 'POST', body: { email, password }, jar, csrf });
  return { jar, csrf, res };
}

async function verifyRosterEmail(email, jar, csrf) {
  const sent = await call('/api/auth/send-code', { method: 'POST', body: { email }, jar, csrf });
  const mail = sentEmails[sentEmails.length - 1];
  const match = String(mail?.text || '').match(/code is (\d{6})/);
  if (sent.status !== 202 || !match) return { sent, verified: { status: 0, json: { error: 'Mock verification email was not captured.' } } };
  const verified = await call('/api/auth/verify-code', { method: 'POST', body: { email, code: match[1] }, jar, csrf });
  return { sent, verified };
}

async function seedFixtures() {
  await init();
  for (const name of ['Group 1', 'Group 2']) {
    if (!(await store.findGroupByName(name))) await store.createGroup({ name, description: '', createdBy: 'verify' });
  }
  const accounts = [
    { name: 'Verify Super', email: 'super@ecu.edu.eg', role: 'superAdmin', group: '', password: PASSWORDS.super },
    { name: 'Verify Admin', email: 'staff@ecu.edu.eg', role: 'admin', group: '', password: PASSWORDS.admin },
    { name: 'Verify One', email: 'one@ecu.edu.eg', role: 'user', group: 'Group 1', password: PASSWORDS.studentOne },
    { name: 'Verify Two', email: 'two@ecu.edu.eg', role: 'user', group: 'Group 2', password: PASSWORDS.studentTwo },
  ];
  for (const account of accounts) {
    await store.createUser({
      name: account.name,
      email: account.email,
      passwordHash: await hashPassword(account.password),
      role: account.role,
      group: account.group,
      confirmed: true,
      active: true,
    });
  }
  // Roster fixtures: the two student addresses are on the allow-list, a teaching assistant is
  // listed for both groups, and "ghost@ecu.edu.eg" has an account WITHOUT an allow-list row so
  // the tests can prove that credentials alone are not enough.
  await store.importRoster([
    { email: 'one@ecu.edu.eg', name: 'Verify One', studentId: '', group: 'Group 1', type: 'student', academicYear: 'verify', advisorName: '', advisorEmail: '', source: 'verify-fixture' },
    { email: 'two@ecu.edu.eg', name: 'Verify Two', studentId: '', group: 'Group 2', type: 'student', academicYear: 'verify', advisorName: '', advisorEmail: '', source: 'verify-fixture' },
    { email: 'listed.student@ecu.edu.eg', name: 'Listed Student', studentId: '', group: 'Group 1', type: 'student', academicYear: 'verify', advisorName: '', advisorEmail: '', source: 'verify-fixture' },
    { email: 'sneaky@ecu.edu.eg', name: 'Sneaky Person', studentId: '', group: 'Group 1', type: 'student', academicYear: 'verify', advisorName: '', advisorEmail: '', source: 'verify-fixture' },
    { email: 'ta@ecu.edu.eg', name: 'Eng. Verify TA', studentId: '', group: 'Group 1', taGroups: ['Group 1', 'Group 2'], type: 'ta', academicYear: 'verify', advisorName: 'Eng. Verify TA', advisorEmail: 'ta@ecu.edu.eg', source: 'verify-fixture' },
  ]);
  await store.createUser({
    name: 'Off Roster',
    email: 'ghost@ecu.edu.eg',
    passwordHash: await hashPassword(PASSWORDS.ghost),
    role: 'user',
    group: 'Group 1',
    confirmed: true,
    active: true,
  });
  await store.createRecord({
    group: 'Group 1', title: 'G1 published', kind: 'Assignment', dueDate: '2026-12-01',
    summary: 'public summary', body: 'group one body', published: true, createdBy: 'verify',
  });
  await store.createRecord({
    group: 'Group 1', title: 'G1 draft secret', kind: 'Note', dueDate: '',
    summary: 'staff only', body: 'draft body', published: false, createdBy: 'verify',
  });
  await store.createRecord({
    group: 'Group 2', title: 'G2 published', kind: 'Assignment', dueDate: '',
    summary: 'group two only', body: 'group two body', published: true, createdBy: 'verify',
  });
}

async function runTests() {
  console.log('\n[1] Guest area and public data');
  const health = await call('/api/health');
  check('health endpoint responds', health.status === 200 && health.json?.status === 'ok');
  check('security headers: CSP present', /script-src 'self'/.test(health.headers.get('content-security-policy') || ''));
  check('security headers: frame denial', health.headers.get('x-frame-options') === 'DENY');
  check('no x-powered-by header', !health.headers.get('x-powered-by'));

  const assessments = await call('/api/public/assessments');
  const titles = (assessments.json?.assessments || []).map((item) => item.title);
  check('guest sees published assessment info', titles.includes('G1 published'), titles.join(','));
  check('guest cannot see unpublished draft', !titles.includes('G1 draft secret'));
  check('guest payload has no user data', !JSON.stringify(assessments.json).includes('@ecu.edu.eg'));

  const groups = await call('/api/public/groups');
  check('guest sees group names only', Array.isArray(groups.json?.groups) && !JSON.stringify(groups.json).includes('email'));

  const page = await call('/');
  check('guest landing page served', page.status === 200 && /<html/i.test(page.text));

  console.log('\n[2] Registration and login rules');
  const weak = await call('/api/auth/register', {
    method: 'POST', body: { name: 'Weak Person', email: 'weak@ecu.edu.eg', password: 'abc', group: 'Group 1' }, csrf: null,
  });
  check('CSRF token is required on POST', weak.status === 403, `status ${weak.status}`);

  const guestJar = makeJar();
  await call('/api/auth/me', { jar: guestJar });
  const guestCsrf = guestJar.get('ga6_csrf_v2');
  const badDomain = await call('/api/auth/register', {
    method: 'POST', jar: guestJar, csrf: guestCsrf,
    body: { name: 'Foreign Person', email: 'someone@gmail.com', password: 'Abcdef1@', group: 'Group 1' },
  });
  check('non-institutional email rejected', badDomain.status === 400, badDomain.json?.error);
  const weakAgain = await call('/api/auth/register', {
    method: 'POST', jar: guestJar, csrf: guestCsrf,
    body: { name: 'Weak Person', email: 'weak@ecu.edu.eg', password: 'abc', group: 'Group 1' },
  });
  check('weak password rejected', weakAgain.status === 400, weakAgain.json?.error);
  const unverifiedSignup = await call('/api/auth/register', {
    method: 'POST', jar: guestJar, csrf: guestCsrf,
    body: { email: 'sneaky@ecu.edu.eg', password: 'Abcdef1@' },
  });
  check('a rostered email cannot register before verification', unverifiedSignup.status === 403);
  const codeSent = await call('/api/auth/send-code', {
    method: 'POST', jar: guestJar, csrf: guestCsrf, body: { email: 'sneaky@ecu.edu.eg' },
  });
  const codeEmail = sentEmails[sentEmails.length - 1];
  const sixDigitCode = String(codeEmail?.text || '').match(/code is (\d{6})/)?.[1] || '';
  check('rostered address receives a numeric code through the mail provider mock', codeSent.status === 202 && codeEmail?.to?.[0] === 'sneaky@ecu.edu.eg' && /^\d{6}$/.test(sixDigitCode));
  const storedCode = await store.findEmailVerification('sneaky@ecu.edu.eg');
  check('verification code is stored only as a salted hash', Boolean(storedCode?.salt && storedCode?.codeHash) && !Object.hasOwn(storedCode || {}, 'code') && storedCode.codeHash !== sixDigitCode);
  const wrongCode = await call('/api/auth/verify-code', {
    method: 'POST', jar: guestJar, csrf: guestCsrf, body: { email: 'sneaky@ecu.edu.eg', code: '000000' === sixDigitCode ? '000001' : '000000' },
  });
  check('incorrect numeric verification code is rejected', wrongCode.status === 400);
  const rightCode = await call('/api/auth/verify-code', {
    method: 'POST', jar: guestJar, csrf: guestCsrf, body: { email: 'sneaky@ecu.edu.eg', code: sixDigitCode },
  });
  check('correct numeric verification code confirms the email', rightCode.status === 200);
  const mailCountBeforeUnknown = sentEmails.length;
  const unknownCodeRequest = await call('/api/auth/send-code', {
    method: 'POST', jar: guestJar, csrf: guestCsrf, body: { email: 'nobody@ecu.edu.eg' },
  });
  check('unlisted addresses receive the same generic response without sending a code', unknownCodeRequest.status === 202 && sentEmails.length === mailCountBeforeUnknown);
  const roleSpoof = await call('/api/auth/register', {
    method: 'POST', jar: guestJar, csrf: guestCsrf,
    body: { name: 'Sneaky Person', email: 'sneaky@ecu.edu.eg', password: 'Abcdef1@', group: 'Group 1', role: 'superAdmin' },
  });
  check('self-registration cannot assign a role', roleSpoof.status === 201 && roleSpoof.json?.user?.role === 'user');
  check('self-registered account starts unapproved', roleSpoof.json?.user?.confirmed === false);

  // Double-submit CSRF needs the token cookie and the header from the same jar.
  const loginJar = makeJar();
  await call('/api/auth/me', { jar: loginJar });
  const loginCsrf = loginJar.get('ga6_csrf_v2');
  const badLogin = await call('/api/auth/login', {
    method: 'POST', jar: loginJar, csrf: loginCsrf, body: { email: 'one@ecu.edu.eg', password: 'Wrong#Pass1' },
  });
  check('wrong password rejected', badLogin.status === 401, `status ${badLogin.status}`);
  check('login error does not reveal account existence', badLogin.json?.error === 'Email or password is incorrect.', badLogin.json?.error);
  const noSuch = await call('/api/auth/login', {
    method: 'POST', jar: loginJar, csrf: loginCsrf, body: { email: 'ghost@ecu.edu.eg', password: 'Wrong#Pass1' },
  });
  check('unknown account returns the same message', noSuch.json?.error === badLogin.json?.error);

  console.log('\n[3] Sessions');
  const student = await login('one@ecu.edu.eg', PASSWORDS.studentOne);
  check('student login succeeds', student.res.status === 200, `status ${student.res.status}`);
  const setCookie = (student.res.headers.getSetCookie() || []).join(' ');
  // Attributes must be checked on the session cookie line itself, not on the joined jar.
  const sidCookie = (student.res.headers.getSetCookie() || []).find((entry) => entry.startsWith('ga6_sid=')) || setCookie;
  check('session cookie is HttpOnly', /httponly/i.test(sidCookie), sidCookie);
  check('session cookie is SameSite=Lax', /samesite=lax/i.test(sidCookie), sidCookie);
  check('session cookie has a Path', /path=/i.test(sidCookie), sidCookie);
  check('password never returned by API', !JSON.stringify(student.res.json).includes('password'));

  const me = await call('/api/auth/me', { jar: student.jar });
  check('session identity resolved', me.json?.user?.email === 'one@ecu.edu.eg');
  check('API never exposes password hash', !JSON.stringify(me.json).includes('passwordHash'));

  console.log('\n[4] Student data scoping');
  const anonymous = await call('/api/user/records');
  check('anonymous cannot read group content', anonymous.status === 401);
  const own = await call('/api/user/records', { jar: student.jar });
  const ownTitles = (own.json?.records || []).map((record) => record.title);
  check('student reads own group content', own.status === 200 && ownTitles.includes('G1 published'), ownTitles.join(','));
  check('student cannot read another group content', !ownTitles.includes('G2 published'));
  const override = await call('/api/user/records?group=Group%202', { jar: student.jar });
  const overrideTitles = (override.json?.records || []).map((record) => record.title);
  check('group query cannot be overridden from the client', overrideTitles.length > 0 && !overrideTitles.includes('G2 published'));
  check('unpublished draft hidden from student', !ownTitles.includes('G1 draft secret'));
}

async function runPrivilegeTests() {
  console.log('\n[5] Privilege escalation attempts (student token against admin API)');
  const student = await login('one@ecu.edu.eg', PASSWORDS.studentOne);
  const s = { jar: student.jar, csrf: student.csrf };

  const adminList = await call('/api/admin/users', s);
  check('student cannot list accounts', adminList.status === 403, `status ${adminList.status}`);
  const makeGroup = await call('/api/admin/groups', { ...s, method: 'POST', body: { name: 'Hacked Group' } });
  check('student cannot create groups', makeGroup.status === 403);
  const makeAdmin = await call('/api/admin/users', {
    ...s, method: 'POST',
    body: { name: 'Mallory', email: 'mallory@ecu.edu.eg', password: 'Abcdef1@', role: 'admin' },
  });
  check('student cannot create staff accounts', makeAdmin.status === 403);
  const activity = await call('/api/admin/activity', s);
  check('student cannot read the activity log', activity.status === 403);
  const overview = await call('/api/admin/overview', s);
  check('student cannot read the dashboard', overview.status === 403);
  const records = await call('/api/admin/records?group=Group%202', s);
  check('student cannot read other groups through the admin API', records.status === 403);

  // Tampering: replay the student session cookie against admin routes, and try a forged cookie.
  const forged = makeJar();
  forged.absorb({ headers: { getSetCookie: () => [] } });
  const fakeCookie = { header: () => `ga6_sid=${'a'.repeat(20)}.${'b'.repeat(40)}`, get: () => undefined, absorb: () => {} };
  const forgedRes = await call('/api/admin/users', { jar: fakeCookie });
  check('forged session cookie is rejected', forgedRes.status === 401);

  const csrfMissing = await call('/api/user/group-request', {
    jar: student.jar, method: 'POST', body: { group: 'Group 2' },
  });
  check('state change without CSRF header blocked', csrfMissing.status === 403);

  console.log('\n[6] Admin and super-admin capabilities');
  const admin = await login('staff@ecu.edu.eg', PASSWORDS.admin);
  check('admin login succeeds', admin.res.status === 200);
  const a = { jar: admin.jar, csrf: admin.csrf };
  const adminOverview = await call('/api/admin/overview', a);
  check('admin reads the dashboard', adminOverview.status === 200 && typeof adminOverview.json?.stats?.users === 'number');
  const adminRecords = await call('/api/admin/records', a);
  check('admin reads content across groups', adminRecords.status === 200 && adminRecords.json?.records?.length === 3);
  const created = await call('/api/admin/groups', { ...a, method: 'POST', body: { name: 'Group 9', description: 'ok' } });
  check('admin creates a group', created.status === 201, created.json?.error || `status ${created.status}`);
  const duplicate = await call('/api/admin/groups', { ...a, method: 'POST', body: { name: 'Group 9' } });
  check('duplicate group rejected', duplicate.status === 409);
  const injection = await call('/api/admin/groups', { ...a, method: 'POST', body: { name: '<script>alert(1)</script>' } });
  check('script payload rejected as group name', injection.status === 400);
  const traversal = await call('/api/admin/groups', { ...a, method: 'POST', body: { name: '../../../windows/system32' } });
  check('path traversal rejected as group name', traversal.status === 400);

  const accountList = await call('/api/admin/users', a);
  const target = accountList.json.users.find((user) => user.email === 'two@ecu.edu.eg');
  const approve = await call(`/api/admin/users/${target.id}`, { ...a, method: 'PATCH', body: { confirmed: true } });
  check('admin can approve a student account', approve.status === 200);
  const roleChange = await call(`/api/admin/users/${target.id}`, { ...a, method: 'PATCH', body: { role: 'admin' } });
  check('admin cannot change roles (super admin only)', roleChange.status === 403, roleChange.json?.error);
  const touchStaff = await call('/api/admin/users/' + accountList.json.users.find((u) => u.role === 'superAdmin').id, {
    ...a, method: 'PATCH', body: { active: false },
  });
  check('admin cannot disable a super admin', touchStaff.status === 403);
  const deleteStaff = await call('/api/admin/users/' + accountList.json.users.find((u) => u.role === 'superAdmin').id, {
    ...a, method: 'DELETE',
  });
  check('admin cannot delete a super admin account', deleteStaff.status === 403);
}

async function runSuperAdminAndPageTests() {
  console.log('\n[7] Super-admin exclusive actions');
  const superAdmin = await login('super@ecu.edu.eg', PASSWORDS.super);
  const sa = { jar: superAdmin.jar, csrf: superAdmin.csrf };
  const accounts = await call('/api/admin/users', sa);
  const adminUser = accounts.json.users.find((user) => user.email === 'staff@ecu.edu.eg');
  const promote = await call(`/api/admin/users/${adminUser.id}`, { ...sa, method: 'PATCH', body: { role: 'admin' } });
  check('super admin can change roles', promote.status === 200, promote.json?.error);
  const selfDemote = await call(`/api/admin/users/${accounts.json.users.find((u) => u.role === 'superAdmin').id}`, {
    ...sa, method: 'PATCH', body: { active: false },
  });
  check('super admin cannot lock themselves out', selfDemote.status === 400, selfDemote.json?.error);
  const removeAdmin = await call(`/api/admin/users/${adminUser.id}`, { ...sa, method: 'DELETE' });
  check('super admin can delete a staff account', removeAdmin.status === 200, removeAdmin.json?.error);
  const removedSession = await call('/api/admin/overview', { jar: adminJarRef });
  check('deleting an account revokes its live session', removedSession.status === 401, `status ${removedSession.status}`);

  console.log('\n[8] Page-level guards and path handling');
  const adminPage = await call('/admin/dashboard/');
  check('anonymous is redirected from admin pages', adminPage.status === 200 && !/admin-dashboard/i.test(adminPage.text));
  const studentPage = await call('/admin/dashboard/', { jar: (await login('one@ecu.edu.eg', PASSWORDS.studentOne)).jar });
  check('student is denied the admin dashboard page', /403|Access denied/.test(studentPage.text) && !/admin-dashboard/i.test(studentPage.text));
  const adminOwn = await call('/admin/dashboard/', { jar: superAdmin.jar });
  check('admin can open the admin dashboard page', adminOwn.status === 200);
  const envProbe = await call('/backend/.env');
  check('.env is not served', envProbe.status !== 200 && !/MONGODB_PASSWORD/.test(envProbe.text), `status ${envProbe.status}`);
  const dotEnvEncoded = await call('/%2e%2e/backend/.env');
  check('encoded traversal does not leak .env', dotEnvEncoded.status !== 200 && !/MONGODB_PASSWORD/.test(dotEnvEncoded.text));
  const storeProbe = await call('/data_base/db.json');
  check('local data store is not web-served', storeProbe.status !== 200);
  const unknownApi = await call('/api/does-not-exist');
  check('unknown API route returns JSON 404', unknownApi.status === 404 && Boolean(unknownApi.json?.error));
  const malformed = await call('/api/auth/login', {
    method: 'POST', jar: makeJar(), csrf: (await call('/api/auth/me', { jar: makeJar() })).json?.csrfToken,
    headers: { 'content-type': 'application/json' },
    body: undefined,
  });
  check('malformed JSON body handled safely', malformed.status === 400 || malformed.status === 403, `status ${malformed.status}`);

  console.log('\n[9] Logout');
  const logout = await call('/api/auth/logout', { method: 'POST', jar: superAdmin.jar, csrf: superAdmin.csrf });
  check('logout clears the session', logout.status === 200);
  const afterLogout = await call('/api/admin/overview', { jar: superAdmin.jar, csrf: superAdmin.csrf });
  check('revoked session cannot be reused', afterLogout.status === 401, `status ${afterLogout.status}`);
}

/** [10] Roster allow-list, email-first sign-in and the permissions a roster row can grant. */
async function runRosterTests() {
  console.log('\n[10] Roster allow-list and email-first sign-in');

  async function checkEmail(email) {
    const jar = makeJar();
    const csrf = (await call('/api/auth/me', { jar })).json?.csrfToken;
    const res = await call('/api/auth/check-email', { method: 'POST', body: { email }, jar, csrf });
    return { jar, csrf, body: res.json || {}, status: res.status };
  }

  const unknown = await checkEmail('nobody@ecu.edu.eg');
  check('unlisted email is not recognised at the email step', unknown.status === 200 && unknown.body.recognized === false);
  check('unlisted email is told it cannot register or sign in', unknown.body.canRegister === false && unknown.body.hasAccount === false);

  const unknownJar = makeJar();
  const unknownCsrf = (await call('/api/auth/me', { jar: unknownJar })).json?.csrfToken;
  const unknownRegister = await call('/api/auth/register', {
    method: 'POST',
    body: { email: 'nobody@ecu.edu.eg', password: PASSWORDS.listed },
    jar: unknownJar,
    csrf: unknownCsrf,
  });
  check('unlisted email cannot create an account', unknownRegister.status === 403, `status ${unknownRegister.status}`);
  check('the refusal is the same wording as the email step', /not registered for access/i.test(unknownRegister.json?.error || ''), unknownRegister.json?.error);
  const unknownAccount = await store.findUserByEmail('nobody@ecu.edu.eg');
  check('no account row was created for the unlisted email', !unknownAccount);

  const ghostJar = makeJar();
  const ghostCsrf = (await call('/api/auth/me', { jar: ghostJar })).json?.csrfToken;
  const ghost = await call('/api/auth/login', {
    method: 'POST', body: { email: 'ghost@ecu.edu.eg', password: PASSWORDS.ghost }, jar: ghostJar, csrf: ghostCsrf,
  });
  check('an off-roster account cannot sign in even with the right password', ghost.status === 403, `status ${ghost.status}`);
  const ghostSession = await call('/api/auth/me', { jar: ghostJar });
  check('the blocked attempt created no session', ghostSession.json?.user === null);

  const listed = await checkEmail('listed.student@ecu.edu.eg');
  check('a rostered email is recognised at the email step', listed.body.recognized === true);
  check('a rostered email without an account may set a first password', listed.body.canRegister === true && listed.body.hasAccount === false);

  const signupJar = makeJar();
  const signupCsrf = (await call('/api/auth/me', { jar: signupJar })).json?.csrfToken;
  const listedVerification = await verifyRosterEmail('listed.student@ecu.edu.eg', signupJar, signupCsrf);
  check('student registration email can be verified first', listedVerification.verified.status === 200, listedVerification.verified.json?.error);
  const created = await call('/api/auth/register', {
    method: 'POST',
    body: {
      email: '  LISTED.Student@ECU.EDU.EG ', // whitespace and upper case must normalise
      password: PASSWORDS.listed,
      role: 'superAdmin', // smuggled fields are ignored: the roster decides the identity
      group: 'Group 2',
      name: 'Impersonated Name',
    },
    jar: signupJar,
    csrf: signupCsrf,
  });
  check('a rostered student can set a first password', created.status === 201, created.json?.error);
  check('email is normalised before the roster match', created.json?.user?.email === 'listed.student@ecu.edu.eg');
  check('the roster supplies the group, not the browser', created.json?.user?.group === 'Group 1');
  check('smuggled role/name fields are ignored', created.json?.user?.role === 'user' && created.json?.user?.name === 'Listed Student');

  const studentLogin = await login('LISTED.Student@Ecu.Edu.Eg', PASSWORDS.listed);
  check('a rostered student can authenticate with the password step', studentLogin.res.status === 200, studentLogin.res.json?.error);
  check('a student is not given admin permissions', studentLogin.res.json?.permissions?.isAdmin === false);
  check('a student is not given super admin permissions', studentLogin.res.json?.permissions?.isSuperAdmin === false);
  const studentAdminApi = await call('/api/admin/overview', { jar: studentLogin.jar });
  check('a student cannot read admin data', studentAdminApi.status === 403, `status ${studentAdminApi.status}`);
  const studentOtherGroup = await call('/api/user/records?group=Group 2', { jar: studentLogin.jar });
  check(
    'a student cannot read another group by asking for it',
    studentOtherGroup.status === 403 || studentOtherGroup.json?.group === 'Group 1',
    `status ${studentOtherGroup.status} group ${studentOtherGroup.json?.group}`
  );

  const taJar = makeJar();
  const taCsrf = (await call('/api/auth/me', { jar: taJar })).json?.csrfToken;
  const taVerification = await verifyRosterEmail('ta@ecu.edu.eg', taJar, taCsrf);
  check('teaching assistant address can be verified before registration', taVerification.verified.status === 200, taVerification.verified.json?.error);
  const taCreated = await call('/api/auth/register', {
    method: 'POST',
    body: { email: 'ta@ecu.edu.eg', password: PASSWORDS.ta, role: 'admin', group: 'Group 2' },
    jar: taJar,
    csrf: taCsrf,
  });
  check('a listed teaching assistant can set a first password', taCreated.status === 201, taCreated.json?.error);
  check('being listed as a TA does not grant an admin role', taCreated.json?.user?.role === 'user');
  check('a TA is flagged as teaching assistant for the UI', taCreated.json?.user?.isTeachingAssistant === true);
  check('a TA keeps the group scope printed in the roster', taCreated.json?.user?.group === 'Group 1');
  const taLogin = await login('ta@ecu.edu.eg', PASSWORDS.ta);
  check('a TA gets no admin permission', taLogin.res.json?.permissions?.isAdmin === false);
  check('a TA gets no super admin permission', taLogin.res.json?.permissions?.isSuperAdmin === false);
  const taAdminApi = await call('/api/admin/overview', { jar: taLogin.jar });
  check('a TA cannot open the admin area', taAdminApi.status === 403, `status ${taAdminApi.status}`);
}

let adminJarRef = null;

/**
 * [11] Focused checks for the features added on top of the original portal:
 * multi-group content, the role -> capability matrix, the protected owner account,
 * the activity filters and the problem-report flow.
 */
async function runFeatureTests() {
  console.log('\n[11] Multi-group content, the role matrix and problem reports');
  const sa = await login('super@ecu.edu.eg', PASSWORDS.super);
  check('super admin can sign in for the feature checks', sa.res.status === 200, sa.res.json?.error);

  /* --- multi-group content ------------------------------------------------- */
  const shared = await call('/api/admin/records', {
    ...sa, method: 'POST',
    body: { groups: ['Group 1', 'Group 2'], title: 'Shared multi-group notice', kind: 'Note', dueDate: '', summary: 'both groups', published: true },
  });
  check('content can be assigned to more than one group',
    shared.status === 201 && (shared.json?.record?.groups || []).length === 2, shared.json?.error);
  const one = await login('one@ecu.edu.eg', PASSWORDS.studentOne);
  const two = await login('two@ecu.edu.eg', PASSWORDS.studentTwo);
  const oneTitles = ((await call('/api/user/records', { jar: one.jar })).json?.records || []).map((r) => r.title);
  const twoTitles = ((await call('/api/user/records', { jar: two.jar })).json?.records || []).map((r) => r.title);
  check('group one sees the multi-group record', oneTitles.includes('Shared multi-group notice'), oneTitles.join(','));
  check('group two sees the multi-group record', twoTitles.includes('Shared multi-group notice'), twoTitles.join(','));
  const bogusKind = await call('/api/admin/records', {
    ...sa, method: 'POST', body: { groups: ['Group 1'], title: 'Bad kind content', kind: 'Free text kind' },
  });
  check('an unsupported content kind is refused', bogusKind.status === 400, `status ${bogusKind.status}`);

  /* --- group edit (notes + subject associations) ---------------------------- */
  const groupList = await call('/api/admin/groups', sa);
  const groupOne = (groupList.json?.groups || []).find((group) => group.name === 'Group 1');
  const createdSubject = await call('/api/admin/subjects', {
    ...sa, method: 'POST', body: { nameEn: 'Verify Subject', slug: 'verify-subject' },
  });
  const slug = createdSubject.json?.subject?.slug || 'verify-subject';
  const edited = await call(`/api/admin/groups/${groupOne.id}`, {
    ...sa, method: 'PATCH', body: { notes: 'internal note', subjects: [slug] },
  });
  check('group edit stores notes and subject associations',
    edited.status === 200 && edited.json?.group?.notes === 'internal note'
      && (edited.json?.group?.subjects || []).includes(slug),
    edited.json?.error);

  /* --- group scoping stays private ---------------------------------------- */
  const ownGroups = await call('/api/user/groups', { jar: one.jar });
  check('a student only ever sees their own group',
    (ownGroups.json?.groups || []).length === 1 && ownGroups.json.groups[0].name === 'Group 1',
    JSON.stringify(ownGroups.json?.groups));

  /* --- page visits are recorded once, never per rerender -------------------- */
  const visited = await call('/admin/dashboard/', sa);
  check('an admin page request succeeds', visited.status === 200, `status ${visited.status}`);
  await call('/admin/dashboard/', sa); // a reload / repeated request
  const visits = ((await call('/api/admin/activity?limit=100', sa)).json?.activity || [])
    .filter((entry) => entry.kind === 'pageview' && entry.page === '/admin/dashboard/');
  check('a page visit is recorded exactly once for repeated requests', visits.length === 1, `count ${visits.length}`);
  check('the page-visit entry names the page and carries no form content',
    Boolean(visits[0]?.actorRole) && !/password/i.test(JSON.stringify(visits[0])), JSON.stringify(visits[0] || {}));

  /* --- role matrix --------------------------------------------------------- */
  const makeStaff = (email, role) => call('/api/admin/users', {
    ...sa, method: 'POST',
    body: { name: `Verify ${role}`, email, password: PASSWORDS.admin, role },
  });
  const assistant = await makeStaff('assistant@ecu.edu.eg', 'adminAssistant');
  check('a super admin can create an admin assistant', assistant.status === 201, assistant.json?.error);
  const superAssistant = await makeStaff('super-assistant@ecu.edu.eg', 'superAdminAssistant');
  check('a super admin can create a super admin assistant', superAssistant.status === 201, superAssistant.json?.error);

  const assistantLogin = await login('assistant@ecu.edu.eg', PASSWORDS.admin);
  check('an admin assistant may open the dashboard',
    (await call('/api/admin/overview', { jar: assistantLogin.jar })).status === 200);
  check('an admin assistant cannot create groups',
    (await call('/api/admin/groups', { ...assistantLogin, method: 'POST', body: { name: 'Assistant Group X' } })).status === 403);
  check('an admin assistant cannot create accounts',
    (await call('/api/admin/users', { ...assistantLogin, method: 'POST', body: { name: 'Nobody', email: 'nobody2@ecu.edu.eg', password: PASSWORDS.admin, role: 'user' } })).status === 403);

  const superAssistantLogin = await login('super-assistant@ecu.edu.eg', PASSWORDS.admin);
  check('a super admin assistant is not given super admin permissions',
    superAssistantLogin.res.json?.permissions?.isSuperAdmin === false,
    JSON.stringify(superAssistantLogin.res.json?.permissions));
  check('a super admin assistant may manage groups',
    (await call('/api/admin/groups', { ...superAssistantLogin, method: 'POST', body: { name: 'Assistant Group' } })).status === 201);
  const targetForRole = ((await call('/api/admin/users', sa)).json.users || []).find((user) => user.email === 'assistant@ecu.edu.eg');
  check('a super admin assistant cannot assign roles',
    (await call(`/api/admin/users/${targetForRole.id}`, { ...superAssistantLogin, method: 'PATCH', body: { role: 'admin' } })).status === 403);
  check('a super admin assistant cannot delete staff accounts',
    (await call(`/api/admin/users/${targetForRole.id}`, { ...superAssistantLogin, method: 'DELETE' })).status === 403);
}

/**
 * [12] The protected owner account: the primary super admin cannot be disabled,
 * password-reset, re-roled or deleted through the admin API by anybody. The address is
 * used only inside this throwaway store, never against the real one.
 */
async function runOwnerProtectionTests() {
  console.log('\n[12] Protected owner account');
  const sa = await login('super@ecu.edu.eg', PASSWORDS.super);
  const ownerEmail = process.env.PROTECTED_OWNER_EMAIL || '192600250@ecu.edu.eg';
  const created = await call('/api/admin/users', {
    ...sa, method: 'POST',
    body: { name: 'Protected Owner', email: ownerEmail, password: PASSWORDS.admin, role: 'user', group: 'Group 1' },
  });
  check('the owner fixture account is created', created.status === 201, created.json?.error);
  const ownerId = created.json?.user?.id;
  check('the account view marks the owner account as protected', created.json?.user?.protected === true);
  check('the owner password cannot be reset through the admin API',
    (await call(`/api/admin/users/${ownerId}/password`, { ...sa, method: 'POST', body: { password: PASSWORDS.listed } })).status === 403);
  check('the owner cannot be disabled through the admin API',
    (await call(`/api/admin/users/${ownerId}`, { ...sa, method: 'PATCH', body: { active: false } })).status === 403);
  check('the owner cannot be re-roled through the admin API',
    (await call(`/api/admin/users/${ownerId}`, { ...sa, method: 'PATCH', body: { role: 'admin' } })).status === 403);
  check('the owner cannot be deleted through the admin API',
    (await call(`/api/admin/users/${ownerId}`, { ...sa, method: 'DELETE' })).status === 403);
  check('the owner account survived every attempt',
    ((await call('/api/admin/users', sa)).json.users || []).some((user) => user.id === ownerId));
}

/**
 * [13] Activity filters and problem reports: the log can be narrowed to staff or students,
 * and a student report reaches the admin list with reporter, time, page and category.
 */
async function runReportingTests() {
  console.log('\n[13] Activity filters and problem reports');
  const sa = await login('super@ecu.edu.eg', PASSWORDS.super);
  const one = await login('one@ecu.edu.eg', PASSWORDS.studentOne);

  const adminOnly = await call('/api/admin/activity?who=admin&limit=100', sa);
  check('the activity log can be filtered to staff',
    adminOnly.status === 200 && (adminOnly.json?.activity || []).length > 0,
    adminOnly.json?.error);
  const studentOnly = await call('/api/admin/activity?who=user&limit=100', sa);
  check('the activity log can be filtered to students',
    studentOnly.status === 200 && (studentOnly.json?.activity || []).every((entry) => entry.actor !== 'Verify Super'));
  check('the activity payload carries no password material',
    !/passwordHash|"password"/i.test(JSON.stringify(adminOnly.json || {})));

  const report = await call('/api/user/problems', {
    ...one, method: 'POST',
    body: { category: 'bug', page: '/user/groups/', description: 'The group page did not open for me yesterday.' },
  });
  check('a signed-in student can file a problem report', report.status === 201, report.json?.error);
  check('a report notification is sent to the configured support inbox', report.json?.emailSent === true && sentEmails[sentEmails.length - 1]?.to?.[0] === 'report-inbox@example.test');
  check('the report email includes reporter, time, page, category and description',
    /one@ecu\.edu\.eg/.test(sentEmails[sentEmails.length - 1]?.text || '')
      && /Reported at:/.test(sentEmails[sentEmails.length - 1]?.text || '')
      && /Page: \/user\/groups\//.test(sentEmails[sentEmails.length - 1]?.text || '')
      && /Category: bug/.test(sentEmails[sentEmails.length - 1]?.text || '')
      && /group page did not open/.test(sentEmails[sentEmails.length - 1]?.text || ''));
  const list = await call('/api/admin/problems', sa);
  const found = (list.json?.problems || []).find((item) => item.id === report.json?.problem?.id);
  check('the report is visible to admins with reporter, time, page and category',
    Boolean(found) && Boolean(found.reporterName) && Boolean(found.createdAt)
      && found.page === '/user/groups/' && found.category === 'bug' && found.status === 'open',
    JSON.stringify(found || {}));
  check('a student cannot read the admin report list',
    (await call('/api/admin/problems', { jar: one.jar })).status === 403);
  const resolved = await call(`/api/admin/problems/${found.id}`, { ...sa, method: 'PATCH', body: { status: 'resolved' } });
  check('an admin can resolve the report',
    resolved.status === 200 && resolved.json?.problem?.status === 'resolved', resolved.json?.error);

  failNextEmail = true;
  const mailFailure = await call('/api/user/problems', {
    ...one, method: 'POST',
    body: { category: 'other', page: '/user/profile/', description: 'Testing the persisted report when email delivery is unavailable.' },
  });
  check('email provider failure does not discard a saved problem report', mailFailure.status === 201 && mailFailure.json?.emailSent === false);
  const savedAfterMailFailure = (await call('/api/admin/problems', sa)).json?.problems?.find((item) => item.id === mailFailure.json?.problem?.id);
  check('report remains visible to administrators after email delivery failure', Boolean(savedAfterMailFailure));
}

async function main() {
  await seedFixtures();
  const app = createApp();
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const seededAdmin = await login('staff@ecu.edu.eg', PASSWORDS.admin);
  adminJarRef = seededAdmin.jar;

  try {
    await runTests();
    await runPrivilegeTests();
    await runRosterTests();
    await runSuperAdminAndPageTests();
    await runFeatureTests();
    await runOwnerProtectionTests();
    await runReportingTests();
  } finally {
    server.close();
    await close();
    fs.rmSync(config.dataDir, { recursive: true, force: true });
  }

  console.log(`\n${passed} checks passed, ${failures.length} failed.`);
  if (failures.length) {
    console.log('Failed checks:');
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('All permission and security checks passed.');
  }
}

main().catch((error) => {
  console.error('Verify run crashed:', error);
  process.exitCode = 1;
});
