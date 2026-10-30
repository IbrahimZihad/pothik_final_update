'use strict';

const { Op } = require('sequelize');
const { models } = require('../../models');
const config = require('../../config');
const { NotFoundError, BusinessRuleError } = require('../../shared/errors');
const { Decimal, money, toAmount, percentOf } = require('../../shared/utils/money');
const { enumerateDates, nightsBetween, addDays, isPast } = require('../../shared/utils/dates');
const { getAddon } = require('../../shared/constants/addons');
const supplierRepository = require('../suppliers/supplier.repository');

const MAX_STAY_NIGHTS = 60;
const MAX_SERVICE_DAYS = 30;

function priceItem({ itemType, refId, providerProfileId = null, title, startDate, endDate, quantity, unitPrice, totalPrice, meta = {} }) {
  return {
    itemType,
    refId,
    providerProfileId,
    title,
    startDate: startDate || null,
    endDate: endDate || null,
    quantity,
    unitPrice: toAmount(unitPrice),
    totalPrice: toAmount(totalPrice),
    meta,
  };
}

function travellersOf(composition) {
  return { adults: Number(composition.adults), children: Number(composition.children || 0) };
}

function assertTravellers(composition) {
  const { adults, children } = travellersOf(composition);
  if (!Number.isInteger(adults) || adults < 1) throw new BusinessRuleError('At least one adult is required', 'INVALID_TRAVELLERS');
  if (!Number.isInteger(children) || children < 0) throw new BusinessRuleError('Children count is invalid', 'INVALID_TRAVELLERS');
  const total = adults + children;
  if (total > 50) throw new BusinessRuleError('A single booking supports up to 50 travellers', 'TOO_MANY_TRAVELLERS');
  return total;
}

async function pricePackage({ packageId, departureId }, composition) {
  const pkg = await models.Package.findOne({ where: { id: packageId, status: 'PUBLISHED' } });
  if (!pkg) throw new NotFoundError('Package');
  if (!departureId) throw new BusinessRuleError('Select a scheduled departure for this package', 'DEPARTURE_REQUIRED');

  const departure = await models.PackageDeparture.findOne({ where: { id: departureId, package_id: pkg.id } });
  if (!departure) throw new NotFoundError('Package departure');
  if (departure.status !== 'SCHEDULED') throw new BusinessRuleError('This departure is no longer open for booking', 'DEPARTURE_CLOSED');
  if (isPast(departure.start_date)) throw new BusinessRuleError('This departure date has passed', 'DEPARTURE_PAST');

  const { adults, children } = travellersOf(composition);
  const seatsLeft = Number(departure.capacity) - Number(departure.booked_count);
  if (seatsLeft < adults + children) {
    throw new BusinessRuleError(`Only ${seatsLeft} seats remain on this departure`, 'DEPARTURE_FULL', { seatsLeft });
  }

  const adultPrice = money(departure.price_override ?? pkg.base_price_per_person);
  const childPrice = pkg.child_price_per_person
    ? money(pkg.child_price_per_person)
    : adultPrice.times(0.6);
  const items = [
    priceItem({
      itemType: 'PACKAGE',
      refId: pkg.id,
      providerProfileId: pkg.provider_profile_id || null,
      title: `${pkg.title} (adult)`,
      startDate: departure.start_date,
      endDate: departure.end_date,
      quantity: adults,
      unitPrice: adultPrice,
      totalPrice: adultPrice.times(adults),
      meta: { departureId: departure.id, travellerType: 'ADULT', seatCapacity: Number(departure.capacity) },
    }),
  ];
  if (children > 0) {
    items.push(
      priceItem({
        itemType: 'PACKAGE',
        refId: pkg.id,
        providerProfileId: pkg.provider_profile_id || null,
        title: `${pkg.title} (child)`,
        startDate: departure.start_date,
        endDate: departure.end_date,
        quantity: children,
        unitPrice: childPrice,
        totalPrice: childPrice.times(children),
        meta: { departureId: departure.id, travellerType: 'CHILD', seatCapacity: Number(departure.capacity) },
      })
    );
  }
  return items;
}

async function priceHotel({ hotelId, checkIn, checkOut, rooms }, composition) {
  const hotel = await models.Hotel.findOne({
    where: { id: hotelId, status: 'PUBLISHED' },
    include: [
      {
        model: models.ProviderProfile,
        as: 'provider',
        attributes: ['id', 'status'],
        where: { status: 'APPROVED' },
        required: true,
      },
    ],
  });
  if (!hotel) throw new NotFoundError('Hotel');

  if (!checkIn || !checkOut) throw new BusinessRuleError('Check-in and check-out dates are required', 'DATES_REQUIRED');
  if (isPast(checkIn)) throw new BusinessRuleError('Check-in date cannot be in the past', 'DATE_IN_PAST');
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1) throw new BusinessRuleError('Check-out must be after check-in', 'INVALID_DATE_RANGE');
  if (nights > MAX_STAY_NIGHTS) throw new BusinessRuleError(`Stays are limited to ${MAX_STAY_NIGHTS} nights`, 'STAY_TOO_LONG');

  const roomIds = rooms.map((room) => room.roomId);
  if (new Set(roomIds).size !== roomIds.length) {
    throw new BusinessRuleError('Each room type can only appear once', 'DUPLICATE_ROOM');
  }
  const roomRows = await models.HotelRoom.findAll({ where: { id: { [Op.in]: roomIds }, hotel_id: hotel.id, status: 'ACTIVE' } });
  const roomById = new Map(roomRows.map((room) => [Number(room.id), room]));
  if (roomRows.length !== roomIds.length) throw new NotFoundError('Room');

  const stayNights = enumerateDates(checkIn, addDays(checkOut, -1));
  const availability = await supplierRepository.listRoomAvailability(roomRows.map((room) => room.id), checkIn, stayNights[stayNights.length - 1]);
  const byKey = new Map(availability.map((row) => [`${row.room_id}:${row.date}`, row]));

  const { adults, children } = travellersOf(composition);
  let adultCapacity = 0;
  let childCapacity = 0;
  const items = [];

  for (const spec of rooms) {
    const room = roomById.get(Number(spec.roomId));
    let stayTotalPerUnit = money(0);

    for (const date of stayNights) {
      const row = byKey.get(`${room.id}:${date}`);
      const availableUnits = row
        ? (row.is_blocked ? 0 : Math.max(Number(row.total_units) - Number(row.reserved_units), 0))
        : Number(room.total_units);
      if (availableUnits < spec.units) {
        throw new BusinessRuleError(`${room.name} is not available on ${date}`, 'ROOM_UNAVAILABLE', {
          roomId: room.id,
          date,
          availableUnits,
        });
      }
      stayTotalPerUnit = stayTotalPerUnit.plus(
        row && row.price_override !== null && row.price_override !== undefined ? money(row.price_override) : money(room.base_price)
      );
    }

    adultCapacity += Number(room.capacity_adults) * spec.units;
    childCapacity += Number(room.capacity_children) * spec.units;

    items.push(
      priceItem({
        itemType: 'HOTEL_ROOM',
        refId: room.id,
        providerProfileId: hotel.provider_profile_id,
        title: `${hotel.name} - ${room.name} (${nights} night${nights > 1 ? 's' : ''}, ${spec.units} room${spec.units > 1 ? 's' : ''})`,
        startDate: checkIn,
        endDate: checkOut,
        quantity: spec.units,
        unitPrice: stayTotalPerUnit,
        totalPrice: stayTotalPerUnit.times(spec.units),
        meta: { hotelId: hotel.id, hotelName: hotel.name, roomName: room.name, nights, units: spec.units, checkIn, checkOut },
      })
    );
  }

  if (adults > adultCapacity) {
    throw new BusinessRuleError(`Selected rooms sleep up to ${adultCapacity} adults`, 'ROOM_CAPACITY_EXCEEDED');
  }
  if (children > childCapacity) {
    throw new BusinessRuleError(`Selected rooms sleep up to ${childCapacity} children`, 'ROOM_CAPACITY_EXCEEDED');
  }
  return items;
}

async function priceVehicle({ vehicleId, startDate, endDate, distanceKm }, composition) {
  const vehicle = await models.Vehicle.findOne({
    where: { id: vehicleId, status: 'ACTIVE' },
    include: [
      {
        model: models.ProviderProfile,
        as: 'provider',
        attributes: ['id', 'status'],
        where: { status: 'APPROVED' },
        required: true,
      },
      { model: models.VehicleCategory, as: 'category', attributes: ['id', 'code', 'name'] },
    ],
  });
  if (!vehicle) throw new NotFoundError('Vehicle');

  if (!startDate || !endDate) throw new BusinessRuleError('Trip dates are required for transport', 'DATES_REQUIRED');
  if (isPast(startDate)) throw new BusinessRuleError('Trip start date cannot be in the past', 'DATE_IN_PAST');
  const days = enumerateDates(startDate, endDate);
  if (endDate < startDate) throw new BusinessRuleError('End date cannot be before the start date', 'INVALID_DATE_RANGE');
  if (days.length > MAX_SERVICE_DAYS) throw new BusinessRuleError(`Transport can be booked for up to ${MAX_SERVICE_DAYS} days`, 'RANGE_TOO_LONG');

  const travellers = assertTravellers(composition);
  if (Number(vehicle.capacity) < travellers) {
    throw new BusinessRuleError(`This vehicle seats ${vehicle.capacity} passengers`, 'VEHICLE_CAPACITY_EXCEEDED', {
      capacity: Number(vehicle.capacity),
    });
  }

  const availability = await supplierRepository.listVehicleAvailability(vehicle.id, startDate, endDate);
  const blocked = availability.filter((row) => row.status !== 'AVAILABLE').map((row) => row.date);
  if (blocked.length) {
    throw new BusinessRuleError('The vehicle is not available on the selected dates', 'VEHICLE_UNAVAILABLE', { blockedDates: blocked });
  }

  let total = money(0);
  const usingDistance = vehicle.price_per_km && distanceKm;
  if (usingDistance) {
    total = money(vehicle.price_per_km).times(distanceKm);
    if (vehicle.price_per_day) total = total.plus(money(vehicle.price_per_day).times(days.length));
  } else if (vehicle.price_per_day) {
    total = money(vehicle.price_per_day).times(days.length);
  } else if (vehicle.price_per_km) {
    throw new BusinessRuleError('This vehicle is priced per kilometre - enter the estimated distance', 'DISTANCE_REQUIRED');
  } else {
    throw new BusinessRuleError('This vehicle has no published price', 'VEHICLE_NOT_PRICED');
  }

  return [
    priceItem({
      itemType: 'VEHICLE',
      refId: vehicle.id,
      providerProfileId: vehicle.provider_profile_id,
      title: `${vehicle.name} (${days.length} day${days.length > 1 ? 's' : ''})`,
      startDate,
      endDate,
      quantity: 1,
      unitPrice: total,
      totalPrice: total,
      meta: { days: days.length, distanceKm: distanceKm || null, category: vehicle.category?.code || null },
    }),
  ];
}

async function priceGuide({ guideId, startDate, endDate, hours }, composition) {
  const guide = await models.Guide.findOne({
    where: { id: guideId, status: 'ACTIVE' },
    include: [
      {
        model: models.ProviderProfile,
        as: 'provider',
        attributes: ['id', 'status'],
        where: { status: 'APPROVED' },
        required: true,
      },
    ],
  });
  if (!guide) throw new NotFoundError('Tour guide');

  if (!startDate || !endDate) throw new BusinessRuleError('Guide dates are required', 'DATES_REQUIRED');
  if (isPast(startDate)) throw new BusinessRuleError('Guide date cannot be in the past', 'DATE_IN_PAST');
  if (endDate < startDate) throw new BusinessRuleError('Guide end date cannot be before the start date', 'INVALID_DATE_RANGE');
  const days = enumerateDates(startDate, endDate);
  if (days.length > MAX_SERVICE_DAYS) throw new BusinessRuleError(`Guides can be booked for up to ${MAX_SERVICE_DAYS} days`, 'RANGE_TOO_LONG');

  const availability = await supplierRepository.listGuideAvailability(guide.id, startDate, endDate);
  const blocked = availability.filter((row) => row.status !== 'AVAILABLE').map((row) => row.date);
  if (blocked.length) {
    throw new BusinessRuleError('The guide is not available on the selected dates', 'GUIDE_UNAVAILABLE', { blockedDates: blocked });
  }

  assertTravellers(composition);
  const total = hours && guide.hourly_rate ? money(guide.hourly_rate).times(hours) : money(guide.daily_rate).times(days.length);

  return [
    priceItem({
      itemType: 'GUIDE',
      refId: guide.id,
      providerProfileId: guide.provider_profile_id,
      title: `Tour guide - ${days.length} day${days.length > 1 ? 's' : ''}`,
      startDate,
      endDate,
      quantity: 1,
      unitPrice: total,
      totalPrice: total,
      meta: { days: days.length, hours: hours || null, languages: guide.languages || [] },
    }),
  ];
}

function priceAddons(addons = []) {
  return addons.map((addon) => {
    const definition = getAddon(addon.code);
    if (!definition) throw new BusinessRuleError(`Unknown add-on service: ${addon.code}`, 'INVALID_ADDON');
    return priceItem({
      itemType: 'SERVICE',
      refId: null,
      providerProfileId: null,
      title: definition.name,
      quantity: addon.quantity,
      unitPrice: definition.price,
      totalPrice: money(definition.price).times(addon.quantity),
      meta: { code: definition.code },
    });
  });
}

async function evaluateCoupon({ code, userId, subtotal }) {
  if (!code) return null;
  const coupon = await models.Coupon.findOne({ where: { code: String(code).trim().toUpperCase() } });
  if (!coupon || !coupon.is_active) throw new BusinessRuleError('Coupon code is not valid', 'COUPON_INVALID');

  const now = new Date();
  if (coupon.starts_at && now < coupon.starts_at) throw new BusinessRuleError('Coupon is not active yet', 'COUPON_NOT_STARTED');
  if (coupon.ends_at && now > coupon.ends_at) throw new BusinessRuleError('Coupon has expired', 'COUPON_EXPIRED');
  if (money(subtotal).lessThan(money(coupon.min_spend || 0))) {
    throw new BusinessRuleError(`Add at least BDT ${toAmount(coupon.min_spend)} to use this coupon`, 'COUPON_MIN_SPEND');
  }
  if (coupon.usage_limit && Number(coupon.used_count) >= Number(coupon.usage_limit)) {
    throw new BusinessRuleError('Coupon usage limit reached', 'COUPON_LIMIT_REACHED');
  }
  if (userId) {
    const used = await models.CouponRedemption.count({ where: { coupon_id: coupon.id, user_id: userId } });
    if (coupon.per_user_limit && used >= Number(coupon.per_user_limit)) {
      throw new BusinessRuleError('You have already used this coupon', 'COUPON_USER_LIMIT');
    }
  }

  let discount = coupon.type === 'PERCENT' ? percentOf(subtotal, coupon.value) : money(coupon.value);
  if (coupon.max_discount) discount = Decimal.min(discount, money(coupon.max_discount));
  discount = Decimal.min(discount, money(subtotal));

  return {
    coupon,
    discount: toAmount(discount),
  };
}

function assertCompositionType(type, composition) {
  const has = {
    package: Boolean(composition.package),
    hotel: Boolean(composition.hotel),
    transport: Boolean(composition.transport),
    guide: Boolean(composition.guide),
  };
  const only = (key) => has[key] && !Object.entries(has).some(([other, present]) => other !== key && present);

  switch (type) {
    case 'PACKAGE':
      if (!only('package')) throw new BusinessRuleError('Package bookings must contain exactly one package', 'INVALID_BOOKING_COMPOSITION');
      break;
    case 'HOTEL':
      if (!only('hotel')) throw new BusinessRuleError('Hotel bookings must contain exactly one hotel stay', 'INVALID_BOOKING_COMPOSITION');
      break;
    case 'TRANSPORT':
      if (!only('transport')) throw new BusinessRuleError('Transport bookings must contain exactly one vehicle', 'INVALID_BOOKING_COMPOSITION');
      break;
    case 'GUIDE':
      if (!only('guide')) throw new BusinessRuleError('Guide bookings must contain exactly one guide', 'INVALID_BOOKING_COMPOSITION');
      break;
    case 'CUSTOM_TRIP':
      if (!has.package && !has.hotel && !has.transport && !has.guide) {
        throw new BusinessRuleError('Add at least one service to your custom trip', 'EMPTY_TRIP');
      }
      break;
    default:
      throw new BusinessRuleError('Unsupported booking type', 'INVALID_BOOKING_TYPE');
  }
}

/**
 * Prices a booking composition using server-side data only. Returns the line
 * items, coupon evaluation and the derived travel window.
 */
async function buildQuote({ type, composition, userId = null, couponCode = null }) {
  assertTravellers(composition);
  assertCompositionType(type, composition);

  const items = [];
  if (composition.package) items.push(...(await pricePackage(composition.package, composition)));
  if (composition.hotel) items.push(...(await priceHotel(composition.hotel, composition)));
  if (composition.transport) items.push(...(await priceVehicle(composition.transport, composition)));
  if (composition.guide) items.push(...(await priceGuide(composition.guide, composition)));
  if (composition.addons?.length) items.push(...priceAddons(composition.addons));

  if (!items.length) throw new BusinessRuleError('The booking has no priced services', 'EMPTY_BOOKING');

  const subtotal = items.reduce((total, item) => total.plus(money(item.totalPrice)), money(0));
  const coupon = couponCode ? await evaluateCoupon({ code: couponCode, userId, subtotal: toAmount(subtotal) }) : null;
  const discountTotal = coupon ? money(coupon.discount) : money(0);
  const totalAmount = subtotal.minus(discountTotal);

  const starts = items.filter((item) => item.startDate).map((item) => item.startDate);
  const ends = items.filter((item) => item.endDate).map((item) => item.endDate);
  const startDate = starts.sort()[0] || composition.startDate;
  const endDate = ends.sort().at(-1) || composition.endDate;
  if (!startDate || !endDate) throw new BusinessRuleError('Travel dates could not be determined', 'DATES_REQUIRED');
  if (isPast(startDate)) throw new BusinessRuleError('Travel date cannot be in the past', 'DATE_IN_PAST');

  return {
    currency: 'BDT',
    type,
    startDate,
    endDate,
    adults: Number(composition.adults),
    children: Number(composition.children || 0),
    items,
    subtotal: toAmount(subtotal),
    discountTotal: toAmount(discountTotal),
    taxTotal: '0.00',
    totalAmount: toAmount(totalAmount),
    coupon: coupon
      ? {
          id: coupon.coupon.id,
          code: coupon.coupon.code,
          description: coupon.coupon.description,
          type: coupon.coupon.type,
          value: Number(coupon.coupon.value),
          discount: coupon.discount,
        }
      : null,
  };
}

function commissionRateFor(itemType, providerProfile) {
  if (providerProfile && providerProfile.commission_rate !== null && providerProfile.commission_rate !== undefined) {
    return Number(providerProfile.commission_rate);
  }
  if (itemType === 'HOTEL_ROOM') return Number(config.commission.hotel);
  if (itemType === 'VEHICLE') return Number(config.commission.transport);
  if (itemType === 'GUIDE') return Number(config.commission.guide);
  return Number(config.commission.default);
}

module.exports = {
  buildQuote,
  assertCompositionType,
  assertTravellers,
  commissionRateFor,
  evaluateCoupon,
  MAX_STAY_NIGHTS,
  MAX_SERVICE_DAYS,
};
