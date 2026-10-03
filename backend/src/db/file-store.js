'use strict';
/**
 * Local JSON store - one file per section under backend/data_base.
 * Used when no Atlas credentials are configured, or when DATA_STORE=file. Keeps the
 * project runnable/verifiable offline. Same interface as the Mongo adapter.
 *
 * Each section lives in its own file (users.json, groups.json, ...) so a single record can be
 * read or repaired without touching the rest of the data, and so two sections can never
 * corrupt each other. Every write is serialised and atomic (temp file + rename per file), so
 * a crash can never leave a half-written section.
 *
 * A legacy single db.json is migrated once, automatically, on first load; it is then left
 * untouched as a backup and is never read again.
 */
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const config = require('../config/env');
const { inGroups } = require('../lib/groups');

const LEGACY_FILE = path.join(config.dataDir, 'db.json');
const EMPTY = {
  users: [],
  groups: [],
  records: [],
  documents: [],
  subjects: [],
  activity: [],
  sessions: [],
  roster: [],
  problems: [],
  emailVerifications: [],
  info: {},
};
/* Only these keys are lists; `info` is a single object and must not be array-normalised. */
const LIST_KEYS = ['users', 'groups', 'records', 'documents', 'subjects', 'activity', 'sessions', 'roster', 'problems', 'emailVerifications'];
/* Section name -> file name. emailVerifications is the one key that is not a valid stem. */
const FILES = {
  users: 'users.json',
  groups: 'groups.json',
  records: 'records.json',
  documents: 'documents.json',
  subjects: 'subjects.json',
  activity: 'activity.json',
  sessions: 'sessions.json',
  roster: 'roster.json',
  problems: 'problems.json',
  emailVerifications: 'email-verifications.json',
  info: 'info.json',
};
const sectionFile = (key) => path.join(config.dataDir, FILES[key]);

let cache = null;
let queue = Promise.resolve();

const newId = () => crypto.randomUUID();
const clone = (value) => (value === undefined ? undefined : structuredClone(value));

/** Atomic single-file write: temp file then rename, so readers never see a partial file. */
async function writeSection(key, value) {
  const target = sectionFile(key);
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
  await fs.rename(tmp, target);
}

async function readSection(key) {
  try {
    return JSON.parse(await fs.readFile(sectionFile(key), 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return undefined;
  }
}

/**
 * One-time split of the old single db.json. Existing sections are never overwritten, so a
 * half-finished migration resumes where it stopped instead of discarding newer rows.
 */
async function migrateLegacy() {
  let legacy;
  try {
    legacy = JSON.parse(await fs.readFile(LEGACY_FILE, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
  let moved = 0;
  for (const key of Object.keys(EMPTY)) {
    if (legacy[key] === undefined) continue;
    if ((await readSection(key)) !== undefined) continue;
    await writeSection(key, legacy[key]);
    moved += 1;
  }
  if (moved) console.log(`[file-store] migrated ${moved} section(s) out of db.json into ${config.dataDir}.`);
  return moved > 0;
}

async function load() {
  if (cache) return cache;
  await fs.mkdir(config.dataDir, { recursive: true });
  await migrateLegacy();
  cache = structuredClone(EMPTY);
  for (const key of Object.keys(EMPTY)) {
    const stored = await readSection(key);
    if (stored !== undefined) cache[key] = stored;
  }
  for (const key of LIST_KEYS) if (!Array.isArray(cache[key])) cache[key] = [];
  if (!cache.info || typeof cache.info !== 'object' || Array.isArray(cache.info)) cache.info = {};
  return cache;
}

/**
 * Serialise every section once so persist() can tell exactly which ones a transaction
 * touched. Rewriting the whole store on every write (the roster alone is hundreds of KB)
 * made the server unresponsive under normal activity logging.
 */
function snapshotSections() {
  const before = new Map();
  for (const key of Object.keys(EMPTY)) before.set(key, JSON.stringify(cache[key]));
  return before;
}

async function persist(previous) {
  for (const key of Object.keys(EMPTY)) {
    if (cache[key] === undefined) continue;
    const serialised = JSON.stringify(cache[key]);
    // No previous snapshot (first write after boot) means write everything once.
    if (previous && previous.get(key) === serialised) continue;
    await writeSection(key, cache[key]);
  }
}

function tx(mutator) {
  const run = async () => {
    const storage = await load();
    const previous = snapshotSections();
    const result = await mutator(storage);
    await persist(previous);
    return result;
  };
  queue = queue.then(run, run);
  return queue;
}

module.exports = {
  kind: 'file',
  async init() {
    await load();
    await persist();
  },
  async close() {},

  async listUsers() {
    return clone((await load()).users);
  },
  async findUserByEmail(email) {
    return clone((await load()).users.find((user) => user.email === email));
  },
  async findUserById(id) {
    return clone((await load()).users.find((user) => user.id === id));
  },
  async createUser(user) {
    return tx((storage) => {
      const record = { id: newId(), createdAt: new Date().toISOString(), ...user };
      storage.users.push(record);
      return clone(record);
    });
  },
  async updateUser(id, patch) {
    return tx((storage) => {
      const user = storage.users.find((item) => item.id === id);
      if (!user) return undefined;
      Object.assign(user, patch, { updatedAt: new Date().toISOString() });
      return clone(user);
    });
  },
  async deleteUser(id) {
    return tx((storage) => {
      const before = storage.users.length;
      storage.users = storage.users.filter((user) => user.id !== id);
      storage.sessions = storage.sessions.filter((session) => session.userId !== id);
      return storage.users.length < before;
    });
  },

  async listRoster() {
    return clone((await load()).roster);
  },
  async findRosterByEmail(email) {
    return clone((await load()).roster.find((student) => student.email === email));
  },
  async importRoster(students) {
    return tx((storage) => {
      const byEmail = new Map(storage.roster.map((student) => [student.email, student]));
      const now = new Date().toISOString();
      for (const student of students) {
        const existing = byEmail.get(student.email);
        byEmail.set(student.email, {
          ...existing,
          ...student,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        });
      }
      storage.roster = [...byEmail.values()];
      return students.length;
    });
  },
  /* A roster row is an allow-list entry. Removing one is only ever a maintenance action
     (dropping invented demo rows); the official rows come back on the next PDF import. */
  async deleteRosterByEmail(email) {
    return tx((storage) => {
      const before = storage.roster.length;
      storage.roster = storage.roster.filter((student) => student.email !== email);
      return storage.roster.length < before;
    });
  },

  async listGroups() {
    const storage = await load();
    return clone([...storage.groups].sort((a, b) => a.name.localeCompare(b.name)));
  },
  async findGroupByName(name) {
    return clone((await load()).groups.find((group) => group.name === name));
  },
  async findGroupById(id) {
    return clone((await load()).groups.find((group) => group.id === id));
  },
  async createGroup(group) {
    return tx((storage) => {
      const record = { id: newId(), createdAt: new Date().toISOString(), ...group };
      storage.groups.push(record);
      return clone(record);
    });
  },
  async updateGroup(id, patch) {
    return tx((storage) => {
      const group = storage.groups.find((item) => item.id === id);
      if (!group) return undefined;
      Object.assign(group, patch, { updatedAt: new Date().toISOString() });
      return clone(group);
    });
  },
  async deleteGroup(id) {
    return tx((storage) => {
      const before = storage.groups.length;
      storage.groups = storage.groups.filter((group) => group.id !== id);
      return storage.groups.length < before;
    });
  },

  /* --------------------------------------------------------------- subjects */
  async listSubjects() {
    return clone((await load()).subjects);
  },
  async findSubjectBySlug(slug) {
    return clone((await load()).subjects.find((subject) => subject.slug === slug));
  },
  async findSubjectById(id) {
    return clone((await load()).subjects.find((subject) => subject.id === id));
  },
  async createSubject(subject) {
    return tx((storage) => {
      const created = { id: newId(), createdAt: new Date().toISOString(), ...subject };
      storage.subjects.push(created);
      return clone(created);
    });
  },
  async updateSubject(id, patch) {
    return tx((storage) => {
      const subject = storage.subjects.find((item) => item.id === id);
      if (!subject) return undefined;
      Object.assign(subject, patch, { updatedAt: new Date().toISOString() });
      return clone(subject);
    });
  },
  async deleteSubject(id) {
    return tx((storage) => {
      const before = storage.subjects.length;
      storage.subjects = storage.subjects.filter((subject) => subject.id !== id);
      return storage.subjects.length < before;
    });
  },

  /* -------------------------------------------------------------- documents */
  async listDocuments(filter = {}) {
    const storage = await load();
    const rows = storage.documents.filter((document) => {
      // Multi-group rows are matched through lib/groups (legacy single `group` included).
      if (filter.group && !inGroups(document, filter.group)) return false;
      if (filter.subject && document.subject !== filter.subject) return false;
      if (filter.publishedOnly && !document.published) return false;
      return true;
    });
    return clone(rows).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  },
  async findDocumentById(id) {
    return clone((await load()).documents.find((document) => document.id === id));
  },
  async createDocument(document) {
    return tx((storage) => {
      const created = { id: newId(), createdAt: new Date().toISOString(), ...document };
      storage.documents.push(created);
      return clone(created);
    });
  },
  async updateDocument(id, patch) {
    return tx((storage) => {
      const document = storage.documents.find((item) => item.id === id);
      if (!document) return undefined;
      Object.assign(document, patch, { updatedAt: new Date().toISOString() });
      return clone(document);
    });
  },
  async deleteDocument(id) {
    return tx((storage) => {
      const before = storage.documents.length;
      storage.documents = storage.documents.filter((document) => document.id !== id);
      return storage.documents.length < before;
    });
  },

  async listRecords(filter = {}) {
    const storage = await load();
    const rows = storage.records.filter((record) => {
      if (filter.group && !inGroups(record, filter.group)) return false;
      if (filter.publishedOnly && !record.published) return false;
      return true;
    });
    return clone(rows).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  },
  async findRecordById(id) {
    return clone((await load()).records.find((record) => record.id === id));
  },
  async createRecord(record) {
    return tx((storage) => {
      const created = { id: newId(), createdAt: new Date().toISOString(), ...record };
      storage.records.push(created);
      return clone(created);
    });
  },
  async updateRecord(id, patch) {
    return tx((storage) => {
      const record = storage.records.find((item) => item.id === id);
      if (!record) return undefined;
      Object.assign(record, patch, { updatedAt: new Date().toISOString() });
      return clone(record);
    });
  },
  async deleteRecord(id) {
    return tx((storage) => {
      const before = storage.records.length;
      storage.records = storage.records.filter((record) => record.id !== id);
      return storage.records.length < before;
    });
  },

  async listActivity({ limit = 100 } = {}) {
    const storage = await load();
    return clone(
      [...storage.activity]
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, limit)
    );
  },
  async createActivity(entry) {
    return tx((storage) => {
      const created = { id: newId(), createdAt: new Date().toISOString(), ...entry };
      storage.activity.push(created);
      // Bounded log; page-visit entries are deduplicated before they ever get here.
      if (storage.activity.length > 5000) storage.activity = storage.activity.slice(-5000);
      return clone(created);
    });
  },
  /* Drop the log lines a removed account produced, so invented demo identities do not keep
     showing up on the dashboard. Returns how many entries were removed. */
  async deleteActivityByActor(actor) {
    return tx((storage) => {
      const before = storage.activity.length;
      storage.activity = storage.activity.filter((entry) => entry.actor !== actor);
      return before - storage.activity.length;
    });
  },

  async createSession(session) {
    return tx((storage) => {
      const created = { ...session };
      storage.sessions.push(created);
      return clone(created);
    });
  },
  async findSession(id) {
    return clone((await load()).sessions.find((session) => session.id === id));
  },
  async updateSession(id, patch) {
    return tx((storage) => {
      const session = storage.sessions.find((item) => item.id === id);
      if (!session) return undefined;
      Object.assign(session, patch);
      return clone(session);
    });
  },
  async deleteSession(id) {
    return tx((storage) => {
      storage.sessions = storage.sessions.filter((session) => session.id !== id);
    });
  },
  async deleteSessionsForUser(userId) {
    return tx((storage) => {
      storage.sessions = storage.sessions.filter((session) => session.userId !== userId);
    });
  },
  async pruneSessions() {
    const now = Date.now();
    return tx((storage) => {
      storage.sessions = storage.sessions.filter((session) => new Date(session.expiresAt).getTime() > now);
    });
  },
  /* Sessions seen at or after `since` - the data source for the dashboard's online count. */
  async findRecentSessions(since) {
    const storage = await load();
    return clone(storage.sessions.filter((session) => String(session.lastSeenAt || session.createdAt) >= since));
  },

  /* --------------------------------------------------------------- problems */
  async listProblems({ limit = 500 } = {}) {
    const storage = await load();
    return clone(
      [...storage.problems]
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, limit)
    );
  },
  async findProblemById(id) {
    return clone((await load()).problems.find((problem) => problem.id === id));
  },
  async createProblem(problem) {
    return tx((storage) => {
      const created = { id: newId(), createdAt: new Date().toISOString(), ...problem };
      storage.problems.push(created);
      return clone(created);
    });
  },
  async updateProblem(id, patch) {
    return tx((storage) => {
      const problem = storage.problems.find((item) => item.id === id);
      if (!problem) return undefined;
      Object.assign(problem, patch, { updatedAt: new Date().toISOString() });
      return clone(problem);
    });
  },

  async findEmailVerification(email) {
    return clone((await load()).emailVerifications.find((item) => item.email === email));
  },
  async saveEmailVerification(email, challenge) {
    return tx((storage) => {
      storage.emailVerifications = storage.emailVerifications.filter((item) => item.email !== email);
      const saved = { id: newId(), email, ...challenge };
      storage.emailVerifications.push(saved);
      return clone(saved);
    });
  },
  async updateEmailVerification(email, patch) {
    return tx((storage) => {
      const item = storage.emailVerifications.find((row) => row.email === email);
      if (!item) return undefined;
      Object.assign(item, patch, { updatedAt: new Date().toISOString() });
      return clone(item);
    });
  },
  async deleteEmailVerification(email) {
    return tx((storage) => {
      const before = storage.emailVerifications.length;
      storage.emailVerifications = storage.emailVerifications.filter((item) => item.email !== email);
      return before !== storage.emailVerifications.length;
    });
  },

  async getInfo() {
    return clone((await load()).info) || {};
  },
  async saveInfo(patch) {
    return tx((storage) => {
      storage.info = { ...storage.info, ...patch, updatedAt: new Date().toISOString() };
      return clone(storage.info);
    });
  },
};
