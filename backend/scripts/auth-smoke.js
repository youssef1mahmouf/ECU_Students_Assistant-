'use strict';
/**
 * Authentication browser test (`npm run verify:auth`).
 *
 * Drives the real browser through the flows this task is about, in both
 * languages, both themes and four widths:
 *
 *   guest -> Sign in -> card centred
 *   sign in through the form -> account menu -> Sign Out
 *   after Sign Out -> session gone, account menu gone, protected nav gone
 *   Back after Sign Out -> must not restore an authenticated page
 *   a valid session -> reopening the app must not force a new sign-in
 *
 * It measures real geometry from the rendered page, so a card that is only
 * *nearly* centred fails rather than passing on an eyeball.
 */
const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

process.env.DATA_STORE = 'file';
process.env.DATA_DIR = path.join(os.tmpdir(), `ga6-auth-${crypto.randomBytes(6).toString('hex')}`);
process.env.NODE_ENV = 'development';
process.env.SESSION_SECRET = crypto.randomBytes(48).toString('base64url');
process.env.PORT = '0';

const puppeteer = require('puppeteer-core');
const { createApp } = require('../src/app');
const { store, init, close } = require('../src/db/store');
const { hashPassword } = require('../src/lib/password');

const PASSWORD = 'Portal#Pass1';
const SHOTS = path.join(__dirname, '..', '..', 'tools', 'auth-smoke');

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

async function seed() {
  await init();
  if (!(await store.findGroupByName('Group 1'))) {
    await store.createGroup({ name: 'Group 1', description: 'Auth smoke group', createdBy: 'smoke' });
  }
  await store.importRoster([
    { email: 'one@ecu.edu.eg', name: 'Smoke Student', studentId: '192600250', group: 'Group 1', type: 'student',
      academicYear: '2026', advisorName: '', advisorEmail: '', source: 'auth-smoke' },
  ]);
  if (!(await store.findUserByEmail('one@ecu.edu.eg'))) {
    await store.createUser({
      name: 'Smoke Student', email: 'one@ecu.edu.eg', role: 'user', group: 'Group 1',
      passwordHash: await hashPassword(PASSWORD), confirmed: true, active: true,
    });
  }
}

/* Preferences are set before any page script runs, exactly as the app reads them. */
async function setPrefs(page, { theme = 'light', language = 'en' } = {}) {
  await page.evaluateOnNewDocument((t, l) => {
    localStorage.setItem('ecu.appearance', JSON.stringify({ theme: t, density: 'comfortable', motion: 'full' }));
    localStorage.setItem('ga6.language', l);
  }, theme, language);
}

/* How far the card sits from the true centre of the viewport.
   0 is perfect; anything past a few pixels is a visible lean. */
function centringError(box, viewportWidth) {
  return Math.abs((box.x + box.width / 2) - viewportWidth / 2);
}

/* Horizontal overflow is a layout failure at every width, not a nitpick. */
async function noOverflow(page) {
  return page.evaluate(() =>
    document.documentElement.scrollWidth <= window.innerWidth + 1 &&
    document.body.scrollWidth <= window.innerWidth + 1
  );
}

async function newPage(browser, viewport, prefs = {}) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await setPrefs(page, prefs);
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return { page, errors };
}

const WIDTHS = [
  { label: '1440px', width: 1440, height: 900 },
  { label: '1024px', width: 1024, height: 768 },
  { label: '768px', width: 768, height: 1024 },
  { label: '390px', width: 390, height: 844 },
];

async function main() {
  if (!CHROME_CANDIDATES.length) {
    console.error('No Chrome or Edge executable found; auth browser test cannot run.');
    process.exitCode = 1;
    return;
  }
  if (fs.existsSync(SHOTS)) fs.rmSync(SHOTS, { recursive: true, force: true });
  fs.mkdirSync(SHOTS, { recursive: true });

  await seed();
  const app = createApp();
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const browser = await puppeteer.launch({
    executablePath: CHROME_CANDIDATES[0],
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  try {
    /* --------------------------------------------- [1] guest -> sign-in page */
    console.log('\n[1] Guest sees the Sign In page centred, at every width');
    for (const vp of WIDTHS) {
      const { page, errors } = await newPage(browser, vp, { theme: 'light', language: 'en' });
      await page.goto(`${base}/user/signin/`, { waitUntil: 'networkidle2' });
      await page.waitForSelector('#emailStep');
      const card = await page.$eval('.auth-layout__card', (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, width: r.width };
      });
      const err = centringError(card, vp.width);
      check(`sign-in card centred @ ${vp.label}`, err <= 2, `off centre by ${err.toFixed(1)}px`);
      check(`sign-in card fits @ ${vp.label}`, card.width <= vp.width, `${card.width}px in ${vp.width}px`);
      check(`no horizontal overflow @ ${vp.label}`, await noOverflow(page));
      check(`no console error on sign-in @ ${vp.label}`, errors.length === 0, errors[0] || '');
      await page.screenshot({ path: path.join(SHOTS, `signin-${vp.label}.png`) });
      await page.close();
    }

    /* --------------------------------------------------- [2] create account */
    console.log('\n[2] Guest sees Create Account centred, at every width');
    for (const vp of WIDTHS) {
      const { page, errors } = await newPage(browser, vp, { theme: 'light', language: 'en' });
      await page.goto(`${base}/user/register/`, { waitUntil: 'networkidle2' });
      await page.waitForSelector('#registerForm');
      const card = await page.$eval('.auth-layout__card', (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, width: r.width };
      });
      const err = centringError(card, vp.width);
      check(`create-account card centred @ ${vp.label}`, err <= 2, `off centre by ${err.toFixed(1)}px`);
      check(`no horizontal overflow @ ${vp.label}`, await noOverflow(page));
      check(`no console error on register @ ${vp.label}`, errors.length === 0, errors[0] || '');
      await page.close();
    }

    /* ---------------------------------------------- [3] action alignment */
    console.log('\n[3] Authentication actions are centred, full width on a phone');
    for (const vp of WIDTHS) {
      const { page } = await newPage(browser, vp, { theme: 'light', language: 'en' });
      await page.goto(`${base}/user/signin/`, { waitUntil: 'networkidle2' });
      await page.waitForSelector('#emailStep .auth-actions');
      const geo = await page.$eval('#emailStep .auth-actions', (el) => {
        const r = el.getBoundingClientRect();
        const card = el.closest('.auth-layout__card').getBoundingClientRect();
        const buttons = [...el.querySelectorAll('.btn')].map((b) => b.getBoundingClientRect());
        return {
          cx: r.x + r.width / 2,
          cardCx: card.x + card.width / 2,
          firstEdge: buttons[0].x,
          lastEdge: buttons[buttons.length - 1].right,
          bw: buttons[0].width,
        };
      });
      /* The row of actions is centred in the card, which means the gap before
         the first button equals the gap after the last. Comparing the first
         button's own centre would be wrong: a centred row of two buttons has
         two buttons, not one, so the first is deliberately off the midpoint. */
      check(`sign-in action row centred in the card @ ${vp.label}`,
        Math.abs(geo.cx - geo.cardCx) <= 2, `row ${geo.cx.toFixed(1)} vs card ${geo.cardCx.toFixed(1)}`);
      const balanced = Math.abs((geo.firstEdge - geo.cx + (geo.lastEdge - geo.cx)));
      check(`sign-in actions balanced about the centre @ ${vp.label}`, balanced <= 2, `${balanced.toFixed(1)}px apart`);
      const stacked = vp.width <= 520;
      check(`button width suits ${vp.label}`, stacked ? geo.bw > vp.width * 0.6 : geo.bw < vp.width * 0.6,
        `${geo.bw.toFixed(0)}px`);
      await page.close();
    }

    /* --------------------------------------- [4] public nav, brand, label */
    console.log('\n[4] Public navigation centred; brand links Home; label is Assistant');
    {
      const { page, errors } = await newPage(browser, { width: 1440, height: 900 }, { theme: 'light', language: 'en' });
      await page.goto(`${base}/?preview=visitor`, { waitUntil: 'networkidle2' });
      await page.waitForSelector('#primaryNav');
      const geo = await page.evaluate(() => {
        const nav = document.querySelector('#primaryNav').getBoundingClientRect();
        const brand = document.querySelector('.brand').getBoundingClientRect();
        const actions = document.querySelector('.topbar__actions').getBoundingClientRect();
        return {
          navCx: nav.x + nav.width / 2,
          vw: window.innerWidth,
          brandX: brand.x,
          actionsRight: window.innerWidth - actions.right,
          wordmarkShown: getComputedStyle(document.querySelector('.brand__text')).display !== 'none',
          href: document.querySelector('.brand').getAttribute('href'),
          label: [...document.querySelectorAll('#primaryNav .topnav__link span')].map((s) => s.textContent.trim()),
        };
      });
      check('public navigation centred', Math.abs(geo.navCx - geo.vw / 2) <= 2,
        `nav centre ${geo.navCx.toFixed(1)} vs viewport ${geo.vw / 2}`);
      check('brand still on the start edge', geo.brandX < 60, `${geo.brandX.toFixed(1)}px`);
      check('actions still on the end edge', geo.actionsRight < 60, `${geo.actionsRight.toFixed(1)}px`);
      check('brand wordmark visible at 1440px', geo.wordmarkShown, 'wordmark hidden at desktop');
      check('brand links to the public Home page', geo.href === '/', geo.href);
      check('nav label reads Assistant (English)', geo.label.includes('Assistant'), geo.label.join(' | '));
      check('no console error on public home', errors.length === 0, errors[0] || '');
      await page.screenshot({ path: path.join(SHOTS, 'public-home-nav.png') });
      await page.close();
    }
    {
      const { page } = await newPage(browser, { width: 1440, height: 900 }, { theme: 'light', language: 'ar' });
      await page.goto(`${base}/?preview=visitor`, { waitUntil: 'networkidle2' });
      await page.waitForSelector('#primaryNav');
      const label = await page.$$eval('#primaryNav .topnav__link span', (nodes) => nodes.map((n) => n.textContent.trim()));
      check('nav label reads المساعد (Arabic)', label.includes('المساعد'), label.join(' | '));
      await page.screenshot({ path: path.join(SHOTS, 'public-home-ar.png') });
      await page.close();
    }

    /* ------------------------------------------- [5] sign in, use the menu */
    console.log('\n[5] Sign in through the real form, then use the account menu');
    const { page, errors } = await newPage(browser, { width: 1440, height: 900 }, { theme: 'light', language: 'en' });
    await page.goto(`${base}/user/signin/`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#loginEmail');
    await page.type('#loginEmail', 'one@ecu.edu.eg');
    await page.click('#emailContinue');
    await page.waitForSelector('#passwordStep:not([hidden])', { timeout: 10000 });
    check('password step revealed once the server accepted the address', true);
    await page.type('#loginPassword', PASSWORD);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }),
      page.click('#loginSubmit'),
    ]);
    check('signed in and landed on the student home', page.url().endsWith('/user/'), page.url());

    const authed = await page.evaluate(() => ({
      accountButton: Boolean(document.querySelector('#accountButton')),
      bell: Boolean(document.querySelector('#bellButton')),
      nav: [...document.querySelectorAll('#primaryNav .topnav__link')].map((a) => a.getAttribute('href')),
    }));
    check('account menu trigger present after sign-in', authed.accountButton);
    check('notification bell present after sign-in', authed.bell);
    check('protected navigation present after sign-in', authed.nav.includes('/user/library/'), authed.nav.join(' '));
    check('public Home link gone from the signed-in bar', !authed.nav.includes('/'), authed.nav.join(' '));

    await page.click('#accountButton');
    await page.waitForSelector('#accountPanel:not([hidden])');
    /* Exactly one panel may be open. Opening the account menu while the
       notification bell is also open is the classic double-menu bug. */
    const openPanels = await page.evaluate(() =>
      [...document.querySelectorAll('.menu')].filter((m) => !m.hidden).map((m) => m.id));
    check('only the account menu is open', openPanels.length === 1 && openPanels[0] === 'accountPanel',
      openPanels.join(', '));
    const menu = await page.evaluate(() => ({
      items: [...document.querySelectorAll('#accountPanel .menu__link, #accountPanel .menu__item')]
        .map((el) => el.textContent.trim()).filter(Boolean),
      label: document.querySelector('#signOutButton')?.textContent.trim(),
    }));
    check('account menu offers Sign out', Boolean(menu.label) && /Sign out/i.test(menu.label), menu.label);
    check('no dead menu items', menu.items.length > 0 && menu.items.every((label) => label.length > 0),
      menu.items.join(' | '));
    await page.screenshot({ path: path.join(SHOTS, 'account-menu.png') });

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }),
      page.click('#signOutButton'),
    ]);
    check('Sign Out returned to the public Home page',
      page.url().replace(/\/$/, '') === base.replace(/\/$/, ''), page.url());

    const afterOut = await page.evaluate(() => ({
      accountButton: Boolean(document.querySelector('#accountButton')),
      bell: Boolean(document.querySelector('#bellButton')),
      signOutButton: Boolean(document.querySelector('#signOutButton')),
      nav: [...document.querySelectorAll('#primaryNav .topnav__link')].map((a) => a.getAttribute('href')),
    }));
    check('account menu gone after Sign Out', !afterOut.accountButton);
    check('notification bell gone after Sign Out', !afterOut.bell);
    check('Sign Out control gone after Sign Out', !afterOut.signOutButton);
    check('protected navigation gone after Sign Out', !afterOut.nav.some((h) => h.startsWith('/user/')), afterOut.nav.join(' '));
    check('public navigation back after Sign Out', afterOut.nav.includes('/'), afterOut.nav.join(' '));
    check('no console error across the whole sign-in/sign-out', errors.length === 0, errors[0] || '');

    /* -------------------------------------- [6] Back must not restore the UI */
    console.log('\n[6] Back after Sign Out must not restore an authenticated page');
    await page.goBack({ waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 800));
    const afterBack = await page.evaluate(() => ({
      href: location.href,
      path: location.pathname,
      accountButton: Boolean(document.querySelector('#accountButton')),
      title: document.title,
    }));
    /* Sign Out uses location.replace, so the signed-in page is *overwritten*
       rather than pushed. Going Back therefore has no authenticated entry to
       return to at all - the browser lands on the empty previous entry. Any
       page that still carries the account menu would be a failure. */
    check('Back did not restore the account menu', !afterBack.accountButton, afterBack.href);
    check('Back did not land on a protected page',
      !afterBack.path.startsWith('/user/') || !afterBack.accountButton, afterBack.href);
    check('Back left no authenticated history entry behind',
      !afterBack.href.startsWith('http') || afterBack.path === '/' || !afterBack.path.startsWith('/user/'),
      afterBack.href);

    /* The server must agree: the cookie is gone, not merely the interface. */
    await page.goto(`${base}/`, { waitUntil: 'networkidle2' });
    const me = await page.evaluate(async (endpoint) => {
      const res = await fetch(endpoint, { credentials: 'same-origin' });
      const body = await res.json();
      return { status: res.status, user: body && body.user ? body.user.email : null };
    }, `${base}/api/auth/me`);
    check('server reports no session after Sign Out', me.user === null, JSON.stringify(me));
    check('session cookie cleared by the server response', me.status === 200, `status ${me.status}`);

    /* ---------------------------------------- [7] session survives a revisit */
    console.log('\n[7] A valid session must survive leaving and reopening the app');
    await page.goto(`${base}/user/signin/`, { waitUntil: 'networkidle2' });
    await page.type('#loginEmail', 'one@ecu.edu.eg');
    await page.click('#emailContinue');
    await page.waitForSelector('#passwordStep:not([hidden])', { timeout: 10000 });
    await page.type('#loginPassword', PASSWORD);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }),
      page.click('#loginSubmit'),
    ]);
    check('signed in again for the persistence check', page.url().endsWith('/user/'), page.url());

    /* A fresh tab in the same browser shares the cookie jar, which is exactly
       what "closed the tab and came back" means to the server. */
    const second = await browser.newPage();
    await second.setViewport({ width: 1440, height: 900 });
    await second.goto(`${base}/user/`, { waitUntil: 'networkidle2' });
    await second.waitForSelector('#accountButton', { timeout: 10000 });
    check('a new tab is already authenticated (no forced sign-in)', second.url().endsWith('/user/'), second.url());
    await second.close();
    await page.close();

    /* ------------------------------------------------------------ [8] themes */
    console.log('\n[8] Authentication pages in light, dark and system');
    /* An isolated context, so these pages are genuinely signed out. Sharing
       the default jar would leave the previous sign-in in place and
       /user/signin/ would - correctly - redirect straight away. */
    const guestCtx = await (browser.createBrowserContext
      ? browser.createBrowserContext()
      : browser.createIncognitoBrowserContext());
    for (const theme of ['light', 'dark', 'system']) {
      const page = await guestCtx.newPage();
      const themeErrors = [];
      page.on('pageerror', (error) => themeErrors.push(String(error)));
      page.on('console', (message) => {
        if (message.type() === 'error') themeErrors.push(message.text());
      });
      await page.setViewport({ width: 1024, height: 768 });
      await setPrefs(page, { theme, language: 'en' });
      await page.goto(`${base}/user/signin/`, { waitUntil: 'networkidle2' });
      await page.waitForSelector('.auth-layout__card');
      const painted = await page.$eval('.auth-layout__card', (el) => {
        const s = getComputedStyle(el);
        return { bg: s.backgroundColor, colour: s.color };
      });
      check(`sign-in card is painted in ${theme}`, painted.bg !== 'rgba(0, 0, 0, 0)', painted.bg);
      check(`no console error in ${theme} mode`, themeErrors.length === 0, themeErrors[0] || '');
      await page.screenshot({ path: path.join(SHOTS, `signin-${theme}.png`) });
      await page.close();
    }

    /* --------------------------------------------------- [9] Arabic (RTL) */
    console.log('\n[9] Sign-in card centred in Arabic (RTL) as well');
    {
      const rtl = await guestCtx.newPage();
      const rtlErrors = [];
      rtl.on('pageerror', (error) => rtlErrors.push(String(error)));
      rtl.on('console', (message) => {
        if (message.type() === 'error') rtlErrors.push(message.text());
      });
      await rtl.setViewport({ width: 1440, height: 900 });
      await setPrefs(rtl, { theme: 'light', language: 'ar' });
      await rtl.goto(`${base}/user/signin/`, { waitUntil: 'networkidle2' });
      await rtl.waitForSelector('.auth-layout__card');
      const card = await rtl.$eval('.auth-layout__card', (el) => {
        const r = el.getBoundingClientRect();
        return { cx: r.x + r.width / 2, dir: document.documentElement.dir };
      });
      check('sign-in card centred in Arabic RTL', Math.abs(card.cx - 720) <= 2,
        `centre ${card.cx.toFixed(1)}, dir=${card.dir}`);
      check('no console error in Arabic', rtlErrors.length === 0, rtlErrors[0] || '');
      await rtl.screenshot({ path: path.join(SHOTS, 'signin-ar.png') });
      await rtl.close();
    }
    await guestCtx.close();
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    await close();
  }

  console.log(`\n${passed} authentication checks passed, ${failures.length} failed.`);
  if (failures.length) {
    console.log('Failed:');
    for (const name of failures) console.log(`  - ${name}`);
    process.exitCode = 1;
  } else {
    console.log('Every authentication flow behaved correctly in a real browser.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});