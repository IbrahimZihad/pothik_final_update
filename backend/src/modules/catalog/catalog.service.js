'use strict';

const { Op } = require('sequelize');
const { models, sequelize } = require('../../models');
const repository = require('./catalog.repository');
const { NotFoundError, BusinessRuleError } = require('../../shared/errors');
const { getPagination, buildMeta } = require('../../shared/utils/pagination');
const { slugify, uniqueSlug } = require('../../shared/utils/slugify');
const cache = require('../../infrastructure/cache/cache');
const { ratingsSummary } = require('../reviews/review.service');

const CACHE_TTL = 120;

function publicDestination(destination) {
  const plain = destination.get ? destination.get({ plain: true }) : destination;
  return {
    id: plain.id,
    name: plain.name,
    nameBn: plain.name_bn,
    slug: plain.slug,
    summary: plain.summary,
    description: plain.description,
    coverImage: plain.cover_image,
    gallery: plain.gallery || [],
    bestSeason: plain.best_season,
    estimatedDurationHours: plain.estimated_duration_hours,
    entryFee: plain.entry_fee,
    ratingAvg: Number(plain.rating_avg || 0),
    ratingCount: plain.rating_count,
    featured: plain.is_featured,
    district: plain.district
      ? { id: plain.district.id, name: plain.district.name, nameBn: plain.district.name_bn, division: plain.district.division || null }
      : null,
    category: plain.category
      ? { id: plain.category.id, name: plain.category.name, nameBn: plain.category.name_bn, slug: plain.category.slug }
      : null,
    touristSpots: (plain.touristSpots || []).map((spot) => ({
      id: spot.id,
      name: spot.name,
      description: spot.description,
      entryFee: spot.entry_fee,
      durationHours: spot.duration_hours,
      image: spot.image_url,
    })),
    latitude: plain.latitude,
    longitude: plain.longitude,
    travelInfo: plain.travel_info,
  };
}

function publicPackage(pkg) {
  const plain = pkg.get ? pkg.get({ plain: true }) : pkg;
  return {
    id: plain.id,
    slug: plain.slug,
    title: plain.title,
    titleBn: plain.title_bn,
    summary: plain.summary,
    description: plain.description,
    coverImage: plain.cover_image,
    gallery: plain.gallery || [],
    durationDays: plain.duration_days,
    durationNights: plain.duration_nights,
    pricePerPerson: Number(plain.base_price_per_person || 0),
    childPrice: plain.child_price_per_person ? Number(plain.child_price_per_person) : null,
    maxCapacity: plain.max_capacity,
    includes: plain.includes || [],
    excludes: plain.excludes || [],
    highlights: plain.highlights || [],
    cancellationPolicy: plain.cancellation_policy,
    ratingAvg: Number(plain.rating_avg || 0),
    ratingCount: plain.rating_count,
    featured: plain.is_featured,
    status: plain.status,
    destinations: (plain.destinations || []).map((d) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      coverImage: d.cover_image,
      summary: d.summary,
    })),
    itineraries: (plain.itineraries || []).map((day) => ({
      day: day.day_number,
      title: day.title,
      description: day.description,
      meals: day.meals_included || [],
      accommodation: day.accommodation,
    })),
    departures: (plain.departures || []).map((departure) => ({
      id: departure.id,
      startDate: departure.start_date,
      endDate: departure.end_date,
      capacity: departure.capacity,
      seatsLeft: Math.max(departure.capacity - departure.booked_count, 0),
      price: Number(departure.price_override || plain.base_price_per_person || 0),
    })),
    operator: plain.operator ? { id: plain.operator.id, name: plain.operator.business_name } : null,
  };
}

async function getDestinations(query) {
  const { page, limit, offset } = getPagination(query, { defaultLimit: 12 });
  const cacheKey = cache.key('destinations', [JSON.stringify(query)]);
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const { rows, count } = await repository.listDestinations({
    districtId: query.districtId,
    divisionId: query.divisionId,
    categorySlug: query.category,
    featured: query.featured === undefined ? undefined : query.featured === 'true' || query.featured === true,
    search: query.search,
    sort: query.sort,
    limit,
    offset,
  });

  const result = {
    items: rows.map(publicDestination),
    meta: buildMeta({ page, limit, total: count }),
  };
  await cache.set(cacheKey, result, CACHE_TTL);
  return result;
}

async function getDestination(slug) {
  const destination = await repository.findDestinationBySlug(slug);
  if (!destination) throw new NotFoundError('Destination');
  const packages = await models.Package.findAll({
    where: { status: 'PUBLISHED' },
    include: [{ model: models.Destination, as: 'destinations', where: { id: destination.id }, attributes: [], through: { attributes: [] } }],
    limit: 6,
    attributes: ['id', 'title', 'slug', 'cover_image', 'base_price_per_person', 'duration_days', 'rating_avg'],
  });
  const reviews = await ratingsSummary('DESTINATION', destination.id);
  return {
    ...publicDestination(destination),
    packages: packages.map((pkg) => ({
      id: pkg.id,
      title: pkg.title,
      slug: pkg.slug,
      coverImage: pkg.cover_image,
      pricePerPerson: Number(pkg.base_price_per_person),
      durationDays: pkg.duration_days,
      ratingAvg: Number(pkg.rating_avg),
    })),
    reviews,
  };
}

async function getDestinationMeta() {
  const cached = await cache.get('destinations:meta');
  if (cached) return cached;
  const [divisions, categories] = await Promise.all([
    repository.listDivisionsWithDistricts(),
    models.DestinationCategory.findAll({ order: [['id', 'ASC']] }),
  ]);
  const result = {
    divisions: divisions.map((d) => ({
      id: d.id,
      name: d.name,
      nameBn: d.name_bn,
      code: d.code,
      districts: d.districts.map((district) => ({ id: district.id, name: district.name, nameBn: district.name_bn, code: district.code })),
    })),
    categories: categories.map((c) => ({ id: c.id, name: c.name, nameBn: c.name_bn, slug: c.slug, icon: c.icon })),
  };
  await cache.set('destinations:meta', result, 600);
  return result;
}

async function getPackages(query) {
  const { page, limit, offset } = getPagination(query, { defaultLimit: 12 });
  const cacheKey = cache.key('packages', [JSON.stringify(query)]);
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const { rows, count } = await repository.listPackages({
    destinationSlug: query.destination,
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
    minDays: query.minDays,
    maxDays: query.maxDays,
    search: query.search,
    featured: query.featured === undefined ? undefined : query.featured === 'true' || query.featured === true,
    sort: query.sort,
    limit,
    offset,
  });

  const result = {
    items: rows.map(publicPackage),
    meta: buildMeta({ page, limit, total: count }),
  };
  await cache.set(cacheKey, result, CACHE_TTL);
  return result;
}

async function getPackage(slug) {
  const pkg = await repository.findPackageBySlug(slug);
  if (!pkg) throw new NotFoundError('Package');
  const reviews = await ratingsSummary('PACKAGE', pkg.id);
  return { ...publicPackage(pkg), reviews };
}

async function getBlogs(query) {
  const { page, limit, offset } = getPagination(query, { defaultLimit: 9 });
  const { rows, count } = await repository.listBlogs({ limit, offset });
  return {
    items: rows.map((blog) => ({
      id: blog.id,
      slug: blog.slug,
      title: blog.title,
      titleBn: blog.title_bn,
      excerpt: blog.excerpt,
      coverImage: blog.cover_image,
      author: blog.author_name,
      publishedAt: blog.published_at,
    })),
    meta: buildMeta({ page, limit, total: count }),
  };
}

async function getBlog(slug) {
  const blog = await repository.findBlogBySlug(slug);
  if (!blog || blog.status !== 'PUBLISHED') throw new NotFoundError('Blog post');
  return {
    id: blog.id,
    slug: blog.slug,
    title: blog.title,
    titleBn: blog.title_bn,
    excerpt: blog.excerpt,
    content: blog.content,
    coverImage: blog.cover_image,
    author: blog.author_name,
    publishedAt: blog.published_at,
  };
}

async function search(query) {
  const term = String(query.q || '').trim();
  if (term.length < 2) throw new BusinessRuleError('Search term must be at least 2 characters', 'SEARCH_TERM_TOO_SHORT');
  const [results, hotelsTotal, guidesTotal] = await Promise.all([
    repository.searchAll(term, 6),
    models.Hotel.count({ where: { status: 'PUBLISHED' } }),
    models.Guide.count({ where: { status: 'ACTIVE' } }),
  ]);
  return {
    query: term,
    destinations: results.destinations,
    packages: results.packages,
    hotels: results.hotels,
    guides: results.guides,
    totals: {
      destinations: results.destinations.length,
      packages: results.packages.length,
      hotels: results.hotels.length,
      guides: results.guides.length,
      hotelsAvailable: hotelsTotal,
      guidesAvailable: guidesTotal,
    },
  };
}

// ---------------------------------------------------------------- admin writes

async function createDestination(payload) {
  const slug = await uniqueSlug(payload.name, async (candidate) =>
    Boolean(await models.Destination.findOne({ where: { slug: candidate } }))
  );
  const destination = await models.Destination.create({
    district_id: payload.districtId,
    category_id: payload.categoryId || null,
    name: payload.name,
    name_bn: payload.nameBn || null,
    slug,
    summary: payload.summary,
    description: payload.description,
    cover_image: payload.coverImage,
    gallery: payload.gallery || [],
    latitude: payload.latitude,
    longitude: payload.longitude,
    travel_info: payload.travelInfo,
    best_season: payload.bestSeason,
    estimated_duration_hours: payload.estimatedDurationHours,
    entry_fee: payload.entryFee || 0,
    status: payload.status || 'PUBLISHED',
    is_featured: Boolean(payload.featured),
  });
  await invalidateCatalogCache();
  return destination;
}

async function updateDestination(id, payload) {
  const destination = await models.Destination.findByPk(id);
  if (!destination) throw new NotFoundError('Destination');
  const map = {
    district_id: payload.districtId,
    category_id: payload.categoryId,
    name: payload.name,
    name_bn: payload.nameBn,
    summary: payload.summary,
    description: payload.description,
    cover_image: payload.coverImage,
    gallery: payload.gallery,
    latitude: payload.latitude,
    longitude: payload.longitude,
    travel_info: payload.travelInfo,
    best_season: payload.bestSeason,
    estimated_duration_hours: payload.estimatedDurationHours,
    entry_fee: payload.entryFee,
    status: payload.status,
    is_featured: payload.featured,
  };
  const updates = Object.fromEntries(Object.entries(map).filter(([, v]) => v !== undefined));
  await destination.update(updates);
  if (payload.name && payload.name !== destination.name) {
    await destination.update({
      slug: await uniqueSlug(payload.name, async (candidate) =>
        Boolean(await models.Destination.findOne({ where: { slug: candidate, id: { [Op.ne]: destination.id } } }))
      ),
    });
  }
  await invalidateCatalogCache();
  return destination;
}

async function archiveDestination(id) {
  const destination = await models.Destination.findByPk(id);
  if (!destination) throw new NotFoundError('Destination');
  await destination.update({ status: 'ARCHIVED' });
  await invalidateCatalogCache();
  return { archived: true };
}

async function savePackage(id, payload) {
  const isCreate = !id;
  let slug;
  if (isCreate) {
    slug = payload.slug
      ? payload.slug
      : await uniqueSlug(payload.title, async (candidate) => Boolean(await models.Package.findOne({ where: { slug: candidate } })));
  } else if (payload.slug) {
    slug = payload.slug;
  }

  const data = {
    ...(slug ? { slug } : {}),
    title: payload.title,
    title_bn: payload.titleBn || null,
    summary: payload.summary,
    description: payload.description,
    cover_image: payload.coverImage,
    gallery: payload.gallery || [],
    duration_days: payload.durationDays,
    duration_nights: payload.durationNights,
    base_price_per_person: payload.pricePerPerson,
    child_price_per_person: payload.childPrice || null,
    max_capacity: payload.maxCapacity,
    min_participants: payload.minParticipants || 1,
    includes: payload.includes || [],
    excludes: payload.excludes || [],
    highlights: payload.highlights || [],
    cancellation_policy: payload.cancellationPolicy,
    status: payload.status || 'DRAFT',
    is_featured: Boolean(payload.featured),
  };

  return sequelize.transaction(async (transaction) => {
    let pkg;
    if (id) {
      pkg = await models.Package.findByPk(id, { transaction });
      if (!pkg) throw new NotFoundError('Package');
      await pkg.update(data, { transaction });
      await models.PackageItinerary.destroy({ where: { package_id: pkg.id }, transaction });
      await models.PackageDestination.destroy({ where: { package_id: pkg.id }, transaction });
    } else {
      pkg = await models.Package.create(data, { transaction });
    }

    if (payload.itineraries?.length) {
      await models.PackageItinerary.bulkCreate(
        payload.itineraries.map((day, index) => ({
          package_id: pkg.id,
          day_number: day.day || index + 1,
          title: day.title,
          description: day.description,
          meals_included: day.meals || [],
          accommodation: day.accommodation,
        })),
        { transaction }
      );
    }
    if (payload.destinationIds?.length) {
      await models.PackageDestination.bulkCreate(
        payload.destinationIds.map((destinationId) => ({ package_id: pkg.id, destination_id: destinationId })),
        { transaction }
      );
    }
    if (payload.departures?.length) {
      for (const departure of payload.departures) {
        await models.PackageDeparture.findOrCreate({
          where: { package_id: pkg.id, start_date: departure.startDate },
          defaults: {
            package_id: pkg.id,
            start_date: departure.startDate,
            end_date: departure.endDate,
            capacity: departure.capacity,
            price_override: departure.price || null,
            status: 'SCHEDULED',
          },
          transaction,
        });
      }
    }

    await invalidateCatalogCache();
    return pkg;
  });
}

async function invalidateCatalogCache() {
  await cache.delPrefix('destinations:');
  await cache.delPrefix('packages:');
}

module.exports = {
  getDestinations,
  getDestination,
  getDestinationMeta,
  getPackages,
  getPackage,
  getBlogs,
  getBlog,
  search,
  createDestination,
  updateDestination,
  archiveDestination,
  savePackage,
  invalidateCatalogCache,
  publicPackage,
  publicDestination,
};
