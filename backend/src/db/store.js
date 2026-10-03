'use strict';
/**
 * Store facade: picks the MongoDB adapter when Atlas credentials exist (or DATA_STORE=mongo)
 * and the local JSON adapter otherwise. Route code depends only on this interface.
 *
 * It also owns the shape migration run on every boot: legacy single-group records and
 * documents gain a `groups` array (the old `group` field is kept as the primary value),
 * and groups gain `notes` / `subjects` defaults. The migration only writes when something
 * changed, so re-running it costs nothing and never rewrites roster rows, accounts or
 * password hashes.
 */
const config = require('../config/env');
const { groupsOf, primaryGroup } = require('../lib/groups');

function selectAdapter() {
  if (config.dataStore === 'mongo') return require('./mongo-store');
  return require('./file-store');
}

const store = selectAdapter();

/** Compute the patch a row needs to reach the multi-group shape, or null when it is fine. */
function shapePatch(row) {
  const groups = groupsOf(row);
  const patch = {};
  if (!Array.isArray(row.groups) || row.groups.join(' ') !== groups.join(' ')) patch.groups = groups;
  if ((row.group || '') !== primaryGroup(groups)) patch.group = primaryGroup(groups);
  return Object.keys(patch).length ? patch : null;
}

async function migrateCollections() {
  let changed = 0;

  for (const record of await store.listRecords()) {
    const patch = shapePatch(record);
    if (patch) {
      await store.updateRecord(record.id, patch);
      changed += 1;
    }
  }

  for (const document of await store.listDocuments()) {
    const patch = shapePatch(document);
    if (patch) {
      await store.updateDocument(document.id, patch);
      changed += 1;
    }
  }

  for (const group of await store.listGroups()) {
    const patch = {};
    if (typeof group.notes !== 'string') patch.notes = '';
    if (!Array.isArray(group.subjects)) patch.subjects = [];
    if (Object.keys(patch).length) {
      await store.updateGroup(group.id, patch);
      changed += 1;
    }
  }

  if (changed) console.log(`[store] migrated ${changed} row(s) to the multi-group shape.`);
  return changed;
}

module.exports = {
  store,
  kind: store.kind,
  async init() {
    await store.init();
    await store.pruneSessions();
    await migrateCollections();
  },
  async close() {
    await store.close();
  },
};
