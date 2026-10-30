'use strict';

const express = require('express');
const { validate } = require('../../shared/middleware/validate');
const { authenticate } = require('../../shared/middleware/authenticate');
const { authLimiter, writeLimiter } = require('../../shared/middleware/rateLimit');
const validators = require('./auth.validators');
const controller = require('./auth.controller');

const router = express.Router();

router.post('/register', authLimiter, validate({ body: validators.register }), controller.register);
router.post('/login', authLimiter, validate({ body: validators.login }), controller.login);
router.post('/refresh', authLimiter, validate({ body: validators.refresh }), controller.refresh);
router.post('/logout', validate({ body: validators.refresh }), controller.logout);

router.post('/verify-email', authLimiter, validate({ body: validators.verifyEmail }), controller.verifyEmail);
router.post('/forgot-password', authLimiter, validate({ body: validators.forgotPassword }), controller.forgotPassword);
router.post('/reset-password', authLimiter, validate({ body: validators.resetPassword }), controller.resetPassword);

router.get('/me', authenticate, controller.me);
router.patch('/me', authenticate, writeLimiter, validate({ body: validators.updateProfile }), controller.updateMe);
router.post(
  '/change-password',
  authenticate,
  writeLimiter,
  validate({ body: validators.changePassword }),
  controller.changePassword
);
router.post('/resend-verification', authenticate, writeLimiter, controller.resendVerification);

module.exports = router;
