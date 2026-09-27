const fs = require('fs');
const src = fs.readFileSync(__dirname + '/_build.js', 'utf8');
let i = 0, line = 1, depth = { '(': 0, '[': 0, '{': 0 };
const open = { '(': ')', '[': ']', '{': '}' };
const close = { ')': '(', ']': '[', '}': '{' };
const stack = [];
let mode = null; // null | "'" | '"' | '`' | '//' | '/*'
while (i < src.length) {
  const c = src[i], n = src[i + 1];
  if (c === '\n') { line++; if (mode === '//') mode = null; if (mode === "'" || mode === '"') mode = null; i++; continue; }
  if (mode === "'" || mode === '"' || mode === '`') { if (c === '\\') { i += 2; continue; } if (c === mode) mode = null; i++; continue; }
  if (mode === '//') { i++; continue; }
  if (mode === '/*') { if (c === '*' && n === '/') { mode = null; i += 2; continue; } i++; continue; }
  if (c === '/' && n === '/') { mode = '//'; i += 2; continue; }
  if (c === '/' && n === '*') { mode = '/*'; i += 2; continue; }
  if (c === "'" || c === '"' || c === '`') { mode = c; i++; continue; }
  if (open[c]) { stack.push({ c, line }); i++; continue; }
  if (close[c]) {
    const top = stack.pop();
    if (!top || top.c !== close[c]) { console.log('MISMATCH at line ' + line + ': got "' + c + '" but top of stack is ' + (top ? '"' + top.c + '" from line ' + top.line : 'empty')); process.exit(1); }
    i++; continue;
  }
  i++;
}
if (stack.length) { console.log('UNCLOSED: ' + stack.map(s => s.c + '@' + s.line).join(', ')); process.exit(1); }
console.log('BALANCED OK');
