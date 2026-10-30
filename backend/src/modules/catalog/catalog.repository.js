'use strict';

const { Op } = require('sequelize');
const { models } = require('../../models');

async function listDestinations({ districtId, divisionId, categorySlug, featured, search, limit, offset, sort }) {
  const where = { status: 'PUBLISHED' };
  if (districtId) where.district_id = districtId;
  if (featured !== undefined) where.is_featured = featured;
  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { summary: { [Op.like]: `%${search}%` } },
    ];
  }

  const include = [
    { model: models.District, as: 'district', attributes: ['id', 'name', 'name_bn', 'division_id'] },
    { model: models.DestinationCategory, as: 'category', attributes: ['id', 'name', 'name_bn', 'slug'] },
  ];
  if (divisionId || categorySlug) {
    include[0].where = {};
    if (divisionId) include[0].where.division_id = divisionId;
    include[0].required = Boolean(divisionId);
    if (categorySlug) {
      include[1].where = { slug: categorySlug };
      include[1].required = true;
    }
  }

  const order =
    sort === 'rating'
      ? [['rating_avg', 'DESC'], ['rating_count', 'DESC']]
      : sort === 'name'
        ? [['name', 'ASC']]
        : sort === 'popular'
          ? [['is_featured', 'DESC'], ['rating_count', 'DESC']]
          : [['created_at', 'DESC'], ['id', 'DESC']];

  const { rows, count } = await models.Destination.findAndCountAll({
    where,
    include,
    order,
    limit,
    offset,
    distinct: true,
  });
  return { rows, count };
}

async function findDestinationBySlug(slug) {
  return models.Destination.findOne({
    where: { slug, status: { [Op.ne]: 'ARCHIVED' } },
    include: [
      { model: models.District, as: 'district', attributes: ['id', 'name', 'name_bn'], include: [{ model: models.Division, as: 'division', attributes: ['id', 'name', 'name_bn', 'code'] }] },
      { model: models.DestinationCategory, as: 'category', attributes: ['id', 'name', 'name_bn', 'slug'] },
      { model: models.TouristSpot, as: 'touristSpots', where: { status: 'ACTIVE' }, required: false },
    ],
  });
}

async function findDestinationById(id) {
  return models.Destination.findByPk(id, {
    include: [{ model: models.District, as: 'district' }, { model: models.TouristSpot, as: 'touristSpots', required: false }],
  });
}

async function listPackages({ destinationSlug, minPrice, maxPrice, minDays, maxDays, search, featured, limit, offset, sort }) {
  const where = { status: 'PUBLISHED' };
  if (featured !== undefined) where.is_featured = featured;
  if (minPrice !== undefined || maxPrice !== undefined) {
    where.base_price_per_person = {};
    if (minPrice !== undefined) where.base_price_per_person[Op.gte] = minPrice;
    if (maxPrice !== undefined) where.base_price_per_person[Op.lte] = maxPrice;
  }
  if (minDays || maxDays) {
    where.duration_days = {};
    if (minDays) where.duration_days[Op.gte] = minDays;
    if (maxDays) where.duration_days[Op.lte] = maxDays;
  }
  if (search) {
    where[Op.or] = [
      { title: { [Op.like]: `%${search}%` } },
      { summary: { [Op.like]: `%${search}%` } },
    ];
  }

  const include = [
    { model: models.Destination, as: 'destinations', attributes: ['id', 'name', 'slug', 'cover_image'], through: { attributes: [] }, required: Boolean(destinationSlug) },
  ];
  if (destinationSlug) include[0].where = { slug: destinationSlug };

  const orderMap = {
    price_asc: [['base_price_per_person', 'ASC']],
    price_desc: [['base_price_per_person', 'DESC']],
    duration: [['duration_days', 'ASC']],
    newest: [['created_at', 'DESC'], ['id', 'DESC']],
    popular: [['rating_count', 'DESC'], ['rating_avg', 'DESC']],
  };

  const { rows, count } = await models.Package.findAndCountAll({
    where,
    include,
    order: orderMap[sort] || orderMap.newest,
    limit,
    offset,
    distinct: true,
  });
  return { rows, count };
}

async function findPackageBySlug(slug) {
  return models.Package.findOne({
    where: { slug, status: { [Op.ne]: 'ARCHIVED' } },
    include: [
      { model: models.Destination, as: 'destinations', attributes: ['id', 'name', 'slug', 'cover_image', 'summary'], through: { attributes: [] } },
      { model: models.PackageItinerary, as: 'itineraries', separate: true, order: [['day_number', 'ASC']] },
      {
        model: models.PackageDeparture,
        as: 'departures',
        separate: true,
        where: { status: 'SCHEDULED', start_date: { [Op.gte]: new Date().toISOString().slice(0, 10) } },
        required: false,
        order: [['start_date', 'ASC']],
        limit: 8,
      },
      { model: models.ProviderProfile, as: 'operator', attributes: ['id', 'business_name'], required: false },
    ],
  });
}

async function findPackageById(id) {
  return models.Package.findByPk(id, {
    include: [
      { model: models.Destination, as: 'destinations', through: { attributes: [] } },
      { model: models.PackageItinerary, as: 'itineraries', separate: true, order: [['day_number', 'ASC']] },
    ],
  });
}

async function listBlogs({ limit, offset, includeDrafts = false }) {
  const where = includeDrafts ? {} : { status: 'PUBLISHED' };
  return models.Blog.findAndCountAll({
    where,
    order: [['published_at', 'DESC'], ['created_at', 'DESC']],
    limit,
    offset,
  });
}

async function findBlogBySlug(slug) {
  return models.Blog.findOne({ where: { slug } });
}

async function searchAll(term, limitPerType = 5) {
  const like = { [Op.like]: `%${term}%` };
  const [destinations, packages, hotels, guides] = await Promise.all([
    models.Destination.findAll({
      where: { status: 'PUBLISHED', [Op.or]: [{ name: like }, { summary: like }] },
      attributes: ['id', 'name', 'slug', 'cover_image', 'summary', 'rating_avg'],
      order: [['created_at', 'DESC'], ['id', 'DESC']],
      limit: limitPerType,
    }),
    models.Package.findAll({
      where: { status: 'PUBLISHED', [Op.or]: [{ title: like }, { summary: like }] },
      attributes: ['id', 'title', 'slug', 'cover_image', 'summary', 'base_price_per_person', 'duration_days'],
      order: [['created_at', 'DESC'], ['id', 'DESC']],
      limit: limitPerType,
    }),
    models.Hotel.findAll({
      where: { status: 'PUBLISHED', [Op.or]: [{ name: like }, { address: like }] },
      attributes: ['id', 'name', 'slug', 'image_url', 'address', 'star_rating', 'rating_avg'],
      order: [['created_at', 'DESC'], ['id', 'DESC']],
      limit: limitPerType,
    }),
    models.Guide.findAll({
      where: { status: 'ACTIVE', [Op.or]: [{ bio: like }] },
      attributes: ['id', 'bio', 'daily_rate', 'photo_url', 'rating_avg', 'languages', 'service_locations'],
      include: [{ model: models.ProviderProfile, as: 'provider', attributes: ['business_name'], where: { status: 'APPROVED' } }],
      order: [['created_at', 'DESC'], ['id', 'DESC']],
      limit: limitPerType,
    }),
  ]);
  return { destinations, packages, hotels, guides };
}

async function listDivisionsWithDistricts() {
  return models.Division.findAll({
    attributes: ['id', 'name', 'name_bn', 'code'],
    include: [{ model: models.District, as: 'districts', attributes: ['id', 'name', 'name_bn', 'code'] }],
    order: [['id', 'ASC']],
  });
}

module.exports = {
  listDestinations,
  findDestinationBySlug,
  findDestinationById,
  listPackages,
  findPackageBySlug,
  findPackageById,
  listBlogs,
  findBlogBySlug,
  searchAll,
  listDivisionsWithDistricts,
};
