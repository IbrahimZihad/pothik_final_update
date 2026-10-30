'use strict';

const express = require('express');
const { validate } = require('../../shared/middleware/validate');
const { authenticate } = require('../../shared/middleware/authenticate');
const { authorize } = require('../../shared/middleware/authorize');
const { writeLimiter } = require('../../shared/middleware/rateLimit');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { success, created } = require('../../shared/responses');
const { PERMISSIONS } = require('../../shared/constants/roles');
const validators = require('./payment.validators');
const service = require('./payment.service');

const customerRouter = express.Router();

// Public gateway callbacks. The payload is never trusted - every gateway
// re-verifies it (HMAC for the sandbox gateway, validation API for SSLCommerz).
async function gatewayCallback(req, res) {
  const payload = { ...req.body };
  if (req.params.result) payload.result = req.params.result.toUpperCase();
  const result = await service.handleCallback(req.params.gateway, payload);
  return success(res, { message: 'Payment callback processed', data: result });
}

customerRouter.post(
  '/callback/:gateway',
  validate({ params: validators.callbackParams }),
  asyncHandler(gatewayCallback)
);
customerRouter.post(
  '/callback/:gateway/:result',
  validate({ params: validators.callbackParams }),
  asyncHandler(gatewayCallback)
);

customerRouter.use(authenticate);

customerRouter.post(
  '/',
  authorize(PERMISSIONS.PAYMENTS_INITIATE),
  writeLimiter,
  validate({ body: validators.initiateBody }),
  asyncHandler(async (req, res) => created(res, { message: 'Payment initiated', data: await service.initiatePayment(req.user, req.body) }))
);

customerRouter.get(
  '/',
  authorize(PERMISSIONS.PAYMENTS_INITIATE),
  validate({ query: validators.myPaymentsQuery }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Payments retrieved', data: await service.listMyPayments(req.user, req.validatedQuery) })
  )
);

customerRouter.get(
  '/refunds',
  authorize(PERMISSIONS.REFUNDS_REQUEST),
  validate({ query: validators.myRefundsQuery }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Refunds retrieved', data: await service.listMyRefunds(req.user, req.validatedQuery) })
  )
);

customerRouter.post(
  '/refunds',
  authorize(PERMISSIONS.REFUNDS_REQUEST),
  writeLimiter,
  validate({ body: validators.refundBody }),
  asyncHandler(async (req, res) => created(res, { message: 'Refund requested', data: await service.requestRefund(req.user, req.body) }))
);

customerRouter.get(
  '/:id',
  authorize(PERMISSIONS.PAYMENTS_INITIATE),
  validate({ params: validators.idParam }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Payment retrieved', data: await service.getPaymentForUser(req.user, req.params.id) })
  )
);

customerRouter.post(
  '/:id/demo-complete',
  authorize(PERMISSIONS.PAYMENTS_INITIATE),
  writeLimiter,
  validate({ params: validators.idParam }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Sandbox payment completed', data: await service.completeDemoPayment(req.user, req.params.id) })
  )
);

const providerRouter = express.Router();

providerRouter.use(authenticate);

providerRouter.get(
  '/finance',
  authorize(PERMISSIONS.FINANCE_READ_OWN),
  asyncHandler(async (req, res) => success(res, { message: 'Finance summary retrieved', data: await service.providerFinance(req.user) }))
);

providerRouter.get(
  '/commissions',
  authorize(PERMISSIONS.FINANCE_READ_OWN),
  validate({ query: validators.providerFinanceQuery }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Commissions retrieved', data: await service.listProviderCommissions(req.user, req.validatedQuery) })
  )
);

providerRouter.get(
  '/earnings',
  authorize(PERMISSIONS.FINANCE_READ_OWN),
  validate({ query: validators.providerEarningsQuery }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Earnings retrieved', data: await service.listProviderEarnings(req.user, req.validatedQuery) })
  )
);

providerRouter.get(
  '/payouts',
  authorize(PERMISSIONS.FINANCE_READ_OWN),
  validate({ query: validators.providerPayoutsQuery }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Payouts retrieved', data: await service.listMyPayouts(req.user, req.validatedQuery) })
  )
);

providerRouter.post(
  '/payouts',
  authorize(PERMISSIONS.PAYOUTS_REQUEST),
  writeLimiter,
  validate({ body: validators.payoutBody }),
  asyncHandler(async (req, res) => created(res, { message: 'Payout requested', data: await service.requestPayout(req.user, req.body) }))
);

const adminRouter = express.Router();

adminRouter.use(authenticate);

adminRouter.get(
  '/payments',
  authorize(PERMISSIONS.PAYMENTS_MANAGE),
  validate({ query: validators.adminPaymentsQuery }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Payments retrieved', data: await service.listAllPayments(req.validatedQuery) })
  )
);

adminRouter.get(
  '/refunds',
  authorize(PERMISSIONS.REFUNDS_APPROVE),
  validate({ query: validators.adminRefundsQuery }),
  asyncHandler(async (req, res) => success(res, { message: 'Refunds retrieved', data: await service.listAllRefunds(req.validatedQuery) }))
);

adminRouter.post(
  '/refunds/:id/approve',
  authorize(PERMISSIONS.REFUNDS_APPROVE),
  validate({ params: validators.idParam, body: validators.refundDecisionBody }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Refund approved', data: await service.approveRefund(req.user, req.params.id) })
  )
);

adminRouter.post(
  '/refunds/:id/reject',
  authorize(PERMISSIONS.REFUNDS_APPROVE),
  validate({ params: validators.idParam, body: validators.refundDecisionBody }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Refund rejected', data: await service.rejectRefund(req.user, req.params.id, req.body) })
  )
);

adminRouter.post(
  '/refunds/:id/process',
  authorize(PERMISSIONS.REFUNDS_APPROVE),
  validate({ params: validators.idParam, body: validators.refundDecisionBody }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Refund processed', data: await service.processRefund(req.user, req.params.id, req.body) })
  )
);

adminRouter.get(
  '/commissions',
  authorize(PERMISSIONS.COMMISSIONS_MANAGE),
  validate({ query: validators.adminCommissionsQuery }),
  asyncHandler(async (req, res) =>
    success(res, { message: 'Commissions retrieved', data: await service.listAllCommissions(req.validatedQuery) })
  )
);

adminRouter.get(
  '/commissions/summary',
  authorize(PERMISSIONS.COMMISSIONS_MANAGE),
  asyncHandler(async (req, res) => success(res, { message: 'Commission summary retrieved', data: await service.commissionSummary() }))
);

adminRouter.get(
  '/payouts',
  authorize(PERMISSIONS.PAYOUTS_APPROVE),
  validate({ query: validators.adminPayoutsQuery }),
  asyncHandler(async (req, res) => success(res, { message: 'Payouts retrieved', data: await service.listAllPayouts(req.validatedQuery) }))
);

for (const action of ['approve', 'reject', 'paid']) {
  adminRouter.post(
    `/payouts/:id/${action}`,
    authorize(PERMISSIONS.PAYOUTS_APPROVE),
    validate({ params: validators.idParam, body: validators.payoutActionBody }),
    asyncHandler(async (req, res) =>
      success(res, {
        message: `Payout ${action === 'paid' ? 'marked as paid' : `${action}d`}`,
        data: await service.transitionPayout(req.user, req.params.id, action, req.body),
      })
    )
  );
}

module.exports = { customerRouter, providerRouter, adminRouter };
