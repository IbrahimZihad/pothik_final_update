'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');

const config = require('./config');
const openapi = require('./docs/openapi');
const routes = require('./routes');
const { requestContext } = require('./shared/middleware/requestContext');
const { httpLogger } = require('./shared/middleware/httpLogger');
const { apiLimiter } = require('./shared/middleware/rateLimit');
const { notFound } = require('./shared/middleware/notFound');
const { errorHandler } = require('./shared/middleware/errorHandler');

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  })
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  })
);

app.use(compression());
app.use(cookieParser());
app.use(requestContext);
app.use(httpLogger);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

app.use(
  '/uploads',
  express.static(config.uploads.dir, {
    maxAge: config.isProd ? '7d' : 0,
    fallthrough: true,
    index: false,
  })
);

app.get('/health', (req, res) => res.redirect(307, `${config.apiPrefix}/health`));
app.get('/health/live', (req, res) => res.redirect(307, `${config.apiPrefix}/health/live`));
app.get('/health/ready', (req, res) => res.redirect(307, `${config.apiPrefix}/health/ready`));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'POTHIK API' }));
app.get('/openapi.json', (req, res) => res.json(openapi));

app.use(config.apiPrefix, apiLimiter, routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
