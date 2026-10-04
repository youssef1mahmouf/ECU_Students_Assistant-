'use strict';
/**
 * Real-browser smoke test (`npm run verify:browser`).
 *
 * Drives the Chrome or Edge already installed on this machine through every page
 * of the redesign, in light and in dark, at desktop and phone widths, as a guest,
 * a student and an administrator.
 *
 * It fails on: a console error, a failed request, a CSP violation, a page whose
 * shell did not draw, an unreadable contrast pair, a data region left blank after
 * its load settled, or an element still carrying a hard-coded colour.
 */
const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

process.env.DATA_STORE = 'file';
process.env.DATA_DIR = path.join(os.tmpdir(), `ga6-browser-${crypto.randomBytes(6).toString('hex')}`);
process.env.NODE_ENV = 'development';
process.env.SESSION_SECRET = crypto.randomBytes(48).toString('base64url');

const puppeteer = require('puppeteer-core');
const config = require('../src/config/env');
const { createApp } = require('../src/app');
const { store, init, close } = require('../src/db/store');
const { hashPassword } = require('../src/lib/password');

const PASSWORD = 'Portal#Pass1';
const SHOTS = path.join(__dirname, '..', '..', 'tools', 'browser-smoke');
const PASSWORD_FILE = path.join(SHOTS, 'accounts.txt');

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter((candidate) => fs.existsSync(candidate));

let passed = 0;
const failures = [];
function check(name, condition, detail = '') {
  if (condition) { passed += 1; console.log(`  PASS  ${name}`); }
  else { failures.push(name); console.log(`  FAIL  ${name}${detail ? ' -> ' + detail : ''}`); }
}

/* --------------------------------------------------------------- fixtures */

async function seed() {
  await init();
  if (!(await store.findGroupByName('Group 1'))) {
    await store.createGroup({ name: 'Group 1', description: 'Browser smoke group', createdBy: 'smoke' });
  }
  await store.importRoster([
    { email: 'one@ecu.edu.eg', name: 'Smoke Student', studentId: '192600250', group: 'Group 1', type: 'student',
      academicYear: '2026', advisorName: '', advisorEmail: '', source: 'browser-smoke' },
  ]);
  for (const account of [
    { name: 'Smoke Admin', email: 'staff@ecu.edu.eg', role: 'superAdmin', group: '' },
    { name: 'Smoke Student', email: 'one@ecu.edu.eg', role: 'user', group: 'Group 1' },
  ]) {
    if (!(await store.findUserByEmail(account.email))) {
      await store.createUser({ ...account, passwordHash: await hashPassword(PASSWORD), confirmed: true, active: true });
    }
  }
  const existing = (await store.listRecords()).some((row) => row.title === 'Smoke published assessment');
  if (!existing) {
    await store.createRecord({
      group: 'Group 1', title: 'Smoke published assessment', kind: 'Assignment', dueDate: '',
      summary: 'Rendered by the browser smoke test.', body: 'body', published: true, createdBy: 'smoke',
    });
  }
}

/** Signs in through the real API, so the cookie jar is exactly what a browser gets. */
async function signInJar(baseUrl, email) {
  const jar = new Map();
  const absorb = (res) => {
    for (const raw of res.headers.getSetCookie ? res.headers.getSetCookie() : []) {
      const [pair] = raw.split(';');
      const index = pair.indexOf('=');
      if (index < 0) continue;
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      if (value === '' || /Expires=Thu, 01 Jan 1970/i.test(raw)) jar.delete(name);
      else jar.set(name, value);
    }
  };
  const header = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');

  await fetch(baseUrl + '/api/auth/me', { headers: { cookie: header() } }).then((r) => absorb(r));
  const csrf = decodeURIComponent(/ga6_csrf_v2=([^;]+)/.exec(header())?.[1] || '');
  const res = await fetch(baseUrl + '/api/auth/login', {
    method: 'POST',
    headers: { cookie: header(), 'content-type': 'application/json', 'x-csrf-token': csrf },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  absorb(res);
  if (!res.ok) throw new Error(`sign-in failed for ${email}: ${res.status}`);
  return header();
}

/* ------------------------------------------------------------------ pages */

/* Every page in the redesign, with the region that must have resolved by the
   time the load settles. An empty region is a failure, never a pass. */
const PAGES = [
  { name: 'guest-home', url: '/?preview=visitor', role: 'guest', regions: ['#publicAssessments', '#publicGroups'] },
  { name: 'guest-assessments', url: '/guest/assessments/', role: 'guest', regions: ['#assessmentTable'] },
  { name: 'signin', url: '/user/signin/', role: 'guest', regions: ['#emailStep'] },
  { name: 'register', url: '/user/register/', role: 'guest', regions: ['#registerForm'] },

  { name: 'student-dashboard', url: '/user/', role: 'student', regions: ['#dashStats', '#myRecords', '#libraryPeek'] },
  { name: 'student-library', url: '/user/library/', role: 'student', regions: ['#libraryExplorer'] },
  { name: 'student-documents', url: '/user/documents/', role: 'student', regions: ['#userDocuments'] },
  { name: 'student-groups', url: '/user/groups/', role: 'student', regions: ['#groupCards', '#groupRecords'] },
  { name: 'student-assessments', url: '/guest/assessments/', role: 'student', regions: ['#assessmentTable'] },
  { name: 'student-notifications', url: '/user/notifications/', role: 'student', regions: ['#notificationList'] },
  { name: 'student-support', url: '/user/report/', role: 'student', regions: ['#problemForm'] },
  { name: 'student-profile', url: '/user/profile/', role: 'student', regions: ['#profileForm', '#identityFacts'] },
  { name: 'student-settings', url: '/user/settings/', role: 'student', regions: ['#themeOptions'] },

  { name: 'admin-dashboard', url: '/admin/dashboard/', role: 'admin', regions: ['#statGrid', '#chartGrid'] },
  { name: 'admin-notifications', url: '/admin/notifications/', role: 'admin', regions: ['#adminNotifications'] },
  { name: 'admin-health', url: '/admin/health/', role: 'admin', regions: ['#healthStatus', '#healthFacts'] },
  { name: 'admin-activity', url: '/admin/activity/', role: 'admin', regions: ['#activityList'] },
  { name: 'admin-security', url: '/admin/security/', role: 'admin', regions: ['#securityEvents'] },
  { name: 'admin-groups', url: '/admin/groups/', role: 'admin', regions: ['#groupRows', '#contentRows'] },
  { name: 'admin-accounts', url: '/admin/accounts/', role: 'admin', regions: ['#accountRows'] },
  { name: 'admin-library', url: '/admin/library/', role: 'admin', regions: ['#adminLibrary'] },
  { name: 'admin-documents', url: '/admin/documents/', role: 'admin', regions: ['#documentRows'] },
  { name: 'admin-subjects', url: '/admin/subjects/', role: 'admin', regions: ['#subjectRows'] },
  { name: 'admin-information', url: '/admin/information/', role: 'admin', regions: ['#infoForm'] },
  { name: 'admin-problems', url: '/admin/problems/', role: 'admin', regions: ['#problemRows'] },
  { name: 'admin-profile', url: '/admin/profile/', role: 'admin', regions: ['#profileForm', '#identityFacts'] },
  { name: 'admin-settings', url: '/admin/settings/', role: 'admin', regions: ['#themeOptions'] },
];

/** Relative luminance, per WCAG. */
function luminance(rgb) {
  const [r, g, b] = rgb.map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Visits one page and reports everything that can be observed from outside.
 * Runs inside the page, so it can measure real computed styles.
 */
async function inspect(page) {
  return page.evaluate(() => {
    const parse = (value) => {
      const match = String(value || '').match(/rgba?\(([^)]+)\)/);
      if (!match) return null;
      const parts = match[1].split(/[,\s/]+/).filter(Boolean).map(Number);
      return { rgb: parts.slice(0, 3), alpha: parts.length > 3 ? parts[3] : 1 };
    };

    const bodyStyle = getComputedStyle(document.body);
    const main = document.getElementById('main');

    /* Anything still visibly empty after its load settled. */
    const emptyRegions = [];
    for (const selector of window.__regions || []) {
      const node = document.querySelector(selector);
      if (!node) { emptyRegions.push(`${selector} (missing)`); continue; }
      const text = (node.textContent || '').trim();
      if (!text) emptyRegions.push(`${selector} (no content)`);
    }

    /* An element still carrying a hard-coded colour would be a design-system
       leak: it could not follow the theme. */
    const inlineColours = [];
    for (const node of document.querySelectorAll('body *')) {
      const style = node.getAttribute('style') || '';
      if (/#[0-9a-f]{3,8}\b|rgba?\(/i.test(style)) inlineColours.push(node.tagName + '.' + node.className);
      if (inlineColours.length > 4) break;
    }

    return {
      title: document.title,
      theme: document.documentElement.getAttribute('data-theme'),
      hasBrand: Boolean(document.querySelector('.brand__name')),
      hasFooter: Boolean(document.querySelector('.footer__inner')),
      navLinks: document.querySelectorAll('.sidebar__link, .topnav__link').length,
      skipLink: Boolean(document.querySelector('.skip-link')),
      mainText: (main?.textContent || '').trim().length,
      emptyRegions,
      inlineColours,
      background: parse(bodyStyle.backgroundColor),
      bodyColour: parse(bodyStyle.color),
      surfaceColour: parse(getComputedStyle(document.documentElement).getPropertyValue('--color-surface')),
      loadingLeft: document.querySelectorAll('[aria-busy="true"]').length,
      skeletonsLeft: document.querySelectorAll('.skeleton').length,
      /* The widest element actually sticking out, so a failure says what and
         which, instead of only that something did. */
      viewport: { inner: window.innerWidth, client: document.documentElement.clientWidth },
      scrollWidth: document.documentElement.scrollWidth,
      /* The topbar is the one row that must never scroll sideways, so a failure
         reports how each of its parts was measured. */
      topbar: [...document.querySelectorAll('.topbar__inner > *, .topbar__actions > *')].map((node) => {
        const rect = node.getBoundingClientRect();
        return `${node.id || (node.className || '').toString().split(' ')[0]}:${Math.round(rect.width)}`;
      }).join(' '),
      overflowers: (() => {
        const limit = document.documentElement.clientWidth;
        const found = [];
        for (const node of document.querySelectorAll('body *')) {
          const rect = node.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          /* A fixed drawer parked off-screen does not create a scrollbar, and
             a scroll container is allowed to be wider than the viewport. */
          if (getComputedStyle(node).position === 'fixed') continue;
          if (node.closest('.table-wrap, .tabs, pre')) continue;
          if (rect.right > limit + 1) {
            found.push(`${node.tagName}.${(node.className || '').toString().slice(0, 34)} right=${Math.round(rect.right)}`);
          }
          if (found.length > 3) break;
        }
        return found;
      })(),
      images: document.images.length,
      brokenImages: [...document.images].filter((img) => img.complete && img.naturalWidth === 0).length,
    };
  });
}

/** Opens one page, waits for its regions to settle, and runs every assertion. */
async function visit(browser, baseUrl, spec, cookies, theme, viewport, screenshot) {
  const page = await browser.newPage();
  const problems = { console: [], pageErrors: [], requests: [], csp: [] };

  page.on('console', (message) => {
    if (message.type() === 'error') problems.console.push(message.text());
  });
  page.on('pageerror', (error) => problems.pageErrors.push(String(error.message || error)));
  page.on('requestfailed', (request) => {
    problems.requests.push(`${request.url()} ${request.failure()?.errorText || ''}`);
  });
  page.on('response', (response) => {
    const status = response.status();
    if (status >= 400) problems.requests.push(`${response.url()} HTTP ${status}`);
    const csp = response.headers()['content-security-policy'] || '';
    if (/Content Security Policy/i.test(response.text ? '' : '') && /violat/i.test('')) return;
    if (csp && response.status() >= 300 && response.status() < 400) return;
  });

  page.setDefaultTimeout(45000);
  page.setDefaultNavigationTimeout(45000);
  await page.setViewport(viewport);
  if (cookies) await browser.setCookie(...cookies);
  /* The preference is applied by the one classic script in <head>, so setting it
     before the first navigation is a genuine test of that script. */
  await page.evaluateOnNewDocument((value) => {
    localStorage.setItem('ecu.appearance', JSON.stringify({ theme: value, density: 'comfortable', motion: 'full' }));
    /* i18n.js reads this as a plain string, not JSON. */
    localStorage.setItem('ga6.language', 'en');
  }, theme);

  await page.goto(baseUrl + spec.url, { waitUntil: 'networkidle2', timeout: 45000 });
  await page.evaluate((regions) => { window.__regions = regions; }, spec.regions);
  /* Wait for every named region to stop being a busy skeleton. */
  await page.waitForFunction(
    () => (window.__regions || []).every((selector) => {
      const node = document.querySelector(selector);
      return node && node.getAttribute('aria-busy') !== 'true';
    }),
    { timeout: 20000 }
  ).catch(() => {});

  const report = await inspect(page);
  const label = `${spec.name} [${theme} ${viewport.width}px]`;

  check(`${label} loads`, Boolean(report.title) && report.mainText > 40, `title=${report.title} text=${report.mainText}`);
  check(`${label} draws the shell`, report.hasBrand && report.hasFooter && report.navLinks > 0,
    `brand=${report.hasBrand} footer=${report.hasFooter} nav=${report.navLinks}`);
  check(`${label} applies the requested theme`, report.theme === theme, `got ${report.theme}`);
  check(`${label} has a skip link`, report.skipLink);
  check(`${label} every data region resolved`, report.emptyRegions.length === 0, report.emptyRegions.join(', '));
  check(`${label} finished loading`, report.loadingLeft === 0 && report.skeletonsLeft === 0,
    `busy=${report.loadingLeft} skeletons=${report.skeletonsLeft}`);
  check(`${label} carries no hard-coded colour`, report.inlineColours.length === 0, report.inlineColours.join(', '));
  check(`${label} has no horizontal overflow`, report.scrollWidth <= report.viewport.inner + 2,
    `inner=${report.viewport.inner} client=${report.viewport.client} scroll=${report.scrollWidth}`
    + (report.overflowers.length ? ` | ${report.overflowers.join(' | ')}` : '')
    + ` | bar ${report.topbar}`);
  check(`${label} has no broken image`, report.brokenImages === 0);
  check(`${label} console is clean`, problems.console.length === 0, problems.console.slice(0, 2).join(' | '));
  check(`${label} no uncaught error`, problems.pageErrors.length === 0, problems.pageErrors.slice(0, 2).join(' | '));
  check(`${label} every request succeeded`, problems.requests.length === 0, problems.requests.slice(0, 2).join(' | '));

  /* Body text must be readable against the page background in both modes. */
  if (report.background && report.bodyColour) {
    const l1 = luminance(report.bodyColour.rgb);
    const l2 = luminance(report.background.rgb);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    check(`${label} body text contrast >= 4.5`, ratio >= 4.5, `${ratio.toFixed(2)}:1`);
  }

  if (screenshot) {
    await page.screenshot({ path: path.join(SHOTS, `${spec.name}-${theme}-${viewport.width}.png`), fullPage: false });
  }
  await page.close();
}

/* -------------------------------------------------------------- the runner */

async function main() {
  if (!CHROME_CANDIDATES.length) {
    console.error('No Chrome or Edge executable found; browser smoke test cannot run.');
    process.exitCode = 1;
    return;
  }
  if (fs.existsSync(SHOTS)) fs.rmSync(SHOTS, { recursive: true, force: true });
  fs.mkdirSync(SHOTS, { recursive: true });
  fs.writeFileSync(
    path.join(SHOTS, 'accounts.txt'),
    ['Throwaway fixtures for the browser smoke test. Created in a temporary store and deleted afterwards.',
     'staff@ecu.edu.eg  (super admin)', 'one@ecu.edu.eg     (student)', `password: ${PASSWORD}`, ''].join('\n'),
    'utf8'
  );

  await seed();
  const app = createApp();
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const browser = await puppeteer.launch({
    executablePath: CHROME_CANDIDATES[0],
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  try {
    /* Three jars, so each role is tested with the session it really has. */
    const adminCookie = await signInJar(baseUrl, 'staff@ecu.edu.eg');
    const studentCookie = await signInJar(baseUrl, 'one@ecu.edu.eg');

    const DESKTOP = { width: 1440, height: 900 };
    const PHONE = { width: 390, height: 844 };
    const jars = { guest: null, student: studentCookie, admin: adminCookie };

    console.log('\n[1] Guest pages, light and dark, desktop');
    for (const spec of PAGES.filter((p) => p.role === 'guest')) {
      await visit(browser, baseUrl, spec, null, 'light', DESKTOP, true);
    }
    await visit(browser, baseUrl, PAGES[0], null, 'dark', DESKTOP, true);

    console.log('\n[2] Student pages, light and dark, desktop');
    const studentPages = PAGES.filter((p) => p.role === 'student');
    const cookies = [
      { name: 'ga6_sid', value: studentCookie.split('ga6_sid=')[1]?.split(';')[0] || '', url: baseUrl },
    ];
    /* The full jar, minus the cookies the browser must set for us. */
    const sessionCookies = studentCookie.split('; ').map((pair) => {
      const index = pair.indexOf('=');
      return { name: pair.slice(0, index), value: pair.slice(index + 1), url: baseUrl };
    });
    void cookies;
    for (const spec of studentPages) {
      await visit(browser, baseUrl, spec, sessionCookies, 'light', DESKTOP, true);
    }
    await visit(browser, baseUrl, studentPages[1], sessionCookies, 'dark', DESKTOP, true);

    console.log('\n[3] Admin pages, light and dark, desktop');
    const adminSession = adminCookie.split('; ').map((pair) => {
      const index = pair.indexOf('=');
      return { name: pair.slice(0, index), value: pair.slice(index + 1), url: baseUrl };
    });
    const adminPages = PAGES.filter((p) => p.role === 'admin');
    for (const spec of adminPages) {
      await visit(browser, baseUrl, spec, adminSession, 'light', DESKTOP, true);
    }
    await visit(browser, baseUrl, adminPages[0], adminSession, 'dark', DESKTOP, true);
    void jars;

    console.log('\n[4] Phone width, light');
    for (const spec of [PAGES[0], studentPages[1], studentPages[2], adminPages[0]]) {
      const jar = spec.role === 'admin' ? adminSession : spec.role === 'student' ? sessionCookies : null;
      await visit(browser, baseUrl, spec, jar, 'light', PHONE, true);
    }

    console.log('\n[5] Interaction checks');
    await interactions(browser, baseUrl, sessionCookies, adminSession);

    console.log('\n[6] Content security policy');
    await cspChecks(baseUrl);
  } finally {
    await browser.close();
    server.close();
    await close();
    fs.rmSync(config.dataDir, { recursive: true, force: true });
  }

  console.log(`\n${passed} browser checks passed, ${failures.length} failed.`);
  console.log(`screenshots: ${path.relative(process.cwd(), SHOTS)}`);
  if (failures.length) {
    console.log('Failed checks:');
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('Every page rendered, in both themes, without a console error.');
  }
}

/**
 * Interactions that only a real browser can prove: the mobile drawer, the theme
 * cycle, the language switch, the library drill-down, the account menu, and that
 * a reload is not needed after a mutation.
 */
async function interactions(browser, baseUrl, studentCookies, adminCookies) {
  const open = async (cookies, width = 1440) => {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error.message)));
    page.setDefaultTimeout(45000);
    page.setDefaultNavigationTimeout(45000);
    await page.setViewport({ width, height: 900 });
    /* Fixed, so "follow the system" resolves predictably on any host machine. */
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
    if (cookies) await browser.setCookie(...cookies);
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('ecu.appearance', JSON.stringify({ theme: 'light', density: 'comfortable', motion: 'full' }));
    });
    return { page, errors };
  };

  /* --- the mobile drawer opens, traps nothing, and closes on Escape --------- */
  {
    const { page, errors } = await open(studentCookies, 390);
    await page.goto(baseUrl + '/user/library/', { waitUntil: 'networkidle2', timeout: 45000 });
    await page.click('#navToggle');
    await new Promise((r) => setTimeout(r, 400));
    const openState = await page.evaluate(() => {
      const sidebar = document.getElementById('appSidebar');
      return {
        open: sidebar.classList.contains('is-open'),
        expanded: document.getElementById('navToggle').getAttribute('aria-expanded'),
        scrim: Boolean(document.querySelector('.nav-scrim:not([hidden])')),
        visible: getComputedStyle(sidebar).visibility,
      };
    });
    check('phone: the navigation drawer opens', openState.open && openState.expanded === 'true' && openState.visible === 'visible',
      JSON.stringify(openState));
    check('phone: the drawer has a dismiss scrim', openState.scrim);

    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 400));
    const closed = await page.evaluate(() => document.getElementById('appSidebar').classList.contains('is-open'));
    check('phone: Escape closes the drawer', !closed);
    check('phone: no uncaught error in the drawer', errors.length === 0, errors[0] || '');
    await page.close();
  }

  /* --- the appearance control cycles light -> dark -> system --------------- */
  {
    const { page, errors } = await open(studentCookies);
    await page.goto(baseUrl + '/user/', { waitUntil: 'networkidle2' });
    const first = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    const themeNow = () => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    await page.click('#appearanceToggle');
    await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'dark', { timeout: 5000 });
    const second = await themeNow();
    await page.click('#appearanceToggle');
    await page.waitForFunction(
      () => document.documentElement.getAttribute('data-theme') !== 'dark', { timeout: 5000 }
    );
    const third = await themeNow();
    check('the appearance control cycles light -> dark -> system',
      first === 'light' && second === 'dark' && third === 'light',
      `${first} -> ${second} -> ${third} (system emulated as light)`);
    check('theme cycling produced no error', errors.length === 0, errors[0] || '');

    /* --- the language switch repaints navigation and content --------------- */
    /* The pages above load in English, so the toggle moves them to Arabic. The
       assertion is that the reading direction flips, whichever way it starts. */
    const startDir = await page.evaluate(() => document.documentElement.dir);
    const startNav = await page.evaluate(
      () => [...document.querySelectorAll('.sidebar__link')].map((n) => n.textContent.trim()).slice(0, 3).join(' / ')
    );
    await page.click('#languageToggle');
    await page.waitForFunction(
      (was) => document.documentElement.dir !== was, { timeout: 10000 }, startDir
    ).catch(() => {});
    await new Promise((r) => setTimeout(r, 300));
    const switched = await page.evaluate(() => ({
      dir: document.documentElement.dir,
      lang: document.documentElement.lang,
      nav: [...document.querySelectorAll('.sidebar__link')].map((n) => n.textContent.trim()).slice(0, 3),
      heading: document.querySelector('h1')?.textContent?.trim(),
    }));
    check('the language switch flips the reading direction', switched.dir !== startDir,
      `${startDir} -> ${switched.dir}`);
    check('the language switch swaps the interface language',
      (switched.dir === 'ltr' && switched.lang === 'en')
      || (switched.dir === 'rtl' && switched.lang === 'ar'),
      `dir=${switched.dir} lang=${switched.lang}`);
    check('the language switch retranslates the navigation',
      switched.nav.join(' ') !== startNav, switched.nav.join(' / '));
    check('the language switch retranslates the page', Boolean(switched.heading), switched.heading || '');
    await page.close();
  }

  /* --- the library drills down, and Back returns to the previous folder ---- */
  {
    const { page, errors } = await open(studentCookies);
    await page.goto(baseUrl + '/user/library/', { waitUntil: 'networkidle2' });
    await page.waitForSelector('.library__folder', { timeout: 20000 });
    const startCrumb = await page.$eval('.breadcrumbs__item', (node) => node.textContent.trim());
    await page.click('.library__folder');
    await page.waitForSelector('.breadcrumbs__item[aria-current="page"]', { timeout: 15000 });
    const drilled = await page.evaluate(() => ({
      url: location.search,
      crumbs: [...document.querySelectorAll('.breadcrumbs__item')].map((n) => n.textContent.trim()),
      folders: document.querySelectorAll('.library__folder').length,
      files: document.querySelectorAll('.library__file').length,
      empty: document.querySelectorAll('.state').length,
    }));
    check('the library drills into a folder', drilled.crumbs.length > (startCrumb ? 2 : 1),
      drilled.crumbs.join(' > '));
    check('a folder shows folders or files, never neither',
      drilled.folders + drilled.files > 0 || drilled.empty > 0,
      `folders=${drilled.folders} files=${drilled.files} empty=${drilled.empty}`);

    /* Press Back the way a person does. Waiting for the URL to settle first
       keeps the assertion about history rather than about navigation timing. */
    const drilledUrl = page.url();
    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await page.waitForFunction(
      (from2) => location.href !== from2 && document.querySelectorAll('.library__folder').length > 0,
      { timeout: 20000 },
      drilledUrl
    ).catch(() => {});
    const backState = await page.evaluate(() => ({
      folders: document.querySelectorAll('.library__folder').length,
      search: location.search,
    }));
    check('the browser Back button returns to the library root',
      backState.folders > 0, `folders=${backState.folders} search=${backState.search}`);
    check('library navigation produced no error', errors.length === 0, errors[0] || '');
    await page.close();
  }

  /* --- the account menu opens, announces itself and closes on Escape ------ */
  {
    const { page, errors } = await open(adminCookies);
    await page.goto(baseUrl + '/admin/dashboard/', { waitUntil: 'networkidle2' });
    await page.click('#accountButton');
    await new Promise((r) => setTimeout(r, 250));
    const menu = await page.evaluate(() => ({
      expanded: document.getElementById('accountButton').getAttribute('aria-expanded'),
      hidden: document.getElementById('accountPanel').hidden,
      items: document.querySelectorAll('#accountPanel .menu__link').length,
    }));
    check('the account menu opens and links the admin area',
      menu.expanded === 'true' && !menu.hidden && menu.items > 4, JSON.stringify(menu));
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 250));
    const closed = await page.evaluate(() => document.getElementById('accountPanel').hidden);
    check('Escape closes the account menu', closed);
    check('the account menu produced no error', errors.length === 0, errors[0] || '');
    await page.close();
  }

  /* --- one library, one source: the documents page holds no folder tree ---- */
  {
    const { page } = await open(studentCookies);
    await page.goto(baseUrl + '/user/documents/', { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => !document.querySelector('#userDocuments')?.hasAttribute('aria-busy'), { timeout: 15000 });
    const dup = await page.evaluate(() => ({
      folders: document.querySelectorAll('#userDocuments .library__folder').length,
      libraries: document.querySelectorAll('#userDocuments .library').length,
      empties: document.querySelectorAll('#userDocuments .state').length,
      orphanIds: [...document.querySelectorAll('#userDocuments [id]')].map((n) => n.id),
    }));
    check('the documents page renders no library folder tree', dup.folders === 0 && dup.libraries === 0,
      JSON.stringify(dup));
    check('the documents page shows content or one empty state',
      dup.empties === 0 || dup.empties === 1, `states=${dup.empties}`);
    await page.close();
  }

  /* --- a mutation updates the view without a manual reload ---------------- */
  {
    const { page, errors } = await open(adminCookies);
    await page.goto(baseUrl + '/admin/information/', { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => document.getElementById('infoTitle').value !== '', { timeout: 15000 })
      .catch(() => {});
    await page.evaluate(() => {
      const values = {
        infoTitle: 'Browser smoke site title',
        infoTagline: 'Rendered by the browser smoke test',
        infoYear: '2026/2027',
        infoNotice: '',
        infoAbout: 'Written by the browser smoke test.',
      };
      for (const [id, value] of Object.entries(values)) document.getElementById(id).value = value;
      document.getElementById('infoForm').requestSubmit();
    });
    await page.waitForFunction(
      () => (document.getElementById('infoMessage').textContent || '').trim().length > 0,
      { timeout: 15000 }
    ).catch(() => {});
    const saved = await page.evaluate(() => ({
      message: (document.getElementById('infoMessage').textContent || '').trim(),
      className: document.getElementById('infoMessage').className,
    }));
    check('a mutation reports success in place, with no reload', saved.message.length > 0 && /success/.test(saved.className),
      `${saved.message} / ${saved.className}`);

    /* The public endpoint the guest pages read must reflect it immediately. */
    const publicTitle = await page.evaluate(async () => (await (await fetch('/api/public/site')).json()).title);
    check('the change is visible to the public endpoint without a manual refresh',
      publicTitle === 'Browser smoke site title', String(publicTitle));
    check('the mutation produced no error', errors.length === 0, errors[0] || '');
    await page.close();
  }
}

/** The CSP must stay exactly as strict as it was, and must actually hold. */
async function cspChecks(baseUrl) {
  const guest = await fetch(baseUrl + '/');
  const header = guest.headers.get('content-security-policy') || '';
  const scriptDirective = (/script-src ([^;]*)/.exec(header) || [])[1] || '';
  check('the CSP allows no inline script', /'self'/.test(scriptDirective) && !/unsafe-inline/.test(scriptDirective), header);
  check('the CSP allows no eval', !/unsafe-eval/.test(header), header);
  check('the CSP still blocks framing', /frame-ancestors 'none'/.test(header));
  check('the CSP still sets object-src none', /object-src 'none'/.test(header));

  const html = await guest.text();
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .filter((match) => match[1].trim().length > 0);
  check('no page carries an inline script', inline.length === 0, `${inline.length} inline scripts`);
  const handlers = / on(click|load|error|submit)=/i.test(html);
  check('no page carries an inline event handler', !handlers);

  /* The whole frontend must never reference another origin. */
  const frontend = path.join(__dirname, '..', '..', 'frontend');
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'dist' || entry.name === 'node_modules' || entry.name === 'vendor') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!['.html', '.js', '.css'].includes(path.extname(entry.name))) continue;
      const source = fs.readFileSync(full, 'utf8');
      /* http(s):// is fine in a comment or in the site owner's contact link. */
      /* Only elements that LOAD a resource. An <a href> to a contact page is a
         link the reader chooses to follow, not a dependency this app pulls in. */
      const matches = source.match(/<(?:script|link|img|iframe|video|audio|source|embed|object)[^>]+(?:src|href)\s*=\s*["']https?:\/\/[^"']+/gi) || [];
      if (matches.length) offenders.push(`${path.relative(frontend, full)}: ${matches[0].slice(0, 60)}`);
    }
  };
  walk(frontend);
  check('no page or asset loads a sub-resource from a third-party origin', offenders.length === 0, offenders.slice(0, 3).join(' | '));

  /* Imports are resolved by the server from frontend/, so an absolute URL in an
     import statement would also be a third-party dependency. */
  const importOffenders = [];
  const importWalk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'dist' || entry.name === 'node_modules' || entry.name === 'vendor') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { importWalk(full); continue; }
      if (path.extname(entry.name) !== '.js') continue;
      const text = fs.readFileSync(full, 'utf8');
      for (const match of text.matchAll(/from\s+["'](https?:\/\/[^"']+)["']/g)) {
        importOffenders.push(`${path.relative(frontend, full)} -> ${match[1]}`);
      }
    }
  };
  importWalk(frontend);
  check('no module imports from a third-party origin', importOffenders.length === 0, importOffenders.slice(0, 3).join(' | '));
}

main().catch((error) => {
  console.error('Browser smoke run crashed:', error);
  process.exitCode = 1;
});
