'use strict';
/**
 * Server entry point. Start with `npm start` from the repository root
 * (or `node backend/server.js` from anywhere).
 */
const config = require('./src/config/env');
const { createApp } = require('./src/app');
const { init, kind, close } = require('./src/db/store');

async function main() {
  await init();
  const app = createApp();
  const server = app.listen(config.port, config.host, () => {
    console.log(`GA6 Group Portal - ${config.env}`);
    console.log(`  data store : ${kind}${config.hasMongoCredentials && kind === 'mongo' ? ' (MongoDB Atlas)' : ''}`);
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
  if (config.isProduction) process.exit(1);
  process.exitCode = 1;
});
