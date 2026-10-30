'use strict';

const express = require('express');
const { authenticate } = require('../../shared/middleware/authenticate');
const { authorize, authorizeAny } = require('../../shared/middleware/authorize');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { success } = require('../../shared/responses');
const { PERMISSIONS } = require('../../shared/constants/roles');
const service = require('./dashboard.service');

const providerRouter = express.Router();

providerRouter.get(
  '/dashboard',
  authenticate,
  authorizeAny(PERMISSIONS.DASHBOARD_HOTEL, PERMISSIONS.DASHBOARD_TRANSPORT, PERMISSIONS.DASHBOARD_GUIDE),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Provider dashboard retrieved', data: await service.providerDashboard(req.user) })
  )
);

const customerRouter = express.Router();

customerRouter.get(
  '/dashboard',
  authenticate,
  authorize(PERMISSIONS.DASHBOARD_CUSTOMER),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Dashboard retrieved', data: await service.customerDashboard(req.user) })
  )
);

module.exports = { providerRouter, customerRouter };
