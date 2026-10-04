'use strict';
const os = require('os'); const path = require('path'); const crypto = require('crypto');
process.env.DATA_STORE = 'file';
process.env.DATA_DIR = path.join(os.tmpdir(), `ga6-diag-${crypto.randomBytes(6).toString('hex')}`);
process.env.NODE_ENV = 'development';
process.env.SESSION_SECRET = crypto.randomBytes(48).toString('base64url');
const puppeteer = require('puppeteer-core');
const config = require('../backend/src/config/env');
const { createApp } = require('../backend/src/app');
const { init, close } = require('../backend/src/db/store');

(async () => {
  await init();
  const app = createApp(); const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(base + '/?preview=visitor', { waitUntil: 'networkidle2', timeout: 40000 });
  await new Promise((r) => setTimeout(r, 1500));
  const info = await page.evaluate(() => {
    const out = [];
    for (const sel of ['.topbar__inner', '.brand', '.brand__mark', '.brand__text', '.topnav', '.topbar__actions',
                       '#languageToggle', '#appearanceToggle', '.nav-toggle', '.visually-hidden']) {
      const nodes = [...document.querySelectorAll(sel)];
      for (const node of nodes) {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        out.push({
          sel,
          text: (node.textContent || '').trim().slice(0, 22),
          x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height),
          display: style.display, position: style.position, overflow: style.overflow,
          clip: style.clipPath, width: style.width,
        });
      }
    }
    return out;
  });
  for (const row of info) console.log(JSON.stringify(row));
  await browser.close(); server.close(); await close();
  require('fs').rmSync(config.dataDir, { recursive: true, force: true });
})().catch((e) => { console.error(e); process.exit(1); });
