'use strict';
/**
 * Imports the official Freshmen roster into whichever data store the project is using.
 *
 *   npm run import:roster                                  # backend/data_base/roster.freshmen-fall-2026.json
 *   npm run import:roster -- "C:\private\roster.json"      # any validated roster document
 *   npm run import:roster -- --dry-run                     # validate and report, write nothing
 *   npm run import:roster -- --store=mongo                 # force the MongoDB adapter (or =file)
 *   npm run extract:roster -- "<GA.pdf>" "<GB.pdf>" --out backend/data_base/roster.freshmen-fall-2026.json
 *
 * Safe to re-run: groups match on their exact printed label, students and teaching assistants
 * on their normalised email. Existing accounts keep their password hash and role; nothing is
 * deleted. Roster documents must never contain passwords - credential-like keys are rejected.
 */
const storeFlag = process.argv.slice(2).find((arg) => arg.startsWith('--store='));
if (storeFlag) process.env.DATA_STORE = storeFlag.split('=')[1];

const fs = require('fs');
const path = require('path');
const config = require('../src/config/env');
const { store, kind, init, close } = require('../src/db/store');
const { importRosterDocument } = require('./lib/roster-store-write');

const DEFAULT_ROSTER = 'roster.freshmen-fall-2026.json';

function resolveInput(argv) {
  const positional = argv.filter((arg) => !arg.startsWith('--'));
  return path.resolve(positional[0] || path.join(config.dataDir, DEFAULT_ROSTER));
}

function assertNoCredentials(document) {
  const rows = Array.isArray(document) ? document : Array.isArray(document.students) ? document.students : [];
  const bad = /passw|secret|hash|token/i;
  for (const row of rows) {
    const key = row && Object.keys(row).find((name) => bad.test(name));
    if (key) throw new Error(`Roster row contains a credential-like field "${key}". Remove it and retry.`);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const input = resolveInput(argv);
  if (!fs.existsSync(input)) {
    throw new Error(
      `Roster document not found: ${input}\nCreate it first: npm run extract:roster -- "<GA.pdf>" "<GB.pdf>" --out ${path.join('backend', 'data_base', DEFAULT_ROSTER)}`
    );
  }
  const document = JSON.parse(fs.readFileSync(input, 'utf8'));
  assertNoCredentials(document);

  await init();
  const summary = await importRosterDocument(document, { store, dryRun });

  console.log(`Roster source         : ${input}`);
  console.log(`Data store            : ${kind}${dryRun ? '  (dry run - nothing written)' : ''}`);
  console.log(`Groups                : ${summary.groups}  (${summary.groupsCreated} created, ${summary.groupsUpdated} refreshed)`);
  console.log(`Students              : ${summary.students}`);
  console.log(`Teaching assistants   : ${summary.staff}`);
  for (const source of summary.perSource) {
    console.log(`  ${source.source}: ${source.students} students in ${source.groups} groups`);
  }
  if (summary.review.length) {
    console.log(`Needs review          : ${summary.review.length} note(s)`);
    for (const note of summary.review.slice(0, 10)) console.log(`  - ${note}`);
  }
  if (!dryRun) {
    console.log('Existing accounts, password hashes and roles were not modified.');
    console.log('Rostered people can now set a first password from the sign-in page.');
  }
}

main()
  .catch((error) => {
    console.error(`Roster import failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await close();
    } catch {
      /* closing after a partial import must not mask the original error */
    }
  });
