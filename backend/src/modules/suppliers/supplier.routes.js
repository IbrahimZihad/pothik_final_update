'use strict';

const express = require('express');
const validators = require('./supplier.validators');
const service = require('./supplier.service');
const { validate } = require('../../shared/middleware/validate');
const { authenticate } = require('../../shared/middleware/authenticate');
const { authorize, requireRoles } = require('../../shared/middleware/authorize');
const { PERMISSIONS, ROLES } = require('../../shared/constants/roles');
const { upload } = require('../../shared/middleware/upload');
const { writeLimiter } = require('../../shared/middleware/rateLimit');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { success, created } = require('../../shared/responses');

// ---------------------------------------------------------------- public API

const publicRouter = express.Router();

publicRouter.get(
  '/hotels',
  validate({ query: validators.hotelListQuery }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Hotels retrieved', data: await service.getHotels(req.validatedQuery) })
  )
);

publicRouter.get(
  '/hotels/:slug',
  validate({ params: validators.slugParam }),
  asyncHandler(async (req, res) => success(res, { message: 'Hotel retrieved', data: await service.getHotel(req.params.slug) }))
);

publicRouter.get(
  '/hotels/:slug/availability',
  validate({ params: validators.slugParam, query: validators.hotelAvailabilityQuery }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Hotel availability', data: await service.getHotelAvailability(req.params.slug, req.validatedQuery) })
  )
);

publicRouter.get(
  '/vehicles',
  validate({ query: validators.vehicleListQuery }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Vehicles retrieved', data: await service.getVehicles(req.validatedQuery) })
  )
);

publicRouter.get(
  '/vehicles/:id',
  validate({ params: validators.idParam }),
  asyncHandler(async (req, res) => success(res, { message: 'Vehicle retrieved', data: await service.getVehicle(req.params.id) }))
);

publicRouter.get(
  '/vehicles/:id/availability',
  validate({ params: validators.idParam, query: validators.providerAvailabilityQuery }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Vehicle availability', data: await service.getVehicleAvailability(req.params.id, req.validatedQuery) })
  )
);

publicRouter.get(
  '/guides',
  validate({ query: validators.guideListQuery }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Tour guides retrieved', data: await service.getGuides(req.validatedQuery) })
  )
);

publicRouter.get(
  '/guides/:id',
  validate({ params: validators.idParam }),
  asyncHandler(async (req, res) => success(res, { message: 'Tour guide retrieved', data: await service.getGuide(req.params.id) }))
);

publicRouter.get(
  '/guides/:id/availability',
  validate({ params: validators.idParam, query: validators.providerAvailabilityQuery }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Guide availability', data: await service.getGuideAvailability(req.params.id, req.validatedQuery) })
  )
);

publicRouter.get(
  '/vehicle-categories',
  asyncHandler(async (req, res) => success(res, { message: 'Vehicle categories', data: await service.getVehicleCategories() }))
);

// ------------------------------------------------------------- provider API

const providerRouter = express.Router();

providerRouter.use(authenticate, requireRoles(ROLES.HOTEL_OWNER, ROLES.TRANSPORT_PROVIDER, ROLES.TOUR_GUIDE));

providerRouter.get(
  '/profile',
  asyncHandler(async (req, res) => success(res, { message: 'Provider profile', data: await service.getProviderProfile(req.user) }))
);

providerRouter.patch(
  '/profile',
  writeLimiter,
  validate({ body: validators.profileBody }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Provider profile updated', data: await service.updateProviderProfile(req.user, req.body) })
  )
);

providerRouter.get(
  '/documents',
  asyncHandler(async (req, res) => success(res, { message: 'Documents retrieved', data: await service.listProviderDocuments(req.user) }))
);

providerRouter.post(
  '/documents',
  writeLimiter,
  upload.single('file'),
  validate({ body: validators.documentBody }),
  asyncHandler(async (req, res) =>
    created(res, {
      message: 'Document uploaded for verification',
      data: await service.uploadProviderDocument(req.user, req.file, req.body),
    })
  )
);

providerRouter.get(
  '/documents/:id/file',
  validate({ params: validators.idParam }),
  asyncHandler(async (req, res) => {
    const file = await service.getProviderDocumentFile(req.user, req.params.id);
    res.setHeader('Content-Disposition', `inline; filename="${file.name}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(file.path);
  })
);

// hotels ----------------------------------------------------------------
providerRouter.get(
  '/hotels',
  authorize(PERMISSIONS.HOTELS_MANAGE_OWN),
  asyncHandler(async (req, res) => success(res, { message: 'Your hotels', data: await service.listProviderHotels(req.user) }))
);

providerRouter.post(
  '/hotels',
  authorize(PERMISSIONS.HOTELS_MANAGE_OWN),
  writeLimiter,
  validate({ body: validators.hotelBody }),
  asyncHandler(async (req, res) => created(res, { message: 'Hotel created', data: await service.createProviderHotel(req.user, req.body) }))
);

providerRouter.patch(
  '/hotels/:id',
  authorize(PERMISSIONS.HOTELS_MANAGE_OWN),
  writeLimiter,
  validate({ params: validators.idParam, body: validators.hotelBody.partial() }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Hotel updated', data: await service.updateProviderHotel(req.user, req.params.id, req.body) })
  )
);

providerRouter.post(
  '/hotels/:id/rooms',
  authorize(PERMISSIONS.ROOMS_MANAGE_OWN),
  writeLimiter,
  validate({ params: validators.idParam, body: validators.roomBody }),
  asyncHandler(async (req, res) =>
    created(res, { message: 'Room created', data: await service.createRoom(req.user, req.params.id, req.body) })
  )
);

providerRouter.patch(
  '/rooms/:id',
  authorize(PERMISSIONS.ROOMS_MANAGE_OWN),
  writeLimiter,
  validate({ params: validators.idParam, body: validators.roomUpdateBody }),
  asyncHandler(async (req, res) => success(res, { message: 'Room updated', data: await service.updateRoom(req.user, req.params.id, req.body) }))
);

providerRouter.delete(
  '/rooms/:id',
  authorize(PERMISSIONS.ROOMS_MANAGE_OWN),
  writeLimiter,
  validate({ params: validators.idParam }),
  asyncHandler(async (req, res) => success(res, { message: 'Room archived', data: await service.archiveRoom(req.user, req.params.id) }))
);

providerRouter.get(
  '/rooms/:id/availability',
  authorize(PERMISSIONS.ROOMS_MANAGE_OWN),
  validate({ params: validators.idParam, query: validators.roomAvailabilityQuery }),
  asyncHandler(async (req, res) =>
    success(res, {
      message: 'Room availability',
      data: await service.getRoomAvailability(req.user, req.params.id, req.validatedQuery),
    })
  )
);

providerRouter.put(
  '/rooms/:id/availability',
  authorize(PERMISSIONS.ROOMS_MANAGE_OWN),
  writeLimiter,
  validate({ params: validators.idParam, body: validators.roomAvailabilityBody }),
  asyncHandler(async (req, res) =>
    success(res, {
      message: 'Room availability updated',
      data: await service.setRoomAvailability(req.user, req.params.id, req.body.dates),
    })
  )
);

// vehicles --------------------------------------------------------------
providerRouter.get(
  '/vehicles',
  authorize(PERMISSIONS.VEHICLES_MANAGE_OWN),
  asyncHandler(async (req, res) => success(res, { message: 'Your vehicles', data: await service.listProviderVehicles(req.user) }))
);

providerRouter.post(
  '/vehicles',
  authorize(PERMISSIONS.VEHICLES_MANAGE_OWN),
  writeLimiter,
  validate({ body: validators.vehicleBody }),
  asyncHandler(async (req, res) => created(res, { message: 'Vehicle created', data: await service.createVehicle(req.user, req.body) }))
);

providerRouter.patch(
  '/vehicles/:id',
  authorize(PERMISSIONS.VEHICLES_MANAGE_OWN),
  writeLimiter,
  validate({ params: validators.idParam, body: validators.vehicleBody.partial() }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Vehicle updated', data: await service.updateVehicle(req.user, req.params.id, req.body) })
  )
);

providerRouter.get(
  '/vehicles/:id/availability',
  authorize(PERMISSIONS.VEHICLES_MANAGE_OWN),
  validate({ params: validators.idParam, query: validators.roomAvailabilityQuery }),
  asyncHandler(async (req, res) =>
    success(res, {
      message: 'Vehicle availability',
      data: await service.getVehicleAvailabilityForProvider(req.user, req.params.id, req.validatedQuery),
    })
  )
);

providerRouter.put(
  '/vehicles/:id/availability',
  authorize(PERMISSIONS.VEHICLES_MANAGE_OWN),
  writeLimiter,
  validate({ params: validators.idParam, body: validators.availabilityToggleBody }),
  asyncHandler(async (req, res) =>
    success(res, {
      message: 'Vehicle availability updated',
      data: await service.setVehicleAvailability(req.user, req.params.id, req.body.dates),
    })
  )
);

// drivers ---------------------------------------------------------------
providerRouter.get(
  '/drivers',
  authorize(PERMISSIONS.DRIVERS_MANAGE_OWN),
  asyncHandler(async (req, res) => success(res, { message: 'Your drivers', data: await service.listProviderDrivers(req.user) }))
);

providerRouter.post(
  '/drivers',
  authorize(PERMISSIONS.DRIVERS_MANAGE_OWN),
  writeLimiter,
  validate({ body: validators.driverBody }),
  asyncHandler(async (req, res) => created(res, { message: 'Driver created', data: await service.createDriver(req.user, req.body) }))
);

providerRouter.patch(
  '/drivers/:id',
  authorize(PERMISSIONS.DRIVERS_MANAGE_OWN),
  writeLimiter,
  validate({ params: validators.idParam, body: validators.driverBody.partial() }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Driver updated', data: await service.updateDriver(req.user, req.params.id, req.body) })
  )
);

providerRouter.delete(
  '/drivers/:id',
  authorize(PERMISSIONS.DRIVERS_MANAGE_OWN),
  writeLimiter,
  validate({ params: validators.idParam }),
  asyncHandler(async (req, res) => success(res, { message: 'Driver archived', data: await service.archiveDriver(req.user, req.params.id) }))
);

// guide -----------------------------------------------------------------
providerRouter.get(
  '/guide',
  authorize(PERMISSIONS.GUIDES_MANAGE_OWN),
  asyncHandler(async (req, res) => success(res, { message: 'Guide profile', data: await service.getGuideProfile(req.user) }))
);

providerRouter.put(
  '/guide',
  authorize(PERMISSIONS.GUIDES_MANAGE_OWN),
  writeLimiter,
  validate({ body: validators.guideBody }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Guide profile saved', data: await service.upsertGuideProfile(req.user, req.body) })
  )
);

providerRouter.get(
  '/guide/availability',
  authorize(PERMISSIONS.GUIDES_MANAGE_OWN),
  validate({ query: validators.roomAvailabilityQuery }),
  asyncHandler(async (req, res) =>
    success(res, {
      message: 'Guide availability',
      data: await service.getGuideAvailabilityForProvider(req.user, req.validatedQuery),
    })
  )
);

providerRouter.put(
  '/guide/availability',
  authorize(PERMISSIONS.GUIDES_MANAGE_OWN),
  writeLimiter,
  validate({ body: validators.availabilityToggleBody }),
  asyncHandler(async (req, res) =>
    success(res, {
      message: 'Guide availability updated',
      data: await service.setGuideAvailability(req.user, req.body.dates),
    })
  )
);

module.exports = { publicRouter, providerRouter };
