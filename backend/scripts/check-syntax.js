'use strict';
/**
 * Dependency-free syntax gate: runs `node --check` over every backend JS file.
 * Wired to `npm run check`.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name.endsWith('.js')) files.push(full);
  }
  return files;
}

let failed = 0;
const files = walk(ROOT);
for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    console.log(`ok    ${path.relative(ROOT, file)}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL  ${path.relative(ROOT, file)}`);
    console.error(String(error.stderr || error.message).trim());
  }
}
console.log(`\n${files.length - failed}/${files.length} files passed.`);
process.exitCode = failed ? 1 : 0;
