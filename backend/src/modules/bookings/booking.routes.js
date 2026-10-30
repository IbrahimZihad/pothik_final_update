'use strict';

const express = require('express');
const { validate } = require('../../shared/middleware/validate');
const { authenticate } = require('../../shared/middleware/authenticate');
const { authorize } = require('../../shared/middleware/authorize');
const { writeLimiter } = require('../../shared/middleware/rateLimit');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { success, created } = require('../../shared/responses');
const { PERMISSIONS } = require('../../shared/constants/roles');
const validators = require('./booking.validators');
const service = require('./booking.service');

const customerRouter = express.Router();

customerRouter.post(
  '/',
  authenticate,
  authorize(PERMISSIONS.BOOKINGS_CREATE),
  writeLimiter,
  validate({ body: validators.createBookingBody }),
  asyncHandler(async (req, res) => created(res, { message: 'Booking created', data: await service.createBooking(req.user, req.body) }))
);

customerRouter.get(
  '/',
  authenticate,
  authorize(PERMISSIONS.BOOKINGS_READ_OWN),
  validate({ query: validators.bookingListQuery }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Bookings retrieved', data: await service.listMyBookings(req.user, req.validatedQuery) })
  )
);

customerRouter.get(
  '/:reference',
  authenticate,
  authorize(PERMISSIONS.BOOKINGS_READ_OWN),
  validate({ params: validators.referenceParam }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Booking retrieved', data: await service.getBookingForUser(req.user, req.params.reference) })
  )
);

customerRouter.post(
  '/:reference/cancel',
  authenticate,
  authorize(PERMISSIONS.BOOKINGS_READ_OWN),
  writeLimiter,
  validate({ params: validators.referenceParam, body: validators.cancelBody }),
  asyncHandler(async (req, res) =>
    success(res, {
      message: 'Booking cancelled',
      data: await service.cancelBooking(req.user, req.params.reference, req.body),
    })
  )
);

const providerRouter = express.Router();

providerRouter.get(
  '/',
  authenticate,
  authorize(PERMISSIONS.BOOKINGS_MANAGE_PROVIDER),
  validate({ query: validators.providerBookingListQuery }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Provider bookings retrieved', data: await service.listProviderBookings(req.user, req.validatedQuery) })
  )
);

providerRouter.get(
  '/:reference',
  authenticate,
  authorize(PERMISSIONS.BOOKINGS_MANAGE_PROVIDER),
  validate({ params: validators.referenceParam }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Booking retrieved', data: await service.getBookingForUser(req.user, req.params.reference) })
  )
);

providerRouter.post(
  '/:reference/accept',
  authenticate,
  authorize(PERMISSIONS.BOOKINGS_MANAGE_PROVIDER),
  writeLimiter,
  validate({ params: validators.referenceParam }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Booking accepted', data: await service.acceptBooking(req.user, req.params.reference) })
  )
);

providerRouter.post(
  '/:reference/reject',
  authenticate,
  authorize(PERMISSIONS.BOOKINGS_MANAGE_PROVIDER),
  writeLimiter,
  validate({ params: validators.referenceParam, body: validators.rejectBody }),
  asyncHandler(async (req, res) =>
    success(res, {
      message: 'Booking rejected',
      data: await service.rejectBooking(req.user, req.params.reference, req.body),
    })
  )
);

providerRouter.post(
  '/:reference/start',
  authenticate,
  authorize(PERMISSIONS.BOOKINGS_MANAGE_PROVIDER),
  writeLimiter,
  validate({ params: validators.referenceParam }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Trip started', data: await service.startBooking(req.user, req.params.reference) })
  )
);

providerRouter.post(
  '/:reference/complete',
  authenticate,
  authorize(PERMISSIONS.BOOKINGS_MANAGE_PROVIDER),
  writeLimiter,
  validate({ params: validators.referenceParam }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Trip completed', data: await service.completeBooking(req.user, req.params.reference) })
  )
);

module.exports = { customerRouter, providerRouter };
