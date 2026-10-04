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

/* The live adapter. A getter is exported below, so every module that did
   `const { store } = require('./db/store')` follows the switch. */
let active = selectAdapter();

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

  for (const record of await active.listRecords()) {
    const patch = shapePatch(record);
    if (patch) {
      await active.updateRecord(record.id, patch);
      changed += 1;
    }
  }

  for (const document of await active.listDocuments()) {
    const patch = shapePatch(document);
    if (patch) {
      await active.updateDocument(document.id, patch);
      changed += 1;
    }
  }

  for (const group of await active.listGroups()) {
    const patch = {};
    if (typeof group.notes !== 'string') patch.notes = '';
    if (!Array.isArray(group.subjects)) patch.subjects = [];
    if (Object.keys(patch).length) {
      await active.updateGroup(group.id, patch);
      changed += 1;
    }
  }

  if (changed) console.log(`[store] migrated ${changed} row(s) to the multi-group shape.`);
  return changed;
}

/**
 * Explains an Atlas connection failure in terms the operator can act on, without ever
 * printing the credential part of a URI. A TLS "alert internal error" almost always means
 * the network is intercepting or dropping port 27017, not that the password is wrong - and
 * the raw driver message ("SSL alert number 80") says neither.
 */
function explain(error) {
  const message = String((error && error.message) || '');
  const host = config.mongoHost || '(not configured)';

  if (/SSL|TLS|ssl3|tlsv1|EPROTO|handshake/i.test(message)) {
    return [
      'The TLS handshake with MongoDB Atlas failed.',
      `  host: ${host}`,
      '  This is a network problem, not a credentials problem: outbound TCP 27017 to the',
      '  Atlas shards is being intercepted or blocked (proxy, firewall, or a network that',
      '  does not allow mTLS). To work locally, set DATA_STORE to the file store:',
      '    PowerShell: $env:DATA_STORE="file"; npm start',
      '    bash:       DATA_STORE=file npm start',
    ].join('\n');
  }
  if (/getaddrinfo|ENOTFOUND|ETIMEDOUT|EAI_AGAIN/i.test(message)) {
    return [
      'The Atlas hostname could not be resolved.',
      `  host: ${host}`,
      '  Check the network, the DNS settings, and MONGODB_HOSTS in backend/.env.',
    ].join('\n');
  }
  if (/Authentication failed|auth failed|not authorized/i.test(message)) {
    return 'Atlas rejected the username or password in backend/.env.';
  }
  return message;
}

module.exports = {
  /* Getters, not values: a fallback swaps the adapter after this module is imported, and
     every consumer must see the live one. */
  get store() {
    return active;
  },
  get kind() {
    return active.kind;
  },

  async init() {
    try {
      await active.init();
    } catch (error) {
      if (active.kind !== 'mongo' || !config.mongoFallbackToFile) throw error;

      console.warn(`[store] MongoDB Atlas is configured but unreachable:\n    ${explain(error)}`);
      console.warn('[store] Falling back to the local JSON store for this process.');
      console.warn('[store] Set DATA_STORE="file" to make this explicit, or');
      console.warn('[store] MONGO_FALLBACK_TO_FILE=false to fail instead of falling back.');

      active = require('./file-store');
      await active.init();
    }
    await active.pruneSessions();
    await migrateCollections();
  },

  async close() {
    await active.close();
  },
};
