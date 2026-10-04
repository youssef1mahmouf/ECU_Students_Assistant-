/**
 * Frontend syntax gate (`npm run check`).
 *
 * The backend has its own `npm run check`, but that one only walks *.js under
 * backend/ and Node treats a bare `node --check file.js` as CommonJS, so it
 * reports a spurious "Unexpected token 'export'" for every ES module here.
 * This script copies each module to a temporary .mjs (which Node always parses
 * as ESM) and syntax-checks that, so the gate is real rather than decorative.
 *
 * It also checks that every icon name the navigation registry asks for exists in
 * the generated icon set, which catches a typo at build time instead of leaving
 * a page silently drawing nothing.
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const run = promisify(execFile);
const ROOT = dirname(fileURLToPath(import.meta.url));
const SKIP = new Set(['dist', 'node_modules', 'vendor', '.git']);

async function walk(dir, out = []) {
  const { readdir } = await import('node:fs/promises');
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else if (extname(entry.name) === '.js') out.push(full);
  }
  return out;
}

const scratch = await mkdtemp(join(tmpdir(), 'ecu-fe-check-'));
let failed = 0;
let checked = 0;

try {
  const files = await walk(ROOT);
  for (const file of files) {
    const temp = join(scratch, 'module.mjs');
    await writeFile(temp, await readFile(file), 'utf8');
    try {
      await run(process.execPath, ['--check', temp]);
      checked += 1;
      console.log(`ok    ${relative(ROOT, file)}`);
    } catch (error) {
      failed += 1;
      console.error(`FAIL  ${relative(ROOT, file)}`);
      console.error(String(error.stderr || error.message).trim());
    }
  }

  /* Every icon named in nav.js and in any component must exist, or the page
     silently loses a glyph instead of failing. */
  const { ICON_LIBRARY, iconNames } = await import(pathToFileURL(join(ROOT, 'shared', 'icons.js')).href);
  const { ICONS } = await readIconSources();
  const unknown = Object.entries(ICONS).filter(([, name]) => !iconNames.includes(name));
  if (unknown.length) {
    failed += 1;
    console.error('FAIL  nav.js references icons that were not vendored:');
    for (const [id, name] of unknown) console.error(`        ${id} -> ${name}`);
  } else {
    console.log(`ok    icon set complete (${ICON_LIBRARY}, ${iconNames.length} icons)`);
  }
} finally {
  await rm(scratch, { recursive: true, force: true });
}

/* Pulls the ICONS map out of nav.js without importing it (which would pull in
   the DOM-dependent modules too). */
async function readIconSources() {
  const source = await readFile(join(ROOT, 'shared', 'nav.js'), 'utf8');
  const body = source.slice(source.indexOf('const ICONS'), source.indexOf('};', source.indexOf('const ICONS')));
  const ICONS = {};
  for (const line of body.split('\n')) {
    const match = line.match(/^\s*(\w+):\s*'([\w-]+)',?\s*$/);
    if (match) ICONS[match[1]] = match[2];
  }
  return { ICONS };
}

console.log(`\n${checked}/${checked + failed} frontend modules passed.`);
process.exitCode = failed ? 1 : 0;