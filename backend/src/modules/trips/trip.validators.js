'use strict';

const { z } = require('zod');
const { paginationQuery, idParam } = require('../../shared/validators/common');
const { compositionSchema } = require('../bookings/booking.validators');

const quoteBody = z.object({
  composition: compositionSchema,
  couponCode: z.string().trim().max(40).optional(),
});

const saveTripBody = quoteBody.extend({
  title: z.string().trim().min(2).max(200).optional(),
  requirements: z.string().max(4000).optional(),
});

const updateTripBody = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  requirements: z.string().max(4000).optional(),
  composition: compositionSchema.optional(),
  couponCode: z.string().trim().max(40).optional(),
});

const tripListQuery = paginationQuery.extend({
  status: z.enum(['DRAFT', 'QUOTED', 'CONFIRMED', 'CANCELLED']).optional(),
});

module.exports = { quoteBody, saveTripBody, updateTripBody, tripListQuery, idParam };
