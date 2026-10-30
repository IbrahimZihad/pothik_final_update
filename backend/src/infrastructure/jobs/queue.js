'use strict';

const logger = require('../../config/logger');
const config = require('../../config');
const { handlers } = require('./handlers');

let queue = null;
let worker = null;
let connection = null;

if (config.queueEnabled) {
  try {
    const { Queue, Worker } = require('bullmq');
    const Redis = require('ioredis');
    connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
    queue = new Queue('pothik', { connection });
    worker = new Worker(
      'pothik',
      async (job) => {
        const handler = handlers[job.name];
        if (!handler) throw new Error(`Unknown job: ${job.name}`);
        return handler(job.data, job);
      },
      { connection, concurrency: 5 }
    );
    worker.on('failed', (job, err) => logger.error({ job: job?.name, id: job?.id, err: err.message }, 'job failed'));
    worker.on('completed', (job) => logger.debug({ job: job.name, id: job.id }, 'job completed'));
    logger.info({ queue: 'pothik' }, 'BullMQ queue and worker started');
  } catch (err) {
    logger.error({ err: err.message }, 'failed to initialise BullMQ, falling back to inline execution');
    queue = null;
    worker = null;
  }
} else {
  logger.info('queue disabled (no REDIS_URL) - background jobs run inline');
}

async function enqueue(name, data, options = {}) {
  if (queue) {
    return queue.add(name, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 500,
      removeOnFail: 1000,
      ...options,
    });
  }

  const handler = handlers[name];
  if (!handler) throw new Error(`Unknown job: ${name}`);
  try {
    await handler(data, { id: `inline-${Date.now()}`, attemptsMade: 0 });
    return { id: 'inline', name };
  } catch (err) {
    logger.error({ job: name, err: err.message }, 'inline job failed');
    return { id: 'inline', name, error: err.message };
  }
}

async function closeQueue() {
  if (worker) await worker.close();
  if (queue) await queue.close();
  if (connection) await connection.quit();
}

module.exports = { enqueue, closeQueue, isEnabled: () => Boolean(queue) };
