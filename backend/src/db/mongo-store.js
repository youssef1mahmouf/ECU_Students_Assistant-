'use strict';
/**
 * MongoDB adapter (MongoDB Atlas via the existing backend/config/db.js driver).
 * Every query is a driver filter document - values are bound by the driver, never
 * concatenated into a query string, so there is no injection surface. Field names used
 * here come from server code only, never from request bodies.
 * config/db.js is required lazily so a credential-less local run never touches it.
 */
const crypto = require('crypto');

const COLLECTIONS = {
  users: 'users',
  roster: 'authorizedStudents',
  groups: 'groups',
  records: 'records',
  documents: 'documents',
  subjects: 'subjects',
  activity: 'activity',
  sessions: 'sessions',
  problems: 'problems',
  emailVerifications: 'emailVerifications',
  info: 'appInfo',
};

/* Indexes are created on start-up so uniqueness is enforced by the database itself,
   not only by the code path that happened to write the record. */
const INDEXES = [
  ['users', { email: 1 }, { unique: true, name: 'users_email_unique' }],
  ['roster', { email: 1 }, { unique: true, name: 'roster_email_unique' }],
  ['groups', { name: 1 }, { unique: true, name: 'groups_name_unique' }],
  ['subjects', { slug: 1 }, { unique: true, name: 'subjects_slug_unique' }],
  ['documents', { group: 1, subject: 1 }, { name: 'documents_group_subject' }],
  ['documents', { published: 1 }, { name: 'documents_published' }],
  ['records', { group: 1, published: 1 }, { name: 'records_group_published' }],
  ['sessions', { id: 1 }, { unique: true, name: 'sessions_id_unique' }],
  ['sessions', { userId: 1 }, { name: 'sessions_user' }],
  ['sessions', { expiresAt: 1 }, { name: 'sessions_expiry' }],
  ['emailVerifications', { email: 1 }, { unique: true, name: 'email_verifications_email_unique' }],
];

let db = null;

async function init() {
  if (db) return db;
  const { connectToDatabase } = require('../../config/db');
  db = await connectToDatabase();
  for (const [name, keys, options] of INDEXES) {
    await db.collection(COLLECTIONS[name]).createIndex(keys, options);
  }
  await repairSessions();
  return db;
}

/**
 * Removes session rows written before `createSession` persisted the `id`. Those rows are
 * unusable (nothing can present the secret that matches them) and they hold the single null
 * slot in the unique id index, which is what makes every new sign-in fail with E11000.
 */
async function repairSessions() {
  const removed = await db.collection(COLLECTIONS.sessions)
    .deleteMany({ $or: [{ id: { $exists: false } }, { id: null }, { id: '' }] });
  if (removed.deletedCount) {
    console.log(`[store] removed ${removed.deletedCount} session row(s) missing an id.`);
  }
}


const col = (name) => db.collection(COLLECTIONS[name]);
const toDto = (doc) => {
  if (!doc) return undefined;
  const { _id, ...rest } = doc;
  return { id: String(_id), ...rest };
};
const stripId = ({ id, ...rest }) => rest;
const newId = () => crypto.randomUUID();

module.exports = {
  kind: 'mongo',
  init,
  async close() {
    const { closeDatabase } = require('../../config/db');
    await closeDatabase();
    db = null;
  },

  async listUsers() {
    return (await col('users').find({}).toArray()).map(toDto);
  },
  async findUserByEmail(email) {
    return toDto(await col('users').findOne({ email }));
  },
  async findUserById(id) {
    return toDto(await col('users').findOne({ id }));
  },
  async createUser(user) {
    const doc = { id: newId(), createdAt: new Date().toISOString(), ...stripId(user) };
    await col('users').insertOne(doc);
    return toDto(doc);
  },
  async updateUser(id, patch) {
    const doc = await col('users').findOneAndUpdate(
      { id },
      { $set: { ...stripId(patch), updatedAt: new Date().toISOString() } },
      { returnDocument: 'after' }
    );
    return toDto(doc);
  },
  async deleteUser(id) {
    const result = await col('users').deleteOne({ id });
    await col('sessions').deleteMany({ userId: id });
    return result.deletedCount > 0;
  },

  async listRoster() {
    return (await col('roster').find({}).sort({ email: 1 }).toArray()).map(toDto);
  },
  async findRosterByEmail(email) {
    return toDto(await col('roster').findOne({ email }));
  },
  async importRoster(students) {
    if (!students.length) return 0;
    const now = new Date().toISOString();

    const operations = students.map((student) => ({
      updateOne: {
        filter: { email: student.email },
        update: {
          $set: { ...student, updatedAt: now },
          $setOnInsert: { id: newId(), createdAt: now },
        },
        upsert: true,
      },
    }));
    await col('roster').bulkWrite(operations, { ordered: true });
    return students.length;
  },
  /* Mirror of the file store: maintenance only, the official rows return on re-import. */
  async deleteRosterByEmail(email) {
    const result = await col('roster').deleteMany({ email });
    return result.deletedCount > 0;
  },

  async listGroups() {
    return (await col('groups').find({}).sort({ name: 1 }).toArray()).map(toDto);
  },
  async findGroupByName(name) {
    return toDto(await col('groups').findOne({ name }));
  },
  async findGroupById(id) {
    return toDto(await col('groups').findOne({ id }));
  },
  async createGroup(group) {
    const doc = { id: newId(), createdAt: new Date().toISOString(), ...stripId(group) };
    await col('groups').insertOne(doc);
    return toDto(doc);
  },
  async updateGroup(id, patch) {
    const doc = await col('groups').findOneAndUpdate(
      { id },
      { $set: { ...stripId(patch), updatedAt: new Date().toISOString() } },
      { returnDocument: 'after' }
    );
    return toDto(doc);
  },
  async deleteGroup(id) {
    const result = await col('groups').deleteOne({ id });
    return result.deletedCount > 0;
  },

  /* --------------------------------------------------------------- subjects */
  async listSubjects() {
    return (await col('subjects').find({}).sort({ nameEn: 1 }).toArray()).map(toDto);
  },
  async findSubjectBySlug(slug) {
    return toDto(await col('subjects').findOne({ slug }));
  },
  async findSubjectById(id) {
    return toDto(await col('subjects').findOne({ id }));
  },
  async createSubject(subject) {
    const doc = { id: newId(), createdAt: new Date().toISOString(), ...stripId(subject) };
    await col('subjects').insertOne(doc);
    return toDto(doc);
  },
  async updateSubject(id, patch) {
    const doc = await col('subjects').findOneAndUpdate(
      { id },
      { $set: { ...stripId(patch), updatedAt: new Date().toISOString() } },
      { returnDocument: 'after' }
    );
    return toDto(doc);
  },
  async deleteSubject(id) {
    const result = await col('subjects').deleteOne({ id });
    return result.deletedCount > 0;
  },

  /* -------------------------------------------------------------- documents */
  async listDocuments(filter = {}) {
    const query = {};
    // Multi-group rows store `groups: []`; legacy rows only have `group`. The $or keeps
    // both shapes readable (a mongo array field matches on its contained value).
    if (filter.group) query.$or = [{ groups: filter.group }, { group: filter.group }];
    if (filter.subject) query.subject = filter.subject;
    if (filter.publishedOnly) query.published = true;
    return (await col('documents').find(query).sort({ createdAt: -1 }).toArray()).map(toDto);
  },
  async findDocumentById(id) {
    return toDto(await col('documents').findOne({ id }));
  },
  async createDocument(document) {
    const doc = { id: newId(), createdAt: new Date().toISOString(), ...stripId(document) };
    await col('documents').insertOne(doc);
    return toDto(doc);
  },
  async updateDocument(id, patch) {
    const doc = await col('documents').findOneAndUpdate(
      { id },
      { $set: { ...stripId(patch), updatedAt: new Date().toISOString() } },
      { returnDocument: 'after' }
    );
    return toDto(doc);
  },
  async deleteDocument(id) {
    const result = await col('documents').deleteOne({ id });
    return result.deletedCount > 0;
  },

  async listRecords(filter = {}) {
    const query = {};
    // See listDocuments: `groups` (new) OR `group` (legacy) must contain the name.
    if (filter.group) query.$or = [{ groups: filter.group }, { group: filter.group }];
    if (filter.publishedOnly) query.published = true;
    return (await col('records').find(query).sort({ createdAt: -1 }).toArray()).map(toDto);
  },
  async findRecordById(id) {
    return toDto(await col('records').findOne({ id }));
  },
  async createRecord(record) {
    const doc = { id: newId(), createdAt: new Date().toISOString(), ...stripId(record) };
    await col('records').insertOne(doc);
    return toDto(doc);
  },
  async updateRecord(id, patch) {
    const doc = await col('records').findOneAndUpdate(
      { id },
      { $set: { ...stripId(patch), updatedAt: new Date().toISOString() } },
      { returnDocument: 'after' }
    );
    return toDto(doc);
  },
  async deleteRecord(id) {
    const result = await col('records').deleteOne({ id });
    return result.deletedCount > 0;
  },

  async listActivity({ limit = 100 } = {}) {
    return (await col('activity').find({}).sort({ createdAt: -1 }).limit(limit).toArray()).map(toDto);
  },
  async createActivity(entry) {
    const doc = { id: newId(), createdAt: new Date().toISOString(), ...stripId(entry) };
    await col('activity').insertOne(doc);
    return toDto(doc);
  },

  /* A session row carries two identifiers: Mongo's own _id, and the opaque `id` that is the
     public half of the session token. The id must therefore be PERSISTED - stripping it (as the
     other collections do, where `id` is the caller's placeholder) left the field missing, so the
     unique index read every row as null: the first sign-in stored a ghost row and every later
     one failed with E11000, and findSession could never match anything. */
  async createSession(session) {
    await col('sessions').insertOne({ ...session });
    return toDto({ _id: session.id, ...session });
  },
  async findSession(id) {
    return toDto(await col('sessions').findOne({ id }));
  },
  async updateSession(id, patch) {
    const doc = await col('sessions').findOneAndUpdate({ id }, { $set: stripId(patch) }, { returnDocument: 'after' });
    return toDto(doc);
  },
  async deleteSession(id) {
    await col('sessions').deleteOne({ id });
  },
  async deleteSessionsForUser(userId) {
    await col('sessions').deleteMany({ userId });
  },
  async pruneSessions() {
    await col('sessions').deleteMany({ expiresAt: { $lt: new Date().toISOString() } });
  },
  /* Sessions seen at or after `since` - the data source for the dashboard's online count. */
  async findRecentSessions(since) {
    return (await col('sessions').find({ lastSeenAt: { $gte: since } }).toArray()).map(toDto);
  },

  /* --------------------------------------------------------------- problems */
  async listProblems({ limit = 500 } = {}) {
    return (await col('problems').find({}).sort({ createdAt: -1 }).limit(limit).toArray()).map(toDto);
  },
  async findProblemById(id) {
    return toDto(await col('problems').findOne({ id }));
  },
  async createProblem(problem) {
    const doc = { id: newId(), createdAt: new Date().toISOString(), ...stripId(problem) };
    await col('problems').insertOne(doc);
    return toDto(doc);
  },
  async updateProblem(id, patch) {
    const doc = await col('problems').findOneAndUpdate(
      { id },
      { $set: { ...stripId(patch), updatedAt: new Date().toISOString() } },
      { returnDocument: 'after' }
    );
    return toDto(doc);
  },

  async findEmailVerification(email) {
    return toDto(await col('emailVerifications').findOne({ email }));
  },
  async saveEmailVerification(email, challenge) {
    const doc = { id: newId(), email, ...challenge };
    await col('emailVerifications').replaceOne({ email }, doc, { upsert: true });
    return toDto(doc);
  },
  async updateEmailVerification(email, patch) {
    const doc = await col('emailVerifications').findOneAndUpdate(
      { email }, { $set: { ...stripId(patch), updatedAt: new Date().toISOString() } }, { returnDocument: 'after' }
    );
    return toDto(doc);
  },
  async deleteEmailVerification(email) {
    const result = await col('emailVerifications').deleteOne({ email });
    return result.deletedCount > 0;
  },

  async getInfo() {
    const doc = await col('info').findOne({ key: 'site' });
    const { _id, key, ...rest } = doc || {};
    return rest || {};
  },
  async saveInfo(patch) {
    const doc = await col('info').findOneAndUpdate(
      { key: 'site' },
      { $set: { ...patch, updatedAt: new Date().toISOString() } },
      { upsert: true, returnDocument: 'after' }
    );
    const { _id, key, ...rest } = doc || {};
    return rest;
  },
};
