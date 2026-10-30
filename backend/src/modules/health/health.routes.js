'use strict';

const express = require('express');
const { sequelize } = require('../../database/sequelize');
const cache = require('../../infrastructure/cache/cache');
const { success, failure } = require('../../shared/responses');

const router = express.Router();

const startedAt = Date.now();

router.get('/live', (req, res) => success(res, { message: 'alive', data: { uptimeSeconds: Math.round((Date.now() - startedAt) / 1000) } }));

router.get('/', (req, res) => success(res, { message: 'ok', data: { service: 'pothik-api', status: 'ok' } }));

router.get('/ready', async (req, res) => {
  const checks = { database: 'down', cache: 'ok' };
  try {
    await sequelize.authenticate();
    checks.database = 'up';
  } catch (err) {
    checks.database = 'down';
  }
  if (!(await cache.get('__ready_probe__')) && cache.mode === 'redis') {
    checks.cache = 'degraded';
  }
  const ready = checks.database === 'up';
  return res.status(ready ? 200 : 503).json({
    success: ready,
    message: ready ? 'ready' : 'not ready',
    data: checks,
  });
});

module.exports = router;
