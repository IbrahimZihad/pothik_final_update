'use strict';

const express = require('express');
const healthRoutes = require('../modules/health/health.routes');
const authRoutes = require('../modules/auth/auth.routes');
const catalog = require('../modules/catalog/catalog.routes');
const reviewRoutes = require('../modules/reviews/review.routes');
const suppliers = require('../modules/suppliers/supplier.routes');
const bookings = require('../modules/bookings/booking.routes');
const tripRoutes = require('../modules/trips/trip.routes');
const payments = require('../modules/payments/payment.routes');
const notifications = require('../modules/notifications/notification.routes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/reviews', reviewRoutes);
router.use('/bookings', bookings.customerRouter);
router.use('/trips', tripRoutes);
router.use('/payments', payments.customerRouter);
router.use('/notifications', notifications.router);
router.use('/messages', notifications.messageRouter);
router.use('/admin', catalog.adminRouter);
router.use('/admin', payments.adminRouter);
router.use('/', catalog.publicRouter);
router.use('/', suppliers.publicRouter);
router.use('/provider/bookings', bookings.providerRouter);
router.use('/provider', suppliers.providerRouter);
router.use('/provider', payments.providerRouter);

module.exports = router;
