'use strict';

const pino = require('pino');
const config = require('./index');

const logger = pino({
  level: config.isTest ? 'silent' : process.env.LOG_LEVEL || (config.isProd ? 'info' : 'debug'),
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'password',
      'password_hash',
      'passwordHash',
      'token',
      'refreshToken',
      '*.password',
      '*.password_hash',
      '*.token',
      '*.secret',
    ],
    censor: '[redacted]',
  },
  transport: config.isProd
    ? undefined
    : {
        target: 'pino/file',
        options: { destination: 1 },
      },
});

module.exports = logger;
