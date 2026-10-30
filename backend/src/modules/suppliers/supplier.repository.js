'use strict';

const { Op, literal } = require('sequelize');
const { models } = require('../../models');

const PROVIDER_PUBLIC_LIST = {
  model: models.ProviderProfile,
  as: 'provider',
  attributes: ['id', 'business_name', 'status'],
  where: { status: 'APPROVED' },
  required: true,
};

const PROVIDER_PUBLIC_DETAIL = {
  model: models.ProviderProfile,
  as: 'provider',
  attributes: ['id', 'business_name', 'description', 'logo_url', 'address', 'phone', 'status'],
  where: { status: 'APPROVED' },
  required: true,
};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- public read

async function listHotels({ destinationSlug, stars, minPrice, maxPrice, search, sort, limit, offset }) {
  const where = { status: 'PUBLISHED' };
  if (stars) where.star_rating = { [Op.gte]: stars };
  if (search) {
    where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }, { address: { [Op.like]: `%${search}%` } }];
  }

  const replacements = {};
  if (minPrice !== undefined || maxPrice !== undefined) {
    const conditions = ["hr.status = 'ACTIVE'"];
    if (minPrice !== undefined) {
      conditions.push('hr.base_price >= :minPrice');
      replacements.minPrice = minPrice;
    }
    if (maxPrice !== undefined) {
      conditions.push('hr.base_price <= :maxPrice');
      replacements.maxPrice = maxPrice;
    }
    where[Op.and] = [literal(`EXISTS (SELECT 1 FROM hotel_rooms hr WHERE hr.hotel_id = Hotel.id AND ${conditions.join(' AND ')})`)];
  }

  const include = [
    PROVIDER_PUBLIC_LIST,
    { model: models.Destination, as: 'destination', attributes: ['id', 'name', 'name_bn', 'slug'], required: Boolean(destinationSlug) },
  ];
  if (destinationSlug) include[1].where = { slug: destinationSlug };

  const minPriceSql = literal(`(SELECT MIN(hr.base_price) FROM hotel_rooms hr WHERE hr.hotel_id = Hotel.id AND hr.status = 'ACTIVE')`);
  const orderMap = {
    newest: [['created_at', 'DESC'], ['id', 'DESC']],
    price_asc: [[minPriceSql, 'ASC']],
    price_desc: [[minPriceSql, 'DESC']],
    rating: [['rating_avg', 'DESC'], ['rating_count', 'DESC']],
    name: [['name', 'ASC']],
  };

  const { rows, count } = await models.Hotel.findAndCountAll({
    where,
    include,
    replacements,
    order: orderMap[sort] || orderMap.newest,
    limit,
    offset,
    distinct: true,
  });
  return { rows, count };
}

async function roomSummaryForHotels(hotelIds) {
  if (!hotelIds.length) return new Map();
  const rooms = await models.HotelRoom.findAll({
    where: { hotel_id: { [Op.in]: hotelIds }, status: 'ACTIVE' },
    attributes: ['hotel_id', 'base_price', 'total_units'],
    raw: true,
  });
  const summary = new Map();
  for (const room of rooms) {
    const key = Number(room.hotel_id);
    const entry = summary.get(key) || { minPrice: null, totalUnits: 0, roomCount: 0 };
    const price = Number(room.base_price);
    entry.minPrice = entry.minPrice === null ? price : Math.min(entry.minPrice, price);
    entry.totalUnits += Number(room.total_units);
    entry.roomCount += 1;
    summary.set(key, entry);
  }
  return summary;
}

async function findHotelBySlug(slug) {
  return models.Hotel.findOne({
    where: { slug, status: 'PUBLISHED' },
    include: [
      PROVIDER_PUBLIC_DETAIL,
      { model: models.Destination, as: 'destination', attributes: ['id', 'name', 'name_bn', 'slug'] },
      {
        model: models.HotelRoom,
        as: 'rooms',
        separate: true,
        where: { status: 'ACTIVE' },
        required: false,
        order: [['base_price', 'ASC']],
      },
    ],
  });
}

async function listVehicles({ categoryCode, minCapacity, search, sort, limit, offset }) {
  const where = { status: 'ACTIVE' };
  if (minCapacity) where.capacity = { [Op.gte]: minCapacity };
  if (search) {
    where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }, { model: { [Op.like]: `%${search}%` } }];
  }

  const include = [
    PROVIDER_PUBLIC_LIST,
    {
      model: models.VehicleCategory,
      as: 'category',
      attributes: ['id', 'code', 'name', 'name_bn', 'icon', 'default_capacity'],
      required: Boolean(categoryCode),
    },
  ];
  if (categoryCode) include[1].where = { code: categoryCode };

  const orderMap = {
    newest: [['created_at', 'DESC'], ['id', 'DESC']],
    price_asc: [['price_per_day', 'ASC']],
    price_desc: [['price_per_day', 'DESC']],
    capacity: [['capacity', 'DESC']],
    rating: [['rating_avg', 'DESC']],
  };

  const { rows, count } = await models.Vehicle.findAndCountAll({
    where,
    include,
    order: orderMap[sort] || orderMap.newest,
    limit,
    offset,
    distinct: true,
  });
  return { rows, count };
}

async function findVehicleById(id) {
  return models.Vehicle.findOne({
    where: { id, status: 'ACTIVE' },
    include: [
      PROVIDER_PUBLIC_DETAIL,
      { model: models.VehicleCategory, as: 'category', attributes: ['id', 'code', 'name', 'name_bn', 'icon', 'default_capacity'] },
    ],
  });
}

async function listGuides({ language, location, expertise, minRating, search, sort, limit, offset }) {
  const where = { status: 'ACTIVE' };
  if (minRating) where.rating_avg = { [Op.gte]: minRating };

  const replacements = {};
  const restrictions = [];
  if (language) {
    restrictions.push(literal('Guide.languages LIKE :language'));
    replacements.language = `%"${language}"%`;
  }
  if (location) {
    restrictions.push(literal('Guide.service_locations LIKE :location'));
    replacements.location = `%"${location}"%`;
  }
  if (expertise) {
    restrictions.push(literal('Guide.expertise LIKE :expertise'));
    replacements.expertise = `%"${expertise}"%`;
  }
  if (search) {
    restrictions.push(literal('Guide.bio LIKE :guideSearch'));
    replacements.guideSearch = `%${search}%`;
  }
  if (restrictions.length) where[Op.and] = restrictions;

  const orderMap = {
    newest: [['created_at', 'DESC'], ['id', 'DESC']],
    rate_asc: [['daily_rate', 'ASC']],
    rate_desc: [['daily_rate', 'DESC']],
    rating: [['rating_avg', 'DESC'], ['rating_count', 'DESC']],
    experience: [['years_experience', 'DESC']],
  };

  const { rows, count } = await models.Guide.findAndCountAll({
    where,
    include: [PROVIDER_PUBLIC_LIST],
    replacements,
    order: orderMap[sort] || orderMap.newest,
    limit,
    offset,
    distinct: true,
  });
  return { rows, count };
}

async function findGuideById(id) {
  return models.Guide.findOne({
    where: { id, status: 'ACTIVE' },
    include: [
      PROVIDER_PUBLIC_DETAIL,
      {
        model: models.GuideAvailability,
        as: 'availability',
        where: { date: { [Op.gte]: todayString() } },
        required: false,
        attributes: ['date', 'status'],
        limit: 60,
      },
    ],
  });
}

async function listVehicleCategories() {
  return models.VehicleCategory.findAll({ order: [['id', 'ASC']] });
}

// ------------------------------------------------------------ availability

async function listRoomAvailability(roomIds, from, to) {
  if (!roomIds.length) return [];
  return models.RoomAvailability.findAll({
    where: { room_id: { [Op.in]: roomIds }, date: { [Op.between]: [from, to] } },
    raw: true,
  });
}

async function listVehicleAvailability(vehicleId, from, to) {
  return models.VehicleAvailability.findAll({
    where: { vehicle_id: vehicleId, date: { [Op.between]: [from, to] } },
    attributes: ['id', 'date', 'status', 'booking_item_id'],
  });
}

async function listGuideAvailability(guideId, from, to) {
  return models.GuideAvailability.findAll({
    where: { guide_id: guideId, date: { [Op.between]: [from, to] } },
    attributes: ['id', 'date', 'status', 'booking_item_id'],
  });
}

async function lockRoomAvailability(roomId, dates, transaction) {
  return models.RoomAvailability.findAll({
    where: { room_id: roomId, date: { [Op.in]: dates } },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
}

async function lockVehicleAvailability(vehicleId, dates, transaction) {
  return models.VehicleAvailability.findAll({
    where: { vehicle_id: vehicleId, date: { [Op.in]: dates } },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
}

async function lockGuideAvailability(guideId, dates, transaction) {
  return models.GuideAvailability.findAll({
    where: { guide_id: guideId, date: { [Op.in]: dates } },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
}

async function findOwnHotel(id, providerProfileId) {
  return models.Hotel.findOne({ where: { id, provider_profile_id: providerProfileId } });
}

async function listOwnHotels(providerProfileId) {
  return models.Hotel.findAll({
    where: { provider_profile_id: providerProfileId },
    include: [
      { model: models.Destination, as: 'destination' },
      { model: models.HotelRoom, as: 'rooms', separate: true, order: [['id', 'ASC']] },
    ],
    order: [['created_at', 'DESC'], ['id', 'DESC']],
  });
}

async function findOwnRoom(id, providerProfileId) {
  return models.HotelRoom.findOne({
    where: { id },
    include: [
      {
        model: models.Hotel,
        as: 'hotel',
        attributes: ['id', 'name', 'slug', 'provider_profile_id', 'status'],
        where: { provider_profile_id: providerProfileId },
        required: true,
      },
    ],
  });
}

async function listRoomsByHotel(hotelId) {
  return models.HotelRoom.findAll({ where: { hotel_id: hotelId }, order: [['id', 'ASC']] });
}

async function listOwnVehicles(providerProfileId) {
  return models.Vehicle.findAll({
    where: { provider_profile_id: providerProfileId },
    include: [{ model: models.VehicleCategory, as: 'category', attributes: ['id', 'code', 'name'] }],
    order: [['created_at', 'DESC'], ['id', 'DESC']],
  });
}

async function findOwnVehicle(id, providerProfileId) {
  return models.Vehicle.findOne({ where: { id, provider_profile_id: providerProfileId } });
}

async function listOwnDrivers(providerProfileId) {
  return models.Driver.findAll({
    where: { provider_profile_id: providerProfileId },
    include: [{ model: models.Vehicle, as: 'vehicle', attributes: ['id', 'name', 'registration_no'] }],
    order: [['created_at', 'DESC'], ['id', 'DESC']],
  });
}

async function findOwnDriver(id, providerProfileId) {
  return models.Driver.findOne({ where: { id, provider_profile_id: providerProfileId } });
}

async function findOwnGuide(providerProfileId) {
  return models.Guide.findOne({ where: { provider_profile_id: providerProfileId } });
}

async function listDocuments(providerProfileId) {
  return models.ProviderDocument.findAll({
    where: { provider_profile_id: providerProfileId },
    order: [['created_at', 'DESC'], ['id', 'DESC']],
  });
}

async function countDocuments(providerProfileId) {
  return models.ProviderDocument.count({ where: { provider_profile_id: providerProfileId } });
}

module.exports = {
  listHotels,
  roomSummaryForHotels,
  findHotelBySlug,
  listVehicles,
  findVehicleById,
  listGuides,
  findGuideById,
  listVehicleCategories,
  listRoomAvailability,
  listVehicleAvailability,
  listGuideAvailability,
  lockRoomAvailability,
  lockVehicleAvailability,
  lockGuideAvailability,
  findOwnHotel,
  listOwnHotels,
  findOwnRoom,
  listRoomsByHotel,
  listOwnVehicles,
  findOwnVehicle,
  listOwnDrivers,
  findOwnDriver,
  findOwnGuide,
  listDocuments,
  countDocuments,
};
