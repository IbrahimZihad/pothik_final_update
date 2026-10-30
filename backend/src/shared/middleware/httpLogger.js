'use strict';

const pinoHttp = require('pino-http');
const logger = require('../../config/logger');
const config = require('../../config');

const httpLogger = pinoHttp({
  logger,
  quietReqLogger: true,
  genReqId: (req) => req.id,
  autoLogging: {
    ignore: (req) => config.isTest || req.url.startsWith('/health'),
  },
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req(req) {
      return { id: req.id, method: req.method, url: req.url };
    },
    res(res) {
      return { statusCode: res.statusCode };
    },
  },
});

module.exports = { httpLogger };
