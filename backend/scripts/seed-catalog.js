'use strict';
/**
 * Catalog bootstrap: makes sure the groups from the roster and the default subject list
 * exist, so the documents area has something safe to file under.
 *
 *   npm run seed:catalog                  -> active store (file store by default)
 *   npm run seed:catalog -- --store=mongo
 *
 * It is idempotent and narrow on purpose:
 *   - groups are created only when missing, and their names come from the imported roster;
 *   - subjects are created only when their slug is free (the slug is a folder name);
 *   - no user, no password, no roster row and no document is ever written or changed.
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const storeFlag = args.find((arg) => arg.startsWith('--store='));
if (storeFlag) process.env.DATA_STORE = storeFlag.split('=')[1];

const { store, kind, init, close } = require('../src/db/store');
const { safeSegment } = require('../src/services/documents');

const CATALOG = path.join(__dirname, '..', 'config', 'subject-catalog.json');

async function ensureGroups() {
  const rosterGroups = [...new Set((await store.listRoster()).map((entry) => entry.group).filter(Boolean))].sort();
  if (!rosterGroups.length) {
    console.log('  ! no roster groups found - run npm run import:roster first');
    return { created: 0, existing: 0 };
  }
  const existing = new Set((await store.listGroups()).map((group) => group.name));
  let created = 0;
  for (const name of rosterGroups) {
    if (existing.has(name)) continue;
    await store.createGroup({ name, description: '', createdBy: 'seed-catalog' });
    created += 1;
    console.log(`  + group ${name}`);
  }
  return { created, existing: existing.size ? rosterGroups.length - created : 0 };
}

async function ensureSubjects() {
  if (!fs.existsSync(CATALOG)) {
    console.log('  ! backend/config/subject-catalog.json is missing, skipping subjects');
    return { created: 0, existing: 0 };
  }
  const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
  let created = 0;
  let existing = 0;
  for (const entry of catalog.subjects || []) {
    const slug = safeSegment(entry.slug || entry.nameEn, '');
    if (!slug) {
      console.log(`  ! skipping an entry without a usable name: ${JSON.stringify(entry)}`);
      continue;
    }
    if (await store.findSubjectBySlug(slug)) {
      existing += 1;
      continue;
    }
    await store.createSubject({
      slug,
      code: entry.code || '',
      nameEn: entry.nameEn,
      nameAr: entry.nameAr || entry.nameEn,
      description: entry.description || '',
      active: true,
      createdBy: 'seed-catalog',
    });
    created += 1;
    console.log(`  + subject ${slug} (${entry.nameEn} / ${entry.nameAr})`);
  }
  return { created, existing };
}

async function main() {
  await init();
  console.log(`Catalog bootstrap on the ${kind} store${kind === 'mongo' ? ' (MongoDB Atlas)' : ''}`);

  const groups = await ensureGroups();
  console.log(`  groups   : ${groups.created} created, ${groups.existing} already present`);

  const subjects = await ensureSubjects();
  console.log(`  subjects : ${subjects.created} created, ${subjects.existing} already present`);

  console.log(`\nStore now holds ${(await store.listGroups()).length} groups and ${(await store.listSubjects()).length} subjects.`);
  console.log('Users, passwords and the roster were not touched.');
}

main()
  .then(async () => {
    await close();
  })
  .catch(async (error) => {
    console.error('Catalog bootstrap failed:', error.message);
    try {
      await close();
    } catch {
      /* the store may never have opened */
    }
    process.exitCode = 1;
  });
