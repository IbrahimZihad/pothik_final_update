'use strict';

const express = require('express');
const { validate } = require('../../shared/middleware/validate');
const { authenticate } = require('../../shared/middleware/authenticate');
const { authorize } = require('../../shared/middleware/authorize');
const { writeLimiter } = require('../../shared/middleware/rateLimit');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { success, created } = require('../../shared/responses');
const { PERMISSIONS } = require('../../shared/constants/roles');
const validators = require('./trip.validators');
const service = require('./trip.service');

const router = express.Router();

router.get('/addons', asyncHandler(async (req, res) => success(res, { message: 'Add-on services', data: service.getAddons() })));

router.post(
  '/quote',
  authenticate,
  authorize(PERMISSIONS.BOOKINGS_CREATE),
  writeLimiter,
  validate({ body: validators.quoteBody }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Trip quotation', data: await service.quoteTrip(req.user, req.body) })
  )
);

router.post(
  '/',
  authenticate,
  authorize(PERMISSIONS.BOOKINGS_CREATE),
  writeLimiter,
  validate({ body: validators.saveTripBody }),
  asyncHandler(async (req, res) => created(res, { message: 'Trip saved', data: await service.saveTrip(req.user, req.body) }))
);

router.get(
  '/',
  authenticate,
  authorize(PERMISSIONS.BOOKINGS_READ_OWN),
  validate({ query: validators.tripListQuery }),
  asyncHandler(async (req, res) => success(res, { message: 'Trips retrieved', data: await service.listTrips(req.user, req.validatedQuery) }))
);

router.get(
  '/:id',
  authenticate,
  authorize(PERMISSIONS.BOOKINGS_READ_OWN),
  validate({ params: validators.idParam }),
  asyncHandler(async (req, res) => success(res, { message: 'Trip retrieved', data: await service.getTrip(req.user, req.params.id) }))
);

router.patch(
  '/:id',
  authenticate,
  authorize(PERMISSIONS.BOOKINGS_CREATE),
  writeLimiter,
  validate({ params: validators.idParam, body: validators.updateTripBody }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Trip updated', data: await service.updateTrip(req.user, req.params.id, req.body) })
  )
);

router.delete(
  '/:id',
  authenticate,
  authorize(PERMISSIONS.BOOKINGS_CREATE),
  writeLimiter,
  validate({ params: validators.idParam }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Trip discarded', data: await service.cancelTrip(req.user, req.params.id) })
  )
);

module.exports = router;
