'use strict';

const { randomUUID } = require('crypto');

function requestContext(req, res, next) {
  const incoming = req.headers['x-request-id'];
  req.id = typeof incoming === 'string' && incoming.length <= 64 ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

module.exports = { requestContext };
