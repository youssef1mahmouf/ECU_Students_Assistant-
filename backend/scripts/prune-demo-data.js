'use strict';
/**
 * Prune invented data: demo accounts and groups the official group PDFs never mention.
 *
 * What counts as invented:
 *   - accounts: every account except those named by --keep= (default: ADMIN_BOOTSTRAP_EMAIL);
 *   - groups: every group the authorised roster does not name. The roster holds only rows
 *     imported from the official PDFs (GA-x / GB-x), so "Group 1", "Group 2", "Group 3" -
 *     what `npm run seed -- --with-demo` creates - have no real students and go, together
 *     with their content records, document rows and storage folder;
 *   - roster rows whose source is 'seed-demo'. PDF rows are never touched.
 *
 * Dry run by default: nothing is written until you add --apply.
 *
 *   npm run prune:demo                                       # report only
 *   npm run prune:demo -- --apply                            # delete
 *   npm run prune:demo -- --keep=192600250@ecu.edu.eg --apply
 *   npm run prune:demo -- --keep-group=Group 1               # pin a group outside the PDFs
 *   npm run prune:demo -- --store=file --apply
 *
 * Refuses to run when no active super admin would survive the purge, when nothing is pinned
 * with --keep, or when a doomed group shares its storage folder with a group that stays.
 */
const fsp = require('fs/promises');
const path = require('path');

const args = process.argv.slice(2);
const has = (name) => args.includes(`--${name}`);
const valueOf = (name) => {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3).trim() : '';
};
const listValue = (name) => valueOf(name).split(',').map((entry) => entry.trim()).filter(Boolean);

const storeFlag = args.find((arg) => arg.startsWith('--store='));
if (storeFlag) process.env.DATA_STORE = storeFlag.split('=')[1];

const config = require('../src/config/env');
const { store, kind, init, close } = require('../src/db/store');
const { safeSegment } = require('../src/services/documents');

const DEMO_SOURCE = 'seed-demo';
const slugOf = (name) => safeSegment(name, '');

/** Delete storage/<slug of a removed group> only when it provably belongs to that group. */
async function removeGroupFolder(groupName, keptSlugs) {
  const slug = slugOf(groupName);
  if (!slug) return { removed: false, slug, reason: 'no folder name can be derived' };
  if (keptSlugs.has(slug)) return { removed: false, slug, reason: 'shared with a group you keep' };
  const root = path.resolve(config.upload.dir);
  const target = path.resolve(root, slug);
  // Only ever a direct child of the storage root - never a nested or absolute path.
  if (path.dirname(target) !== root) return { removed: false, slug, reason: 'outside the storage root' };
  const entries = await fsp.readdir(target).catch(() => null);
  if (entries === null) return { removed: false, slug, reason: 'no folder exists' };
  await fsp.rm(target, { recursive: true, force: true });
  return { removed: true, slug, entries: entries.length };
}

async function main() {
  const apply = has('apply');
  const keepEmails = (listValue('keep').length ? listValue('keep') : [config.adminBootstrap.email])
    .filter(Boolean)
    .map((email) => email.toLowerCase());
  const pinned = new Set(listValue('keep-group'));

  await init();

  const users = await store.listUsers();
  const groups = await store.listGroups();
  const roster = await store.listRoster();

  const keep = new Set(keepEmails);
  const keptUsers = users.filter((user) => keep.has(String(user.email || '').toLowerCase()));
  const doomedUsers = users.filter((user) => !keep.has(String(user.email || '').toLowerCase()));

  const rosterGroups = new Set(roster.map((row) => String(row.group || '').trim()).filter(Boolean));
  const doomedGroups = groups.filter(
    (group) => !rosterGroups.has(String(group.name || '').trim()) && !pinned.has(group.name)
  );
  const keptSlugs = new Set(
    groups.filter((group) => !doomedGroups.includes(group)).map((group) => slugOf(group.name))
  );
  const demoRoster = roster.filter((row) => String(row.source || '').toLowerCase() === DEMO_SOURCE);

  /* ------------------------------------------------------------- guard rails */
  const survivingSupers = keptUsers.filter((user) => user.role === 'superAdmin' && user.active !== false);
  const losingSupers = doomedUsers.filter((user) => user.role === 'superAdmin' && user.active !== false);
  if (losingSupers.length > 0 && survivingSupers.length === 0) {
    throw new Error('Refusing to run: the purge would leave no active super admin. Use --keep=<email>.');
  }
  if (keep.size === 0) {
    throw new Error('Refusing to run: nothing is pinned with --keep and no ADMIN_BOOTSTRAP_EMAIL is set.');
  }

  const doomedGroupNames = new Set(doomedGroups.map((group) => group.name));
  const belongsToDoomed = (row) => {
    const names = Array.isArray(row.groups) && row.groups.length
      ? row.groups
      : [row.group].filter(Boolean);
    return names.some((name) => doomedGroupNames.has(name));
  };
  const doomedRecords = (await store.listRecords()).filter(belongsToDoomed);
  const doomedDocuments = (await store.listDocuments()).filter(belongsToDoomed);

  const plan = {
    store: kind,
    apply,
    keep: [...keep],
    users: doomedUsers.map((user) => user.email),
    groups: doomedGroups.map((group) => group.name),
    records: doomedRecords.length,
    documents: doomedDocuments.length,
    rosterRows: demoRoster.length,
  };
  console.log(JSON.stringify(plan, null, 2));
  if (!apply) {
    console.log('Dry run only - re-run with --apply to delete.');
    await close();
    return;
  }

  /* ------------------------------------------------------------------ delete */
  for (const record of doomedRecords) await store.deleteRecord(record.id);
  for (const document of doomedDocuments) {
    await store.deleteDocument(document.id);
    const { removeDocumentFile } = require('../src/services/documents');
    await removeDocumentFile(document.storageKey).catch(() => {});
  }
  for (const group of doomedGroups) {
    await store.deleteGroup(group.id);
    const folder = await removeGroupFolder(group.name, keptSlugs);
    if (folder.removed) console.log(`removed storage/${folder.slug} (${folder.entries} entries)`);
    else console.log(`kept storage/${folder.slug}: ${folder.reason}`);
  }
  for (const user of doomedUsers) {
    await store.deleteUser(user.id);
    if (typeof store.deleteActivityByActor === 'function') {
      await store.deleteActivityByActor(user.name).catch(() => {});
    }
  }
  for (const row of demoRoster) await store.deleteRosterByEmail(row.email);

  console.log(
    `Pruned ${plan.users.length} account(s), ${plan.groups.length} group(s), ` +
      `${plan.records} record(s), ${plan.documents} document(s), ${plan.rosterRows} demo roster row(s).`
  );
  await close();
}

main().catch((error) => {
  console.error(`prune:demo failed: ${error.message}`);
  process.exitCode = 1;
});
