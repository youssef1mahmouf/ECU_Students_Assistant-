'use strict';
const os = require('os'); const path = require('path'); const crypto = require('crypto');
process.env.DATA_STORE = 'file';
process.env.DATA_DIR = path.join(os.tmpdir(), `ga6-diag-${crypto.randomBytes(6).toString('hex')}`);
process.env.NODE_ENV = 'development';
process.env.SESSION_SECRET = crypto.randomBytes(48).toString('base64url');
const puppeteer = require('puppeteer-core');
const config = require('../backend/src/config/env');
const { createApp } = require('../backend/src/app');
const { store, init, close } = require('../backend/src/db/store');
const { hashPassword } = require('../backend/src/lib/password');
const PASSWORD = 'Portal#Pass1';
(async () => {
  await init();
  await store.createGroup({ name: 'Group 1', description: '', createdBy: 'd' });
  await store.importRoster([{ email: 'one@ecu.edu.eg', name: 'D S', studentId: '1', group: 'Group 1', type: 'student', academicYear: '2026', advisorName: '', advisorEmail: '', source: 'diag' }]);
  await store.createUser({ name: 'D S', email: 'one@ecu.edu.eg', role: 'user', group: 'Group 1', passwordHash: await hashPassword(PASSWORD), confirmed: true, active: true });
  const app = createApp(); const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const jar = new Map(); const absorb = (res) => { for (const raw of res.headers.getSetCookie ? res.headers.getSetCookie() : []) { const [p] = raw.split(';'); const i = p.indexOf('='); if (i < 0) continue; jar.set(p.slice(0, i).trim(), p.slice(i + 1).trim()); } };
  const header = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  await fetch(base + '/api/auth/me', { headers: { cookie: header() } }).then(absorb);
  const csrf = decodeURIComponent(/ga6_csrf_v2=([^;]+)/.exec(header())[1]);
  absorb(await fetch(base + '/api/auth/login', { method: 'POST', headers: { cookie: header(), 'content-type': 'application/json', 'x-csrf-token': csrf }, body: JSON.stringify({ email: 'one@ecu.edu.eg', password: PASSWORD }) }));
  const cookies = header().split('; ').map((pair) => { const i = pair.indexOf('='); return { name: pair.slice(0, i), value: pair.slice(i + 1), url: base }; });
  const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: 'new', args: ['--no-sandbox'] });
  for (const url of ['/user/library/', '/user/documents/']) {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });
    await browser.setCookie(...cookies);
    await page.evaluateOnNewDocument(() => { localStorage.setItem('ga6.language', 'en'); localStorage.setItem('ecu.appearance', JSON.stringify({ theme: 'light' })); });
    await page.goto(base + url, { waitUntil: 'networkidle2', timeout: 40000 });
    await new Promise((r) => setTimeout(r, 2000));
    const r = await page.evaluate(() => {
      const limit = document.documentElement.clientWidth; const out = [];
      for (const node of document.querySelectorAll('body *')) {
        const rect = node.getBoundingClientRect();
        if (rect.right > limit + 1) out.push(`${node.tagName}.${(node.className||'').toString().slice(0,40)} r=${Math.round(rect.right)} w=${Math.round(rect.width)}`);
        if (out.length > 8) break;
      }
      const inner = document.querySelector('.topbar__inner');
      const acts = document.querySelector('.topbar__actions');
      return { client: limit, scroll: document.documentElement.scrollWidth,
        inner: inner ? inner.getBoundingClientRect().width : 0,
        acts: acts ? acts.getBoundingClientRect().width : 0, out };
    });
    console.log(url, JSON.stringify(r));
    await page.close();
  }
  await browser.close(); server.close(); await close();
  require('fs').rmSync(config.dataDir, { recursive: true, force: true });
})().catch((e) => { console.error(e); process.exit(1); });


