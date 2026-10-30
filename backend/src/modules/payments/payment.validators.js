'use strict';

const { z } = require('zod');
const { paginationQuery, idParam, money } = require('../../shared/validators/common');

const PAYMENT_STATUSES = ['INITIATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'];
const REFUND_STATUSES = ['REQUESTED', 'APPROVED', 'REJECTED', 'PROCESSED'];
const PAYOUT_STATUSES = ['REQUESTED', 'APPROVED', 'PAID', 'REJECTED'];
const COMMISSION_STATUSES = ['PENDING', 'EARNED', 'PAID', 'REVERSED'];

const bookingReference = z.string().trim().min(4).max(40);

const initiateBody = z.object({
  bookingReference,
  amount: money.optional(),
  method: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.enum(['card', 'bkash', 'nagad', 'rocket', 'bank', 'sslcommerz']))
    .optional()
    .default('card'),
  gateway: z.enum(['demo', 'sslcommerz', 'bkash']).optional(),
  idempotencyKey: z.string().trim().min(8).max(120),
});

const callbackParams = z.object({
  gateway: z.enum(['demo', 'sslcommerz', 'bkash']),
  result: z.enum(['success', 'fail', 'cancel']).optional(),
});
const callbackBody = z.object({}).passthrough();

const refundBody = z.object({
  bookingReference,
  amount: money.optional(),
  reason: z.string().trim().min(3).max(500),
});

const refundDecisionBody = z.object({
  notes: z.string().trim().max(500).optional(),
  providerRefundId: z.string().trim().max(120).optional(),
});

const payoutBody = z.object({
  amount: money.refine((value) => value > 0, 'Amount must be positive'),
  method: z.enum(['bkash', 'nagad', 'bank', 'cash']).optional().default('bkash'),
  notes: z.string().trim().max(500).optional(),
});

const payoutActionBody = z.object({
  reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
});

const myPaymentsQuery = paginationQuery.extend({ status: z.enum(PAYMENT_STATUSES).optional() });
const myRefundsQuery = paginationQuery.extend({ status: z.enum(REFUND_STATUSES).optional() });

const adminPaymentsQuery = myPaymentsQuery.extend({
  provider: z.enum(['demo', 'sslcommerz', 'bkash', 'nagad']).optional(),
});

const adminRefundsQuery = paginationQuery.extend({
  status: z.enum(REFUND_STATUSES).optional(),
  bookingId: z.coerce.number().int().positive().optional(),
});

const adminPayoutsQuery = paginationQuery.extend({
  status: z.enum(PAYOUT_STATUSES).optional(),
  providerProfileId: z.coerce.number().int().positive().optional(),
});

const adminCommissionsQuery = paginationQuery.extend({
  status: z.enum(COMMISSION_STATUSES).optional(),
  providerProfileId: z.coerce.number().int().positive().optional(),
});

const providerFinanceQuery = paginationQuery.extend({ status: z.enum(COMMISSION_STATUSES).optional() });
const providerPayoutsQuery = paginationQuery.extend({ status: z.enum(PAYOUT_STATUSES).optional() });
const providerEarningsQuery = paginationQuery;

module.exports = {
  idParam,
  initiateBody,
  callbackParams,
  callbackBody,
  refundBody,
  refundDecisionBody,
  payoutBody,
  payoutActionBody,
  myPaymentsQuery,
  myRefundsQuery,
  adminPaymentsQuery,
  adminRefundsQuery,
  adminPayoutsQuery,
  adminCommissionsQuery,
  providerFinanceQuery,
  providerPayoutsQuery,
  providerEarningsQuery,
};
