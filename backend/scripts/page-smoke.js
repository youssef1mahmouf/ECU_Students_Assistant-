'use strict';
/**
 * Page-level smoke test (`npm run verify:pages`).
 * Boots the real app on a throwaway file store, then checks that every frontend document
 * and module the portals depend on is actually served, and that the server-side page
 * guards refuse the wrong role *before* any markup is handed out.
 */
const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

process.env.DATA_STORE = 'file';
process.env.DATA_STORE = 'file';
process.env.DATA_DIR = path.join(os.tmpdir(), `ga6-pages-${crypto.randomBytes(6).toString('hex')}`);
process.env.NODE_ENV = 'development';
process.env.SESSION_SECRET = crypto.randomBytes(48).toString('base64url');

const config = require('../src/config/env');
const { createApp } = require('../src/app');
const { store, init, close } = require('../src/db/store');
const { hashPassword } = require('../src/lib/password');

const PASSWORD = 'Portal#Pass1';
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
  };
}

let baseUrl = '';
async function open(urlPath, { jar, method = 'GET', body, csrf } = {}) {
  const headers = {};
  if (jar && jar.header()) headers.cookie = jar.header();
  if (csrf) headers['x-csrf-token'] = csrf;
  let payload;
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(baseUrl + urlPath, { method, headers, body: payload });
  const text = await res.text();
  if (jar) jar.absorb(res);
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* html or css response */
  }
  return { status: res.status, text, json };
}

async function signIn(email, jar) {
  await open('/api/auth/me', { jar });
  return open('/api/auth/login', {
    jar,
    method: 'POST',
    csrf: jar.get('ga6_csrf_v2'),
    body: { email, password: PASSWORD },
  });
}

const ADMIN_PAGES = [
  ['/admin/dashboard/', 'statGrid'],
  ['/admin/accounts/', 'accountRows'],
  ['/admin/groups/', 'groupRows'],
  ['/admin/subjects/', 'subjectRows'],
  ['/admin/documents/', 'documentRows'],
  ['/admin/activity/', 'activityList'],
  ['/admin/information/', 'infoForm'],
  ['/admin/problems/', 'problemRows'],
  ['/admin/profile/', 'profileForm'],
];

const SHARED_ASSETS = [
  '/admin/scripts/dashboard.js',
  '/admin/scripts/accounts.js',
  '/admin/scripts/groups.js',
  '/admin/scripts/subjects.js',
  '/admin/scripts/documents.js',
  '/admin/scripts/activity.js',
  '/admin/scripts/information.js',
  '/admin/scripts/problems.js',
  '/admin/scripts/profile.js',
  '/admin/styles.css',
  '/user/scripts/signin.js',
  '/user/scripts/register.js',
  '/user/scripts/documents.js',
  '/user/scripts/report.js',
  '/user/styles.css',
  '/shared/api.js',
  '/shared/admin-layout.js',
  '/shared/layout.js',
  '/shared/ui.js',
  '/shared/i18n.js',
  '/shared/session.js',
  '/shared/base.css',
];


async function seed() {
  await init();
  if (!(await store.findGroupByName('Group 1'))) {
    await store.createGroup({ name: 'Group 1', description: '', createdBy: 'pages' });
  }
  // Sign-in checks the authorised roster, so the student fixture needs a roster row.
  await store.importRoster([
    { email: 'one@ecu.edu.eg', name: 'Page Student', studentId: '', group: 'Group 1', type: 'student', academicYear: 'pages', advisorName: '', advisorEmail: '', source: 'pages-fixture' },
  ]);
  for (const account of [
    { name: 'Page Admin', email: 'staff@ecu.edu.eg', role: 'superAdmin', group: '' },
    { name: 'Page Student', email: 'one@ecu.edu.eg', role: 'user', group: 'Group 1' },
  ]) {
    if (!(await store.findUserByEmail(account.email))) {
      await store.createUser({
        ...account,
        passwordHash: await hashPassword(PASSWORD),
        confirmed: true,
        active: true,
      });
    }
  }
  await store.createRecord({
    group: 'Group 1', title: 'Page published', kind: 'Assignment', dueDate: '', summary: 'shown',
    body: 'body', published: true, createdBy: 'pages',
  });
  await store.createRecord({
    group: 'Group 1', title: 'Page draft', kind: 'Note', dueDate: '', summary: 'staff only',
    body: 'draft', published: false, createdBy: 'pages',
  });
}

async function run() {
  const adminJar = makeJar();
  const adminLogin = await signIn('staff@ecu.edu.eg', adminJar);
  check('admin sign-in works', adminLogin.status === 200, `status ${adminLogin.status}`);

  console.log('\n[1] Admin documents are served to staff');
  for (const [urlPath, marker] of ADMIN_PAGES) {
    const page = await open(urlPath, { jar: adminJar });
    check(`${urlPath} served to admin`, page.status === 200 && page.text.includes(`id="${marker}"`),
      `status ${page.status}`);
  }

  console.log('\n[2] Modules and styles are served');
  for (const assetPath of SHARED_ASSETS) {
    const asset = await open(assetPath);
    check(`${assetPath} served`, asset.status === 200 && asset.text.length > 0, `status ${asset.status}`);
  }

  console.log('\n[3] Student portal pages and data scoping');
  const studentJar = makeJar();
  check('student sign-in works', (await signIn('one@ecu.edu.eg', studentJar)).status === 200);
  const studentGroups = await open('/user/groups/', { jar: studentJar });
  check('/user/groups/ served to student', studentGroups.status === 200 && /<html/i.test(studentGroups.text),
    `status ${studentGroups.status}`);
  const studentProfile = await open('/user/profile/', { jar: studentJar });
  check('/user/profile/ served to student', studentProfile.status === 200 && /<html/i.test(studentProfile.text),
    `status ${studentProfile.status}`);
  const records = await open('/api/user/records', { jar: studentJar });
  const titles = (records.json?.records || []).map((record) => record.title);
  check('student sees published content', titles.includes('Page published'), titles.join(','));
  check('student cannot see drafts', !titles.includes('Page draft'), titles.join(','));

  console.log('\n[3b] Student report page and admin link on the public home');
  const reportPage = await open('/user/report/', { jar: studentJar });
  check('/user/report/ served to a signed-in student', reportPage.status === 200 && reportPage.text.includes('id="problemForm"'),
    `status ${reportPage.status}`);
  const reportAnonymous = await fetch(baseUrl + '/user/report/', { redirect: 'manual' });
  check('anonymous is redirected from the report page', reportAnonymous.status === 303, `status ${reportAnonymous.status}`);
  const publicHome = await open('/');
  /* There is no separate admin entry any more: everyone signs in at /user/signin/. The page
     must not advertise an /admin/ link, and the server must send /admin/ to that form. */
  check('public home does not link to a separate admin area', !/href="\/admin\/"/.test(publicHome.text));
  check('public home carries the visitor-preview banner slot', /id="previewBanner"/.test(publicHome.text));

  // One sign-in page for every role: the old admin entry forwards to it.
  for (const entry of ['/admin/', '/admin', '/administrator']) {
    const res = await fetch(baseUrl + entry, { redirect: 'manual' });
    check(`${entry} redirects to the shared sign-in page`,
      res.status === 302 && res.headers.get('location') === '/user/signin/',
      `status ${res.status} -> ${res.headers.get('location')}`);
  }

  console.log('\n[4] Page guards refuse the wrong role');
  for (const [urlPath] of ADMIN_PAGES) {
    const denied = await fetch(baseUrl + urlPath, { redirect: 'manual', headers: { cookie: studentJar.header() } });
    check(`${urlPath} blocked for student`, denied.status === 403, `status ${denied.status}`);
  }
  const anonymous = await fetch(baseUrl + '/admin/dashboard/', { redirect: 'manual' });
  check('anonymous is redirected from admin pages', anonymous.status === 303, `status ${anonymous.status}`);
  const anonymousUserArea = await fetch(baseUrl + '/user/profile/', { redirect: 'manual' });
  check('anonymous is redirected from user pages', anonymousUserArea.status === 303,
    `status ${anonymousUserArea.status}`);

  console.log('\n[5] Email-first sign-in page and its two languages');
  const signin = await open('/user/signin/');
  check('/user/signin/ is public', signin.status === 200 && /<html/i.test(signin.text), `status ${signin.status}`);
  check('sign-in asks for the email first', /id="emailStep"/.test(signin.text) && /id="loginEmail"/.test(signin.text));
  check('the password step exists but starts hidden', /id="passwordStep"[^>]*hidden/.test(signin.text));
  const emailStepMarkup = signin.text.slice(signin.text.indexOf('id="emailStep"'), signin.text.indexOf('id="passwordStep"'));
  check('no password field is offered before the email check', !/loginPassword/.test(emailStepMarkup));
  check('a first-password route is offered', /id="setupStep"/.test(signin.text) && /\/user\/register\//.test(signin.text));
  check('the page is Arabic by default with RTL', /<html lang="ar" dir="rtl">/.test(signin.text));
  const register = await open('/user/register/');
  check('/user/register/ is public', register.status === 200 && /id="registerForm"/.test(register.text));
  check('first-password form asks for email and password only', /id="newEmail"/.test(register.text) && /id="newPassword"/.test(register.text) && !/name="group"/.test(register.text));
  check('registration has send-code, six-digit entry and verify controls', /id="sendCode"/.test(register.text) && /id="emailCode"[^>]*pattern="\[0-9\]\{6\}"/.test(register.text) && /id="verifyCode"/.test(register.text));
  const dictionary = await open('/shared/i18n.js');
  const signInAsEntry = (dictionary.text.match(/'user\.signInAs':\s*\[[^\]]*\]/) || [''])[0];
  check('the email-first label is bilingual', /[\u0600-\u06FF]/.test(signInAsEntry) && /Continuing as \{email\}/.test(signInAsEntry), signInAsEntry);
  const notRegisteredEntry = (dictionary.text.match(/'server\.notRegistered':\s*\[[^\]]*\]/) || [''])[0];
  check('the not-registered answer is bilingual', /[\u0600-\u06FF]/.test(notRegisteredEntry) && /This email is not registered for access to this portal\./.test(notRegisteredEntry), notRegisteredEntry);
  check('the email step wording is bilingual', /'user\.signinNote':\s*\[[^\]]*\]/.test(dictionary.text) && /'action\.continue':\s*\[[^\]]*\]/.test(dictionary.text));
  check('email verification controls have Arabic and English labels', /'action\.sendCode':\s*\[['\"][\u0600-\u06FF]/.test(dictionary.text) && /'action\.verifyCode':\s*\[['\"][\u0600-\u06FF]/.test(dictionary.text));
  check('sign-in modules are served', /<script type="module" src="\/user\/scripts\/signin\.js">/.test(signin.text));
}

async function main() {
  await seed();
  const app = createApp();
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    await run();
  } finally {
    server.close();
    await close();
    fs.rmSync(config.dataDir, { recursive: true, force: true });
  }

  console.log(`\n${passed} page checks passed, ${failures.length} failed.`);
  if (failures.length) {
    console.log('Failed checks:');
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('Every portal page is served and guarded correctly.');
  }
}

main().catch((error) => {
  console.error('Page check run crashed:', error);
  process.exitCode = 1;
});
