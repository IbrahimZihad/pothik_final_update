'use strict';

const Redis = require('ioredis');
const config = require('../../config');
const logger = require('../../config/logger');

/**
 * Cache abstraction. Redis is used when REDIS_URL is present; otherwise an
 * in-process TTL map keeps single-instance development functional.
 * Redis is never the source of truth for bookings, payments or inventory.
 */
class Cache {
  constructor() {
    this.memory = new Map();
    this.redis = null;
    this.mode = 'memory';

    if (config.redisUrl) {
      this.redis = new Redis(config.redisUrl, {
        lazyConnect: false,
        maxRetriesPerRequest: 3,
        enableOfflineQueue: false,
      });
      this.redis.on('error', (err) => logger.warn({ err: err.message }, 'redis cache unavailable, using memory fallback'));
      this.redis.on('ready', () => {
        this.mode = 'redis';
        logger.info('cache backend: redis');
      });
      this.mode = 'redis';
    }
  }

  async get(key) {
    if (this.redis && this.mode === 'redis') {
      try {
        const raw = await this.redis.get(key);
        return raw ? JSON.parse(raw) : null;
      } catch (err) {
        logger.warn({ err: err.message }, 'cache get failed, falling back to memory');
      }
    }
    const entry = this.memory.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.memory.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key, value, ttlSeconds = 60) {
    if (this.redis && this.mode === 'redis') {
      try {
        await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        return;
      } catch (err) {
        logger.warn({ err: err.message }, 'cache set failed, falling back to memory');
      }
    }
    this.memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key) {
    if (this.redis && this.mode === 'redis') {
      try {
        await this.redis.del(key);
      } catch (err) {
        logger.warn({ err: err.message }, 'cache del failed');
      }
    }
    this.memory.delete(key);
  }

  /** Deletes every key beginning with prefix (used for list cache invalidation). */
  async delPrefix(prefix) {
    if (this.redis && this.mode === 'redis') {
      try {
        let cursor = '0';
        do {
          const [next, keys] = await this.redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
          cursor = next;
          if (keys.length) await this.redis.del(...keys);
        } while (cursor !== '0');
      } catch (err) {
        logger.warn({ err: err.message }, 'cache prefix delete failed');
      }
    }
    for (const key of this.memory.keys()) {
      if (key.startsWith(prefix)) this.memory.delete(key);
    }
  }

  async flush() {
    if (this.redis && this.mode === 'redis') {
      try {
        await this.redis.flushdb();
      } catch (err) {
        logger.warn({ err: err.message }, 'cache flush failed');
      }
    }
    this.memory.clear();
  }

  key(namespace, parts = []) {
    return [namespace, ...parts].join(':');
  }
}

module.exports = new Cache();
