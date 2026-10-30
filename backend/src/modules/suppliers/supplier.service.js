'use strict';

const path = require('path');
const { Op } = require('sequelize');
const { models, sequelize } = require('../../models');
const repository = require('./supplier.repository');
const config = require('../../config');
const { NotFoundError, ForbiddenError, BusinessRuleError, ConflictError } = require('../../shared/errors');
const { getPagination, buildMeta } = require('../../shared/utils/pagination');
const { uniqueSlug } = require('../../shared/utils/slugify');
const { enumerateDates, addDays, isPast, today } = require('../../shared/utils/dates');
const { resolvePrivateUpload } = require('../../shared/utils/privateUploads');

const MAX_AVAILABILITY_DAYS = 90;
const MAX_STAY_NIGHTS = 60;

// ------------------------------------------------------------------- helpers

function documentFileUrl(document) {
  if (!document.file_url || !document.file_url.startsWith('/uploads/private/')) return document.file_url || null;
  return `${config.apiPrefix}/provider/documents/${document.id}/file`;
}

function assertProvider(user, expectedType) {
  const profile = user.providerProfile;
  if (!profile) throw new ForbiddenError('No provider profile is linked to this account');
  if (expectedType && profile.type !== expectedType) {
    throw new ForbiddenError(`This action requires a ${expectedType.toLowerCase()} provider profile`);
  }
  return profile;
}

function statusFor(profile, requested, { published, fallback }) {
  if (requested === published) return profile.status === 'APPROVED' ? published : 'PENDING_REVIEW';
  return requested || fallback;
}

function assertStayRange(start, end, { allowSameDay = false } = {}) {
  if (!start || !end) throw new BusinessRuleError('Start and end dates are required', 'DATES_REQUIRED');
  if (isPast(start)) throw new BusinessRuleError('Start date cannot be in the past', 'DATE_IN_PAST');
  const invalidEnd = allowSameDay ? end < start : end <= start;
  if (invalidEnd) {
    throw new BusinessRuleError(
      allowSameDay ? 'End date cannot be before the start date' : 'End date must be after the start date',
      'INVALID_DATE_RANGE'
    );
  }
  const days = enumerateDates(start, end).length;
  if (days > MAX_STAY_NIGHTS + 1) {
    throw new BusinessRuleError(`Date range cannot exceed ${MAX_STAY_NIGHTS} nights`, 'DATE_RANGE_TOO_LONG');
  }
  return days;
}

function dateRange(from, to, defaultDays = 30) {
  const start = from || today();
  const end = to || addDays(start, defaultDays);
  assertStayRange(start, end, { allowSameDay: true });
  const dates = enumerateDates(start, end);
  if (dates.length > MAX_AVAILABILITY_DAYS) {
    throw new BusinessRuleError(`Availability can be queried for at most ${MAX_AVAILABILITY_DAYS} days`, 'RANGE_TOO_LONG');
  }
  return { start, end, dates };
}

function uniqueDates(entries) {
  const seen = new Set();
  const dates = [];
  for (const entry of entries) {
    if (seen.has(entry.date)) continue;
    seen.add(entry.date);
    dates.push(entry.date);
  }
  if (dates.length > MAX_AVAILABILITY_DAYS) {
    throw new BusinessRuleError(`At most ${MAX_AVAILABILITY_DAYS} dates can be updated at once`, 'TOO_MANY_DATES');
  }
  return dates;
}

function toNumber(value) {
  return value === null || value === undefined ? null : Number(value);
}

// ------------------------------------------------------------------ mappers

function serializeHotelSummary(hotel, summary) {
  const plain = hotel.get ? hotel.get({ plain: true }) : hotel;
  return {
    id: plain.id,
    name: plain.name,
    slug: plain.slug,
    description: plain.description,
    starRating: plain.star_rating,
    address: plain.address,
    image: plain.image_url,
    facilities: plain.facilities || [],
    checkinTime: plain.checkin_time,
    checkoutTime: plain.checkout_time,
    rating: { average: Number(plain.rating_avg || 0), count: plain.rating_count || 0 },
    destination: plain.destination
      ? { id: plain.destination.id, name: plain.destination.name, nameBn: plain.destination.name_bn, slug: plain.destination.slug }
      : null,
    provider: plain.provider ? { id: plain.provider.id, businessName: plain.provider.business_name } : null,
    minPrice: summary?.minPrice ?? null,
    roomCount: summary?.roomCount ?? null,
    totalUnits: summary?.totalUnits ?? null,
  };
}

function serializeRoom(room) {
  const plain = room.get ? room.get({ plain: true }) : room;
  return {
    id: plain.id,
    name: plain.name,
    roomType: plain.room_type,
    description: plain.description,
    capacityAdults: plain.capacity_adults,
    capacityChildren: plain.capacity_children,
    basePrice: Number(plain.base_price),
    extraBedPrice: Number(plain.extra_bed_price || 0),
    totalUnits: plain.total_units,
    minStayNights: plain.min_stay_nights,
    maxStayNights: plain.max_stay_nights,
    image: plain.image_url,
    amenities: plain.amenities || [],
    status: plain.status,
  };
}

function serializeHotelDetail(hotel) {
  const plain = hotel.get({ plain: true });
  const summary = plain.rooms?.length
    ? {
        minPrice: Math.min(...plain.rooms.map((room) => Number(room.base_price))),
        roomCount: plain.rooms.length,
        totalUnits: plain.rooms.reduce((sum, room) => sum + Number(room.total_units), 0),
      }
    : null;
  const base = serializeHotelSummary(plain, summary);
  return {
    ...base,
    phone: plain.phone,
    email: plain.email,
    gallery: plain.gallery || [],
    latitude: plain.latitude,
    longitude: plain.longitude,
    provider: plain.provider
      ? {
          id: plain.provider.id,
          businessName: plain.provider.business_name,
          description: plain.provider.description,
          phone: plain.provider.phone,
          address: plain.provider.address,
          logo: plain.provider.logo_url,
        }
      : null,
    rooms: (plain.rooms || []).map(serializeRoom),
  };
}

function serializeVehicle(vehicle, { detail = false } = {}) {
  const plain = vehicle.get ? vehicle.get({ plain: true }) : vehicle;
  return {
    id: plain.id,
    name: plain.name,
    model: plain.model,
    category: plain.category
      ? { id: plain.category.id, code: plain.category.code, name: plain.category.name, nameBn: plain.category.name_bn, icon: plain.category.icon }
      : null,
    capacity: plain.capacity,
    image: plain.image_url,
    features: plain.features || [],
    pricePerDay: toNumber(plain.price_per_day),
    pricePerKm: toNumber(plain.price_per_km),
    driverIncluded: plain.driver_included,
    status: plain.status,
    rating: { average: Number(plain.rating_avg || 0), count: plain.rating_count || 0 },
    provider:
      plain.provider && (detail || plain.provider.business_name)
        ? {
            id: plain.provider.id,
            businessName: plain.provider.business_name,
            ...(detail
              ? { description: plain.provider.description, phone: plain.provider.phone, address: plain.provider.address }
              : {}),
          }
        : null,
  };
}

function serializeGuide(guide, { detail = false } = {}) {
  const plain = guide.get ? guide.get({ plain: true }) : guide;
  return {
    id: plain.id,
    bio: plain.bio,
    languages: plain.languages || [],
    expertise: plain.expertise || [],
    yearsExperience: plain.years_experience,
    dailyRate: Number(plain.daily_rate),
    hourlyRate: toNumber(plain.hourly_rate),
    serviceLocations: plain.service_locations || [],
    photo: plain.photo_url,
    status: plain.status,
    rating: { average: Number(plain.rating_avg || 0), count: plain.rating_count || 0 },
    provider: plain.provider
      ? {
          id: plain.provider.id,
          businessName: plain.provider.business_name,
          ...(detail
            ? { description: plain.provider.description, phone: plain.provider.phone, address: plain.provider.address }
            : {}),
        }
      : null,
  };
}

// ------------------------------------------------------------------- public

async function getHotels(query) {
  const { page, limit, offset } = getPagination(query, { defaultLimit: 12 });
  const { rows, count } = await repository.listHotels({
    destinationSlug: query.destination,
    stars: query.stars,
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
    search: query.search,
    sort: query.sort,
    limit,
    offset,
  });
  const summary = await repository.roomSummaryForHotels(rows.map((hotel) => hotel.id));
  return {
    items: rows.map((hotel) => serializeHotelSummary(hotel, summary.get(Number(hotel.id)))),
    meta: buildMeta({ page, limit, total: count }),
  };
}

async function getHotel(slug) {
  const hotel = await repository.findHotelBySlug(slug);
  if (!hotel) throw new NotFoundError('Hotel');
  return serializeHotelDetail(hotel);
}

async function getHotelAvailability(slug, query) {
  const hotel = await repository.findHotelBySlug(slug);
  if (!hotel) throw new NotFoundError('Hotel');
  assertStayRange(query.checkIn, query.checkOut);
  const nights = enumerateDates(query.checkIn, addDays(query.checkOut, -1));
  if (nights.length > MAX_STAY_NIGHTS) {
    throw new BusinessRuleError(`Stay cannot exceed ${MAX_STAY_NIGHTS} nights`, 'STAY_TOO_LONG');
  }
  const rooms = hotel.rooms || [];
  const rows = await repository.listRoomAvailability(
    rooms.map((room) => room.id),
    query.checkIn,
    nights[nights.length - 1]
  );
  const byKey = new Map(rows.map((row) => [`${row.room_id}:${row.date}`, row]));
  const requestedUnits = query.rooms || 1;

  const availability = rooms.map((room) => {
    let remaining = Infinity;
    let stayTotal = 0;
    const nightly = nights.map((date) => {
      const row = byKey.get(`${room.id}:${date}`);
      const units = row ? Math.max(Number(row.total_units) - Number(row.reserved_units), 0) : Number(room.total_units);
      const available = row && row.is_blocked ? 0 : units;
      const price = row && row.price_override !== null && row.price_override !== undefined ? Number(row.price_override) : Number(room.base_price);
      remaining = Math.min(remaining, available);
      stayTotal += price;
      return { date, available, price };
    });
    return {
      roomId: room.id,
      name: room.name,
      roomType: room.room_type,
      capacityAdults: room.capacity_adults,
      capacityChildren: room.capacity_children,
      nightly,
      remainingUnits: remaining === Infinity ? Number(room.total_units) : remaining,
      stayTotal,
      available: (remaining === Infinity ? Number(room.total_units) : remaining) >= requestedUnits,
    };
  });

  return {
    checkIn: query.checkIn,
    checkOut: query.checkOut,
    nights: nights.length,
    requestedUnits,
    rooms: availability,
    available: availability.some((room) => room.available),
  };
}

async function getVehicles(query) {
  const { page, limit, offset } = getPagination(query, { defaultLimit: 12 });
  const { rows, count } = await repository.listVehicles({
    categoryCode: query.category,
    minCapacity: query.minCapacity,
    search: query.search,
    sort: query.sort,
    limit,
    offset,
  });
  return {
    items: rows.map((vehicle) => serializeVehicle(vehicle)),
    meta: buildMeta({ page, limit, total: count }),
  };
}

async function getVehicle(id) {
  const vehicle = await repository.findVehicleById(id);
  if (!vehicle) throw new NotFoundError('Vehicle');
  return serializeVehicle(vehicle, { detail: true });
}

async function getVehicleAvailability(id, query) {
  const vehicle = await repository.findVehicleById(id);
  if (!vehicle) throw new NotFoundError('Vehicle');
  assertStayRange(query.startDate, query.endDate, { allowSameDay: true });
  const dates = enumerateDates(query.startDate, query.endDate);
  if (dates.length > MAX_AVAILABILITY_DAYS) {
    throw new BusinessRuleError(`Availability can be queried for at most ${MAX_AVAILABILITY_DAYS} days`, 'RANGE_TOO_LONG');
  }
  const rows = await repository.listVehicleAvailability(id, query.startDate, query.endDate);
  const byDate = new Map(rows.map((row) => [row.date, row.status]));
  return {
    vehicleId: Number(id),
    startDate: query.startDate,
    endDate: query.endDate,
    blockedDates: dates.filter((date) => byDate.get(date) && byDate.get(date) !== 'AVAILABLE'),
    available: dates.every((date) => !byDate.get(date) || byDate.get(date) === 'AVAILABLE'),
  };
}

async function getGuides(query) {
  const { page, limit, offset } = getPagination(query, { defaultLimit: 12 });
  const { rows, count } = await repository.listGuides({
    language: query.language,
    location: query.location,
    expertise: query.expertise,
    minRating: query.minRating,
    search: query.search,
    sort: query.sort,
    limit,
    offset,
  });
  return {
    items: rows.map((guide) => serializeGuide(guide)),
    meta: buildMeta({ page, limit, total: count }),
  };
}

async function getGuide(id) {
  const guide = await repository.findGuideById(id);
  if (!guide) throw new NotFoundError('Tour guide');
  const plain = guide.get({ plain: true });
  return {
    ...serializeGuide(plain, { detail: true }),
    availability: (plain.availability || []).map((row) => ({ date: row.date, available: row.status === 'AVAILABLE' })),
  };
}

async function getGuideAvailability(id, query) {
  const guide = await repository.findGuideById(id);
  if (!guide) throw new NotFoundError('Tour guide');
  assertStayRange(query.startDate, query.endDate, { allowSameDay: true });
  const dates = enumerateDates(query.startDate, query.endDate);
  if (dates.length > MAX_AVAILABILITY_DAYS) {
    throw new BusinessRuleError(`Availability can be queried for at most ${MAX_AVAILABILITY_DAYS} days`, 'RANGE_TOO_LONG');
  }
  const rows = await repository.listGuideAvailability(id, query.startDate, query.endDate);
  const byDate = new Map(rows.map((row) => [row.date, row.status]));
  return {
    guideId: Number(id),
    startDate: query.startDate,
    endDate: query.endDate,
    blockedDates: dates.filter((date) => byDate.get(date) && byDate.get(date) !== 'AVAILABLE'),
    available: dates.every((date) => !byDate.get(date) || byDate.get(date) === 'AVAILABLE'),
  };
}

async function getVehicleCategories() {
  const categories = await repository.listVehicleCategories();
  return categories.map((category) => ({
    id: category.id,
    code: category.code,
    name: category.name,
    nameBn: category.name_bn,
    defaultCapacity: category.default_capacity,
    icon: category.icon,
  }));
}

// ---------------------------------------------------------- provider profile

async function getProviderProfile(user) {
  const profile = assertProvider(user);
  const record = await models.ProviderProfile.findByPk(profile.id, {
    include: [{ model: models.ProviderDocument, as: 'documents', separate: true, order: [['created_at', 'DESC']] }],
  });
  return {
    id: record.id,
    type: record.type,
    businessName: record.business_name,
    description: record.description,
    phone: record.phone,
    address: record.address,
    logo: record.logo_url,
    status: record.status,
    rejectionReason: record.rejection_reason,
    commissionRate: toNumber(record.commission_rate),
    approvedAt: record.approved_at,
    documents: (record.documents || []).map((document) => ({
      id: document.id,
      type: document.type,
      fileUrl: documentFileUrl(document),
      status: document.status,
      notes: document.notes,
      createdAt: document.created_at,
    })),
  };
}

async function updateProviderProfile(user, payload) {
  const profile = assertProvider(user);
  const record = await models.ProviderProfile.findByPk(profile.id);
  if (!record) throw new NotFoundError('Provider profile');
  const map = {
    business_name: payload.businessName,
    description: payload.description,
    phone: payload.phone,
    address: payload.address,
    logo_url: payload.logo,
  };
  await record.update(Object.fromEntries(Object.entries(map).filter(([, value]) => value !== undefined)));
  return getProviderProfile(user);
}

async function listProviderDocuments(user) {
  const profile = assertProvider(user);
  const documents = await repository.listDocuments(profile.id);
  return documents.map((document) => ({
    id: document.id,
    type: document.type,
    fileUrl: documentFileUrl(document),
    status: document.status,
    notes: document.notes,
    createdAt: document.created_at,
  }));
}

async function uploadProviderDocument(user, file, { type }) {
  const profile = assertProvider(user);
  if (!file) throw new BusinessRuleError('A document file is required', 'FILE_REQUIRED');
  const existing = await repository.countDocuments(profile.id);
  if (existing >= 20) {
    throw new BusinessRuleError('Document limit reached. Contact support to replace documents.', 'DOCUMENT_LIMIT');
  }
  const document = await models.ProviderDocument.create({
    provider_profile_id: profile.id,
    type,
    file_url: `/uploads/private/${file.filename}`,
    status: 'PENDING',
  });
  return {
    id: document.id,
    type: document.type,
    fileUrl: documentFileUrl(document),
    status: document.status,
    createdAt: document.created_at,
  };
}

async function getProviderDocumentFile(user, documentId) {
  const profile = assertProvider(user);
  const document = await models.ProviderDocument.findOne({
    where: { id: documentId, provider_profile_id: profile.id },
  });
  if (!document) throw new NotFoundError('Provider document');
  const absolute = resolvePrivateUpload(document.file_url);
  return { path: absolute, name: path.basename(absolute) };
}

// ------------------------------------------------------------- hotel (owner)

async function listProviderHotels(user) {
  const profile = assertProvider(user, 'HOTEL');
  const hotels = await repository.listOwnHotels(profile.id);
  return hotels.map((hotel) => {
    const plain = hotel.get({ plain: true });
    return {
      ...serializeHotelSummary(plain, {
        minPrice: plain.rooms?.length ? Math.min(...plain.rooms.map((room) => Number(room.base_price))) : null,
        roomCount: plain.rooms?.length || 0,
        totalUnits: (plain.rooms || []).reduce((sum, room) => sum + Number(room.total_units), 0),
      }),
      phone: plain.phone,
      email: plain.email,
      gallery: plain.gallery || [],
      status: plain.status,
      rooms: (plain.rooms || []).map(serializeRoom),
    };
  });
}

async function createProviderHotel(user, payload) {
  const profile = assertProvider(user, 'HOTEL');
  const slug = payload.slug || (await uniqueSlug(payload.name, async (candidate) => Boolean(await models.Hotel.findOne({ where: { slug: candidate } }))));
  const status = statusFor(profile, payload.status, { published: 'PUBLISHED', fallback: 'DRAFT' });
  const hotel = await models.Hotel.create({
    provider_profile_id: profile.id,
    destination_id: payload.destinationId || null,
    name: payload.name,
    slug,
    description: payload.description,
    star_rating: payload.starRating,
    address: payload.address,
    latitude: payload.latitude,
    longitude: payload.longitude,
    phone: payload.phone,
    email: payload.email,
    checkin_time: payload.checkInTime || '14:00',
    checkout_time: payload.checkOutTime || '12:00',
    image_url: payload.image,
    gallery: payload.gallery || [],
    facilities: payload.facilities || [],
    status,
  });
  return serializeHotelSummary(hotel, null);
}

async function updateProviderHotel(user, hotelId, payload) {
  const profile = assertProvider(user, 'HOTEL');
  const hotel = await repository.findOwnHotel(hotelId, profile.id);
  if (!hotel) throw new NotFoundError('Hotel');
  const map = {
    destination_id: payload.destinationId,
    name: payload.name,
    description: payload.description,
    star_rating: payload.starRating,
    address: payload.address,
    latitude: payload.latitude,
    longitude: payload.longitude,
    phone: payload.phone,
    email: payload.email,
    checkin_time: payload.checkInTime,
    checkout_time: payload.checkOutTime,
    image_url: payload.image,
    gallery: payload.gallery,
    facilities: payload.facilities,
  };
  const updates = Object.fromEntries(Object.entries(map).filter(([, value]) => value !== undefined));
  if (payload.status) updates.status = statusFor(profile, payload.status, { published: 'PUBLISHED', fallback: 'DRAFT' });
  if (payload.name && payload.name !== hotel.name) {
    updates.slug = await uniqueSlug(payload.name, async (candidate) =>
      Boolean(await models.Hotel.findOne({ where: { slug: candidate, id: { [Op.ne]: hotel.id } } }))
    );
  }
  await hotel.update(updates);
  const summary = await repository.roomSummaryForHotels([hotel.id]);
  return { ...serializeHotelSummary(hotel, summary.get(Number(hotel.id))), status: hotel.status };
}

async function createRoom(user, hotelId, payload) {
  const profile = assertProvider(user, 'HOTEL');
  const hotel = await repository.findOwnHotel(hotelId, profile.id);
  if (!hotel) throw new NotFoundError('Hotel');
  const room = await models.HotelRoom.create({
    hotel_id: hotel.id,
    name: payload.name,
    description: payload.description,
    room_type: payload.roomType,
    capacity_adults: payload.capacityAdults,
    capacity_children: payload.capacityChildren || 0,
    base_price: payload.basePrice,
    extra_bed_price: payload.extraBedPrice || 0,
    total_units: payload.totalUnits,
    min_stay_nights: payload.minStayNights || 1,
    max_stay_nights: payload.maxStayNights || null,
    image_url: payload.image,
    amenities: payload.amenities || [],
    status: 'ACTIVE',
  });
  return serializeRoom(room);
}

async function updateRoom(user, roomId, payload) {
  const profile = assertProvider(user, 'HOTEL');
  const room = await repository.findOwnRoom(roomId, profile.id);
  if (!room) throw new NotFoundError('Room');

  if (payload.totalUnits !== undefined) {
    const peak = await models.RoomAvailability.max('reserved_units', { where: { room_id: room.id } });
    if (Number(payload.totalUnits) < Number(peak || 0)) {
      throw new BusinessRuleError(
        `Total units cannot be lower than the ${peak} units already reserved on a date`,
        'UNITS_BELOW_RESERVED'
      );
    }
  }

  const map = {
    name: payload.name,
    description: payload.description,
    room_type: payload.roomType,
    capacity_adults: payload.capacityAdults,
    capacity_children: payload.capacityChildren,
    base_price: payload.basePrice,
    extra_bed_price: payload.extraBedPrice,
    total_units: payload.totalUnits,
    min_stay_nights: payload.minStayNights,
    max_stay_nights: payload.maxStayNights,
    image_url: payload.image,
    amenities: payload.amenities,
    status: payload.status,
  };
  await room.update(Object.fromEntries(Object.entries(map).filter(([, value]) => value !== undefined)));
  return serializeRoom(room);
}

async function archiveRoom(user, roomId) {
  const profile = assertProvider(user, 'HOTEL');
  const room = await repository.findOwnRoom(roomId, profile.id);
  if (!room) throw new NotFoundError('Room');
  await room.update({ status: 'INACTIVE' });
  return { archived: true };
}

async function getRoomAvailability(user, roomId, query) {
  const profile = assertProvider(user, 'HOTEL');
  const room = await repository.findOwnRoom(roomId, profile.id);
  if (!room) throw new NotFoundError('Room');
  const { start, end, dates } = dateRange(query.from, query.to);
  const rows = await models.RoomAvailability.findAll({
    where: { room_id: room.id, date: { [Op.between]: [start, end] } },
    raw: true,
  });
  const byDate = new Map(rows.map((row) => [row.date, row]));
  return dates.map((date) => {
    const row = byDate.get(date);
    return {
      date,
      totalUnits: row ? Number(row.total_units) : Number(room.total_units),
      reservedUnits: row ? Number(row.reserved_units) : 0,
      availableUnits: row ? Math.max(Number(row.total_units) - Number(row.reserved_units), 0) : Number(room.total_units),
      isBlocked: row ? Boolean(row.is_blocked) : false,
      priceOverride: row ? toNumber(row.price_override) : null,
    };
  });
}

async function setRoomAvailability(user, roomId, entries) {
  const profile = assertProvider(user, 'HOTEL');
  const room = await repository.findOwnRoom(roomId, profile.id);
  if (!room) throw new NotFoundError('Room');
  if (!entries.length) throw new BusinessRuleError('At least one date is required', 'DATES_REQUIRED');
  const dates = uniqueDates(entries);

  return sequelize.transaction(async (transaction) => {
    const results = [];
    for (const entry of entries) {
      if (isPast(entry.date)) throw new BusinessRuleError('Cannot change availability in the past', 'DATE_IN_PAST');
      const [row, created] = await models.RoomAvailability.findOrCreate({
        where: { room_id: room.id, date: entry.date },
        defaults: {
          room_id: room.id,
          date: entry.date,
          total_units: room.total_units,
          reserved_units: 0,
          is_blocked: false,
        },
        transaction,
      });
      const updates = {};
      if (entry.isBlocked !== undefined) updates.is_blocked = entry.isBlocked;
      if (entry.priceOverride !== undefined) updates.price_override = entry.priceOverride;
      if (entry.totalUnits !== undefined) {
        if (Number(entry.totalUnits) < Number(row.reserved_units)) {
          throw new BusinessRuleError(
            `${entry.date} already has ${row.reserved_units} reserved units`,
            'UNITS_BELOW_RESERVED'
          );
        }
        updates.total_units = entry.totalUnits;
      }
      if (Object.keys(updates).length) await row.update(updates, { transaction });
      results.push({
        date: row.date,
        totalUnits: Number(row.total_units),
        reservedUnits: Number(row.reserved_units),
        isBlocked: Boolean(row.is_blocked),
        priceOverride: toNumber(row.price_override),
        created,
      });
    }
    return results;
  });
}

// -------------------------------------------------------- vehicle (owner)

async function resolveCategory(payload) {
  if (payload.categoryId) {
    const category = await models.VehicleCategory.findByPk(payload.categoryId);
    if (!category) throw new NotFoundError('Vehicle category');
    return category;
  }
  if (!payload.categoryCode) {
    throw new BusinessRuleError('A vehicle category is required', 'VEHICLE_CATEGORY_REQUIRED');
  }
  const category = await models.VehicleCategory.findOne({ where: { code: payload.categoryCode } });
  if (!category) throw new NotFoundError('Vehicle category');
  return category;
}

function serializeOwnVehicle(vehicle) {
  const base = serializeVehicle(vehicle, { detail: true });
  return { ...base, registrationNo: vehicle.registration_no, categoryId: vehicle.category_id };
}

async function listProviderVehicles(user) {
  const profile = assertProvider(user, 'TRANSPORT');
  const vehicles = await repository.listOwnVehicles(profile.id);
  return vehicles.map(serializeOwnVehicle);
}

async function createVehicle(user, payload) {
  const profile = assertProvider(user, 'TRANSPORT');
  const category = await resolveCategory(payload);
  const duplicate = await models.Vehicle.findOne({ where: { registration_no: payload.registrationNo } });
  if (duplicate) throw new ConflictError('A vehicle with this registration number already exists');
  const status = statusFor(profile, payload.status, { published: 'ACTIVE', fallback: 'PENDING_REVIEW' });
  const vehicle = await models.Vehicle.create({
    provider_profile_id: profile.id,
    category_id: category.id,
    name: payload.name,
    model: payload.model,
    registration_no: payload.registrationNo,
    capacity: payload.capacity,
    price_per_day: payload.pricePerDay || null,
    price_per_km: payload.pricePerKm || null,
    image_url: payload.image,
    features: payload.features || [],
    driver_included: payload.driverIncluded !== false,
    status,
  });
  vehicle.category = category;
  return serializeOwnVehicle(vehicle);
}

async function updateVehicle(user, vehicleId, payload) {
  const profile = assertProvider(user, 'TRANSPORT');
  const vehicle = await repository.findOwnVehicle(vehicleId, profile.id);
  if (!vehicle) throw new NotFoundError('Vehicle');
  if (payload.registrationNo && payload.registrationNo !== vehicle.registration_no) {
    const duplicate = await models.Vehicle.findOne({
      where: { registration_no: payload.registrationNo, id: { [Op.ne]: vehicle.id } },
    });
    if (duplicate) throw new ConflictError('A vehicle with this registration number already exists');
  }
  const category = payload.categoryId || payload.categoryCode ? await resolveCategory(payload) : null;
  const map = {
    category_id: category ? category.id : undefined,
    name: payload.name,
    model: payload.model,
    registration_no: payload.registrationNo,
    capacity: payload.capacity,
    price_per_day: payload.pricePerDay,
    price_per_km: payload.pricePerKm,
    image_url: payload.image,
    features: payload.features,
    driver_included: payload.driverIncluded,
  };
  const updates = Object.fromEntries(Object.entries(map).filter(([, value]) => value !== undefined));
  if (payload.status) updates.status = statusFor(profile, payload.status, { published: 'ACTIVE', fallback: 'INACTIVE' });
  await vehicle.update(updates);
  const refreshed = await models.Vehicle.findByPk(vehicle.id, {
    include: [{ model: models.VehicleCategory, as: 'category', attributes: ['id', 'code', 'name'] }],
  });
  return serializeOwnVehicle(refreshed);
}

async function getVehicleAvailabilityForProvider(user, vehicleId, query) {
  const profile = assertProvider(user, 'TRANSPORT');
  const vehicle = await repository.findOwnVehicle(vehicleId, profile.id);
  if (!vehicle) throw new NotFoundError('Vehicle');
  const { start, end, dates } = dateRange(query.from, query.to);
  const rows = await repository.listVehicleAvailability(vehicle.id, start, end);
  const byDate = new Map(rows.map((row) => [row.date, row]));
  return dates.map((date) => {
    const row = byDate.get(date);
    return {
      date,
      status: row ? row.status : 'AVAILABLE',
      bookingItemId: row ? row.booking_item_id : null,
      scheduled: Boolean(row),
    };
  });
}

async function setVehicleAvailability(user, vehicleId, entries) {
  const profile = assertProvider(user, 'TRANSPORT');
  const vehicle = await repository.findOwnVehicle(vehicleId, profile.id);
  if (!vehicle) throw new NotFoundError('Vehicle');
  if (!entries.length) throw new BusinessRuleError('At least one date is required', 'DATES_REQUIRED');
  uniqueDates(entries);

  return sequelize.transaction(async (transaction) => {
    const results = [];
    for (const entry of entries) {
      if (isPast(entry.date)) throw new BusinessRuleError('Cannot change availability in the past', 'DATE_IN_PAST');
      const [row, created] = await models.VehicleAvailability.findOrCreate({
        where: { vehicle_id: vehicle.id, date: entry.date },
        defaults: { vehicle_id: vehicle.id, date: entry.date, status: 'AVAILABLE' },
        transaction,
      });
      if (!created && row.status === 'BOOKED') {
        throw new BusinessRuleError(`${entry.date} is already booked and cannot be changed`, 'DATE_BOOKED');
      }
      if (row.status !== entry.status) await row.update({ status: entry.status }, { transaction });
      results.push({ date: row.date, status: row.status });
    }
    return results;
  });
}

// ---------------------------------------------------------- drivers (owner)

function serializeDriver(driver) {
  const plain = driver.get ? driver.get({ plain: true }) : driver;
  return {
    id: plain.id,
    name: plain.name,
    phone: plain.phone,
    licenseNo: plain.license_no,
    licenseExpiry: plain.license_expiry,
    photo: plain.photo_url,
    status: plain.status,
    vehicle: plain.vehicle
      ? { id: plain.vehicle.id, name: plain.vehicle.name, registrationNo: plain.vehicle.registration_no }
      : null,
  };
}

async function listProviderDrivers(user) {
  const profile = assertProvider(user, 'TRANSPORT');
  const drivers = await repository.listOwnDrivers(profile.id);
  return drivers.map(serializeDriver);
}

async function assertOwnVehicle(user, vehicleId) {
  const profile = assertProvider(user, 'TRANSPORT');
  const vehicle = await repository.findOwnVehicle(vehicleId, profile.id);
  if (!vehicle) throw new NotFoundError('Vehicle');
  return vehicle;
}

async function createDriver(user, payload) {
  const profile = assertProvider(user, 'TRANSPORT');
  if (payload.vehicleId) await assertOwnVehicle(user, payload.vehicleId);
  const driver = await models.Driver.create({
    provider_profile_id: profile.id,
    vehicle_id: payload.vehicleId || null,
    name: payload.name,
    phone: payload.phone,
    license_no: payload.licenseNo,
    license_expiry: payload.licenseExpiry || null,
    photo_url: payload.photo,
    status: payload.status || 'ACTIVE',
  });
  return serializeDriver(driver);
}

async function updateDriver(user, driverId, payload) {
  const profile = assertProvider(user, 'TRANSPORT');
  const driver = await repository.findOwnDriver(driverId, profile.id);
  if (!driver) throw new NotFoundError('Driver');
  if (payload.vehicleId) await assertOwnVehicle(user, payload.vehicleId);
  const map = {
    vehicle_id: payload.vehicleId,
    name: payload.name,
    phone: payload.phone,
    license_no: payload.licenseNo,
    license_expiry: payload.licenseExpiry,
    photo_url: payload.photo,
    status: payload.status,
  };
  await driver.update(Object.fromEntries(Object.entries(map).filter(([, value]) => value !== undefined)));
  return serializeDriver(driver);
}

async function archiveDriver(user, driverId) {
  const profile = assertProvider(user, 'TRANSPORT');
  const driver = await repository.findOwnDriver(driverId, profile.id);
  if (!driver) throw new NotFoundError('Driver');
  await driver.update({ status: 'INACTIVE', vehicle_id: null });
  return { archived: true };
}

// -------------------------------------------------------------- guide owner

async function getGuideProfile(user) {
  const profile = assertProvider(user, 'GUIDE');
  const guide = await repository.findOwnGuide(profile.id);
  return guide ? serializeGuide(guide, { detail: true }) : null;
}

async function upsertGuideProfile(user, payload) {
  const profile = assertProvider(user, 'GUIDE');
  let guide = await repository.findOwnGuide(profile.id);
  const status = payload.status
    ? statusFor(profile, payload.status, { published: 'ACTIVE', fallback: 'PENDING_REVIEW' })
    : guide?.status || 'PENDING_REVIEW';
  const data = {
    bio: payload.bio,
    languages: payload.languages || [],
    expertise: payload.expertise || [],
    years_experience: payload.yearsExperience || 0,
    daily_rate: payload.dailyRate,
    hourly_rate: payload.hourlyRate || null,
    service_locations: payload.serviceLocations || [],
    photo_url: payload.photo,
    status,
  };
  if (guide) {
    await guide.update(data);
  } else {
    guide = await models.Guide.create({ provider_profile_id: profile.id, ...data });
  }
  const refreshed = await models.Guide.findByPk(guide.id, {
    include: [{ model: models.ProviderProfile, as: 'provider', attributes: ['id', 'business_name', 'description', 'phone', 'address'] }],
  });
  return serializeGuide(refreshed, { detail: true });
}

async function ownGuideOrFail(user) {
  const profile = assertProvider(user, 'GUIDE');
  const guide = await repository.findOwnGuide(profile.id);
  if (!guide) throw new NotFoundError('Guide profile');
  return guide;
}

async function getGuideAvailabilityForProvider(user, query) {
  const guide = await ownGuideOrFail(user);
  const { start, end, dates } = dateRange(query.from, query.to);
  const rows = await repository.listGuideAvailability(guide.id, start, end);
  const byDate = new Map(rows.map((row) => [row.date, row]));
  return dates.map((date) => {
    const row = byDate.get(date);
    return {
      date,
      status: row ? row.status : 'AVAILABLE',
      bookingItemId: row ? row.booking_item_id : null,
      scheduled: Boolean(row),
    };
  });
}

async function setGuideAvailability(user, entries) {
  const guide = await ownGuideOrFail(user);
  if (!entries.length) throw new BusinessRuleError('At least one date is required', 'DATES_REQUIRED');
  uniqueDates(entries);

  return sequelize.transaction(async (transaction) => {
    const results = [];
    for (const entry of entries) {
      if (isPast(entry.date)) throw new BusinessRuleError('Cannot change availability in the past', 'DATE_IN_PAST');
      const [row, created] = await models.GuideAvailability.findOrCreate({
        where: { guide_id: guide.id, date: entry.date },
        defaults: { guide_id: guide.id, date: entry.date, status: 'AVAILABLE' },
        transaction,
      });
      if (!created && row.status === 'BOOKED') {
        throw new BusinessRuleError(`${entry.date} is already booked and cannot be changed`, 'DATE_BOOKED');
      }
      if (row.status !== entry.status) await row.update({ status: entry.status }, { transaction });
      results.push({ date: row.date, status: row.status });
    }
    return results;
  });
}

module.exports = {
  getHotels,
  getHotel,
  getHotelAvailability,
  getVehicles,
  getVehicle,
  getVehicleAvailability,
  getGuides,
  getGuide,
  getGuideAvailability,
  getVehicleCategories,
  getProviderProfile,
  updateProviderProfile,
  listProviderDocuments,
  uploadProviderDocument,
  getProviderDocumentFile,
  listProviderHotels,
  createProviderHotel,
  updateProviderHotel,
  createRoom,
  updateRoom,
  archiveRoom,
  getRoomAvailability,
  setRoomAvailability,
  listProviderVehicles,
  createVehicle,
  updateVehicle,
  getVehicleAvailabilityForProvider,
  setVehicleAvailability,
  listProviderDrivers,
  createDriver,
  updateDriver,
  archiveDriver,
  getGuideProfile,
  upsertGuideProfile,
  getGuideAvailabilityForProvider,
  setGuideAvailability,
  assertStayRange,
  serializeRoom,
  serializeVehicle,
  serializeGuide,
  serializeHotelSummary,
};
