'use strict';

const { Op } = require('sequelize');
const { models, sequelize } = require('../../models');
const repository = require('./booking.repository');
const pricing = require('./pricing.service');
const { transitionBooking } = require('./booking.state');
const { NotFoundError, ForbiddenError, BusinessRuleError, ConflictError } = require('../../shared/errors');
const { money, toAmount, percentOf } = require('../../shared/utils/money');
const { generateBookingReference } = require('../../shared/utils/bookingReference');
const { enumerateDates, addDays, isPast } = require('../../shared/utils/dates');
const { getPagination, buildMeta } = require('../../shared/utils/pagination');
const { ROLES } = require('../../shared/constants/roles');
const notifications = require('../notifications/notification.service');
const logger = require('../../config/logger');

// ------------------------------------------------------------------ helpers

async function nextReference(transaction) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const reference = generateBookingReference();
    const exists = await models.Booking.findOne({ where: { reference }, transaction });
    if (!exists) return reference;
  }
  throw new ConflictError('Could not allocate a booking reference, please retry');
}

function defaultCancellationPolicy(type) {
  if (type === 'PACKAGE') {
    return 'Free cancellation until 7 days before departure. 50% refund within 7 days of departure.';
  }
  return 'Free cancellation until 48 hours before the trip start. Later cancellations may incur provider charges.';
}

async function compositionFromTrip(user, tripId) {
  const trip = await models.CustomTrip.findOne({ where: { id: tripId, user_id: user.id } });
  if (!trip) throw new NotFoundError('Trip');
  if (!['DRAFT', 'QUOTED'].includes(trip.status)) {
    throw new BusinessRuleError('This trip has already been booked', 'TRIP_ALREADY_BOOKED');
  }
  const composition = trip.quotation?.composition;
  if (!composition) throw new BusinessRuleError('The trip has no saved composition', 'TRIP_INCOMPLETE');
  return {
    ...composition,
    adults: trip.adults || composition.adults,
    children: trip.children ?? composition.children,
    specialRequests: trip.requirements || composition.specialRequests,
  };
}

function serializeItem(item) {
  const plain = item.get ? item.get({ plain: true }) : item;
  return {
    id: plain.id,
    itemType: plain.item_type,
    refId: plain.item_type === 'SERVICE' ? null : plain.ref_id,
    providerProfileId: plain.provider_profile_id,
    title: plain.title,
    startDate: plain.start_date,
    endDate: plain.end_date,
    quantity: plain.quantity,
    unitPrice: toAmount(plain.unit_price),
    totalPrice: toAmount(plain.total_price),
    commissionRate: Number(plain.commission_rate || 0),
    commissionAmount: toAmount(plain.commission_amount),
    providerPayable: toAmount(plain.provider_payable),
    status: plain.status,
    meta: plain.meta || null,
  };
}

function serializeBooking(booking, { providerProfileId = null, includeCustomer = false } = {}) {
  const plain = booking.get({ plain: true });
  const items = (plain.items || [])
    .filter((item) => !providerProfileId || Number(item.provider_profile_id) === Number(providerProfileId))
    .map(serializeItem);

  return {
    id: plain.id,
    reference: plain.reference,
    type: plain.type,
    status: plain.status,
    startDate: plain.start_date,
    endDate: plain.end_date,
    adults: plain.adults,
    children: plain.children,
    contact: { name: plain.contact_name, phone: plain.contact_phone, email: plain.contact_email },
    specialRequests: plain.special_requests,
    currency: plain.currency,
    subtotal: toAmount(plain.subtotal),
    discountTotal: toAmount(plain.discount_total),
    taxTotal: toAmount(plain.tax_total),
    totalAmount: toAmount(plain.total_amount),
    paidAmount: toAmount(plain.paid_amount),
    dueAmount: toAmount(plain.due_amount),
    coupon: plain.coupon
      ? { id: plain.coupon.id, code: plain.coupon.code, description: plain.coupon.description, type: plain.coupon.type, value: Number(plain.coupon.value) }
      : null,
    cancellationPolicy: plain.cancellation_policy,
    cancellationReason: plain.cancellation_reason,
    confirmedAt: plain.confirmed_at,
    cancelledAt: plain.cancelled_at,
    completedAt: plain.completed_at,
    createdAt: plain.created_at,
    customTripId: plain.custom_trip_id,
    items,
    passengers: (plain.passengers || []).map((passenger) => ({
      id: passenger.id,
      fullName: passenger.full_name,
      age: passenger.age,
      gender: passenger.gender,
    })),
    payments: (plain.payments || []).map((payment) => ({
      id: payment.id,
      provider: payment.provider,
      amount: toAmount(payment.amount),
      currency: payment.currency,
      method: payment.method,
      status: payment.status,
      paidAt: payment.paid_at,
      createdAt: payment.created_at,
    })),
    statusHistory: (plain.statusHistory || []).map((entry) => ({
      from: entry.from_status,
      to: entry.to_status,
      reason: entry.reason,
      at: entry.created_at,
    })),
    customer:
      includeCustomer && plain.customer
        ? { id: plain.customer.id, name: plain.customer.name, email: plain.customer.email, phone: plain.customer.phone }
        : undefined,
  };
}

function serializeBookingSummary(booking) {
  const plain = booking.get ? booking.get({ plain: true }) : booking;
  return {
    id: plain.id,
    reference: plain.reference,
    type: plain.type,
    status: plain.status,
    startDate: plain.start_date,
    endDate: plain.end_date,
    adults: plain.adults,
    children: plain.children,
    totalAmount: toAmount(plain.total_amount),
    paidAmount: toAmount(plain.paid_amount),
    dueAmount: toAmount(plain.due_amount),
    currency: plain.currency,
    createdAt: plain.created_at,
    items: (plain.items || []).map((item) => ({
      id: item.id,
      itemType: item.item_type,
      title: item.title,
      totalPrice: toAmount(item.total_price),
      status: item.status,
    })),
    customer:
      plain.customer && plain.customer.name
        ? { id: plain.customer.id, name: plain.customer.name, email: plain.customer.email, phone: plain.customer.phone }
        : undefined,
  };
}

// ------------------------------------------------------------- reservations

async function reserveInventory({ booking, items, transaction }) {
  const packageSeats = new Map();
  for (const item of items) {
    if (item.item_type === 'PACKAGE' && item.meta?.departureId) {
      const key = Number(item.meta.departureId);
      packageSeats.set(key, (packageSeats.get(key) || 0) + Number(item.quantity));
    }
  }
  for (const [departureId, seats] of packageSeats) {
    const departure = await models.PackageDeparture.findByPk(departureId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!departure) throw new NotFoundError('Package departure');
    const seatsLeft = Number(departure.capacity) - Number(departure.booked_count);
    if (seatsLeft < seats) {
      throw new BusinessRuleError(`Only ${seatsLeft} seats remain on this departure`, 'DEPARTURE_FULL', { seatsLeft });
    }
    await departure.update({ booked_count: Number(departure.booked_count) + seats }, { transaction });
  }

  for (const item of items.filter((row) => row.item_type === 'HOTEL_ROOM')) {
    const room = await models.HotelRoom.findByPk(item.ref_id, { transaction });
    if (!room) throw new NotFoundError('Room');
    const dates = enumerateDates(item.start_date, addDays(item.end_date, -1));
    for (const date of dates) {
      await models.RoomAvailability.findOrCreate({
        where: { room_id: room.id, date },
        defaults: { room_id: room.id, date, total_units: room.total_units, reserved_units: 0, is_blocked: false },
        transaction,
      });
    }
    const rows = await models.RoomAvailability.findAll({
      where: { room_id: room.id, date: { [Op.in]: dates } },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const byDate = new Map(rows.map((row) => [row.date, row]));
    for (const date of dates) {
      const row = byDate.get(date);
      const available = row.is_blocked ? 0 : Number(row.total_units) - Number(row.reserved_units);
      if (available < Number(item.quantity)) {
        throw new BusinessRuleError(`${room.name} is no longer available on ${date}`, 'ROOM_UNAVAILABLE', {
          roomId: room.id,
          date,
          availableUnits: available,
        });
      }
    }
    for (const row of rows) {
      await row.update({ reserved_units: Number(row.reserved_units) + Number(item.quantity) }, { transaction });
    }
  }

  for (const item of items.filter((row) => row.item_type === 'VEHICLE' || row.item_type === 'GUIDE')) {
    const isVehicle = item.item_type === 'VEHICLE';
    const model = isVehicle ? models.VehicleAvailability : models.GuideAvailability;
    const key = isVehicle ? 'vehicle_id' : 'guide_id';
    const dates = enumerateDates(item.start_date, item.end_date);
    for (const date of dates) {
      await model.findOrCreate({
        where: { [key]: item.ref_id, date },
        defaults: { [key]: item.ref_id, date, status: 'AVAILABLE' },
        transaction,
      });
    }
    const rows = await model.findAll({
      where: { [key]: item.ref_id, date: { [Op.in]: dates } },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const blocked = rows.filter((row) => row.status !== 'AVAILABLE').map((row) => row.date);
    if (blocked.length) {
      const label = isVehicle ? 'Vehicle' : 'Guide';
      throw new BusinessRuleError(`${label} is no longer available on the selected dates`, 'SERVICE_UNAVAILABLE', {
        blockedDates: blocked,
        itemId: item.id,
        bookingId: booking.id,
      });
    }
    for (const row of rows) {
      await row.update({ status: 'BOOKED', booking_item_id: item.id }, { transaction });
    }
  }
}

async function releaseInventory(items, transaction) {
  const packageSeats = new Map();
  for (const item of items) {
    if (item.item_type === 'PACKAGE' && item.meta?.departureId) {
      const key = Number(item.meta.departureId);
      packageSeats.set(key, (packageSeats.get(key) || 0) + Number(item.quantity));
    }
  }
  for (const [departureId, seats] of packageSeats) {
    const departure = await models.PackageDeparture.findByPk(departureId, { transaction, lock: transaction.LOCK.UPDATE });
    if (departure) {
      await departure.update(
        { booked_count: Math.max(Number(departure.booked_count) - seats, 0) },
        { transaction }
      );
    }
  }

  for (const item of items) {
    if (item.item_type === 'HOTEL_ROOM') {
      const dates = enumerateDates(item.start_date, addDays(item.end_date, -1));
      const rows = await models.RoomAvailability.findAll({
        where: { room_id: item.ref_id, date: { [Op.in]: dates } },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      for (const row of rows) {
        await row.update(
          { reserved_units: Math.max(Number(row.reserved_units) - Number(item.quantity), 0) },
          { transaction }
        );
      }
    } else if (item.item_type === 'VEHICLE') {
      await models.VehicleAvailability.update(
        { status: 'AVAILABLE', booking_item_id: null },
        { where: { booking_item_id: item.id }, transaction }
      );
    } else if (item.item_type === 'GUIDE') {
      await models.GuideAvailability.update(
        { status: 'AVAILABLE', booking_item_id: null },
        { where: { booking_item_id: item.id }, transaction }
      );
    }
  }
}

async function setCommissionStatus(bookingId, status, transaction, { earned = false } = {}) {
  const items = await models.BookingItem.findAll({ where: { booking_id: bookingId }, transaction });
  const ids = items.map((item) => item.id);
  if (!ids.length) return;
  const updates = { status };
  if (earned) updates.earned_at = new Date();
  await models.Commission.update(updates, { where: { booking_item_id: { [Op.in]: ids } }, transaction });
}

async function confirmItems(bookingId, transaction) {
  await models.BookingItem.update({ status: 'CONFIRMED' }, { where: { booking_id: bookingId, status: 'PENDING' }, transaction });
  await setCommissionStatus(bookingId, 'EARNED', transaction, { earned: true });
}

async function awardLoyalty(booking, transaction) {
  const points = Math.floor(Number(booking.total_amount) / 100);
  if (points <= 0) return;
  const last = await models.LoyaltyTransaction.findOne({
    where: { user_id: booking.customer_user_id },
    order: [['id', 'DESC']],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  const balance = (last ? Number(last.balance_after) : 0) + points;
  await models.LoyaltyTransaction.create(
    {
      user_id: booking.customer_user_id,
      points,
      type: 'EARN',
      booking_id: booking.id,
      balance_after: balance,
      description: `Earned on ${booking.reference}`,
    },
    { transaction }
  );
}

// ------------------------------------------------------------- create/read

async function createBooking(user, payload) {
  const composition = payload.customTripId
    ? await compositionFromTrip(user, payload.customTripId)
    : payload.composition;
  if (!composition) throw new BusinessRuleError('A trip composition is required', 'COMPOSITION_REQUIRED');

  const outcome = await sequelize.transaction(async (transaction) => {
    const quote = await pricing.buildQuote({
      type: payload.type,
      composition,
      userId: user.id,
      couponCode: payload.couponCode,
    });

    const reference = await nextReference(transaction);
    const booking = await models.Booking.create(
      {
        reference,
        customer_user_id: user.id,
        type: payload.type,
        status: 'PENDING',
        start_date: quote.startDate,
        end_date: quote.endDate,
        adults: quote.adults,
        children: quote.children,
        contact_name: payload.contact.name,
        contact_phone: payload.contact.phone,
        contact_email: payload.contact.email,
        special_requests: composition.specialRequests || null,
        currency: 'BDT',
        subtotal: quote.subtotal,
        discount_total: quote.discountTotal,
        tax_total: quote.taxTotal,
        total_amount: quote.totalAmount,
        paid_amount: '0.00',
        due_amount: quote.totalAmount,
        coupon_id: quote.coupon?.id || null,
        custom_trip_id: payload.customTripId || null,
        cancellation_policy: defaultCancellationPolicy(payload.type),
      },
      { transaction }
    );

    await models.BookingStatusHistory.create(
      {
        booking_id: booking.id,
        from_status: null,
        to_status: 'PENDING',
        changed_by_user_id: user.id,
        reason: 'Booking created',
      },
      { transaction }
    );

    const providerIds = [...new Set(quote.items.map((item) => item.providerProfileId).filter(Boolean))];
    const providers = providerIds.length
      ? await models.ProviderProfile.findAll({ where: { id: { [Op.in]: providerIds } }, transaction })
      : [];
    const providerById = new Map(providers.map((provider) => [Number(provider.id), provider]));

    const items = [];
    for (const priced of quote.items) {
      const provider = priced.providerProfileId ? providerById.get(Number(priced.providerProfileId)) : null;
      const rate = priced.providerProfileId ? pricing.commissionRateFor(priced.itemType, provider) : 0;
      const commission = percentOf(priced.totalPrice, rate);
      const payable = money(priced.totalPrice).minus(commission);

      const item = await models.BookingItem.create(
        {
          booking_id: booking.id,
          item_type: priced.itemType,
          ref_id: priced.refId || 0,
          provider_profile_id: priced.providerProfileId || null,
          title: priced.title,
          start_date: priced.startDate,
          end_date: priced.endDate,
          quantity: priced.quantity,
          unit_price: priced.unitPrice,
          total_price: priced.totalPrice,
          commission_rate: toAmount(rate),
          commission_amount: toAmount(commission),
          provider_payable: toAmount(payable),
          // Platform-fulfilled lines (add-ons, operator-less packages) need no provider acceptance.
          status: priced.providerProfileId ? 'PENDING' : 'CONFIRMED',
          meta: priced.meta,
        },
        { transaction }
      );
      items.push(item);

      if (provider) {
        await models.Commission.create(
          {
            booking_item_id: item.id,
            provider_profile_id: provider.id,
            gross_amount: priced.totalPrice,
            rate: toAmount(rate),
            amount: toAmount(commission),
            status: 'PENDING',
          },
          { transaction }
        );
      }
    }

    await reserveInventory({ booking, items, transaction });

    if (quote.coupon) {
      const couponRow = await models.Coupon.findByPk(quote.coupon.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!couponRow) throw new BusinessRuleError('Coupon code is not valid', 'COUPON_INVALID');
      if (couponRow.usage_limit && Number(couponRow.used_count) >= Number(couponRow.usage_limit)) {
        throw new BusinessRuleError('Coupon usage limit reached', 'COUPON_LIMIT_REACHED');
      }
      await models.CouponRedemption.create(
        {
          coupon_id: couponRow.id,
          user_id: user.id,
          booking_id: booking.id,
          discount_amount: quote.discountTotal,
        },
        { transaction }
      );
      await couponRow.increment('used_count', { by: 1, transaction });
    }

    const passengerRows = payload.passengers?.length
      ? payload.passengers.map((passenger) => ({
          booking_id: booking.id,
          full_name: passenger.fullName,
          age: passenger.age ?? null,
          gender: passenger.gender ?? null,
          nid: passenger.nid ?? null,
          passport_no: passenger.passportNo ?? null,
        }))
      : [{ booking_id: booking.id, full_name: payload.contact.name }];
    await models.BookingPassenger.bulkCreate(passengerRows, { transaction });

    if (payload.customTripId) {
      const trip = await models.CustomTrip.findOne({
        where: { id: payload.customTripId, user_id: user.id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!trip) throw new NotFoundError('Trip');
      if (!['DRAFT', 'QUOTED'].includes(trip.status)) {
        throw new BusinessRuleError('This trip has already been booked', 'TRIP_ALREADY_BOOKED');
      }
      await trip.update({ status: 'CONFIRMED', estimated_total: quote.totalAmount }, { transaction });
    }

    const needsProviderConfirmation = items.some((item) => item.status === 'PENDING');
    await transitionBooking(booking, needsProviderConfirmation ? 'AWAITING_CONFIRMATION' : 'AWAITING_PAYMENT', {
      userId: user.id,
      reason: needsProviderConfirmation
        ? 'Booking submitted for provider confirmation'
        : 'No provider confirmation required - ready for payment',
      transaction,
    });

    const detail = await repository.findDetailByReference(reference, { transaction });
    return { booking: serializeBooking(detail), customerId: booking.customer_user_id };
  });

  try {
    const bookingRow = await models.Booking.findByPk(outcome.booking.id);
    if (outcome.booking.status === 'AWAITING_PAYMENT') {
      await notifications.notifyCustomer(bookingRow, {
        type: 'BOOKING_READY',
        title: `Booking ${outcome.booking.reference} is ready to pay`,
        body: `Pay BDT ${outcome.booking.dueAmount} to confirm your booking.`,
      });
    } else {
      await notifications.notifyBookingCreated(bookingRow);
    }
  } catch (err) {
    logger.error({ err: err.message, reference: outcome.booking.reference }, 'booking notification failed');
  }

  return outcome.booking;
}

async function getBookingForUser(user, reference) {
  const booking = await repository.findDetailByReference(reference);
  if (!booking) throw new NotFoundError('Booking');

  const isOwner = Number(booking.customer_user_id) === Number(user.id);
  const isAdmin = user.roles?.includes(ROLES.ADMIN);
  const providerId = user.providerProfile?.id ? Number(user.providerProfile.id) : null;
  const isProvider = providerId && booking.items.some((item) => Number(item.provider_profile_id) === providerId);

  if (!isOwner && !isAdmin && !isProvider) throw new NotFoundError('Booking');

  return serializeBooking(booking, {
    providerProfileId: isProvider && !isOwner && !isAdmin ? providerId : null,
    includeCustomer: Boolean(isAdmin || isProvider),
  });
}

async function listMyBookings(user, query) {
  const { page, limit, offset } = getPagination(query, { defaultLimit: 10 });
  const { rows, count } = await repository.listForCustomer(user.id, { status: query.status, limit, offset });
  return {
    items: rows.map(serializeBookingSummary),
    meta: buildMeta({ page, limit, total: count }),
  };
}

// --------------------------------------------------------------- lifecycle

async function cancelBooking(user, reference, { reason }) {
  const cancelled = await sequelize.transaction(async (transaction) => {
    const booking = await repository.findByReference(reference, { transaction, lock: true });
    if (!booking) throw new NotFoundError('Booking');
    if (Number(booking.customer_user_id) !== Number(user.id)) throw new NotFoundError('Booking');

    const cancellable = ['PENDING', 'AWAITING_CONFIRMATION', 'QUOTED', 'AWAITING_PAYMENT', 'CONFIRMED'];
    if (!cancellable.includes(booking.status)) {
      throw new BusinessRuleError(`Bookings in ${booking.status} status cannot be cancelled`, 'BOOKING_NOT_CANCELLABLE');
    }
    if (booking.status === 'CONFIRMED' && isPast(booking.start_date)) {
      throw new BusinessRuleError('The trip has already started', 'TRIP_STARTED');
    }

    const items = await repository.findItems(booking.id, { transaction });
    await releaseInventory(items, transaction);
    await models.BookingItem.update({ status: 'CANCELLED' }, { where: { booking_id: booking.id }, transaction });
    await setCommissionStatus(booking.id, 'REVERSED', transaction);

    await transitionBooking(booking, 'CANCELLED', {
      userId: user.id,
      reason: reason || 'Cancelled by customer',
      transaction,
    });

    if (money(booking.paid_amount).greaterThan(0)) {
      const existing = await models.Refund.findOne({ where: { booking_id: booking.id, status: 'REQUESTED' }, transaction });
      if (!existing) {
        const payment = await models.Payment.findOne({
          where: { booking_id: booking.id, status: 'SUCCEEDED' },
          order: [['id', 'DESC']],
          transaction,
        });
        await models.Refund.create(
          {
            booking_id: booking.id,
            payment_id: payment?.id || null,
            amount: toAmount(booking.paid_amount),
            reason: reason || 'Cancelled by customer',
            status: 'REQUESTED',
            requested_by_user_id: user.id,
          },
          { transaction }
        );
      }
      await transitionBooking(booking, 'REFUND_PENDING', {
        userId: user.id,
        reason: 'Refund requested after cancellation',
        transaction,
      });
    }

    const detail = await repository.findDetailByReference(reference, { transaction });
    return serializeBooking(detail);
  });

  try {
    const bookingRow = await models.Booking.findByPk(cancelled.id);
    await notifications.notifyCustomer(bookingRow, {
      type: 'BOOKING_CANCELLED',
      title: `Booking ${cancelled.reference} cancelled`,
      body: cancelled.status === 'REFUND_PENDING'
        ? 'Your booking is cancelled. A refund request has been created and is awaiting review.'
        : 'Your booking has been cancelled.',
    });
    await notifications.notifyProviders(bookingRow, {
      type: 'BOOKING_CANCELLED',
      title: `Booking ${cancelled.reference} cancelled`,
      body: 'The customer cancelled this booking. Inventory has been released.',
    });
  } catch (err) {
    logger.error({ err: err.message, reference }, 'cancellation notification failed');
  }

  return cancelled;
}

async function listProviderBookings(user, query) {
  const providerId = user.providerProfile?.id;
  if (!providerId) throw new ForbiddenError('Provider account required');
  const { page, limit, offset } = getPagination(query, { defaultLimit: 10 });
  const { rows, count } = await repository.listForProvider(providerId, { status: query.status, limit, offset });
  return {
    items: rows.map(serializeBookingSummary),
    meta: buildMeta({ page, limit, total: count }),
  };
}

async function providerOwnItems(user, bookingId, transaction) {
  const providerId = user.providerProfile?.id;
  if (!providerId) throw new ForbiddenError('Provider account required');
  const items = await repository.findItemsForProvider(bookingId, providerId, { transaction });
  if (!items.length) throw new NotFoundError('Booking');
  return { providerId: Number(providerId), items };
}

async function acceptBooking(user, reference) {
  const accepted = await sequelize.transaction(async (transaction) => {
    const booking = await repository.findByReference(reference, { transaction, lock: true });
    if (!booking) throw new NotFoundError('Booking');
    const { items } = await providerOwnItems(user, booking.id, transaction);

    if (booking.status !== 'AWAITING_CONFIRMATION') {
      throw new BusinessRuleError(`Bookings in ${booking.status} status cannot be accepted`, 'INVALID_BOOKING_STATUS');
    }
    await models.BookingItem.update(
      { status: 'CONFIRMED' },
      { where: { id: { [Op.in]: items.map((item) => item.id) } }, transaction }
    );

    const all = await repository.findItems(booking.id, { transaction });
    if (all.every((item) => item.status === 'CONFIRMED')) {
      await transitionBooking(booking, 'AWAITING_PAYMENT', {
        userId: user.id,
        reason: 'All providers confirmed the booking',
        transaction,
      });
    }

    const detail = await repository.findDetailByReference(reference, { transaction });
    return serializeBooking(detail, { providerProfileId: user.providerProfile.id, includeCustomer: true });
  });

  if (accepted.status === 'AWAITING_PAYMENT') {
    try {
      const bookingRow = await models.Booking.findByPk(accepted.id);
      await notifications.notifyCustomer(bookingRow, {
        type: 'BOOKING_READY',
        title: `All providers accepted ${accepted.reference}`,
        body: `Please pay BDT ${accepted.dueAmount} to confirm your booking.`,
      });
    } catch (err) {
      logger.error({ err: err.message, reference }, 'acceptance notification failed');
    }
  }

  return accepted;
}

async function rejectBooking(user, reference, { reason }) {
  const rejected = await sequelize.transaction(async (transaction) => {
    const booking = await repository.findByReference(reference, { transaction, lock: true });
    if (!booking) throw new NotFoundError('Booking');
    const { providerId } = await providerOwnItems(user, booking.id, transaction);

    if (booking.status !== 'AWAITING_CONFIRMATION') {
      throw new BusinessRuleError(`Bookings in ${booking.status} status cannot be rejected`, 'INVALID_BOOKING_STATUS');
    }

    const items = await repository.findItems(booking.id, { transaction });
    await releaseInventory(items, transaction);
    await models.BookingItem.update({ status: 'CANCELLED' }, { where: { booking_id: booking.id }, transaction });
    await setCommissionStatus(booking.id, 'REVERSED', transaction);

    await transitionBooking(booking, 'REJECTED', {
      userId: user.id,
      reason: reason || 'Rejected by provider',
      transaction,
    });

    const detail = await repository.findDetailByReference(reference, { transaction });
    return serializeBooking(detail, { providerProfileId: providerId, includeCustomer: true });
  });

  try {
    const bookingRow = await models.Booking.findByPk(rejected.id);
    await notifications.notifyCustomer(bookingRow, {
      type: 'BOOKING_REJECTED',
      title: `Booking ${rejected.reference} could not be confirmed`,
      body: 'A provider could not take this booking. Reserved inventory has been released. Please try another option.',
    });
  } catch (err) {
    logger.error({ err: err.message, reference }, 'rejection notification failed');
  }

  return rejected;
}

async function startBooking(user, reference) {
  return sequelize.transaction(async (transaction) => {
    const booking = await repository.findByReference(reference, { transaction, lock: true });
    if (!booking) throw new NotFoundError('Booking');
    const { providerId } = await providerOwnItems(user, booking.id, transaction);
    if (booking.status !== 'CONFIRMED') {
      throw new BusinessRuleError('Only confirmed bookings can start', 'INVALID_BOOKING_STATUS');
    }
    await transitionBooking(booking, 'IN_PROGRESS', {
      userId: user.id,
      reason: 'Trip started by provider',
      transaction,
    });
    const detail = await repository.findDetailByReference(reference, { transaction });
    return serializeBooking(detail, { providerProfileId: providerId, includeCustomer: true });
  });
}

async function completeBooking(user, reference) {
  const completed = await sequelize.transaction(async (transaction) => {
    const booking = await repository.findByReference(reference, { transaction, lock: true });
    if (!booking) throw new NotFoundError('Booking');
    const { providerId } = await providerOwnItems(user, booking.id, transaction);
    if (booking.status !== 'IN_PROGRESS') {
      throw new BusinessRuleError('Only trips in progress can be completed', 'INVALID_BOOKING_STATUS');
    }
    await models.BookingItem.update({ status: 'COMPLETED' }, { where: { booking_id: booking.id }, transaction });
    await transitionBooking(booking, 'COMPLETED', {
      userId: user.id,
      reason: 'Trip completed',
      transaction,
    });
    await awardLoyalty(booking, transaction);
    const detail = await repository.findDetailByReference(reference, { transaction });
    return serializeBooking(detail, { providerProfileId: providerId, includeCustomer: true });
  });

  try {
    const bookingRow = await models.Booking.findByPk(completed.id);
    await notifications.notifyCustomer(bookingRow, {
      type: 'BOOKING_COMPLETED',
      title: `Trip ${completed.reference} completed`,
      body: 'Thank you for travelling with POTHIK. Share your experience with a review.',
    });
  } catch (err) {
    logger.error({ err: err.message, reference }, 'completion notification failed');
  }

  return completed;
}

/**
 * Called by the payments module after a verified gateway callback. The booking
 * row is locked by the caller inside the same transaction.
 */
async function applyPayment(booking, amount, { transaction, actorUserId = null }) {
  const paid = money(booking.paid_amount).plus(money(amount));
  if (paid.greaterThan(money(booking.total_amount))) {
    throw new BusinessRuleError('Payment exceeds the outstanding balance', 'PAYMENT_EXCEEDS_DUE', {
      due: toAmount(booking.due_amount),
    });
  }
  const due = money(booking.total_amount).minus(paid);
  await booking.update({ paid_amount: toAmount(paid), due_amount: toAmount(due) }, { transaction });

  if (due.lessThanOrEqualTo(0)) {
    if (booking.status === 'AWAITING_PAYMENT') {
      await confirmItems(booking.id, transaction);
      await transitionBooking(booking, 'CONFIRMED', {
        userId: actorUserId,
        reason: 'Payment verified',
        transaction,
      });
    }
  }
  return booking;
}

async function markRefunded(booking, { transaction, actorUserId = null }) {
  if (booking.status !== 'REFUND_PENDING') {
    throw new BusinessRuleError('Booking is not awaiting a refund', 'INVALID_BOOKING_STATUS');
  }
  await transitionBooking(booking, 'REFUNDED', {
    userId: actorUserId,
    reason: 'Refund processed',
    transaction,
  });
  return booking;
}

module.exports = {
  createBooking,
  getBookingForUser,
  listMyBookings,
  cancelBooking,
  listProviderBookings,
  acceptBooking,
  rejectBooking,
  startBooking,
  completeBooking,
  applyPayment,
  markRefunded,
  serializeBooking,
  serializeBookingSummary,
};
