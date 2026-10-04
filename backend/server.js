'use strict';
/**
 * Server entry point. Start with `npm start` from the repository root
 * (or `node backend/server.js` from anywhere).
 */
const config = require('./src/config/env');
const { createApp } = require('./src/app');
const db = require('./src/db/store');
const { init, close } = db;

async function main() {
  await init();
  const app = createApp();
  const server = app.listen(config.port, config.host, () => {
    console.log(`GA6 Group Portal - ${config.env}`);
    /* Read the live adapter after init(), because a failed Atlas connection falls back to
       the file store and the banner must say what is actually serving the data. */
    const kind = db.kind;
    console.log(`  data store : ${kind}${kind === 'mongo' ? ' (MongoDB Atlas)' : ` (${config.dataDir})`}`);
    if (kind === 'file' && config.dataStore === 'mongo') {
      console.log('              (Atlas was configured but unreachable - using the file store)');
    }
    console.log(`  listening  : http://${config.host}:${config.port}`);
    console.log('  areas      : /            guest');
    console.log('               /user/       student area');
    console.log('               /admin/      staff area');
    console.log('               /api/        JSON API');
  });

  const shutdown = async (signal) => {
    console.log(`\n[server] ${signal} received, shutting down.`);
    server.close(async () => {
      try {
        await close();
      } catch (error) {
        console.warn('[server] store close failed:', error.message);
      }
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => console.error('[unhandledRejection]', reason));
}

main().catch((error) => {
  console.error('[server] failed to start:', error.message);
  if (/SSL|TLS|ssl3|tlsv1|handshake/i.test(error.message || '')) {
    console.error(
      '  The TLS handshake with MongoDB Atlas failed. This is a network problem, not a\n' +
      '  credentials problem. To run against the local JSON store instead:\n' +
      '    PowerShell : $env:DATA_STORE="file"; npm start\n' +
      '    bash       : DATA_STORE=file npm start'
    );
  }
  if (config.isProduction) process.exit(1);
  process.exitCode = 1;
});
