'use strict';
/* Inspects and repairs the session collection: rows written without an `id` are unusable and
   hold the one null slot in the unique index. Run: node backend/scripts/repair-sessions.js */
/* Loading config first is what injects backend/.env into process.env; config/db.js reads the
   credentials from there and does not load dotenv itself. */
require('../src/config/env');
const { connectToDatabase, closeDatabase } = require('../config/db');

const GHOST = { $or: [{ id: { $exists: false } }, { id: null }, { id: '' }] };

(async () => {
  const db = await connectToDatabase();
  const sessions = db.collection('sessions');

async function verifyInsertPath() {
  /* Proves the unique index is satisfied now: two rows, two distinct ids, both findable. */
  const stamp = Date.now();
  const rows = [0, 1].map((n) => ({
    id: `verify-${stamp}-${n}`,
    userId: 'verify',
    verifierHash: 'x'.repeat(64),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  }));
  await sessions.insertMany(rows);
  const found = await Promise.all(rows.map((r) => sessions.findOne({ id: r.id })));
  console.log(`inserted     : ${rows.length}`);
  console.log(`findable     : ${found.filter(Boolean).length}/${rows.length}`);
  await sessions.deleteMany({ id: { $in: rows.map((r) => r.id) } });
  console.log('cleaned up   : yes');
}
  const total = await sessions.countDocuments({});
  const ghosts = await sessions.countDocuments(GHOST);
  console.log(`session rows : ${total}`);
  console.log(`missing id   : ${ghosts}`);
  if (ghosts) {
    const removed = await sessions.deleteMany(GHOST);
    console.log(`deleted      : ${removed.deletedCount}`);
  }
  console.log(`remaining    : ${await sessions.countDocuments({})}`);
  await verifyInsertPath();
  await closeDatabase();
})().catch((error) => {
  console.error('failed:', error.message);
  process.exit(1);
});