'use strict';

const express = require('express');
const { z } = require('zod');
const { validate } = require('../../shared/middleware/validate');
const { authenticate } = require('../../shared/middleware/authenticate');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { success, created } = require('../../shared/responses');
const service = require('./review.service');
const { idParam, paginationQuery } = require('../../shared/validators/common');

const createSchema = z.object({
  bookingId: z.coerce.number().int().positive(),
  targetType: z.enum(['HOTEL', 'GUIDE', 'TRANSPORT', 'PACKAGE', 'DESTINATION']),
  targetId: z.coerce.number().int().positive(),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(160).optional(),
  comment: z.string().trim().max(3000).optional(),
});

const listSchema = paginationQuery.extend({
  targetType: z.enum(['HOTEL', 'GUIDE', 'TRANSPORT', 'PACKAGE', 'DESTINATION']).optional(),
  targetId: z.coerce.number().int().positive().optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
});

const replySchema = z.object({ reply: z.string().trim().min(2).max(3000) });

const summarySchema = z.object({
  targetType: z.enum(['HOTEL', 'GUIDE', 'TRANSPORT', 'PACKAGE', 'DESTINATION']),
  targetId: z.coerce.number().int().positive(),
});

const router = express.Router();

router.get(
  '/',
  validate({ query: listSchema }),
  asyncHandler(async (req, res) => success(res, { message: 'Reviews retrieved', data: await service.listReviews(req.validatedQuery) }))
);

router.get(
  '/summary',
  validate({ query: summarySchema }),
  asyncHandler(async (req, res) =>
    success(res, {
      message: 'Review summary retrieved',
      data: await service.reviewSummary(req.validatedQuery.targetType, req.validatedQuery.targetId),
    })
  )
);

router.post(
  '/',
  authenticate,
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => created(res, { message: 'Review submitted for moderation', data: await service.createReview(req.user.id, req.body) }))
);

router.patch(
  '/:id/reply',
  authenticate,
  validate({ params: idParam, body: replySchema }),
  asyncHandler(async (req, res) => success(res, { message: 'Reply saved', data: await service.providerReply(req.user, req.params.id, req.body) }))
);

module.exports = router;
