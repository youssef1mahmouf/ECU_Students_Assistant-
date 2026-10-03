'use strict';
/**
 * Owner account bootstrap - the only sanctioned way to create or update the main
 * super-admin, because it never lets a caller skip the authorised roster.
 *
 *   npm run bootstrap:owner -- --email=192600250@ecu.edu.eg --name="Youssef Mahmoud" --group=GA-6
 *   npm run bootstrap:owner -- ... --store=mongo        (once Atlas network access is open)
 *   npm run bootstrap:owner -- ... --check              (report only, writes nothing)
 *
 * The password is NEVER an argument value: it comes from ADMIN_BOOTSTRAP_PASSWORD, from a file
 * named by --password-file=<path> (only the path is an argument, never the secret), or generated
 * on request with --generate and printed once. Nothing here logs a password or a hash, and
 * nothing is written to a tracked file. Rerunning is safe:
 *   - an existing account keeps its password unless --rotate-password is passed;
 *   - role/group/name are only changed when they actually differ;
 *   - the roster row, other students and other staff are never touched.
 *
 * A file is the easiest route when editing backend/.env is awkward:
 *   npm run bootstrap:owner -- --email=... --password-file=D:\secrets\owner-pass.txt
 *   (a space in the path can be written as %20; delete the file afterwards)
 *
 * Allow-list gate: the email must exist in the imported roster, and the group must be a real
 * group that the roster assigns to that same address. If either is not true the script stops
 * and explains the mismatch - it does not create, elevate or fall back to anything.
 */
const crypto = require('crypto');
const fs = require('fs');

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const valueOf = (name) => {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`));
  if (!hit) return undefined;
  const raw = hit.slice(name.length + 3);
  /* A quoted space survives the shell as %20, and a literal space rarely survives it at all,
     so percent escapes are decoded - names like "Eng.youssef Mahmoud" stay readable. */
  if (/%[0-9A-Fa-f]{2}/.test(raw)) {
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw; // a stray % that is not an escape stays exactly as typed
    }
  }
  return raw;
};
const storeFlag = args.find((arg) => arg.startsWith('--store='));
if (storeFlag) process.env.DATA_STORE = storeFlag.split('=')[1];

const config = require('../src/config/env');
const { store, kind, init, close } = require('../src/db/store');
const { hashPassword, verifyPassword } = require('../src/lib/password');

const OWNER_ROLE = 'superAdmin';

function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 18; i += 1) out += alphabet[crypto.randomInt(0, alphabet.length)];
  // Satisfies the project password policy: upper case, digit and symbol.
  return `${out.slice(0, 10)}${crypto.randomInt(10, 99)}@${out.slice(10)}`;
}

/**
 * The secret arrives from the environment or from a file the operator owns - never as an
 * argument value, so it cannot land in shell history or a process list. Only the path is an
 * argument, and nothing here ever echoes what the file contains.
 */
function readSecret() {
  const fromEnv = process.env.ADMIN_BOOTSTRAP_PASSWORD || '';
  const filePath = String(valueOf('password-file') || '').trim();
  if (filePath && fromEnv) {
    /* backend/.env is loaded into the environment, so a stale key there must not block a run
       that deliberately names a file. The file wins; only the source is named, never a value. */
    console.log('  password src  : --password-file is used (ADMIN_BOOTSTRAP_PASSWORD is also set in .env or the environment and is ignored)');
  }
  if (!filePath) return fromEnv;
  let raw = '';
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(`--password-file could not be read (${error.code || error.message}): the secret is required, nothing was written.`);
  }
  const value = raw.trim();
  if (!value) throw new Error('--password-file is empty, so no password could be read and nothing was written.');
  return value;
}

/** `GA6` and `ga 6` are the same label as `GA-6` once punctuation is ignored - nothing more. */
function normaliseLabel(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function resolveGroup(requested, available, rosterGroup) {
  const wanted = String(requested || '').trim();
  if (!wanted) return { group: rosterGroup, notice: `No --group given, using the roster group "${rosterGroup}".` };
  if (available.includes(wanted)) {
    return { group: wanted, notice: wanted === rosterGroup ? '' : `Group "${wanted}" exists, but the roster assigns this student "${rosterGroup}".` };
  }
  const matches = available.filter((name) => normaliseLabel(name) === normaliseLabel(wanted));
  if (matches.length === 1) {
    return {
      group: matches[0],
      notice: `Requested group "${wanted}" does not exist; the only matching label is "${matches[0]}".`,
    };
  }
  const error = new Error(
    `Group "${wanted}" is not in the store (${matches.length > 1 ? `ambiguous: ${matches.join(', ')}` : 'no match'}). ` +
      `Available groups: ${available.slice(0, 24).join(', ')}${available.length > 24 ? ', ...' : ''}`
  );
  error.code = 'GROUP_UNAVAILABLE';
  throw error;
}

async function main() {
  const email = String(valueOf('email') || config.adminBootstrap.email || '').trim().toLowerCase();
  const requestedName = String(valueOf('name') || '').trim();
  const requestedGroup = String(valueOf('group') || '').trim();
  const checkOnly = flag('check');
  const rotate = flag('rotate-password');
  const generate = flag('generate');

  if (!email) throw new Error('Pass --email=name@ecu.edu.eg (or set ADMIN_BOOTSTRAP_EMAIL).');
  if (!/@ecu\.edu\.eg$/.test(email)) throw new Error(`Refusing "${email}": the portal only accepts @ecu.edu.eg addresses.`);

  const secret = readSecret();
  if (generate && secret) throw new Error('Set only one of ADMIN_BOOTSTRAP_PASSWORD / --password-file or --generate.');
  if (!checkOnly && !generate && !secret && !rotate) {
    throw new Error(
      'No password supplied. Pass --password-file=<path> holding the secret, set ADMIN_BOOTSTRAP_PASSWORD ' +
        'in the environment (the secret itself is never an argument value), pass --generate to create a ' +
        'strong one-time password, or pass --check to verify without writing.'
    );
  }
  if (secret && (secret.length < 8 || !/(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])/.test(secret))) {
    throw new Error('The supplied password does not meet the portal password policy (8+, upper case, digit, symbol).');
  }
  if (rotate && !generate && !secret) {
    throw new Error('--rotate-password needs a new password: give it with --password-file=<path> or set ADMIN_BOOTSTRAP_PASSWORD.');
  }

  await init();
  console.log(`Owner bootstrap on the ${kind} store${kind === 'mongo' ? ' (MongoDB Atlas)' : ''}${checkOnly ? ' [check only]' : ''}`);

  /* --- allow-list gate ------------------------------------------------------------- */
  const entry = await store.findRosterByEmail(email);
  if (!entry) {
    throw new Error(
      `${email} is not on the authorised roster. Import the roster first (npm run import:roster) - ` +
        'this script will not create an account outside the allow-list.'
    );
  }
  console.log(`  roster row  : ${entry.name} | group ${entry.group} | id ${entry.studentId || '-'} | ${entry.source || 'roster'} page ${entry.sourcePage || entry.page || '-'}`);

  const groups = (await store.listGroups()).map((group) => group.name);
  if (!groups.includes(entry.group)) {
    throw new Error(`The roster assigns "${entry.group}" but that group is not in the store. Run npm run import:roster to create it.`);
  }
  const resolved = resolveGroup(requestedGroup, groups, entry.group);
  if (resolved.notice) console.log(`  group notice: ${resolved.notice}`);
  if (resolved.group !== entry.group) {
    throw new Error(
      `Refusing to place ${email} in "${resolved.group}": the roster says "${entry.group}". ` +
        'Changing a rostered student group is an administrator action on that account, not a bootstrap shortcut.'
    );
  }

  const name = requestedName || entry.name;
  if (requestedName && requestedName !== entry.name) {
    console.log(`  name notice   : display name "${requestedName}" differs from the roster name "${entry.name}" (identity is matched by email).`);
  }

  /* --- create or update ------------------------------------------------------------ */
  const existing = await store.findUserByEmail(email);
  const passwordToUse = generate ? generatePassword() : secret;
  let user;
  let outcome;

  if (!existing) {
    outcome = 'created';
    user = checkOnly
      ? { name, email, role: OWNER_ROLE, group: resolved.group, confirmed: true, active: true }
      : await store.createUser({
          name,
          email,
          passwordHash: await hashPassword(passwordToUse),
          role: OWNER_ROLE,
          group: resolved.group,
          confirmed: true,
          active: true,
          staffCreated: true,
        });
    if (!checkOnly) {
      await store.createActivity({ actor: 'bootstrap-owner', action: `Bootstrapped the owner account ${email}.`, level: 'admin' });
    }
  } else {
    const patch = {};
    if (existing.role !== OWNER_ROLE) patch.role = OWNER_ROLE;
    if ((existing.group || '') !== resolved.group) patch.group = resolved.group;
    if (existing.name !== name) patch.name = name;
    if (existing.confirmed !== true) patch.confirmed = true;
    if (existing.active === false) patch.active = true;
    if (rotate && passwordToUse) patch.passwordHash = await hashPassword(passwordToUse);
    outcome = Object.keys(patch).length ? `updated (${Object.keys(patch).join(', ')})` : 'unchanged';
    user = Object.keys(patch).length && !checkOnly ? await store.updateUser(existing.id, patch) : existing;
  }

  /* --- verify, without ever printing a secret -------------------------------------- */
  const stored = checkOnly ? existing : await store.findUserByEmail(email);
  const shown = stored || user;
  console.log(`  account       : ${outcome}`);
  console.log(`  name          : ${shown.name}`);
  console.log(`  email         : ${email}`);
  console.log(`  role          : ${shown.role}`);
  console.log(`  group         : ${shown.group}`);
  console.log(`  confirmed     : ${Boolean(shown.confirmed)}`);
  if (checkOnly) {
    console.log('  password      : not read (check mode)');
  } else if (passwordToUse && (outcome === 'created' || rotate)) {
    const fresh = await store.findUserByEmail(email);
    const matches = await verifyPassword(passwordToUse, fresh.passwordHash);
    console.log(`  password      : ${matches ? 'set and verified (value not printed)' : 'NOT verified'}`);
    if (!matches) process.exitCode = 1;
    if (generate) console.log(`\n  one-time password (shown once, change it after the first sign-in):\n    ${passwordToUse}`);
  } else {
    console.log('  password      : left untouched (pass --rotate-password to change it)');
  }
  if (!checkOnly && outcome === 'created') {
    console.log('\n  Sign in at /user/signin/ or /admin/ and change the password from the profile page.');
  }
}

main()
  .then(async () => {
    await close();
  })
  .catch(async (error) => {
    console.error(`\nBootstrap stopped: ${error.message}`);
    try {
      await close();
    } catch {
      /* the store may never have opened */
    }
    process.exitCode = 1;
  });



