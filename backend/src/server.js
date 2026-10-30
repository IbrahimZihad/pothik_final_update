'use strict';

const app = require('./app');
const config = require('./config');
const logger = require('./config/logger');
const { sequelize, closeConnection } = require('./database/sequelize');
const { closeQueue } = require('./infrastructure/jobs/queue');

let server;

async function connectWithRetry(attempts = 10, delayMs = 3000) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await sequelize.authenticate();
      logger.info({ dialect: config.db.dialect, database: config.db.name }, 'database connection established');
      return;
    } catch (err) {
      logger.warn({ attempt, attempts, err: err.message }, 'database connection failed, retrying');
      if (attempt === attempts) throw err;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function start() {
  await connectWithRetry();

  server = app.listen(config.port, () => {
    logger.info(
      { port: config.port, env: config.env, instance: process.env.INSTANCE_ID || 'local' },
      'POTHIK API listening'
    );
  });

  const shutdown = async (signal) => {
    logger.info({ signal }, 'shutting down');
    server.close(async () => {
      try {
        await closeQueue();
        await closeConnection();
        logger.info('shutdown complete');
        process.exit(0);
      } catch (err) {
        logger.error({ err: err.message }, 'error during shutdown');
        process.exit(1);
      }
    });
    setTimeout(() => {
      logger.error('forced shutdown after timeout');
      process.exit(1);
    }, 15000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason: reason instanceof Error ? reason.message : String(reason) }, 'unhandled rejection');
  });
  process.on('uncaughtException', (err) => {
    logger.fatal({ err: err.message, stack: err.stack }, 'uncaught exception');
    process.exit(1);
  });

  return server;
}

if (require.main === module) {
  start().catch((err) => {
    logger.fatal({ err: err.message }, 'failed to start server');
    process.exit(1);
  });
}

module.exports = { start };
