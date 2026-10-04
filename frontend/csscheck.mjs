import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Stylesheet integrity gate (`npm run check`, via check.mjs).
 *
 * A rule nested inside another rule - instead of inside an at-rule - is dropped
 * silently by the browser. That is exactly how the dark palette and half the
 * component library went missing during this redesign: one unclosed brace
 * swallowed the rest of the file, the stylesheet still parsed without an error,
 * and only a screenshot revealed it. `node --check` cannot see this and neither
 * can the build.
 *
 * Two things are asserted per file:
 *   1. braces balance, and every rule sits either at the top level or inside an
 *      at-rule;
 *   2. no component stylesheet hard-codes a colour, so the theme switch really is
 *      one attribute on <html> and not a partly-maintained override.
 */
const ROOT = dirname(fileURLToPath(import.meta.url));
const SKIP = new Set(['dist', 'node_modules', 'vendor', '.git']);
/* tokens.css is the one file allowed to name colours: it defines the palette. */
const TOKEN_FILES = new Set(['tokens.css']);
/* Colours a component may legitimately state literally, with the reason. */
const ALLOWED_COLOURS = new Map([
  ['#3a1618', 'dark-mode text on the danger fill (components.css)'],
  ['#fff', 'print stylesheet (base.css)'],
  ['#000', 'print stylesheet and the PDF canvas (base.css, library.css)'],
  ['#ffffff', 'library.css viewer canvas, which must stay white in both modes'],
]);

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else if (extname(entry.name) === '.css') out.push(full);
  }
  return out;
}

/** Strips comments, then flags rules nested inside rules rather than at-rules. */
function audit(source) {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const problems = [];
  const stack = [];
  let top = 0;
  let buffer = '';

  for (const ch of text) {
    if (ch === '{') {
      const selector = buffer.trim().split('\n').pop().slice(0, 60);
      buffer = '';
      const illegal = stack.length > 0 && !stack.every((entry) => entry.startsWith('@'));
      if (illegal) problems.push(`"${selector}" is nested inside a rule, not an at-rule`);
      stack.push(selector);
    } else if (ch === '}') {
      const opened = stack.pop();
      if (opened === undefined) problems.push('a closing brace has no matching opening brace');
      else if (stack.length === 0) top += 1;
    } else buffer += ch;
  }
  if (stack.length) problems.push(`unclosed block: ${stack.join(' > ')}`);
  return { problems, top };
}

/** Colour literals outside tokens.css, ignoring anything inside a comment. */
function hardCodedColours(source) {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const found = [];
  for (const match of text.matchAll(/#[0-9a-fA-F]{3,8}\b|\brgba?\([^)]*\)/g)) {
    const value = match[0].toLowerCase();
    if (!ALLOWED_COLOURS.has(value)) found.push(value);
  }
  return found;
}

let failed = 0;
for (const file of await walk(ROOT)) {
  const source = await readFile(file, 'utf8');
  const name = relative(ROOT, file).split('\\').join('/');
  const { problems, top } = audit(source);

  if (problems.length) {
    failed += 1;
    console.error(`FAIL  ${name}`);
    for (const problem of problems.slice(0, 5)) console.error(`        ${problem}`);
  } else {
    console.log(`ok    ${name} (${top} top-level rules)`);
  }

  if (!TOKEN_FILES.has(name.split('/').pop())) {
    const colours = [...new Set(hardCodedColours(source))];
    if (colours.length) {
      failed += 1;
      console.error(`FAIL  ${name} hard-codes colours outside tokens.css: ${colours.join(', ')}`);
    }
  }
}

console.log(failed ? `css     : ${failed} problems` : 'css     : every stylesheet parses cleanly and owns no colour of its own');
process.exitCode = failed ? 1 : 0;
