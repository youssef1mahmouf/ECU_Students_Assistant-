// Smoke test: runs shared.js + each page script in a fake DOM to catch runtime
// errors and references to elements that are not present in the generated HTML.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const DIR = __dirname;

function makeStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    clear: () => m.clear(),
  };
}

let uid = 0;

function makeEnv(htmlText, search, base, page) {
  const ids = new Set();
  const missing = [];
  const handlers = [];
  const navs = [];

  const scan = h => { const re = /\bid="([^"]+)"/g; let m; while ((m = re.exec(h))) ids.add(m[1]); };
  scan(htmlText);

  function el(tag, id) {
    const e = {
      tagName: (tag || 'div').toUpperCase(),
      id: id || '',
      textContent: '',
      value: '',
      hidden: false,
      type: '',
      dataset: {},
      style: {},
      children: [],
      classList: (() => {
        const s = new Set();
        return {
          add: c => s.add(c),
          remove: c => s.delete(c),
          toggle: (c, f) => { if (f === undefined) { if (s.has(c)) s.delete(c); else s.add(c); } else if (f) s.add(c); else s.delete(c); },
          contains: c => s.has(c),
        };
      })(),
      addEventListener: (t, f) => handlers.push({ id: e.id || tag, type: t, fn: f }),
      removeEventListener() {},
      appendChild: c => { e.children.push(c); return c; },
      insertAdjacentHTML: (pos, h) => scan(String(h)),
      setAttribute(k, v) { if (k === 'id') { ids.add(v); e.id = v; } e['attr_' + k] = v; },
      getAttribute(k) { return e['attr_' + k] === undefined ? null : e['attr_' + k]; },
      remove() {}, focus() {}, blur() {}, click() {}, scrollIntoView() {},
      closest: () => el('div'),
      get previousElementSibling() { return el('div'); },
      get nextElementSibling() { return el('div'); },
      get parentElement() { return el('div'); },
      querySelector: () => el('div'),
      querySelectorAll: () => [],
      submit() {}, reset() {},
    };
    let raw = '';
    Object.defineProperty(e, 'innerHTML', { get: () => raw, set: h => { raw = String(h); scan(raw); } });
    return e;
  }

  const cache = new Map();
  const body = el('body');
  body.dataset = { page: page, base: base };
  const doc = {
    body: body,
    documentElement: { lang: 'ar', dir: 'rtl', setAttribute() {} },
    head: el('head'),
    getElementById(id) {
      if (!ids.has(id)) { missing.push(id); return null; }
      if (!cache.has(id)) cache.set(id, el('div', id));
      return cache.get(id);
    },
    querySelector: () => el('div'),
    querySelectorAll: () => [],
    createElement: t => el(t),
    createTextNode: t => ({ nodeValue: t }),
    createTreeWalker: () => ({ nextNode: () => null }),
    addEventListener: (t, f) => handlers.push({ id: 'document', type: t, fn: f }),
  };

  const store = { localStorage: makeStorage(), sessionStorage: makeStorage() };
  const location = { href: 'file:///x', search: search || '', reload() {}, assign() {} };
  Object.defineProperty(location, 'href', {
    get() { return this._h || 'file:///x'; },
    set(v) { navs.push(v); this._h = v; },
  });

  const win = {
    location: location,
    addEventListener() {},
    scrollTo() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
  };

  const sandbox = Object.assign({}, store, {
    document: doc,
    window: win,
    navigator: { clipboard: { writeText: async () => {} } },
    crypto: { randomUUID: () => 'gen-' + (++uid) },
    FormData: function () { return { get: () => '' }; },
    Blob: function () {},
    URLSearchParams: URLSearchParams,
    URL: Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL() {} }),
    setTimeout: (fn) => 0,
    clearTimeout() {},
    console: console,
  });
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  return { sandbox, missing, handlers, navs, location, store };
}

const PAGES = [
  { page: 'home', html: 'index.html', base: '.', scripts: ['shared.js', 'home/script.js'], search: '' },
  { page: 'signin', html: 'signin/index.html', base: '..', scripts: ['shared.js', 'signin/script.js'], search: '' },
  { page: 'register', html: 'register/index.html', base: '..', scripts: ['shared.js', 'register/script.js'], search: '' },
  { page: 'groups', html: 'groups/index.html', base: '..', scripts: ['shared.js', 'groups/script.js'], search: '' },
  { page: 'groups?group', html: 'groups/index.html', base: '..', scripts: ['shared.js', 'groups/script.js'], search: '?group=GA1' },
  { page: 'profile', html: 'profile/index.html', base: '..', scripts: ['shared.js', 'profile/script.js'], search: '' },
];

let failures = 0;
for (const p of PAGES) {
  const htmlText = fs.readFileSync(path.join(DIR, p.html), 'utf8');
  const env = makeEnv(htmlText, p.search, p.base, p.page);
  const ctx = vm.createContext(env.sandbox);
  let err = null;
  for (const s of p.scripts) {
    try {
      vm.runInContext(fs.readFileSync(path.join(DIR, s), 'utf8'), ctx, { filename: s });
    } catch (e) { err = s + ' -> ' + e.message; break; }
  }
  const dupMissing = [...new Set(env.missing)];
  const status = err ? 'ERROR ' : (dupMissing.length ? 'MISSING' : 'OK    ');
  if (err || dupMissing.length) failures++;
  console.log(`[${status}] ${p.page}`);
  if (err) console.log('         ' + err);
  if (dupMissing.length) console.log('         missing element ids: ' + dupMissing.join(', '));
  if (env.navs.length) console.log('         navigated to: ' + env.navs.join(', '));
}
console.log(failures === 0 ? 'SMOKE OK' : 'SMOKE FAILURES: ' + failures);
console.log('\n--- phase 2: authenticated states ---');

const STORAGE_KEY = 'groupPortalDataV2';
const SESSION_KEY = 'groupPortalRememberedUserV1';

function seed(store, extraUsers, activeId, userPatch) {
  const user = Object.assign({ id: 'u1', name: 'Ali Test', email: 'ali@test.eg', password: 'Passw0rd!', role: 'user', selectedGroup: 'GA1', confirmed: true }, userPatch || {});
  const data = {
    groups: ['GA1', 'GA2'],
    users: [user].concat(extraUsers || []),
    posts: [{ group: 'GA1', author: 'Ali Test', text: 'hello', createdAt: new Date().toISOString() }],
    activity: [], records: [{ group: 'GA1', title: 'Rec', subject: 'Math', types: ['جدول'], links: [], date: '1/1', time: '10:00', details: 'd' }],
    subjects: [{ id: 's1', group: 'GA1', name: 'Math' }],
  };
  store.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  if (activeId) store.localStorage.setItem(SESSION_KEY, activeId);
}

const SA = { id: '192600250@ecu.edu.eg', name: 'Main Super Admin', email: '192600250@ecu.edu.eg', password: 'Youssef@552008', role: 'superAdmin', selectedGroup: '', confirmed: true };

const PHASE2 = [
  { page: 'profile', html: 'profile/index.html', base: '..', scripts: ['shared.js', 'profile/script.js'], search: '', seed: s => seed(s, null, 'u1'), expectNav: null, expectIncludes: 'Ali Test' },
  { page: 'profile(superadmin)', html: 'profile/index.html', base: '..', scripts: ['shared.js', 'profile/script.js'], search: '', seed: s => seed(s, [SA], SA.id), expectNav: null, expectIncludes: 'data-admin-scroll' },
  { page: 'profile(unconfirmed)', html: 'profile/index.html', base: '..', scripts: ['shared.js', 'profile/script.js'], search: '', seed: s => seed(s, null, 'u1', { confirmed: false }), expectNav: null, expectIncludes: 'اختر مجموعتك' },
  { page: 'groups', html: 'groups/index.html', base: '..', scripts: ['shared.js', 'groups/script.js'], search: '', seed: s => seed(s, null, 'u1'), expectNav: null, expectIncludes: 'GA1' },
  { page: 'groups?group=GA1', html: 'groups/index.html', base: '..', scripts: ['shared.js', 'groups/script.js'], search: '?group=GA1', seed: s => seed(s, null, 'u1'), expectNav: null, expectIncludes: 'Math' },
  { page: 'groups?group=GA1(superadmin)', html: 'groups/index.html', base: '..', scripts: ['shared.js', 'groups/script.js'], search: '?group=GA1', seed: s => seed(s, [SA], SA.id), expectNav: null, expectIncludes: 'GA1' },
];

let p2fail = 0;
for (const p of PHASE2) {
  const htmlText = fs.readFileSync(path.join(DIR, p.html), 'utf8');
  const env = makeEnv(htmlText, p.search, p.base, p.page);
  const ctx = vm.createContext(env.sandbox);
  let err = null;
  try {
    p.seed(env.store);
    for (const s of p.scripts) vm.runInContext(fs.readFileSync(path.join(DIR, s), 'utf8'), ctx, { filename: s });
  } catch (e) { err = e.message + ' | ' + (e.stack || '').split('\n')[1]; }

  const content = env.sandbox.document.getElementById('userContent');
  const html = content ? content.innerHTML : '';
  const problems = [];
  if (err) problems.push('runtime: ' + err);
  if (env.missing.length) problems.push('missing ids: ' + [...new Set(env.missing)].join(', '));
  if (p.expectNav === null && env.navs.length) problems.push('unexpected nav to ' + env.navs.join(','));
  if (p.expectIncludes && !html.includes(p.expectIncludes)) problems.push('expected text not rendered: ' + p.expectIncludes);

  if (problems.length) { p2fail++; failures++; console.log('[ERROR ] ' + p.page); problems.forEach(x => console.log('         ' + x)); }
  else console.log('[OK    ] ' + p.page + '  (rendered ' + html.length + ' chars)');
}
console.log(p2fail === 0 ? 'PHASE2 OK' : 'PHASE2 FAILURES: ' + p2fail);
console.log(failures === 0 ? 'ALL SMOKE OK' : 'TOTAL FAILURES: ' + failures);

