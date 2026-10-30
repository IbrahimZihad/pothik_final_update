'use strict';

const { Op } = require('sequelize');
const { models } = require('../../models');

const DETAIL_INCLUDE = [
  { model: models.BookingItem, as: 'items' },
  { model: models.BookingPassenger, as: 'passengers' },
  { model: models.BookingStatusHistory, as: 'statusHistory' },
  { model: models.Payment, as: 'payments', attributes: ['id', 'provider', 'amount', 'currency', 'method', 'status', 'paid_at', 'created_at'] },
  { model: models.Coupon, as: 'coupon', attributes: ['id', 'code', 'description', 'type', 'value'], required: false },
  { model: models.CustomTrip, as: 'customTrip', attributes: ['id', 'title', 'status'], required: false },
];

async function findByReference(reference, { transaction, lock = false } = {}) {
  return models.Booking.findOne({
    where: { reference },
    transaction,
    lock: lock ? transaction.LOCK.UPDATE : undefined,
  });
}

async function findDetailByReference(reference, { transaction } = {}) {
  return models.Booking.findOne({
    where: { reference },
    include: DETAIL_INCLUDE,
    order: [
      [{ model: models.BookingItem, as: 'items' }, 'id', 'ASC'],
      [{ model: models.BookingStatusHistory, as: 'statusHistory' }, 'id', 'ASC'],
      [{ model: models.Payment, as: 'payments' }, 'created_at', 'DESC'],
    ],
    transaction,
  });
}

async function findDetailForUser(reference, userId) {
  return models.Booking.findOne({
    where: { reference, customer_user_id: userId },
    include: DETAIL_INCLUDE,
    order: [
      [{ model: models.BookingItem, as: 'items' }, 'id', 'ASC'],
      [{ model: models.BookingStatusHistory, as: 'statusHistory' }, 'id', 'ASC'],
      [{ model: models.Payment, as: 'payments' }, 'created_at', 'DESC'],
    ],
  });
}

async function listForCustomer(userId, { status, limit, offset }) {
  const where = { customer_user_id: userId };
  if (status) where.status = status;
  return models.Booking.findAndCountAll({
    where,
    include: [{ model: models.BookingItem, as: 'items', attributes: ['id', 'item_type', 'title', 'total_price', 'status'] }],
    order: [['created_at', 'DESC']],
    limit,
    offset,
    distinct: true,
  });
}

async function listForProvider(providerProfileId, { status, limit, offset }) {
  const where = {};
  if (status) where.status = status;
  return models.Booking.findAndCountAll({
    where,
    include: [
      { model: models.BookingItem, as: 'items', where: { provider_profile_id: providerProfileId }, required: true },
      { model: models.User, as: 'customer', attributes: ['id', 'name', 'email', 'phone'] },
    ],
    order: [['created_at', 'DESC']],
    limit,
    offset,
    distinct: true,
  });
}

async function listAll({ status, type, search, from, to, limit, offset }) {
  const where = {};
  if (status) where.status = status;
  if (type) where.type = type;
  if (from) where.start_date = { ...(where.start_date || {}), [Op.gte]: from };
  if (to) where.start_date = { ...(where.start_date || {}), [Op.lte]: to };
  if (search) where.reference = { [Op.like]: `%${search}%` };
  return models.Booking.findAndCountAll({
    where,
    include: [{ model: models.User, as: 'customer', attributes: ['id', 'name', 'email', 'phone'] }],
    order: [['created_at', 'DESC']],
    limit,
    offset,
  });
}

async function findItems(bookingId, { transaction } = {}) {
  return models.BookingItem.findAll({ where: { booking_id: bookingId }, order: [['id', 'ASC']], transaction });
}

async function findItemsForProvider(bookingId, providerProfileId, { transaction } = {}) {
  return models.BookingItem.findAll({
    where: { booking_id: bookingId, provider_profile_id: providerProfileId },
    order: [['id', 'ASC']],
    transaction,
  });
}

module.exports = {
  findByReference,
  findDetailByReference,
  findDetailForUser,
  listForCustomer,
  listForProvider,
  listAll,
  findItems,
  findItemsForProvider,
};
