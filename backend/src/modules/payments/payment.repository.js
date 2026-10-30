'use strict';

const { Op } = require('sequelize');
const { models, sequelize } = require('../../models');

const PAID_STATUS = ['SUCCEEDED', 'REFUNDED', 'PARTIALLY_REFUNDED'];
const ACTIVE_REFUND_STATUSES = ['REQUESTED', 'APPROVED', 'PROCESSED'];

function findBookingByReference(reference, options = {}) {
  return models.Booking.findOne({ where: { reference }, ...options });
}

function findPaymentById(id, options = {}) {
  return models.Payment.findByPk(id, options);
}

function findPaymentByKey(idempotencyKey, options = {}) {
  return models.Payment.findOne({ where: { idempotency_key: idempotencyKey }, ...options });
}

function findPaymentByTxn(providerTxnId, options = {}) {
  return models.Payment.findOne({ where: { provider_txn_id: providerTxnId }, ...options });
}

async function listPaymentsForUser(userId, { page, limit, offset, status }) {
  const where = {};
  if (status) where.status = status;
  const customerBookings = await models.Booking.findAll({ where: { customer_user_id: userId }, attributes: ['id'] });
  where.booking_id = { [Op.in]: customerBookings.map((row) => row.id) };

  const { rows, count } = await models.Payment.findAndCountAll({
    where,
    include: [{ model: models.Booking, as: 'booking', attributes: ['id', 'reference', 'status', 'type'] }],
    order: [['id', 'DESC']],
    limit,
    offset,
  });
  return { rows, count };
}

async function listPayments({ page, limit, offset, status, provider, bookingId }) {
  const where = {};
  if (status) where.status = status;
  if (provider) where.provider = provider;
  if (bookingId) where.booking_id = bookingId;

  const { rows, count } = await models.Payment.findAndCountAll({
    where,
    include: [{ model: models.Booking, as: 'booking', attributes: ['id', 'reference', 'status', 'type', 'customer_user_id'] }],
    order: [['id', 'DESC']],
    limit,
    offset,
  });
  return { rows, count };
}

function findRefund(id, options = {}) {
  return models.Refund.findByPk(id, { include: [{ model: models.Booking, as: 'booking', attributes: ['id', 'reference', 'status'] }], ...options });
}

async function listRefundsForUser(userId, { page, limit, offset, status }) {
  const bookings = await models.Booking.findAll({ where: { customer_user_id: userId }, attributes: ['id'] });
  const where = { booking_id: { [Op.in]: bookings.map((row) => row.id) } };
  if (status) where.status = status;

  const { rows, count } = await models.Refund.findAndCountAll({
    where,
    include: [{ model: models.Booking, as: 'booking', attributes: ['id', 'reference', 'status'] }],
    order: [['id', 'DESC']],
    limit,
    offset,
  });
  return { rows, count };
}

async function listRefunds({ page, limit, offset, status, bookingId }) {
  const where = {};
  if (status) where.status = status;
  if (bookingId) where.booking_id = bookingId;

  const { rows, count } = await models.Refund.findAndCountAll({
    where,
    include: [{ model: models.Booking, as: 'booking', attributes: ['id', 'reference', 'status', 'customer_user_id'] }],
    order: [['id', 'DESC']],
    limit,
    offset,
  });
  return { rows, count };
}

async function refundedTotal(bookingId, options = {}) {
  const refunds = await models.Refund.findAll({
    where: { booking_id: bookingId, status: { [Op.in]: ACTIVE_REFUND_STATUSES } },
    attributes: ['amount'],
    ...options,
  });
  return refunds.reduce((sum, row) => sum + Number(row.amount), 0);
}

function findPayout(id, options = {}) {
  return models.ProviderPayout.findByPk(id, {
    include: [{ model: models.ProviderProfile, as: 'provider', attributes: ['id', 'business_name', 'user_id'] }],
    ...options,
  });
}

async function listPayoutsForProvider(providerProfileId, { page, limit, offset, status }) {
  const where = { provider_profile_id: providerProfileId };
  if (status) where.status = status;

  const { rows, count } = await models.ProviderPayout.findAndCountAll({ where, order: [['id', 'DESC']], limit, offset });
  return { rows, count };
}

async function listPayouts({ page, limit, offset, status, providerProfileId }) {
  const where = {};
  if (status) where.status = status;
  if (providerProfileId) where.provider_profile_id = providerProfileId;

  const { rows, count } = await models.ProviderPayout.findAndCountAll({
    where,
    include: [{ model: models.ProviderProfile, as: 'provider', attributes: ['id', 'business_name', 'type'] }],
    order: [['id', 'DESC']],
    limit,
    offset,
  });
  return { rows, count };
}

async function providerEarned(providerProfileId) {
  const rows = await sequelize.query(
    `SELECT COALESCE(SUM(bi.provider_payable), 0) AS total
       FROM booking_items bi
       JOIN bookings b ON b.id = bi.booking_id
      WHERE bi.provider_profile_id = :providerProfileId
        AND b.status = 'COMPLETED'
        AND bi.status <> 'CANCELLED'`,
    { replacements: { providerProfileId }, type: sequelize.QueryTypes.SELECT }
  );
  return Number(rows[0]?.total || 0);
}

async function providerPayoutTotal(providerProfileId, statuses) {
  const total = await models.ProviderPayout.sum('amount', {
    where: { provider_profile_id: providerProfileId, status: { [Op.in]: statuses } },
  });
  return Number(total || 0);
}

async function listCommissionsForProvider(providerProfileId, { page, limit, offset, status }) {
  const where = { provider_profile_id: providerProfileId };
  if (status) where.status = status;

  const { rows, count } = await models.Commission.findAndCountAll({
    where,
    include: [{ model: models.BookingItem, as: 'bookingItem', attributes: ['id', 'booking_id', 'title', 'item_type'] }],
    order: [['id', 'DESC']],
    limit,
    offset,
  });
  return { rows, count };
}

async function listCommissions({ page, limit, offset, status, providerProfileId }) {
  const where = {};
  if (status) where.status = status;
  if (providerProfileId) where.provider_profile_id = providerProfileId;

  const { rows, count } = await models.Commission.findAndCountAll({
    where,
    include: [
      { model: models.BookingItem, as: 'bookingItem', attributes: ['id', 'booking_id', 'title', 'item_type'] },
      { model: models.ProviderProfile, as: 'provider', attributes: ['id', 'business_name', 'type'] },
    ],
    order: [['id', 'DESC']],
    limit,
    offset,
  });
  return { rows, count };
}

async function listProviderEarnings(providerProfileId, { page, limit, offset }) {
  const { rows, count } = await models.BookingItem.findAndCountAll({
    where: { provider_profile_id: providerProfileId, status: 'COMPLETED' },
    include: [{ model: models.Booking, as: 'booking', attributes: ['id', 'reference', 'status', 'type', 'completed_at'] }],
    order: [['id', 'DESC']],
    limit,
    offset,
  });
  return { rows, count };
}

async function commissionTotals() {
  const rows = await sequelize.query(
    `SELECT status, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
       FROM commissions
      GROUP BY status`,
    { type: sequelize.QueryTypes.SELECT }
  );
  return rows.map((row) => ({ status: row.status, count: Number(row.count), total: Number(row.total) }));
}

module.exports = {
  PAID_STATUS,
  ACTIVE_REFUND_STATUSES,
  findBookingByReference,
  findPaymentById,
  findPaymentByKey,
  findPaymentByTxn,
  listPaymentsForUser,
  listPayments,
  findRefund,
  listRefundsForUser,
  listRefunds,
  refundedTotal,
  findPayout,
  listPayoutsForProvider,
  listPayouts,
  providerEarned,
  providerPayoutTotal,
  listCommissionsForProvider,
  listCommissions,
  listProviderEarnings,
  commissionTotals,
};
