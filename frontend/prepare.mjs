/**
 * Vendors the two third-party runtime libraries into `shared/vendor/`.
 *
 * Why a prepare step at all:
 *   - The server sends `Content-Security-Policy: default-src 'self'; script-src 'self'`.
 *     A CDN <script> tag would be blocked, so every dependency has to be served by this
 *     origin. There is also no bundler in this project.
 *   - `npm install` therefore produces the files, and this script copies only the exact
 *     modules the pages import. The result is committed, so the app also runs on a machine
 *     that never ran `npm install`.
 *
 * Libraries (and only these two - see README for the full evaluation):
 *   lucide-static  icons. MIT. Copied into a generated `shared/icons.js` holding the inner
 *                  markup of each icon, so no network request and no sprite <use> quirks.
 *   pdfjs-dist     in-app PDF rendering for the resource viewer. Apache-2.0. The library
 *                  and its worker are copied verbatim and only fetched on the viewer route.
 *
 * Run with: `npm run vendor` (also wired to postinstall and to the build).
 */
import { mkdir, readFile, readdir, rm, writeFile, copyFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const VENDOR = join(ROOT, 'shared', 'vendor');

/** Every icon the design system can ask for. Keeps the shipped payload tiny and auditable. */
const ICONS = [
  'activity', 'arrow-left', 'arrow-right', 'arrow-up-right', 'bell', 'book-open', 'calendar-days',
  'check', 'chevron-down', 'chevron-left', 'chevron-right', 'circle-alert', 'circle-check',
  'circle-help', 'clock', 'database', 'download', 'eye', 'file', 'file-image', 'file-text',
  'filter', 'folder', 'folder-open', 'gauge', 'graduation-cap', 'heart-pulse', 'house',
  'image', 'inbox', 'info', 'languages', 'layout-dashboard', 'layout-grid', 'library', 'list',
  'list-checks', 'lock', 'log-out', 'mail', 'menu', 'monitor', 'moon', 'music', 'panel-left',
  'paperclip', 'palette', 'play', 'plus', 'refresh-cw', 'search', 'server', 'settings',
  'shield', 'shield-check', 'sliders-horizontal', 'sparkles', 'sun', 'sun-moon', 'trash-2',
  'triangle-alert', 'type', 'upload', 'user', 'users', 'video', 'x',
];

/** Copied verbatim from the package so the worker is served from this origin, as CSP demands. */
const PDF_FILES = ['pdf.min.mjs', 'pdf.worker.min.mjs'];

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
/** Strips the licence comment and the outer <svg> wrapper, keeping only the drawable markup. */
function innerSvg(source) {
  const open = source.indexOf('>', source.indexOf('<svg'));
  const close = source.lastIndexOf('</svg>');
  if (open === -1 || close === -1) throw new Error('unreadable lucide svg');
  return source
    .slice(open + 1, close)
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
}

async function buildIcons(lucideRoot, version) {
  const iconsDir = join(lucideRoot, 'icons');
  const available = new Set((await readdir(iconsDir)).filter((name) => name.endsWith('.svg')));
  const missing = ICONS.filter((name) => !available.has(`${name}.svg`));
  if (missing.length) throw new Error(`lucide-static is missing icons: ${missing.join(', ')}`);

  const entries = [];
  for (const name of ICONS) {
    const source = await readFile(join(iconsDir, `${name}.svg`), 'utf8');
    entries.push([name, innerSvg(source)]);
  }

  const body = entries
    .map(([name, markup]) => `  ${JSON.stringify(name)}: '${markup.replaceAll("'", "\\'")}',`)
    .join('\n');

  const file = `/**
 * GENERATED FILE - do not edit by hand.
 * Produced by frontend/prepare.mjs from lucide-static v${version} (ISC licence).
 * Only the icons the design system uses are shipped, inline, so rendering one costs no
 * network request and inherits \`currentColor\` from its context.
 *
 * Regenerate with: npm run vendor
 */
const VERSION = 'lucide-static@${version}';

/** name -> inner SVG markup (the drawable part only, no <svg> wrapper). */
const MARKUP = {
${body}
};

/** Every icon this build can draw. */
export const iconNames = Object.keys(MARKUP);

export { VERSION as ICON_LIBRARY };

/**
 * Markup for one icon. An unknown name returns an empty string instead of throwing, so a
 * typo in a page degrades to "no icon" rather than breaking the whole view.
 * Pure string output: the caller decides where it goes, and everything it returns is
 * literal markup shipped by this file - never anything a user typed.
 */
export function icon(name) {
  return MARKUP[name] || '';
}
`;
  await writeFile(join(ROOT, 'shared', 'icons.js'), file, 'utf8');
  return entries.length;
}

async function copyPdf(pdfjsRoot) {
  const build = join(pdfjsRoot, 'build');
  const target = join(VENDOR, 'pdf');
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  let bytes = 0;
  for (const name of PDF_FILES) {
    const from = join(build, name);
    if (!(await exists(from))) throw new Error(`pdfjs-dist is missing build/${name}`);
    await copyFile(from, join(target, name));
    bytes += (await stat(from)).size;
  }
  return bytes;
}

async function versionOf(pkgRoot) {
  return JSON.parse(await readFile(join(pkgRoot, 'package.json'), 'utf8')).version;
}

// Resolve an installed package directory the way Node's own resolver does: walk up from
// this directory looking for node_modules/<name>.
//
// The repository root is an npm workspace, so npm may hoist these packages into
// <repo>/node_modules. A standalone install inside frontend/ would instead place them in
// frontend/node_modules. Both layouts must resolve identically, so never hard-code one.
async function resolvePackage(name) {
  let dir = ROOT;
  for (;;) {
    const candidate = join(dir, 'node_modules', ...name.split('/'));
    if (await exists(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

async function main() {
  const lucideRoot = await resolvePackage('lucide-static');
  const pdfjsRoot = await resolvePackage('pdfjs-dist');
  const missing = [!lucideRoot && 'lucide-static', !pdfjsRoot && 'pdfjs-dist'].filter(Boolean);
  if (missing.length) {
    console.error(`vendor: ${missing.join(' and ')} not installed.`);
    console.error('vendor: dependencies are owned by the repository root, which declares frontend/ as an npm workspace.');
    console.error('vendor: run `npm ci` at the repository root, then `npm run build` in frontend/.');
    console.error('vendor: running `npm install` inside frontend/ is neither required nor supported.');
    process.exit(1);
  }

  await mkdir(VENDOR, { recursive: true });
  const lucideVersion = await versionOf(lucideRoot);
  const pdfVersion = await versionOf(pdfjsRoot);
  const pdfBytes = await copyPdf(pdfjsRoot);
  const icons = await buildIcons(lucideRoot, lucideVersion);

  await writeFile(
    join(VENDOR, 'README.md'),
    [
      '# Vendored runtime libraries',
      '',
      'Generated by `npm run vendor` (`frontend/prepare.mjs`). Do not edit anything here.',
      '',
      '| File | Library | Licence | Loaded |',
      '| --- | --- | --- | --- |',
      `| \`../icons.js\` | lucide-static ${lucideVersion} | ISC | everywhere (inline, no request) |`,
      `| \`pdf/pdf.min.mjs\` | pdfjs-dist ${pdfVersion} | Apache-2.0 | only on the resource viewer route |`,
      `| \`pdf/pdf.worker.min.mjs\` | pdfjs-dist ${pdfVersion} | Apache-2.0 | only when a PDF is opened |`,
      '',
      'They are committed on purpose: the Express server serves `frontend/` directly, so a',
      'machine that only ran `npm install` at the repository root still gets a working',
      'application, and the Cloudflare Pages build never depends on `node_modules`.',
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(`vendor: ${icons} icons -> shared/icons.js (lucide-static ${lucideVersion})`);
  console.log(`vendor: pdfjs-dist ${pdfVersion} -> shared/vendor/pdf (${(pdfBytes / 1024).toFixed(0)} KB, viewer-only)`);
}

await main();