'use strict';

const { BusinessRuleError } = require('../../shared/errors');
const { models } = require('../../models');

/**
 * The only legal booking status transitions. Every status change must go through
 * transitionBooking() so no code path can set an arbitrary status directly.
 */
const TRANSITIONS = {
  PENDING: ['AWAITING_CONFIRMATION', 'AWAITING_PAYMENT', 'CANCELLED', 'REJECTED'],
  AWAITING_CONFIRMATION: ['QUOTED', 'AWAITING_PAYMENT', 'REJECTED', 'CANCELLED'],
  QUOTED: ['AWAITING_PAYMENT', 'REJECTED', 'CANCELLED'],
  AWAITING_PAYMENT: ['CONFIRMED', 'REJECTED', 'CANCELLED'],
  CONFIRMED: ['IN_PROGRESS', 'CANCELLED', 'REFUND_PENDING'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: ['REFUND_PENDING'],
  REFUND_PENDING: ['REFUNDED', 'CANCELLED'],
  REFUNDED: [],
};

const ACTIVE_STATUSES = ['PENDING', 'AWAITING_CONFIRMATION', 'QUOTED', 'AWAITING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS'];

function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    throw new BusinessRuleError(`Booking cannot move from ${from} to ${to}`, 'INVALID_STATUS_TRANSITION', {
      from,
      to,
      allowed: TRANSITIONS[from] || [],
    });
  }
}

async function transitionBooking(booking, to, { userId = null, reason = null, transaction } = {}) {
  const from = booking.status;
  assertTransition(from, to);

  const updates = { status: to };
  if (to === 'CONFIRMED') updates.confirmed_at = new Date();
  if (to === 'CANCELLED') updates.cancelled_at = new Date();
  if (to === 'COMPLETED') updates.completed_at = new Date();
  if (reason) updates.cancellation_reason = reason;

  await booking.update(updates, { transaction });
  await models.BookingStatusHistory.create(
    {
      booking_id: booking.id,
      from_status: from,
      to_status: to,
      changed_by_user_id: userId,
      reason,
    },
    { transaction }
  );
  return booking;
}

module.exports = { TRANSITIONS, ACTIVE_STATUSES, canTransition, assertTransition, transitionBooking };
