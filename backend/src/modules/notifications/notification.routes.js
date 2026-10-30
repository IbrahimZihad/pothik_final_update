'use strict';

const express = require('express');
const { validate } = require('../../shared/middleware/validate');
const { authenticate } = require('../../shared/middleware/authenticate');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { success, created } = require('../../shared/responses');
const validators = require('./notification.validators');
const service = require('./notification.service');

const router = express.Router();

router.use(authenticate);

router.get(
  '/',
  validate({ query: validators.listQuery }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Notifications retrieved', data: await service.listNotifications(req.user, req.validatedQuery) })
  )
);

router.get(
  '/unread-count',
  asyncHandler(async (req, res) => success(res, { message: 'Unread notifications counted', data: await service.unreadCount(req.user) }))
);

router.post(
  '/read-all',
  asyncHandler(async (req, res) => success(res, { message: 'Notifications marked as read', data: await service.markAllRead(req.user) }))
);

router.post(
  '/:id/read',
  validate({ params: validators.idParam }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Notification marked as read', data: await service.markRead(req.user, req.params.id) })
  )
);

const messageRouter = express.Router();

messageRouter.use(authenticate);

messageRouter.get(
  '/',
  validate({ query: validators.threadQuery }),
  asyncHandler(async (req, res) => success(res, { message: 'Messages retrieved', data: await service.listThread(req.user, req.validatedQuery) }))
);

messageRouter.post(
  '/',
  validate({ body: validators.messageBody }),
  asyncHandler(async (req, res) => created(res, { message: 'Message sent', data: await service.sendMessage(req.user, req.body) }))
);

module.exports = { router, messageRouter };
