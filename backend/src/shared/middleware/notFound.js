'use strict';

const { failure } = require('../responses');

function notFound(req, res) {
  return failure(res, {
    status: 404,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    code: 'ROUTE_NOT_FOUND',
  });
}

module.exports = { notFound };
