const path = require('path');
// The same file every other module reads, so this one behaves identically whether the
// process was started from the repository root or from inside backend/.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { MongoClient } = require('mongodb');

const dbName = process.env.MONGODB_DB_NAME || 'ga6';

// The mongodb+srv:// URI needs a DNS TXT lookup on the Atlas hostname. On some
// networks that lookup times out (queryTxt ETIMEOUT), so we build a standard
// mongodb:// URI listing the shard hosts directly. Same cluster, no TXT record.
const SRV_HOSTS = [
  'ac-1b1pl44-shard-00-00.htyu9f4.mongodb.net',
  'ac-1b1pl44-shard-00-01.htyu9f4.mongodb.net',
  'ac-1b1pl44-shard-00-02.htyu9f4.mongodb.net',
];

function buildUri() {
  const uri = process.env.MONGODB_URI;
  // Already a direct (non-srv) URI -> use as-is.
  if (uri && uri.startsWith('mongodb://')) return uri;

  const user = process.env.MONGODB_USERNAME;
  const pass = process.env.MONGODB_PASSWORD;
  if (!user || !pass) {
    throw new Error('MONGODB_USERNAME and MONGODB_PASSWORD must be set in backend/.env');
  }

  const hosts = (process.env.MONGODB_HOSTS || SRV_HOSTS.join(','))
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean)
    .join(',');
  const replicaSet = process.env.MONGODB_REPLICA_SET || 'atlas-8dntpb-shard-0';

  return (
    `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${hosts}/` +
    `?ssl=true&replicaSet=${replicaSet}&authSource=admin&retryWrites=true&w=majority`
  );
}

const client = new MongoClient(buildUri(), { serverSelectionTimeoutMS: 20000 });

async function connectToDatabase() {
  await client.connect();
  console.log('Connected to MongoDB Atlas');
  return client.db(dbName);
}

async function closeDatabase() {
  await client.close();
  console.log('MongoDB connection closed');
}

module.exports = { connectToDatabase, closeDatabase, client, dbName };
