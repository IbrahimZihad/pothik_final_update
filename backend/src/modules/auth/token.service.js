'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../../config');

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function signAccessToken(userId) {
  return jwt.sign({ sub: String(userId), type: 'access' }, config.jwt.accessSecret, {
    algorithm: 'HS256',
    expiresIn: config.jwt.accessTtl,
    jwtid: crypto.randomUUID(),
  });
}

function signRefreshToken(userId, familyId) {
  return jwt.sign({ sub: String(userId), type: 'refresh', fam: familyId }, config.jwt.refreshSecret, {
    algorithm: 'HS256',
    expiresIn: `${config.jwt.refreshTtlDays}d`,
    jwtid: crypto.randomUUID(),
  });
}

function verifyRefreshToken(token) {
  return jwt.verify(token, config.jwt.refreshSecret, { algorithms: ['HS256'] });
}

function randomToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = { hashToken, signAccessToken, signRefreshToken, verifyRefreshToken, randomToken };
