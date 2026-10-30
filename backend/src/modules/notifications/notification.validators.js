'use strict';

const { z } = require('zod');
const { paginationQuery, idParam } = require('../../shared/validators/common');

const listQuery = paginationQuery.extend({
  unread: z.enum(['true', 'false']).optional(),
  type: z.string().trim().max(60).optional(),
});

const messageBody = z.object({
  bookingReference: z.string().trim().min(4).max(40),
  recipientUserId: z.coerce.number().int().positive().optional(),
  body: z.string().trim().min(1).max(4000),
});

const threadQuery = z.object({
  bookingReference: z.string().trim().min(4).max(40),
  withUserId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(200).optional().default(50),
});

module.exports = { listQuery, idParam, messageBody, threadQuery };
