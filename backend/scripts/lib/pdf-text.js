'use strict';
/**
 * Minimal, dependency-free PDF text extractor for the roster PDFs.
 *
 * The supplied rosters are text PDFs produced by a spreadsheet/office export: one table per
 * page, standard-encoded Latin strings, no ToUnicode maps. This module inflates the page
 * content streams, replays the text-space operators (Td/TD/Tm/TL/T*) so every shown string
 * keeps its x/y position, and groups items that share a baseline into table rows.
 *
 * It is intentionally small and strict: if a PDF does not look like this shape the caller
 * gets an error (or empty rows) instead of silently wrong data, and extraction is always
 * cross-checked by scripts/verify-roster.js before anything reaches the database.
 */
const fs = require('fs');
const zlib = require('zlib');

function readObjects(source) {
  const objects = new Map();
  for (const match of source.matchAll(/(\d+)\s+0\s+obj([\s\S]*?)endobj/g)) objects.set(Number(match[1]), match[2]);
  return objects;
}

function refsIn(body) {
  return [...body.matchAll(/(\d+)\s+0\s+R/g)].map((m) => Number(m[1]));
}

function streamText(objects, num) {
  const body = objects.get(num);
  if (!body) return null;
  const marker = body.indexOf('stream');
  if (marker < 0) return null;
  const dict = body.slice(0, marker);
  const dataStart = body[marker + 6] === '\r' ? marker + 8 : marker + 7;
  const declared = dict.match(/\/Length\s+(\d+)/);
  const raw = declared
    ? Buffer.from(body.slice(dataStart, dataStart + Number(declared[1])), 'latin1')
    : Buffer.from(body.slice(dataStart, body.indexOf('endstream', dataStart)), 'latin1');
  if (!/FlateDecode/.test(dict)) return raw.toString('latin1');
  try {
    return zlib.inflateSync(raw).toString('latin1');
  } catch {
    try {
      return zlib.inflateRawSync(raw).toString('latin1');
    } catch {
      return null;
    }
  }
}

/** Page content-stream references in true page order (walks the /Pages tree). */
function pageContents(objects) {
  let catalogNum = null;
  for (const [num, body] of objects) if (/\/Type\s*\/Catalog/.test(body)) catalogNum = num;
  const order = [];
  const seen = new Set();
  const walk = (num) => {
    if (!num || seen.has(num)) return;
    seen.add(num);
    const body = objects.get(num);
    if (!body) return;
    if (/\/Type\s*\/Pages/.test(body)) {
      const kids = body.match(/\/Kids\s*\[([\s\S]*?)\]/);
      (kids ? refsIn(kids[1]) : []).forEach(walk);
      return;
    }
    if (/\/Type\s*\/Page(?![s])/.test(body)) {
      const contents = body.match(/\/Contents\s*(\[[\s\S]*?\]|\d+\s+0\s+R)/);
      order.push(contents ? refsIn(contents[1]) : []);
    }
  };
  const catalog = catalogNum === null ? null : objects.get(catalogNum);
  if (catalog) {
    const pagesRef = catalog.match(/\/Pages\s+(\d+)\s+0\s+R/);
    if (pagesRef) walk(Number(pagesRef[1]));
  }
  if (!order.length) {
    for (const body of objects.values()) {
      if (/\/Type\s*\/Page(?![s])/.test(body) && !/\/Kids/.test(body)) {
        const contents = body.match(/\/Contents\s*(\[[\s\S]*?\]|\d+\s+0\s+R)/);
        order.push(contents ? refsIn(contents[1]) : []);
      }
    }
  }
  return order;
}


function unescapePdfString(value) {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (ch !== '\\') {
      out += ch;
      continue;
    }
    const next = value[i + 1];
    i += 1;
    if (next === 'n') out += '\n';
    else if (next === 'r') out += '\r';
    else if (next === 't') out += '\t';
    else if (next >= '0' && next <= '7') {
      let octal = next;
      while (octal.length < 3 && value[i + 1] >= '0' && value[i + 1] <= '7') octal += value[++i];
      out += String.fromCharCode(parseInt(octal, 8));
    } else if (next !== '\n') out += next === undefined ? '' : next;
  }
  return out;
}

/** Split a content stream into literals, names, numbers, operators and array brackets. */
function tokenize(content) {
  const tokens = [];
  let i = 0;
  while (i < content.length) {
    const ch = content[i];
    if (ch === '(') {
      let depth = 1;
      let j = i + 1;
      let literal = '';
      while (j < content.length && depth > 0) {
        if (content[j] === '\\') {
          literal += content.slice(j, j + 2);
          j += 2;
          continue;
        }
        if (content[j] === '(') depth += 1;
        if (content[j] === ')') {
          depth -= 1;
          if (depth === 0) break;
        }
        literal += content[j];
        j += 1;
      }
      tokens.push({ type: 'string', value: unescapePdfString(literal) });
      i = j + 1;
      continue;
    }
    if (ch === '<') {
      const close = content.indexOf('>', i);
      if (close < 0) {
        i += 1;
        continue;
      }
      const hex = content.slice(i + 1, close).replace(/[^0-9a-fA-F]/g, '');
      let decoded = '';
      for (let k = 0; k + 1 < hex.length; k += 2) decoded += String.fromCharCode(parseInt(hex.slice(k, k + 2), 16));
      tokens.push({ type: 'string', value: decoded });
      i = close + 1;
      continue;
    }
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === '/') {
      let j = i + 1;
      while (j < content.length && !/[\s/[\]()<>]/.test(content[j])) j += 1;
      tokens.push({ type: 'name', value: content.slice(i + 1, j) });
      i = j;
      continue;
    }
    if (ch === '[' || ch === ']') {
      tokens.push({ type: ch === '[' ? 'open' : 'close' });
      i += 1;
      continue;
    }
    let j = i;
    while (j < content.length && !/[\s/[\]()<>]/.test(content[j])) j += 1;
    if (j === i) {
      i += 1;
      continue;
    }

    tokens.push({ type: 'word', value: content.slice(i, j) });
    i = j;
  }
  return tokens;
}

const TEXT_OPERATORS = new Set(['Td', 'TD', 'Tm', 'TL', 'Tj', 'TJ', 'T*', 'BT', 'ET', "'", '"']);

/** Replay text-space operators so every shown string keeps the position it was drawn at. */
function textItems(content) {
  const items = [];
  let x = 0;
  let y = 0;
  let leading = 0;
  let strings = [];
  let numbers = [];
  for (const token of tokenize(content)) {
    if (token.type === 'string') {
      strings.push(token.value);
      numbers = [];
      continue;
    }
    if (token.type === 'word' && /^-?[\d.]+$/.test(token.value)) {
      numbers.push(Number(token.value));
      continue;
    }
    if (token.type === 'word' && TEXT_OPERATORS.has(token.value)) {
      if (token.value === 'Tj' || token.value === 'TJ' || token.value === "'" || token.value === '"') {
        const text = strings.join('');
        if (text) items.push({ x: Number(x.toFixed(2)), y: Number(y.toFixed(2)), text });
        if (token.value === "'" || token.value === '"') y -= leading;
      } else if (token.value === 'Td' || token.value === 'TD') {
        if (numbers.length >= 2) {
          x += numbers[numbers.length - 2];
          y += numbers[numbers.length - 1];
        }
        if (token.value === 'TD' && numbers.length >= 1) leading = -numbers[numbers.length - 1];
      } else if (token.value === 'Tm' && numbers.length >= 6) {
        x = numbers[numbers.length - 2];
        y = numbers[numbers.length - 1];
      } else if (token.value === 'TL' && numbers.length >= 1) {
        leading = numbers[numbers.length - 1];
      } else if (token.value === 'T*') {
        y -= leading;
      } else if (token.value === 'BT') {
        x = 0;
        y = 0;
      }
      strings = [];
      numbers = [];
      continue;
    }
    if (token.type === 'open' || token.type === 'close') continue;
    strings = [];
    numbers = [];
  }
  return items;
}

/** Items on the same baseline, sorted left to right; rows sorted top to bottom. */
function rowsFromItems(items, tolerance = 4) {
  const rows = [];
  for (const item of items) {
    const row = rows.find((candidate) => Math.abs(candidate[0].y - item.y) < tolerance);
    if (row) row.push(item);
    else rows.push([item]);
  }
  return rows
    .sort((a, b) => b[0].y - a[0].y)
    .map((row) => row.sort((a, b) => a.x - b.x));
}

/**
 * @param {string} filePath PDF to read (never modified).
 * @returns {{ pages: Array<{ page: number, rows: Array<Array<{x:number,y:number,text:string}>> }>, pageCount: number }}
 */
function extractPages(filePath) {
  const buffer = fs.readFileSync(filePath);
  const objects = readObjects(buffer.toString('latin1'));
  const contents = pageContents(objects);
  if (!contents.length) throw new Error(`No pages found in ${filePath}`);
  const pages = contents.map((refs, index) => {
    const content = refs.map((ref) => streamText(objects, ref)).filter(Boolean).join('\n');
    if (!content) throw new Error(`Page ${index + 1} of ${filePath} has no readable content stream.`);
    return { page: index + 1, rows: rowsFromItems(textItems(content)) };
  });
  return { pages, pageCount: pages.length };
}

module.exports = { extractPages, textItems, rowsFromItems };
