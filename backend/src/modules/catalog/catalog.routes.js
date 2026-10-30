'use strict';

const express = require('express');
const service = require('./catalog.service');
const validators = require('./catalog.validators');
const { validate } = require('../../shared/middleware/validate');
const { authenticate } = require('../../shared/middleware/authenticate');
const { authorize } = require('../../shared/middleware/authorize');
const { PERMISSIONS } = require('../../shared/constants/roles');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { success, created } = require('../../shared/responses');

const router = express.Router();

router.get(
  '/destinations',
  validate({ query: validators.destinationListQuery }),
  asyncHandler(async (req, res) => success(res, { message: 'Destinations retrieved', data: await service.getDestinations(req.validatedQuery) }))
);

router.get('/destinations/meta', asyncHandler(async (req, res) => success(res, { message: 'Destination metadata', data: await service.getDestinationMeta() })));

router.get(
  '/destinations/:slug',
  asyncHandler(async (req, res) => success(res, { message: 'Destination retrieved', data: await service.getDestination(req.params.slug) }))
);

router.get(
  '/packages',
  validate({ query: validators.packageListQuery }),
  asyncHandler(async (req, res) => success(res, { message: 'Packages retrieved', data: await service.getPackages(req.validatedQuery) }))
);

router.get(
  '/packages/:slug',
  asyncHandler(async (req, res) => success(res, { message: 'Package retrieved', data: await service.getPackage(req.params.slug) }))
);

router.get(
  '/blogs',
  validate({ query: validators.paginationQuery }),
  asyncHandler(async (req, res) => success(res, { message: 'Blog posts retrieved', data: await service.getBlogs(req.validatedQuery) }))
);

router.get(
  '/blogs/:slug',
  asyncHandler(async (req, res) => success(res, { message: 'Blog post retrieved', data: await service.getBlog(req.params.slug) }))
);

router.get(
  '/search',
  validate({ query: validators.searchQuery }),
  asyncHandler(async (req, res) => success(res, { message: 'Search results', data: await service.search(req.validatedQuery) }))
);

// ---- admin catalog management ------------------------------------------------
const adminRouter = express.Router();

adminRouter.post(
  '/destinations',
  authenticate,
  authorize(PERMISSIONS.DESTINATIONS_MANAGE),
  validate({ body: validators.destinationBody }),
  asyncHandler(async (req, res) => created(res, { message: 'Destination created', data: await service.createDestination(req.body) }))
);

adminRouter.patch(
  '/destinations/:id',
  authenticate,
  authorize(PERMISSIONS.DESTINATIONS_MANAGE),
  validate({ params: validators.idParam, body: validators.destinationBody.partial() }),
  asyncHandler(async (req, res) => success(res, { message: 'Destination updated', data: await service.updateDestination(req.params.id, req.body) }))
);

adminRouter.delete(
  '/destinations/:id',
  authenticate,
  authorize(PERMISSIONS.DESTINATIONS_MANAGE),
  validate({ params: validators.idParam }),
  asyncHandler(async (req, res) => success(res, { message: 'Destination archived', data: await service.archiveDestination(req.params.id) }))
);

adminRouter.post(
  '/packages',
  authenticate,
  authorize(PERMISSIONS.PACKAGES_MANAGE),
  validate({ body: validators.packageBody }),
  asyncHandler(async (req, res) => created(res, { message: 'Package created', data: await service.savePackage(null, req.body) }))
);

adminRouter.patch(
  '/packages/:id',
  authenticate,
  authorize(PERMISSIONS.PACKAGES_MANAGE),
  validate({ params: validators.idParam, body: validators.packageBody.partial() }),
  asyncHandler(async (req, res) => success(res, { message: 'Package updated', data: await service.savePackage(req.params.id, req.body) }))
);

module.exports = { publicRouter: router, adminRouter };
