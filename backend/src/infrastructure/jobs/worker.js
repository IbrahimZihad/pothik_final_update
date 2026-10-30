'use strict';

/**
 * Standalone worker entrypoint for deployments that scale background processing
 * separately from the API (docker service `worker`). The API also starts an
 * in-process worker when REDIS_URL is configured.
 */
const logger = require('../../config/logger');
const { sequelize } = require('../../database/sequelize');
const config = require('../../config');

async function main() {
  if (!config.queueEnabled) {
    logger.warn('queue disabled - nothing to process (set REDIS_URL and QUEUE_ENABLED=true)');
    process.exit(0);
  }
  await sequelize.authenticate();
  require('./queue');
  logger.info('worker process started');
}

main().catch((err) => {
  logger.fatal({ err: err.message }, 'worker failed to start');
  process.exit(1);
});
