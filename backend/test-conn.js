require('dotenv').config();
const { connectToDatabase, closeDatabase } = require('./config/db');
const fs = require('fs');

(async () => {
  try {
    const db = await connectToDatabase();
    const collections = await db.listCollections().toArray();
    const info = await db.admin().serverInfo();
    fs.writeFileSync(
      'test-conn.log',
      [
        'STATUS=OK',
        'DB=' + db.databaseName,
        'SERVER_VERSION=' + info.version,
        'COLLECTIONS=' + collections.length,
        'NAMES=' + (collections.map((c) => c.name).join(', ') || '(none)'),
      ].join('\n') + '\n',
      'utf8'
    );
    await closeDatabase();
    process.exit(0);
  } catch (e) {
    fs.writeFileSync('test-conn.log', 'STATUS=FAILED\n' + e.message + '\n', 'utf8');
    process.exit(1);
  }
})();
