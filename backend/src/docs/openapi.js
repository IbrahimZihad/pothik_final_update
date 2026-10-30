'use strict';

const config = require('../config');

const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'POTHIK OTA API',
    version: '1.0.0',
    description:
      'REST API for the POTHIK online travel agency. All endpoints are versioned under /api/v1. ' +
      'Authenticate with a Bearer access token; permissions are enforced centrally by role.',
  },
  servers: [{ url: `${config.apiUrl}${config.apiPrefix}` }],
  tags: [
    { name: 'Health' },
    { name: 'Auth' },
    { name: 'Catalog' },
    { name: 'Bookings' },
    { name: 'Payments' },
    { name: 'Provider' },
    { name: 'Admin' },
    { name: 'Reviews' },
    { name: 'Notifications' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Success: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: { type: 'object' },
          meta: { type: 'object' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string' },
          code: { type: 'string' },
          errors: { type: 'array', items: { type: 'object' } },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Liveness probe',
        responses: { 200: { description: 'Service alive' } },
      },
    },
    '/health/ready': {
      get: {
        tags: ['Health'],
        summary: 'Readiness probe (database connectivity)',
        responses: { 200: { description: 'Ready' }, 503: { description: 'Not ready' } },
      },
    },
  },
};

module.exports = openapi;
