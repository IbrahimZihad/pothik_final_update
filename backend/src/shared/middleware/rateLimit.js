'use strict';

const rateLimit = require('express-rate-limit');
const config = require('../../config');
const { TooManyRequestsError } = require('../errors');

function buildLimiter({ windowMs = config.rateLimit.windowMs, limit = config.rateLimit.max } = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => config.isTest,
    handler: (req, res, next) => {
      next(new TooManyRequestsError('Too many requests. Please slow down and try again shortly.'));
    },
  });
}

const apiLimiter = buildLimiter();
const authLimiter = buildLimiter({ windowMs: 15 * 60 * 1000, limit: config.rateLimit.authMax });
const writeLimiter = buildLimiter({ windowMs: 60 * 1000, limit: 60 });

module.exports = { apiLimiter, authLimiter, writeLimiter, buildLimiter };
