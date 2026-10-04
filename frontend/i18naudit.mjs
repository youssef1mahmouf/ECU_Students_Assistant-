import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Bilingual audit (`npm run check:i18n`, also part of `npm run check`).
 *
 * Three things a redesign can silently break, none of which a browser reports:
 *   1. a key a page uses that the dictionary does not define - the label renders
 *      as an empty string instead of falling back to something readable;
 *   2. a page title key that does not exist - the tab title goes blank;
 *   3. a dynamically built key (`role.${x}`, `level.${x}`) whose set is incomplete,
 *      leaving one role or one level unlabelled;
 *   4. an entry missing its English half - it renders in Arabic in English mode.
 */
const ROOT = dirname(fileURLToPath(import.meta.url));
const SKIP = new Set(['dist', 'node_modules', 'vendor', '.git']);

/* Keys built at runtime, with the values the code can produce. Pinning them here
   is what makes the dynamic families checkable at all. */
const DYNAMIC = {
  role: ['user', 'adminAssistant', 'superAdminAssistant', 'doctor', 'engineer', 'admin', 'superAdmin'],
  level: ['security', 'admin', 'auth', 'content', 'info'],
  kind: ['pdf', 'image', 'video', 'audio', 'text', 'file', 'lecture', 'tutorial', 'lab'],
  /* `problems.category${Capitalised}` and `admin.chart${Capitalised}` join two
     halves of a literal prefix that is not itself a dictionary entry, so the
     prefix is written here with a marker the lookup understands. */
  'problems.category|': ['Bug', 'Content', 'Account', 'Group', 'Other'],
  'admin.chart|': ['Daily', 'Weekly', 'Monthly'],
};

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else if (['.js', '.html'].includes(extname(entry.name))) out.push(full);
  }
  return out;
}

const dictionarySource = await readFile(join(ROOT, 'shared', 'i18n.js'), 'utf8');
const entries = [...dictionarySource.matchAll(/^\s*'([\w.]+)':\s*\[([\s\S]*?)\]\s*,?/gm)];
const defined = new Map(entries.map((match) => [match[1], match[2]]));

const problems = [];
const used = new Map();
const note = (key, file, why) => {
  if (!used.has(key)) used.set(key, new Set());
  used.get(key).add(why ? `${file} (${why})` : file);
};

/* An entry must be exactly two quoted strings. The pattern tolerates commas,
   escaped quotes and the line break between the Arabic and English halves. */
const PAIR = /^\s*'((?:[^'\\]|\\.)*)'\s*,\s*'((?:[^'\\]|\\.)*)'\s*$/;
for (const [key, body] of defined) {
  const halves = PAIR.exec(body);
  if (!halves || !halves[1].trim() || !halves[2].trim()) {
    problems.push(`entry '${key}' is not a complete [arabic, english] pair`);
  }
}

for (const file of await walk(ROOT)) {
  const source = await readFile(file, 'utf8');
  const where = relative(ROOT, file).replaceAll('\\', '/');

  for (const match of source.matchAll(/\bt\(\s*'([\w.]+)'/g)) note(match[1], where);
  for (const match of source.matchAll(/(?:titleKey|bodyKey|loadingKey):\s*'([\w.]+)'/g)) note(match[1], where);
  for (const match of source.matchAll(/data-i18n(?:-placeholder|-label)?="([\w.]+)"/g)) note(match[1], where);
  for (const match of source.matchAll(/data-page-title="([\w.]+)"/g)) note(match[1], where, 'page title');
}

for (const [key, where] of used) {
  if (defined.has(key)) continue;
  const prefix = key.split('.').slice(0, -1).join('.');
  if (DYNAMIC[prefix]) continue;
  problems.push(`missing key '${key}' used in ${[...where].join(', ')}`);
}

for (const [prefix, values] of Object.entries(DYNAMIC)) {
  for (const value of values) {
    const literal = prefix.endsWith('|') ? prefix.slice(0, -1) : prefix + '.';
    const key = `${prefix.endsWith('|') ? prefix : prefix + '.'}${value}`;
    if (!defined.has(literal + value)) problems.push(`missing dynamic key '${key}'`);
  }
}

/* Keys no page or component references any more. Reported, not fatal: a few are
   legitimately kept for the server-message registry. */
const unused = [...defined.keys()].filter(
  (key) => !used.has(key) && !key.startsWith('server.') && !key.startsWith('v.')
);

console.log(`i18n    : ${defined.size} keys defined, ${used.size} referenced, ${unused.length} unreferenced`);
if (problems.length) {
  console.error(`i18n    : ${problems.length} problems`);
  for (const problem of problems.slice(0, 60)) console.error(`  ${problem}`);
  if (problems.length > 60) console.error(`  ... and ${problems.length - 60} more`);
  process.exitCode = 1;
} else {
  console.log('i18n    : every referenced key exists, every entry is bilingual');
}
