'use strict';
/**
 * Local/demo seed. Never run this against a production database.
 *
 *   npm run seed                -> seeds the active store (file store by default)
 *   npm run seed -- --store=mongo
 *   npm run seed -- --with-demo -> also creates sample staff, students and content
 *
 * No privileged password is ever written into a frontend file or committed here: if
 * ADMIN_BOOTSTRAP_PASSWORD is not supplied, a strong random password is generated and
 * printed once, and saved to backend/data_base/seed-credentials.txt (git-ignored).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const args = process.argv.slice(2);
const storeFlag = args.find((arg) => arg.startsWith('--store='));
if (storeFlag) process.env.DATA_STORE = storeFlag.split('=')[1];
const withDemo = args.includes('--with-demo');

const config = require('../src/config/env');
const { store, kind, init, close } = require('../src/db/store');
const { hashPassword } = require('../src/lib/password');

const DEFAULT_GROUPS = ['Group 1', 'Group 2', 'Group 3'];

function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 18; i += 1) out += alphabet[crypto.randomInt(0, alphabet.length)];
  // Satisfy the project password policy: upper case, digit and symbol.
  return `${out.slice(0, 10)}${crypto.randomInt(10, 99)}@${out.slice(10)}`;
}

async function ensureGroup(name) {
  if (await store.findGroupByName(name)) return false;
  await store.createGroup({ name, description: '', createdBy: 'seed' });
  return true;
}

function reportCredential(label, email, password, file) {
  fs.appendFileSync(file, `${label}: ${email} / ${password}\n`, { mode: 0o600 });
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    /* Windows: inherit ACL */
  }
  console.log(`  ${label}: ${email}`);
  console.log(`    password: ${password}   (printed once - store it now)`);
}

async function main() {
  await init();
  console.log(`Seeding ${kind} store${kind === 'mongo' ? ' (MongoDB Atlas)' : ''}...`);

  for (const name of DEFAULT_GROUPS) {
    if (await ensureGroup(name)) console.log(`  + group ${name}`);
  }

  const users = await store.listUsers();
  const credentialsFile = path.join(config.dataDir, 'seed-credentials.txt');
  if (!users.some((user) => user.role === 'superAdmin')) {
    const email = config.adminBootstrap.email || 'admin@ecu.edu.eg';
    const password = process.env.ADMIN_BOOTSTRAP_PASSWORD || generatePassword();
    await store.createUser({
      name: config.adminBootstrap.name,
      email,
      passwordHash: await hashPassword(password),
      role: 'superAdmin',
      group: '',
      confirmed: true,
      active: true,
    });
    await store.createActivity({ actor: 'seed', action: 'Created the first super admin account.', level: 'admin' });
    console.log('  + super admin account');
    reportCredential('SUPER ADMIN', email, password, credentialsFile);
  } else {
    console.log('  = super admin already exists (left untouched)');
  }

  if (withDemo) {
    const staffEmail = 'staff@ecu.edu.eg';
    if (!(await store.findUserByEmail(staffEmail))) {
      const password = generatePassword();
      await store.createUser({
        name: 'Group Administrator',
        email: staffEmail,
        passwordHash: await hashPassword(password),
        role: 'admin',
        group: '',
        confirmed: true,
        active: true,
      });
      console.log('  + admin account');
      reportCredential('ADMIN', staffEmail, password, credentialsFile);
    }

    const students = [
      { name: 'Demo Student One', email: 'student1@ecu.edu.eg', group: 'Group 1' },
      { name: 'Demo Student Two', email: 'student2@ecu.edu.eg', group: 'Group 2' },
    ];
    // Sign-in now checks the authorised roster, so the demo students need roster rows too.
    // These are demo identities only: the real allow-list comes from the official PDFs.
    await store.importRoster(
      students.map((student) => ({
        email: student.email,
        name: student.name,
        studentId: '',
        group: student.group,
        type: 'student',
        academicYear: 'demo',
        advisorName: '',
        advisorEmail: '',
        source: 'seed-demo',
      }))
    );
    for (const student of students) {
      if (await store.findUserByEmail(student.email)) continue;
      const password = generatePassword();
      await store.createUser({
        name: student.name,
        email: student.email,
        passwordHash: await hashPassword(password),
        role: 'user',
        group: student.group,
        confirmed: true,
        active: true,
      });
      console.log(`  + ${student.name} (${student.group})`);
      reportCredential('STUDENT', student.email, password, credentialsFile);
    }

    if ((await store.listRecords()).length === 0) {
      await store.createRecord({
        group: 'Group 1',
        title: 'Assessment 1 - individual report',
        kind: 'Assignment',
        dueDate: '2026-11-30',
        summary: 'Public notice: assessment 1 is open for Group 1 members.',
        body: 'Submit the individual report through the group space before the deadline.',
        published: true,
        createdBy: 'seed',
      });
      await store.createRecord({
        group: 'Group 1',
        title: 'Draft marking scheme (not published)',
        kind: 'Note',
        dueDate: '',
        summary: 'Internal note visible only to staff.',
        body: 'Draft text that must never appear on a public page.',
        published: false,
        createdBy: 'seed',
      });
      console.log('  + sample assessment content (one published, one draft)');
    }
  }

  const info = await store.getInfo();
  if (!info.title) {
    await store.saveInfo({
      title: 'بوابة المجموعات',
      tagline: 'إدارة بسيطة للحسابات والمجموعات',
      about: 'منصة تقييم طلاب ECU: صفحات عامة للزوار، ومساحة للطلاب، ولوحة تحكم للإدارة.',
      notice: 'بيئة تجريبية للتطوير المحلي فقط.',
      academicYear: '2025/2026',
    });
    console.log('  + site information');
  }

  console.log('\nDone. Start the app with:  npm start');
  if (fs.existsSync(credentialsFile)) {
    console.log(`Generated credentials: ${credentialsFile} (git-ignored, delete when done)`);
  }
  await close();
}

main().catch(async (error) => {
  console.error('Seed failed:', error.message);
  try {
    await close();
  } catch {
    /* ignore */
  }
  process.exitCode = 1;
});
