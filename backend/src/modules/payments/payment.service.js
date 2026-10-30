'use strict';

const { UniqueConstraintError, Op } = require('sequelize');
const { models, sequelize } = require('../../models');
const repository = require('./payment.repository');
const bookingService = require('../bookings/booking.service');
const { transitionBooking } = require('../bookings/booking.state');
const notifications = require('../notifications/notification.service');
const { getGateway, gatewayStatus } = require('../../infrastructure/payments');
const config = require('../../config');
const logger = require('../../config/logger');
const { NotFoundError, ForbiddenError, BusinessRuleError, ConflictError } = require('../../shared/errors');
const { money, toAmount, max } = require('../../shared/utils/money');
const { getPagination, buildMeta } = require('../../shared/utils/pagination');
const { recordAudit } = require('../../shared/utils/audit');

const PAYABLE_BOOKING_STATUSES = ['AWAITING_PAYMENT', 'CONFIRMED'];
const REFUND_REQUESTABLE_STATUSES = ['CANCELLED', 'REFUND_PENDING', 'COMPLETED'];
const PAYOUT_ACTION_LABEL = { approve: 'approved', reject: 'rejected', paid: 'paid' };

// ---------------------------------------------------------------- serializers

function serializePayment(payment) {
  const plain = payment.get ? payment.get({ plain: true }) : payment;
  return {
    id: plain.id,
    bookingId: plain.booking_id,
    bookingReference: plain.booking?.reference || null,
    provider: plain.provider,
    providerTxnId: plain.provider_txn_id,
    amount: toAmount(plain.amount),
    currency: plain.currency,
    method: plain.method,
    status: plain.status,
    failureReason: plain.failure_reason,
    paidAt: plain.paid_at,
    verifiedAt: plain.verified_at,
    createdAt: plain.created_at,
    gatewayUrl: plain.gateway_payload?.gatewayUrl || null,
  };
}

function serializeRefund(refund) {
  const plain = refund.get ? refund.get({ plain: true }) : refund;
  return {
    id: plain.id,
    bookingId: plain.booking_id,
    bookingReference: plain.booking?.reference || null,
    paymentId: plain.payment_id,
    amount: toAmount(plain.amount),
    reason: plain.reason,
    status: plain.status,
    notes: plain.notes,
    providerRefundId: plain.provider_refund_id,
    requestedByUserId: plain.requested_by_user_id,
    processedByUserId: plain.processed_by_user_id,
    processedAt: plain.processed_at,
    createdAt: plain.created_at,
  };
}

function serializePayout(payout) {
  const plain = payout.get ? payout.get({ plain: true }) : payout;
  return {
    id: plain.id,
    providerProfileId: plain.provider_profile_id,
    providerName: plain.provider?.business_name || null,
    amount: toAmount(plain.amount),
    status: plain.status,
    method: plain.method,
    reference: plain.reference,
    notes: plain.notes,
    requestedAt: plain.requested_at,
    processedAt: plain.processed_at,
    createdAt: plain.created_at,
  };
}

function serializeCommission(row) {
  const plain = row.get ? row.get({ plain: true }) : row;
  return {
    id: plain.id,
    bookingItemId: plain.booking_item_id,
    bookingId: plain.bookingItem?.booking_id || null,
    itemType: plain.bookingItem?.item_type || null,
    title: plain.bookingItem?.title || null,
    providerProfileId: plain.provider_profile_id,
    providerName: plain.provider?.business_name || null,
    grossAmount: toAmount(plain.gross_amount),
    rate: Number(plain.rate),
    amount: toAmount(plain.amount),
    status: plain.status,
    earnedAt: plain.earned_at,
    createdAt: plain.created_at,
  };
}

function assertProvider(user, expectedType = null) {
  const profile = user.providerProfile;
  if (!profile) throw new ForbiddenError('No provider profile is linked to this account');
  if (expectedType && profile.type !== expectedType) {
    throw new ForbiddenError(`This action requires a ${expectedType.toLowerCase()} provider profile`);
  }
  if (profile.status !== 'APPROVED') throw new ForbiddenError('Your provider profile is not approved yet');
  return profile;
}

function callbackUrls(gatewayName) {
  const base = `${config.apiUrl}${config.apiPrefix}/payments/callback/${gatewayName}`;
  return { success: base, fail: `${base}/fail`, cancel: `${base}/cancel` };
}

// ----------------------------------------------------------------- payments

function paymentGateways() {
  return gatewayStatus();
}

async function initiatePayment(user, payload) {
  const booking = await repository.findBookingByReference(payload.bookingReference);
  if (!booking) throw new NotFoundError('Booking');
  if (Number(booking.customer_user_id) !== Number(user.id)) throw new ForbiddenError('This booking belongs to another account');

  if (!PAYABLE_BOOKING_STATUSES.includes(booking.status)) {
    throw new BusinessRuleError(`A booking in ${booking.status} status cannot be paid`, 'BOOKING_NOT_PAYABLE', {
      status: booking.status,
    });
  }

  const due = money(booking.due_amount);
  if (due.lessThanOrEqualTo(0)) throw new BusinessRuleError('This booking is already fully paid', 'BOOKING_ALREADY_PAID');

  const amount = payload.amount ? money(payload.amount) : due;
  if (!amount.isFinite() || amount.lessThanOrEqualTo(0)) throw new BusinessRuleError('Payment amount must be positive', 'INVALID_PAYMENT_AMOUNT');
  if (amount.greaterThan(due)) {
    throw new BusinessRuleError('Payment exceeds the outstanding balance', 'PAYMENT_EXCEEDS_DUE', { due: toAmount(due) });
  }

  const existing = await repository.findPaymentByKey(payload.idempotencyKey);
  if (existing) {
    if (Number(existing.booking_id) !== Number(booking.id) || !money(existing.amount).equals(amount)) {
      throw new ConflictError('This idempotency key was already used with different payment details');
    }
    return { payment: serializePayment(existing), gatewayUrl: existing.gateway_payload?.gatewayUrl || null, idempotent: true };
  }

  const gatewayName = payload.gateway || config.payments.gateway;
  const gateway = getGateway(gatewayName);

  let payment;
  try {
    payment = await models.Payment.create({
      booking_id: booking.id,
      provider: gatewayName,
      idempotency_key: payload.idempotencyKey,
      amount: toAmount(amount),
      currency: booking.currency || 'BDT',
      method: payload.method || null,
      status: 'INITIATED',
    });
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      const raced = await repository.findPaymentByKey(payload.idempotencyKey);
      if (raced) return { payment: serializePayment(raced), gatewayUrl: raced.gateway_payload?.gatewayUrl || null, idempotent: true };
    }
    throw err;
  }

  try {
    const session = await gateway.createSession({
      payment,
      booking,
      customer: { name: user.name, email: user.email },
      urls: callbackUrls(gatewayName),
    });
    await payment.update({
      status: 'PENDING',
      provider_txn_id: session.providerTxnId,
      gateway_payload: { ...(session.raw || {}), gatewayUrl: session.gatewayUrl },
    });
  } catch (err) {
    await payment.update({ status: 'FAILED', failure_reason: String(err.message).slice(0, 490) });
    throw err;
  }

  return { payment: serializePayment(payment), gatewayUrl: payment.gateway_payload?.gatewayUrl || null, idempotent: false };
}

async function resolvePayment(payload, verified) {
  const candidates = [payload.paymentId, payload.payment_id, payload.paymentID, payload.tran_id, verified.reference].filter(
    (value) => value !== undefined && value !== null && value !== ''
  );
  for (const candidate of candidates) {
    const value = String(candidate);
    if (/^\d+$/.test(value)) {
      const byId = await repository.findPaymentById(Number(value));
      if (byId) return byId;
    }
    const byTxn = await repository.findPaymentByTxn(value);
    if (byTxn) return byTxn;
  }
  if (verified.providerTxnId) {
    const byTxn = await repository.findPaymentByTxn(verified.providerTxnId);
    if (byTxn) return byTxn;
  }
  return null;
}

async function recordSettlement(paymentId, verified) {
  return sequelize.transaction(async (transaction) => {
    const payment = await models.Payment.findByPk(paymentId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!payment) throw new NotFoundError('Payment');

    const booking = await models.Booking.findByPk(payment.booking_id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!booking) throw new NotFoundError('Booking');

    if (repository.PAID_STATUS.includes(payment.status)) {
      return { payment, booking, alreadySettled: true, excess: null };
    }

    if (verified.amount !== undefined && verified.amount !== null) {
      if (!money(verified.amount).equals(money(payment.amount))) {
        throw new BusinessRuleError('Callback amount does not match the payment', 'PAYMENT_AMOUNT_MISMATCH', {
          expected: toAmount(payment.amount),
          received: String(verified.amount),
        });
      }
    }
    if (verified.reference && /^PTK-/.test(String(verified.reference)) && verified.reference !== booking.reference) {
      throw new BusinessRuleError('Callback booking reference does not match the payment', 'PAYMENT_REFERENCE_MISMATCH');
    }

    const now = new Date();
    await payment.update(
      {
        status: 'SUCCEEDED',
        provider_txn_id: verified.providerTxnId || payment.provider_txn_id,
        paid_at: now,
        verified_at: now,
        gateway_payload: { ...(payment.gateway_payload || {}), callback: verified.raw ?? verified },
      },
      { transaction }
    );

    let excess = null;

    if (PAYABLE_BOOKING_STATUSES.includes(booking.status)) {
      const due = money(booking.due_amount);
      let applied = money(payment.amount);
      if (applied.greaterThan(due)) {
        excess = applied.minus(due);
        applied = due;
      }
      if (applied.isPositive()) {
        await bookingService.applyPayment(booking, toAmount(applied), {
          transaction,
          actorUserId: booking.customer_user_id,
        });
      }
    } else if (booking.status === 'CANCELLED' || booking.status === 'REFUND_PENDING') {
      excess = money(payment.amount);
    } else {
      throw new BusinessRuleError(`A booking in ${booking.status} status cannot accept this payment`, 'BOOKING_NOT_PAYABLE');
    }

    let refund = null;
    if (excess && excess.isPositive()) {
      refund = await models.Refund.create(
        {
          booking_id: booking.id,
          payment_id: payment.id,
          amount: toAmount(excess),
          reason:
            booking.status === 'CANCELLED' || booking.status === 'REFUND_PENDING'
              ? 'Payment captured for a cancelled booking'
              : 'Overpayment returned to the customer',
          status: 'REQUESTED',
          requested_by_user_id: booking.customer_user_id,
        },
        { transaction }
      );
      if (booking.status === 'CANCELLED') {
        await transitionBooking(booking, 'REFUND_PENDING', {
          userId: booking.customer_user_id,
          reason: 'Payment received after cancellation - refund queued',
          transaction,
        });
      }
    }

    return { payment, booking, alreadySettled: false, refund };
  });
}

async function handleCallback(gatewayName, payload) {
  const gateway = getGateway(gatewayName);
  const verified = await gateway.verifyCallback(payload);

  if (verified.status === 'INVALID') {
    logger.warn({ gateway: gatewayName }, 'payment callback failed verification');
    throw new BusinessRuleError(verified.reason || 'Payment verification failed', 'PAYMENT_VERIFICATION_FAILED');
  }

  const payment = await resolvePayment(payload, verified);
  if (!payment) throw new NotFoundError('Payment');

  if (verified.status === 'FAILED' || verified.status === 'CANCELLED') {
    if (!repository.PAID_STATUS.includes(payment.status)) {
      await payment.update({
        status: 'FAILED',
        failure_reason: `Gateway reported ${verified.status.toLowerCase()}`.slice(0, 490),
        gateway_payload: { ...(payment.gateway_payload || {}), callback: verified.raw ?? verified },
      });
    }
    const failedBooking = await models.Booking.findByPk(payment.booking_id, { attributes: ['id', 'reference'] });
    return { payment: serializePayment(payment), bookingStatus: null, bookingReference: failedBooking?.reference || null, settled: false };
  }

  const { payment: settled, booking, alreadySettled, refund } = await recordSettlement(payment.id, verified);

  if (!alreadySettled) {
    try {
      await notifications.notifyPaymentReceived(booking, settled);
      if (refund) await notifications.notifyRefundUpdate(refund, 'REQUESTED');
    } catch (err) {
      logger.error({ err: err.message, paymentId: payment.id }, 'payment notification failed');
    }
  }

  return {
    payment: serializePayment(settled),
    bookingStatus: booking.status,
    bookingReference: booking.reference,
    settled: !alreadySettled,
    alreadySettled,
  };
}

async function completeDemoPayment(user, paymentId) {
  if (config.payments.gateway !== 'demo' || config.isProd) {
    throw new ForbiddenError('Sandbox payments are disabled');
  }

  const payment = await repository.findPaymentById(paymentId, {
    include: [{ model: models.Booking, as: 'booking', attributes: ['id', 'reference', 'customer_user_id'] }],
  });
  if (!payment) throw new NotFoundError('Payment');
  if (Number(payment.booking.customer_user_id) !== Number(user.id)) {
    throw new ForbiddenError('This payment belongs to another account');
  }

  const gateway = getGateway('demo');
  const callback = gateway.buildCallback({
    paymentId: payment.id,
    amount: toAmount(payment.amount),
    bookingReference: payment.booking.reference,
    result: 'SUCCESS',
  });
  return handleCallback('demo', callback);
}

async function getPaymentForUser(user, id) {
  const payment = await repository.findPaymentById(id, {
    include: [{ model: models.Booking, as: 'booking', attributes: ['id', 'reference', 'status', 'customer_user_id'] }],
  });
  if (!payment) throw new NotFoundError('Payment');
  if (Number(payment.booking.customer_user_id) !== Number(user.id)) throw new ForbiddenError('This payment belongs to another account');
  return serializePayment(payment);
}

async function listMyPayments(user, query) {
  const { page, limit, offset } = getPagination(query, { defaultLimit: 20, maxLimit: 100 });
  const { rows, count } = await repository.listPaymentsForUser(user.id, { page, limit, offset, status: query.status });
  return { items: rows.map(serializePayment), meta: buildMeta({ page, limit, total: count }) };
}

async function listAllPayments(query) {
  const { page, limit, offset } = getPagination(query, { defaultLimit: 25, maxLimit: 100 });
  const { rows, count } = await repository.listPayments({ page, limit, offset, status: query.status, provider: query.provider });
  return { items: rows.map(serializePayment), meta: buildMeta({ page, limit, total: count }) };
}

// ------------------------------------------------------------------ refunds

async function requestRefund(user, { bookingReference, amount, reason }) {
  const booking = await repository.findBookingByReference(bookingReference);
  if (!booking) throw new NotFoundError('Booking');
  if (Number(booking.customer_user_id) !== Number(user.id)) throw new ForbiddenError('This booking belongs to another account');
  if (!REFUND_REQUESTABLE_STATUSES.includes(booking.status)) {
    throw new BusinessRuleError(`Refunds are not available for a booking in ${booking.status} status`, 'REFUND_NOT_ALLOWED', {
      status: booking.status,
    });
  }

  const paid = money(booking.paid_amount);
  if (!paid.isPositive()) throw new BusinessRuleError('There is no payment to refund', 'NOTHING_TO_REFUND');

  const already = await repository.refundedTotal(booking.id);
  const refundable = max(0, paid.minus(already));
  const requested = amount ? money(amount) : refundable;
  if (!requested.isPositive()) throw new BusinessRuleError('This booking has already been refunded', 'ALREADY_REFUNDED');
  if (requested.greaterThan(refundable)) {
    throw new BusinessRuleError('Refund amount exceeds the refundable balance', 'REFUND_EXCEEDS_BALANCE', {
      refundable: toAmount(refundable),
    });
  }

  const result = await sequelize.transaction(async (transaction) => {
    const latestPayment = await models.Payment.findOne({
      where: { booking_id: booking.id, status: { [Op.in]: repository.PAID_STATUS } },
      order: [['id', 'DESC']],
      transaction,
    });

    const refund = await models.Refund.create(
      {
        booking_id: booking.id,
        payment_id: latestPayment?.id || null,
        amount: toAmount(requested),
        reason: reason || 'Customer refund request',
        status: 'REQUESTED',
        requested_by_user_id: user.id,
      },
      { transaction }
    );

    const locked = await models.Booking.findByPk(booking.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (locked.status === 'CANCELLED') {
      await transitionBooking(locked, 'REFUND_PENDING', {
        userId: user.id,
        reason: 'Refund requested by customer',
        transaction,
      });
    }
    return refund;
  });

  await notifications.notifyRefundUpdate(await repository.findRefund(result.id), 'REQUESTED');
  return serializeRefund(result);
}

async function listMyRefunds(user, query) {
  const { page, limit, offset } = getPagination(query, { defaultLimit: 20, maxLimit: 100 });
  const { rows, count } = await repository.listRefundsForUser(user.id, { page, limit, offset, status: query.status });
  return { items: rows.map(serializeRefund), meta: buildMeta({ page, limit, total: count }) };
}

async function listAllRefunds(query) {
  const { page, limit, offset } = getPagination(query, { defaultLimit: 25, maxLimit: 100 });
  const { rows, count } = await repository.listRefunds({ page, limit, offset, status: query.status });
  return { items: rows.map(serializeRefund), meta: buildMeta({ page, limit, total: count }) };
}

async function approveRefund(admin, id, context = {}) {
  const refund = await repository.findRefund(id);
  if (!refund) throw new NotFoundError('Refund');
  if (refund.status !== 'REQUESTED') {
    throw new BusinessRuleError(`Refund is already ${refund.status.toLowerCase()}`, 'INVALID_REFUND_STATUS');
  }
  await refund.update({ status: 'APPROVED', processed_by_user_id: admin.id, processed_at: new Date() });
  await recordAudit({
    actorUserId: admin.id,
    action: 'refund.approved',
    entityType: 'refund',
    entityId: refund.id,
    metadata: { bookingId: refund.booking_id, amount: toAmount(refund.amount) },
    ...context,
  });
  await notifications.notifyRefundUpdate(refund, 'APPROVED');
  return serializeRefund(refund);
}

async function rejectRefund(admin, id, { notes } = {}, context = {}) {
  const refund = await repository.findRefund(id);
  if (!refund) throw new NotFoundError('Refund');
  if (!['REQUESTED', 'APPROVED'].includes(refund.status)) {
    throw new BusinessRuleError(`Refund is already ${refund.status.toLowerCase()}`, 'INVALID_REFUND_STATUS');
  }

  await sequelize.transaction(async (transaction) => {
    await refund.update(
      { status: 'REJECTED', notes: notes || refund.notes, processed_by_user_id: admin.id, processed_at: new Date() },
      { transaction }
    );

    const booking = await models.Booking.findByPk(refund.booking_id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!booking || booking.status !== 'REFUND_PENDING') return;

    const pending = await models.Refund.count({
      where: { booking_id: booking.id, status: { [Op.in]: ['REQUESTED', 'APPROVED'] }, id: { [Op.ne]: refund.id } },
      transaction,
    });
    if (pending === 0) {
      await transitionBooking(booking, 'CANCELLED', { userId: admin.id, reason: 'Refund request rejected', transaction });
    }
  });

  await notifications.notifyRefundUpdate(refund, 'REJECTED');
  await recordAudit({
    actorUserId: admin.id,
    action: 'refund.rejected',
    entityType: 'refund',
    entityId: refund.id,
    metadata: { bookingId: refund.booking_id, amount: toAmount(refund.amount), notes: notes || null },
    ...context,
  });
  return serializeRefund(refund);
}

async function processRefund(admin, id, { providerRefundId, notes } = {}, context = {}) {
  const refund = await repository.findRefund(id);
  if (!refund) throw new NotFoundError('Refund');
  if (refund.status !== 'APPROVED') {
    throw new BusinessRuleError('Only approved refunds can be processed', 'INVALID_REFUND_STATUS', { status: refund.status });
  }

  await sequelize.transaction(async (transaction) => {
    const locked = await models.Refund.findByPk(refund.id, { transaction, lock: transaction.LOCK.UPDATE });
    await locked.update(
      {
        status: 'PROCESSED',
        provider_refund_id: providerRefundId || locked.provider_refund_id,
        notes: notes || locked.notes,
        processed_by_user_id: admin.id,
        processed_at: new Date(),
      },
      { transaction }
    );

    const booking = await models.Booking.findByPk(locked.booking_id, { transaction, lock: transaction.LOCK.UPDATE });
    const processedTotal = await models.Refund.sum('amount', {
      where: { booking_id: booking.id, status: 'PROCESSED' },
      transaction,
    });
    const paid = money(booking.paid_amount);

    const payments = await models.Payment.findAll({
      where: { booking_id: booking.id, status: { [Op.in]: repository.PAID_STATUS } },
      transaction,
    });
    let remaining = money(processedTotal || 0);
    for (const payment of payments) {
      if (remaining.lessThanOrEqualTo(0)) break;
      const refunded = money(payment.amount);
      const newStatus = remaining.greaterThanOrEqualTo(refunded) ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
      await payment.update({ status: newStatus }, { transaction });
      remaining = remaining.minus(refunded);
    }

    if (money(processedTotal || 0).greaterThanOrEqualTo(paid) && booking.status === 'REFUND_PENDING') {
      await transitionBooking(booking, 'REFUNDED', { userId: admin.id, reason: 'Refund completed', transaction });
    }
  });

  await notifications.notifyRefundUpdate(refund, 'PROCESSED');
  await recordAudit({
    actorUserId: admin.id,
    action: 'refund.processed',
    entityType: 'refund',
    entityId: refund.id,
    metadata: { bookingId: refund.booking_id, amount: toAmount(refund.amount), providerRefundId: providerRefundId || null },
    ...context,
  });
  return serializeRefund(await repository.findRefund(refund.id));
}

// ------------------------------------------------------- commissions/payouts

async function listProviderCommissions(user, query) {
  const profile = assertProvider(user);
  const { page, limit, offset } = getPagination(query, { defaultLimit: 20, maxLimit: 100 });
  const { rows, count } = await repository.listCommissionsForProvider(profile.id, { page, limit, offset, status: query.status });
  return { items: rows.map(serializeCommission), meta: buildMeta({ page, limit, total: count }) };
}

async function listProviderEarnings(user, query) {
  const profile = assertProvider(user);
  const { page, limit, offset } = getPagination(query, { defaultLimit: 20, maxLimit: 100 });
  const { rows, count } = await repository.listProviderEarnings(profile.id, { page, limit, offset });
  return {
    items: rows.map((row) => {
      const plain = row.get({ plain: true });
      return {
        bookingItemId: plain.id,
        bookingReference: plain.booking?.reference || null,
        title: plain.title,
        itemType: plain.item_type,
        gross: toAmount(plain.total_price),
        commission: toAmount(plain.commission_amount),
        payable: toAmount(plain.provider_payable),
        completedAt: plain.booking?.completed_at || null,
      };
    }),
    meta: buildMeta({ page, limit, total: count }),
  };
}

async function providerFinance(user) {
  const profile = assertProvider(user);
  const earned = await repository.providerEarned(profile.id);
  const requested = await repository.providerPayoutTotal(profile.id, ['REQUESTED']);
  const approved = await repository.providerPayoutTotal(profile.id, ['APPROVED']);
  const paid = await repository.providerPayoutTotal(profile.id, ['PAID']);
  const available = max(0, money(earned).minus(money(requested).plus(money(approved)).plus(money(paid))));

  return {
    providerProfileId: profile.id,
    earned: toAmount(earned),
    requested: toAmount(requested),
    approved: toAmount(approved),
    paidOut: toAmount(paid),
    available: toAmount(available),
  };
}

async function requestPayout(user, { amount, method, notes }) {
  const profile = assertProvider(user);
  const finance = await providerFinance(user);
  const requested = money(amount);
  if (!requested.isPositive()) throw new BusinessRuleError('Payout amount must be positive', 'INVALID_PAYOUT_AMOUNT');
  if (requested.greaterThan(money(finance.available))) {
    throw new BusinessRuleError('Payout exceeds your available balance', 'PAYOUT_EXCEEDS_BALANCE', { available: finance.available });
  }

  const payout = await models.ProviderPayout.create({
    provider_profile_id: profile.id,
    amount: toAmount(requested),
    status: 'REQUESTED',
    method: method || null,
    notes: notes || null,
    requested_at: new Date(),
  });

  try {
    await notifications.notifyPayoutRequested(payout.id);
  } catch (err) {
    logger.error({ err: err.message, payoutId: payout.id }, 'payout notification failed');
  }

  return serializePayout(await repository.findPayout(payout.id));
}

async function listMyPayouts(user, query) {
  const profile = assertProvider(user);
  const { page, limit, offset } = getPagination(query, { defaultLimit: 20, maxLimit: 100 });
  const { rows, count } = await repository.listPayoutsForProvider(profile.id, { page, limit, offset, status: query.status });
  return { items: rows.map(serializePayout), meta: buildMeta({ page, limit, total: count }) };
}

async function listAllPayouts(query) {
  const { page, limit, offset } = getPagination(query, { defaultLimit: 25, maxLimit: 100 });
  const { rows, count } = await repository.listPayouts({
    page,
    limit,
    offset,
    status: query.status,
    providerProfileId: query.providerProfileId,
  });
  return { items: rows.map(serializePayout), meta: buildMeta({ page, limit, total: count }) };
}

async function listAllCommissions(query) {
  const { page, limit, offset } = getPagination(query, { defaultLimit: 25, maxLimit: 100 });
  const { rows, count } = await repository.listCommissions({
    page,
    limit,
    offset,
    status: query.status,
    providerProfileId: query.providerProfileId,
  });
  return { items: rows.map(serializeCommission), meta: buildMeta({ page, limit, total: count }) };
}

async function commissionSummary() {
  const totals = await repository.commissionTotals();
  return { byStatus: totals, totalEarned: toAmount(totals.filter((row) => row.status === 'EARNED' || row.status === 'PAID').reduce((sum, row) => sum + row.total, 0)) };
}

async function transitionPayout(admin, id, action, { reference, notes } = {}, context = {}) {
  const payout = await repository.findPayout(id);
  if (!payout) throw new NotFoundError('Payout');

  const allowed = { approve: ['REQUESTED', 'APPROVED'], reject: ['REQUESTED', 'APPROVED'], paid: ['APPROVED'] };
  if (!allowed[action]) throw new BusinessRuleError('Unknown payout action', 'INVALID_PAYOUT_ACTION');
  if (!allowed[action].includes(payout.status)) {
    throw new BusinessRuleError(`Payout cannot be ${action} from ${payout.status.toLowerCase()}`, 'INVALID_PAYOUT_STATUS', { status: payout.status });
  }

  if (action === 'approve') {
    await payout.update({ status: 'APPROVED', processed_by_user_id: admin.id, processed_at: new Date() });
  } else if (action === 'reject') {
    await payout.update({ status: 'REJECTED', notes: notes || payout.notes, processed_by_user_id: admin.id, processed_at: new Date() });
  } else {
    await payout.update({
      status: 'PAID',
      reference: reference || payout.reference,
      notes: notes || payout.notes,
      processed_by_user_id: admin.id,
      processed_at: new Date(),
    });
  }

  try {
    await notifications.notify(payout.provider.user_id, {
      type: 'PAYOUT_UPDATE',
      title: `Payout ${payout.status.toLowerCase()}`,
      body: `Your payout of BDT ${Number(payout.amount).toFixed(2)} is now ${payout.status.toLowerCase()}.`,
      data: { payoutId: payout.id },
    });
  } catch (err) {
    logger.error({ err: err.message, payoutId: payout.id }, 'payout notification failed');
  }

  await recordAudit({
    actorUserId: admin.id,
    action: `payout.${PAYOUT_ACTION_LABEL[action]}`,
    entityType: 'provider_payout',
    entityId: payout.id,
    metadata: {
      providerProfileId: payout.provider_profile_id,
      amount: toAmount(payout.amount),
      reference: reference || null,
      notes: notes || null,
    },
    ...context,
  });

  return serializePayout(await repository.findPayout(payout.id));
}

module.exports = {
  paymentGateways,
  initiatePayment,
  handleCallback,
  completeDemoPayment,
  getPaymentForUser,
  listMyPayments,
  listAllPayments,
  requestRefund,
  listMyRefunds,
  listAllRefunds,
  approveRefund,
  rejectRefund,
  processRefund,
  listProviderCommissions,
  listProviderEarnings,
  providerFinance,
  requestPayout,
  listMyPayouts,
  listAllPayouts,
  listAllCommissions,
  commissionSummary,
  transitionPayout,
  serializePayment,
  serializeRefund,
  serializePayout,
  serializeCommission,
};
