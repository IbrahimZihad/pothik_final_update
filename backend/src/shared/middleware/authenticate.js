'use strict';

const jwt = require('jsonwebtoken');
const config = require('../../config');
const { UnauthorizedError } = require('../errors');
const { loadUserContext } = require('../services/userContext.service');

function extractToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

async function authenticate(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) throw new UnauthorizedError('Access token is missing');

    let payload;
    try {
      payload = jwt.verify(token, config.jwt.accessSecret, { algorithms: ['HS256'] });
    } catch (err) {
      throw new UnauthorizedError(err.name === 'TokenExpiredError' ? 'Access token expired' : 'Invalid access token');
    }

    if (payload.type !== 'access') throw new UnauthorizedError('Invalid token type');

    const user = await loadUserContext(payload.sub);
    if (user.status === 'SUSPENDED') throw new UnauthorizedError('Account is suspended');

    req.user = user;
    req.auth = { tokenId: payload.jti };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authenticate };
