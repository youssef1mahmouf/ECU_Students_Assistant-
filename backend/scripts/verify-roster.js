'use strict';
/**
 * Verifies the roster pipeline end to end (`npm run verify:roster`).
 *
 * By default it imports the roster document twice into a throwaway file store in os.tmpdir()
 * and asserts that every printed group, student and teaching assistant arrived, that a second
 * import creates nothing, and that no credential ever entered the allow-list.
 * Pass --live to check the configured store (file or Atlas) without writing anything to it.
 */
const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const argv = process.argv.slice(2);
const live = argv.includes('--live');
const jsonFlag = argv.indexOf('--json');
const storeFlag = argv.find((arg) => arg.startsWith('--store='));
if (storeFlag) process.env.DATA_STORE = storeFlag.split('=')[1];
if (!live) {
  process.env.DATA_STORE = 'file';
  process.env.DATA_DIR = path.join(os.tmpdir(), `ga6-roster-${crypto.randomBytes(6).toString('hex')}`);
}
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
if (!process.env.SESSION_SECRET) process.env.SESSION_SECRET = crypto.randomBytes(48).toString('base64url');

const config = require('../src/config/env');
const { store, kind, init, close } = require('../src/db/store');
const { importRosterDocument } = require('./lib/roster-store-write');

// The document always lives beside the local data folder, even when DATA_DIR points
// somewhere else (the isolated verification store).
const DEFAULT_DOC = path.join(__dirname, '..', 'data_base', 'roster.freshmen-fall-2026.json');
const ROSTER = path.resolve(jsonFlag >= 0 ? argv[jsonFlag + 1] : DEFAULT_DOC);

let passed = 0;
const failures = [];
function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`);
  }
}

async function main() {
  if (!fs.existsSync(ROSTER)) throw new Error(`Roster document not found: ${ROSTER}`);
  const payload = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
  await init();
  console.log(`Roster document: ${ROSTER}`);
  console.log(`Data store     : ${kind}${live ? '  (live check - read only)' : '  (isolated copy)'}`);

  let summary = null;
  if (!live) {
    summary = await importRosterDocument(payload, { store });
    check('first import creates every group', summary.groupsCreated === payload.groups.length,
      `${summary.groupsCreated}/${payload.groups.length}`);
  }

  const [roster, groups] = await Promise.all([store.listRoster(), store.listGroups()]);
  const students = roster.filter((entry) => entry.type === 'student');
  const staff = roster.filter((entry) => entry.type === 'ta');
  const byEmail = new Map(roster.map((entry) => [entry.email, entry]));

  console.log('\n[1] Every printed row is present');
  const missingGroups = payload.groups.map((group) => group.label).filter((label) => !groups.some((row) => row.name === label));
  check('every group label exists', missingGroups.length === 0, missingGroups.join(', '));
  check('group labels are unique', new Set(groups.map((row) => row.name)).size === groups.length);
  check('student rows match the printed count', students.length === payload.students.length,
    `${students.length} stored / ${payload.students.length} printed`);
  const wrong = payload.students.filter((student) => {
    const row = byEmail.get(student.email);
    return !row || row.name !== student.name || row.group !== student.group || row.studentId !== student.studentId;
  });
  check('each student keeps the printed name, id and group', wrong.length === 0,
    wrong.slice(0, 3).map((student) => student.studentId).join(', '));
  check('each student keeps its source page', payload.students.every((student) => byEmail.get(student.email)?.sourcePage === student.page));
  check('each group holds the printed number of students', payload.groups.every((group) =>
    students.filter((row) => row.group === group.label).length === group.students));

  console.log('\n[2] Teaching assistants');
  const printed = new Map();
  for (const group of payload.groups) {
    for (const advisor of group.advisors) {
      const entry = printed.get(advisor.email) || { email: advisor.email, groups: [] };
      if (!entry.groups.includes(group.label)) entry.groups.push(group.label);
      printed.set(advisor.email, entry);
    }
  }
  const missingStaff = [...printed.keys()].filter((email) => !byEmail.has(email));
  check('every printed teaching assistant is on the allow-list', missingStaff.length === 0, missingStaff.join(', '));
  check('each teaching assistant keeps every listed group', [...printed.values()].every((advisor) => {
    const row = byEmail.get(advisor.email);
    return row && advisor.groups.every((label) => (row.taGroups || []).includes(label));
  }));
  check('no roster group lost its advisor metadata', groups
    .filter((row) => payload.groups.some((group) => group.label === row.name))
    .every((row) => (row.taEmails || []).length > 0));

  console.log('\n[3] Safety of the allow-list');
  check('allow-list holds only student and teaching-assistant rows', roster.length === students.length + staff.length);
  check('no credential is stored in the allow-list', roster.every((entry) =>
    !Object.keys(entry).some((key) => /passw|secret|hash|token/i.test(key))));
  check('every student email is derived from the student id', students.every((entry) =>
    !entry.studentId || entry.email === `${entry.studentId}@${config.security.emailDomain}`));
  check('allow-list rows are unique per email', new Set(roster.map((entry) => entry.email)).size === roster.length);
  check('allow-list rows are unique per student id',
    new Set(students.map((entry) => entry.studentId)).size === students.length);
  check('a teaching-assistant row never carries an admin role',
    staff.every((entry) => !['admin', 'superAdmin'].includes(entry.role)));

  if (!live) {
    console.log('\n[4] Re-running the import');
    const before = roster.length;
    const second = await importRosterDocument(payload, { store });
    const after = await store.listRoster();
    check('a second import creates no group', second.groupsCreated === 0, `${second.groupsCreated} created`);
    check('a second import creates no allow-list row', after.length === before, `${before} -> ${after.length}`);
    check('a second import reports the same counts',
      second.students === summary.students && second.staff === summary.staff && second.groups === summary.groups);
    check('no duplicate email appeared after the second import',
      new Set(after.map((entry) => entry.email)).size === after.length);

    console.log('\n[5] An import never touches accounts');
    const accounts = await store.listUsers();
    check('import did not create or modify accounts', accounts.length === 0, `${accounts.length} accounts`);
  }

  console.log(`\nRoster totals: ${payload.groups.length} groups, ${payload.students.length} students, ${printed.size} teaching assistants.`);
  console.log(`${passed} checks passed, ${failures.length} failed.`);
  if (failures.length) {
    console.log('Failed checks:');
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('Roster verification passed.');
  }
}

main()
  .catch((error) => {
    console.error(`Roster verification failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await close();
    } catch {
      /* already failing */
    }
    if (!live && config.dataDir) fs.rmSync(config.dataDir, { recursive: true, force: true });
  });
