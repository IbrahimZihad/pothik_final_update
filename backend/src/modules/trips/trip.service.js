'use strict';

const { models, sequelize } = require('../../models');
const pricing = require('../bookings/pricing.service');
const { NotFoundError, BusinessRuleError } = require('../../shared/errors');
const { getPagination, buildMeta } = require('../../shared/utils/pagination');
const { toAmount } = require('../../shared/utils/money');
const { listAddons } = require('../../shared/constants/addons');

function compositionItems(composition) {
  const rows = [];
  for (const destination of composition.destinations || []) {
    rows.push({
      item_type: 'DESTINATION',
      ref_id: destination.destinationId,
      title: null,
      quantity: 1,
      meta: { touristSpotIds: destination.touristSpotIds || [] },
    });
  }
  if (composition.package) {
    rows.push({
      item_type: 'PACKAGE',
      ref_id: composition.package.packageId,
      title: null,
      quantity: Number(composition.adults) + Number(composition.children || 0),
      meta: { departureId: composition.package.departureId || null },
    });
  }
  if (composition.hotel) {
    for (const room of composition.hotel.rooms) {
      rows.push({
        item_type: 'HOTEL_ROOM',
        ref_id: room.roomId,
        title: null,
        quantity: room.units,
        meta: {
          hotelId: composition.hotel.hotelId,
          checkIn: composition.hotel.checkIn,
          checkOut: composition.hotel.checkOut,
        },
      });
    }
  }
  if (composition.transport) {
    rows.push({
      item_type: 'VEHICLE',
      ref_id: composition.transport.vehicleId,
      title: null,
      quantity: 1,
      meta: {
        startDate: composition.transport.startDate,
        endDate: composition.transport.endDate,
        distanceKm: composition.transport.distanceKm || null,
      },
    });
  }
  if (composition.guide) {
    rows.push({
      item_type: 'GUIDE',
      ref_id: composition.guide.guideId,
      title: null,
      quantity: 1,
      meta: {
        startDate: composition.guide.startDate,
        endDate: composition.guide.endDate,
        hours: composition.guide.hours || null,
      },
    });
  }
  for (const addon of composition.addons || []) {
    rows.push({ item_type: 'SERVICE', ref_id: null, title: addon.code, quantity: addon.quantity, meta: { code: addon.code } });
  }
  return rows;
}

function serializeTrip(trip, { detail = false } = {}) {
  const plain = trip.get ? trip.get({ plain: true }) : trip;
  return {
    id: plain.id,
    title: plain.title,
    status: plain.status,
    startDate: plain.start_date,
    endDate: plain.end_date,
    adults: plain.adults,
    children: plain.children,
    requirements: plain.requirements,
    estimatedTotal: plain.estimated_total ? toAmount(plain.estimated_total) : null,
    createdAt: plain.created_at,
    updatedAt: plain.updated_at,
    quotation: plain.quotation
      ? {
          items: plain.quotation.items || [],
          subtotal: plain.quotation.subtotal,
          discountTotal: plain.quotation.discountTotal,
          taxTotal: plain.quotation.taxTotal,
          totalAmount: plain.quotation.totalAmount,
          coupon: plain.quotation.coupon || null,
          startDate: plain.quotation.startDate,
          endDate: plain.quotation.endDate,
        }
      : null,
    items: detail
      ? (plain.items || []).map((item) => ({
          id: item.id,
          itemType: item.item_type,
          refId: item.ref_id,
          title: item.title,
          quantity: item.quantity,
          meta: item.meta,
        }))
      : undefined,
  };
}

async function quoteTrip(user, { composition, couponCode }) {
  const quote = await pricing.buildQuote({
    type: 'CUSTOM_TRIP',
    composition,
    userId: user.id,
    couponCode,
  });
  return { ...quote, composition };
}

async function saveTrip(user, payload) {
  const quote = await pricing.buildQuote({
    type: 'CUSTOM_TRIP',
    composition: payload.composition,
    userId: user.id,
    couponCode: payload.couponCode,
  });

  return sequelize.transaction(async (transaction) => {
    const trip = await models.CustomTrip.create(
      {
        user_id: user.id,
        title: payload.title || 'My Bangladesh trip',
        status: 'QUOTED',
        start_date: quote.startDate,
        end_date: quote.endDate,
        adults: quote.adults,
        children: quote.children,
        requirements: payload.requirements || payload.composition.specialRequests || null,
        estimated_total: quote.totalAmount,
        quotation: { ...quote, composition: payload.composition },
      },
      { transaction }
    );

    await models.CustomTripItem.bulkCreate(
      compositionItems(payload.composition).map((item) => ({ ...item, custom_trip_id: trip.id })),
      { transaction }
    );

    const detail = await models.CustomTrip.findByPk(trip.id, {
      include: [{ model: models.CustomTripItem, as: 'items' }],
      transaction,
    });
    return serializeTrip(detail, { detail: true });
  });
}

async function listTrips(user, query) {
  const { page, limit, offset } = getPagination(query, { defaultLimit: 10 });
  const where = { user_id: user.id };
  if (query.status) where.status = query.status;
  const { rows, count } = await models.CustomTrip.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit,
    offset,
  });
  return {
    items: rows.map((trip) => serializeTrip(trip)),
    meta: buildMeta({ page, limit, total: count }),
  };
}

async function getTrip(user, tripId) {
  const trip = await models.CustomTrip.findOne({
    where: { id: tripId, user_id: user.id },
    include: [{ model: models.CustomTripItem, as: 'items' }],
  });
  if (!trip) throw new NotFoundError('Trip');
  return serializeTrip(trip, { detail: true });
}

async function updateTrip(user, tripId, payload) {
  const trip = await models.CustomTrip.findOne({ where: { id: tripId, user_id: user.id } });
  if (!trip) throw new NotFoundError('Trip');
  if (!['DRAFT', 'QUOTED'].includes(trip.status)) {
    throw new BusinessRuleError('Only draft or quoted trips can be edited', 'TRIP_NOT_EDITABLE');
  }

  return sequelize.transaction(async (transaction) => {
    const updates = {};
    if (payload.title !== undefined) updates.title = payload.title;
    if (payload.requirements !== undefined) updates.requirements = payload.requirements;

    if (payload.composition) {
      const quote = await pricing.buildQuote({
        type: 'CUSTOM_TRIP',
        composition: payload.composition,
        userId: user.id,
        couponCode: payload.couponCode,
      });
      updates.start_date = quote.startDate;
      updates.end_date = quote.endDate;
      updates.adults = quote.adults;
      updates.children = quote.children;
      updates.estimated_total = quote.totalAmount;
      updates.quotation = { ...quote, composition: payload.composition };
      updates.status = 'QUOTED';

      await models.CustomTripItem.destroy({ where: { custom_trip_id: trip.id }, transaction });
      await models.CustomTripItem.bulkCreate(
        compositionItems(payload.composition).map((item) => ({ ...item, custom_trip_id: trip.id })),
        { transaction }
      );
    }

    await trip.update(updates, { transaction });
    const detail = await models.CustomTrip.findByPk(trip.id, {
      include: [{ model: models.CustomTripItem, as: 'items' }],
      transaction,
    });
    return serializeTrip(detail, { detail: true });
  });
}

async function cancelTrip(user, tripId) {
  const trip = await models.CustomTrip.findOne({ where: { id: tripId, user_id: user.id } });
  if (!trip) throw new NotFoundError('Trip');
  if (!['DRAFT', 'QUOTED'].includes(trip.status)) {
    throw new BusinessRuleError('Only draft or quoted trips can be discarded', 'TRIP_NOT_CANCELLABLE');
  }
  await trip.update({ status: 'CANCELLED' });
  return { cancelled: true };
}

module.exports = {
  getAddons: listAddons,
  quoteTrip,
  saveTrip,
  listTrips,
  getTrip,
  updateTrip,
  cancelTrip,
  compositionItems,
};
